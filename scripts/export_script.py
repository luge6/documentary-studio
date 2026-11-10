#!/usr/bin/env python3
"""Validate shots.json and write the recording script (script.md) for the narrator.

usage: export_script.py <project_dir>
"""
import os, sys, textwrap
sys.path.insert(0, os.path.dirname(__file__))
from common import *

proj = project_dir(sys.argv)
path = os.path.join(proj, "shots.json")
if not os.path.exists(path): die("shots.json not found")
S = load_json(path)

problems, warnings = [], []
if not S.get("chapters"): problems.append("no chapters")
n_words = 0; n_cards = 0; n_beats = 0
for ci, bi, ch, b in beats(S):
    n_beats += 1
    where = f"chapter {ci} '{ch.get('title', '')}' beat {bi}"
    say = (b.get("say") or "").strip()
    if not say: problems.append(f"{where}: empty 'say'")
    wc = len(say.split()); n_words += wc
    if wc > 45: warnings.append(f"{where}: {wc} words on one shot (~{wc / WPM * 60:.0f}s) - consider splitting")
    shot = b.get("shot") or {}
    t = shot.get("type")
    if t not in SHOT_TYPES: problems.append(f"{where}: unknown shot type {t!r} (valid: {', '.join(SHOT_TYPES)})")
    else:
        for f in SHOT_TYPES[t]:
            if f not in shot: problems.append(f"{where}: {t} shot needs '{f}'")
    if t == "artifact" and not (shot.get("object") or shot.get("model")): problems.append(f"{where}: artifact needs 'object' or 'model'")
    if t == "photo" and shot.get("src") and not os.path.exists(os.path.join(proj, shot["src"])): warnings.append(f"{where}: image {shot['src']} not found (a generated scene will be used)")
for ch in S.get("chapters", []):
    if ch.get("card", True) and ch.get("num") is not None: n_cards += 1

minutes = n_words / WPM + n_cards * CARD_SECONDS / 60
print(f"{len(S.get('chapters', []))} chapters, {n_beats} shots, {n_words} words -> ~{minutes:.1f} min at {WPM} wpm")
if not 8 <= minutes <= 12.5: warnings.append(f"estimated length {minutes:.1f} min is outside the 8-12 min target")
for w in warnings: print("WARN:", w)
if problems:
    for p in problems: print("ERROR:", p)
    sys.exit(1)

# ---- script.md for recording ----
out = [f"# {S.get('title', 'Untitled')}", "",
       f"*Recording script - about {n_words:,} words, roughly {minutes:.0f} minutes at a calm documentary pace.*", "",
       "> **How to record:** read only the normal text. Headings in [brackets] are chapter cards - do not read them,",
       "> just leave a short breath before starting each new chapter. Record in one take or several, but export a",
       "> single file named `voiceover.wav` (or .mp3). Small changes and ad-libs are fine - the edit follows your actual words.", ""]
for ch in S["chapters"]:
    head = ch.get("title", "")
    if ch.get("num") is not None and ch.get("card", True):
        out += ["", f"## [Chapter {ch['num']} - {head}]", ""]
    else:
        out += ["", f"## [{head or 'Cold open'}]", ""]
    para = []
    for i, b in enumerate(ch.get("beats", [])):
        para.append(b["say"].strip())
        if len(" ".join(para).split()) > 70 or b.get("break"):
            out += [textwrap.fill(" ".join(para), 100), ""]; para = []
    if para: out += [textwrap.fill(" ".join(para), 100), ""]
with open(os.path.join(proj, "script.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(out).strip() + "\n")
print("wrote", os.path.join(proj, "script.md"))
