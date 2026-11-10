#!/usr/bin/env python3
"""Align shots.json beats to the real voiceover (words.json) and build timeline.json.

usage: align.py <project_dir>
writes timeline.json, subtitles.srt, chapters.txt
"""
import os, sys, difflib
sys.path.insert(0, os.path.dirname(__file__))
from common import *

proj = project_dir(sys.argv)
S = load_json(os.path.join(proj, "shots.json"))
WJ = load_json(os.path.join(proj, "words.json"))
words = WJ["words"]; vdur = WJ["duration"]
if not words: die("words.json has no words")
FPS = S.get("fps", 24)
LEAD = 0.12       # cut slightly before the first word of a beat
TAIL = 2.5        # hold after the last word

# ---- token streams ----
s_tok, s_beat = [], []           # script tokens and which beat they belong to
beat_list = list(beats(S))
for k, (ci, bi, ch, b) in enumerate(beat_list):
    for t in norm_tokens(b.get("say", "")):
        s_tok.append(t); s_beat.append(k)
t_tok, t_word = [], []           # transcript tokens -> word index
for wi, w in enumerate(words):
    for t in norm_tokens(w["w"]):
        t_tok.append(t); t_word.append(wi)

sm = difflib.SequenceMatcher(None, s_tok, t_tok, autojunk=False)
s2t = {}
for a, b, n in sm.get_matching_blocks():
    for j in range(n): s2t[a + j] = b + j
matched = len(s2t) / max(1, len(s_tok))
print(f"matched {matched:.0%} of script words to the recording")
if matched < 0.6: print("WARN: low match - was the right script read? Timing falls back to interpolation where words are missing.")

# ---- beat start times (source audio seconds) ----
nB = len(beat_list); starts = [None] * nB; first_word = [None] * nB
for k in range(nB):
    idx = [i for i, bb in enumerate(s_beat) if bb == k]
    for off, i in enumerate(idx):
        if i in s2t:
            wi = t_word[s2t[i]]
            starts[k] = max(0.0, words[wi]["start"] - off * 0.32); first_word[k] = wi if off == 0 else None
            break
# interpolate beats with no match
known = [k for k in range(nB) if starts[k] is not None]
if not known: die("could not match any script words to the recording")
for k in range(nB):
    if starts[k] is None:
        prev = max([j for j in known if j < k], default=None); nxt = min([j for j in known if j > k], default=None)
        a = starts[prev] if prev is not None else 0.0; b = starts[nxt] if nxt is not None else words[-1]["end"]
        pa = prev if prev is not None else -1; pb = nxt if nxt is not None else nB
        starts[k] = a + (b - a) * (k - pa) / (pb - pa)
        print(f"WARN: beat {k} ('{beat_list[k][3]['say'][:40]}...') not found in recording - timing interpolated")
starts[0] = 0.0
for k in range(1, nB): starts[k] = max(starts[k], starts[k - 1] + 0.6)

# ---- chapter gaps: cut the audio in the pause before each carded chapter ----
gap_src = []   # (source time of the cut, gap seconds, chapter)
first_beat_of = {}
for k, (ci, bi, ch, b) in enumerate(beat_list):
    if bi == 0: first_beat_of[ci] = k
for ci, ch in enumerate(S["chapters"]):
    if ch.get("num") is None or not ch.get("card", True) or ci not in first_beat_of: continue
    k = first_beat_of[ci]; t = starts[k]
    # find the silence before this beat's first word
    before = [w for w in words if w["start"] < t - 0.02]
    if before: pe = before[-1]["end"]; cut = (pe + t) / 2 if pe < t else t - 0.03
    else: cut = max(0.0, t - 0.2)
    if k == 0: cut = 0.0
    gap_src.append((cut, ch.get("cardSeconds", CARD_SECONDS), ci))

def to_out(t):
    return t + sum(g for c, g, _ in gap_src if c <= t + 1e-6)

pieces, cur, out = [], 0.0, 0.0
for c, g, _ in gap_src:
    if c > cur: pieces.append([round(cur, 4), round(c, 4), round(out, 4)]); out += c - cur
    out += g; cur = c
pieces.append([round(cur, 4), round(vdur, 4), round(out, 4)]); out += vdur - cur
total = round(out + TAIL, 3)

# ---- shots ----
out_words = [{"w": w["w"], "t": to_out(w["start"]), "e": to_out(w["end"])} for w in words]
shots = []
gap_by_ch = {ci: (c, g) for c, g, ci in gap_src}
for k, (ci, bi, ch, b) in enumerate(beat_list):
    if bi == 0 and ci in gap_by_ch:
        c, g = gap_by_ch[ci]; cs = to_out(c) - g if c > 0 else 0.0
        if c == 0: cs = 0.0
        shots.append({"type": "chapter", "data": {"num": ch.get("num"), "title": ch.get("title", ""), "subtitle": ch.get("subtitle", "")}, "start": cs, "transition": "dip", "chapter": ci, "card": True})
        st = cs + g
        tr = "dip"
    else:
        st = max(0.0, to_out(starts[k]) - LEAD) if k else 0.0
        tr = b.get("transition", (b.get("shot") or {}).get("transition", "cut"))
    sh = dict(b["shot"]); typ = sh.pop("type"); sh.pop("transition", None)
    shots.append({"type": typ, "data": sh, "start": st, "transition": tr, "chapter": ci, "beat": k})
shots.sort(key=lambda s: s["start"])
for i, s in enumerate(shots):
    s["end"] = shots[i + 1]["start"] if i + 1 < len(shots) else total
    s["start"] = round(s["start"], 3); s["end"] = round(s["end"], 3)
    s["words"] = [{"w": w["w"], "t": round(w["t"] - s["start"], 3)} for w in out_words if s["start"] - 0.05 <= w["t"] < s["end"]]
shots = [s for s in shots if s["end"] - s["start"] > 0.05]
for i, s in enumerate(shots):
    d = s["end"] - s["start"]
    if s["type"] != "chapter" and d > 14: print(f"WARN: shot {i} ({s['type']}) lasts {d:.1f}s - split its beat for better pacing")
    if d < 1.2: print(f"WARN: shot {i} ({s['type']}) lasts only {d:.1f}s")

# ---- subtitles (.srt, for YouTube upload; burn-in optional) ----
subs, line = [], []
def flush():
    if line: subs.append({"start": round(line[0]["t"], 3), "end": round(line[-1]["e"] + 0.15, 3), "text": " ".join(x["w"] for x in line)})
for w in out_words:
    if line and (len(" ".join(x["w"] for x in line + [w])) > 42 or w["t"] - line[-1]["e"] > 0.7): flush(); line = []
    line.append(w)
    if w["w"][-1:] in ".?!": flush(); line = []
flush()
for i in range(len(subs) - 1): subs[i]["end"] = min(subs[i]["end"], subs[i + 1]["start"] - 0.02)
def ts(t): h, r = divmod(t, 3600); m, s = divmod(r, 60); return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}"
with open(os.path.join(proj, "subtitles.srt"), "w", encoding="utf-8") as f:
    for i, s in enumerate(subs, 1): f.write(f"{i}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n\n")

# ---- YouTube chapters ----
chap = [{"title": "Intro", "start": 0.0}]
for s in shots:
    if s.get("card"): chap.append({"title": s["data"]["title"], "start": s["start"]})
if len(chap) > 1 and chap[1]["start"] < 1: chap = chap[1:]
def mmss(t): return f"{int(t // 60)}:{int(t % 60):02d}"
with open(os.path.join(proj, "chapters.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(f"{mmss(c['start'])} {c['title']}" for c in chap) + "\n")

save_json(os.path.join(proj, "timeline.json"), {
    "title": S.get("title", ""), "fps": FPS, "duration": total, "burnSubtitles": bool(S.get("subtitles", False)),
    "voice": {"file": os.path.basename(find_voiceover(proj) or WJ.get("source", "")), "pieces": pieces},
    "chapters": chap, "shots": shots, "subtitles": subs,
})
print(f"timeline: {len(shots)} shots, {total / 60:.2f} min ({total:.1f}s) -> timeline.json, subtitles.srt, chapters.txt")
