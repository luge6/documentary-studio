#!/usr/bin/env python3
"""Build the soundtrack (voice + music + sound design) and mux the final video.

usage: sound.py <project_dir> [--music path/to/track.mp3] [--music-db -20] [--no-mux]
needs  timeline.json, voiceover.*, build/video_silent.mp4 (unless --no-mux)
writes build/mix.wav and final.mp4
"""
import os, sys, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from common import *

proj = project_dir(sys.argv)
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
TL = load_json(os.path.join(proj, "timeline.json"))
SR = 48000; DUR = TL["duration"]; N = int(DUR * SR) + SR
rng = np.random.default_rng(7)
os.makedirs(os.path.join(proj, "build"), exist_ok=True)

# ---------------- voice ----------------
vo = find_voiceover(proj) or die("voiceover not found")
src = decode_audio(vo, SR)
voice = np.zeros(N, np.float32)
for a, b, o in TL["voice"]["pieces"]:
    seg = src[int(a * SR):int(b * SR)]; i = int(o * SR); j = min(N, i + len(seg)); voice[i:j] += seg[: j - i]
pk = np.max(np.abs(voice)) or 1.0; voice *= 0.89 / pk

# ---------------- helpers ----------------
def T(n): return np.arange(n, dtype=np.float32) / SR
def place(buf, clip, at, g=1.0):
    i = int(at * SR)
    if i >= N or i + len(clip) <= 0: return
    a = max(0, -i); i = max(0, i); j = min(N, i + len(clip) - a); buf[i:j] += clip[a:a + j - i] * g
def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); m = np.ones_like(f)
    if lo: m *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: m *= 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x)).astype(np.float32)
def noise(n, lo=None, hi=None): return fft_filter(rng.standard_normal(n).astype(np.float32), lo, hi)
def env_ar(n, att, rel):
    t = T(n); return np.minimum(1, t / max(att, 1e-4)) * np.exp(-np.maximum(0, t - att) / rel)
def boom(f0=80, f1=36, d=1.6, g=1.0):
    n = int(d * SR); t = T(n); f = f1 + (f0 - f1) * np.exp(-t * 7); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 2.6) * g).astype(np.float32)
def thud(): return boom(130, 60, 0.35, 1) + noise(int(0.35 * SR), hi=900) * env_ar(int(0.35 * SR), 0.002, 0.04) * 0.6
def click(d=0.012): n = int(d * SR); return (rng.standard_normal(n) * np.exp(-T(n) / 0.002)).astype(np.float32)
def whoosh(d=0.8, lo=400, hi=5000): n = int(d * SR); return noise(n, lo, hi) * np.sin(np.pi * T(n) / d) ** 2
def riser(d=1.6): n = int(d * SR); t = T(n); x = t / d; return noise(n, 1200, 9000) * x ** 2.2 * 0.5 + np.sin(2 * np.pi * np.cumsum(180 + 1500 * x ** 2) / SR) * x ** 3 * 0.15
def beep(f, d=0.08): n = int(d * SR); t = T(n); return (np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.01)).astype(np.float32)
def scratch(d=0.4): n = int(d * SR); return noise(n, 2500, 7000) * np.sin(np.pi * T(n) / d)
def shimmer(d=2.0):
    n = int(d * SR); t = T(n); out = np.zeros(n, np.float32)
    for f in (1318, 1568, 1976, 2637): out += np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t * 1.6)
    return out * np.minimum(1, t / 0.3) * 0.25

# ---------------- sound design from the shot list ----------------
sfx = np.zeros(N, np.float32); bed = np.zeros(N, np.float32)
for i, sh in enumerate(TL["shots"]):
    s0, s1 = sh["start"], sh["end"]; d = sh.get("data", {}); typ = sh["type"]
    dur, cue, reveal = make_s(sh)
    if typ == "title": place(sfx, boom(70, 30, 2.5), s0 + 0.2, 0.8); place(sfx, shimmer(2.5), s0 + 0.3, 0.5)
    elif typ == "chapter":
        place(sfx, riser(1.5), s0 - 1.5, 0.35); place(sfx, boom(90, 34, 2.2), s0 + 0.3, 0.75); place(sfx, whoosh(1.2, 200, 2000), s0 + 0.2, 0.25)
    elif typ == "board":
        place(sfx, whoosh(0.6, 600, 4000), s0, 0.12)
        for t in reveal(d.get("cards", []), 0.03, 0.7): place(sfx, thud(), s0 + t + 0.25, 0.35)
        for t in reveal(d.get("cards", []), 0.03, 0.7):
            for k in range(30):
                if rng.random() < 0.6: place(sfx, click(), s0 + t + 0.25 + k * 0.045, 0.05)
    elif typ == "checklist":
        items = d.get("items", []); place(sfx, whoosh(0.5, 800, 4000), s0, 0.1)
        for j, it in enumerate(items):
            if it.get("mark", "check") == "none": continue
            mt = (cue(it["markCue"]) if it.get("markCue") else None)
            mt = mt if mt is not None else dur * 0.45 + (dur * 0.27) * (j / (len(items) - 1) if len(items) > 1 else 0)
            place(sfx, scratch(0.4), s0 + mt, 0.12)
        if d.get("stamp"):
            st = cue(d["stamp"].get("cue"), dur * 0.8) if d["stamp"].get("cue") else dur * 0.8
            place(sfx, boom(110, 50, 0.6), s0 + st, 0.6); place(sfx, click(0.03), s0 + st, 0.5)
    elif typ == "document": place(sfx, whoosh(0.7, 900, 6000), s0, 0.12)
    elif typ == "quote": place(sfx, boom(55, 40, 2.5), s0 + 0.1, 0.25)
    elif typ == "statement":
        place(sfx, boom(70, 38, 1.8), s0 + 0.05, 0.35)
        toks = str(d.get("text", "")).split(); step = min(0.16, dur * 0.35 / max(1, len(toks)))
        emph = {norm_word(w) for w in d.get("emphasis", [])}
        hits = [0.15 + i * step for i, w in enumerate(toks) if norm_word(w) in emph]
        if hits: place(sfx, boom(95, 40, 1.2), s0 + hits[0], 0.4)
    elif typ == "number":
        end = max(0.6, dur * 0.55); t = 0.15; step = 0.05
        while t < end: place(sfx, click(0.006), s0 + t, 0.09); step *= 1.06; t += step
        place(sfx, boom(100, 50, 0.8), s0 + end, 0.35)
    elif typ == "map":
        place(sfx, whoosh(1.4, 150, 1500), s0, 0.25); pt = cue(d["cue"], dur * 0.35) if d.get("cue") else dur * 0.35
        place(sfx, thud(), s0 + pt, 0.4); place(sfx, beep(1760, 0.25) * env_ar(int(0.25 * SR), 0.003, 0.08), s0 + pt + 0.05, 0.12)
    elif typ == "timeline":
        for t in reveal(d.get("events", []), 0.03, 0.75): place(sfx, thud(), s0 + t + 0.3, 0.3); place(sfx, whoosh(0.5, 300, 3000), s0 + t, 0.08)
    elif typ == "photo": place(sfx, click(0.02), s0 + 0.05, 0.3); place(sfx, whoosh(0.6, 800, 5000), s0, 0.08)
    elif typ == "bars":
        for k, t in enumerate(reveal(d.get("items", []), 0.05, 0.6)):
            n = int(0.9 * SR); tt = T(n); place(sfx, np.sin(2 * np.pi * np.cumsum(220 + k * 40 + 300 * tt / 0.9) / SR) * env_ar(n, 0.05, 0.5) * 0.3, s0 + t)
    elif typ == "xray":
        n = int(dur * SR); tt = T(n); hum = (np.sin(2 * np.pi * 120 * tt) + 0.4 * np.sin(2 * np.pi * 240 * tt)) * np.minimum(1, tt / 0.3) * np.minimum(1, (dur - tt) / 0.2)
        place(sfx, hum.astype(np.float32), s0, 0.035)
        sw = min(1.6, dur * 0.5); t = 0.1
        while t < sw: place(sfx, beep(1320, 0.07), s0 + t, 0.06); t += 0.4
        if d.get("marker", True) is not False:
            ht = cue(d["cue"], dur * 0.55) if d.get("cue") else dur * 0.55
            for k in range(3): place(sfx, beep(1860, 0.09), s0 + ht + k * 0.18, 0.09)
    elif typ == "artifact": place(sfx, whoosh(1.6, 100, 1200), s0, 0.25); place(sfx, shimmer(1.8), s0 + 0.3, 0.12)
    elif typ == "molecule": place(sfx, shimmer(2.2), s0 + 0.1, 0.25)
    elif typ == "footage":
        ov = d.get("overlay") or {}
        if ov.get("kind") == "number":
            end = max(0.8, dur * 0.5); t = 0.2; step = 0.05
            while t < end: place(sfx, click(0.006), s0 + t, 0.08); step *= 1.06; t += step
            place(sfx, boom(100, 50, 0.8), s0 + end, 0.35)
        elif ov.get("kind") == "statement": place(sfx, boom(70, 38, 1.8), s0 + 0.15, 0.3)
        elif ov.get("kind") == "hud":
            n = int(dur * SR); tt = T(n); place(sfx, ((np.sin(2 * np.pi * 120 * tt) * np.minimum(1, tt / 0.3) * np.minimum(1, (dur - tt) / 0.2))).astype(np.float32), s0, 0.03)
            for k in range(3): place(sfx, beep(1860, 0.09), s0 + dur * 0.3 + k * 0.18, 0.08)
        if i > 0 and TL["shots"][i - 1]["type"] != "footage": place(sfx, whoosh(0.6, 300, 3000), s0 - 0.2, 0.08)
    elif typ == "landscape":
        n = int((s1 - s0) * SR); w = noise(n, 60, 700) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.2 * T(n))) * np.minimum(1, T(n) / 0.6) * np.minimum(1, (s1 - s0 - T(n)) / 0.6)
        place(bed, w, s0, 0.12)

# ---------------- music ----------------
_cfg = load_json(os.path.join(proj, "shots.json")) if os.path.exists(os.path.join(proj, "shots.json")) else {}
music_file = arg("--music") or (os.path.join(proj, _cfg["music"]) if _cfg.get("music") not in (None, "", "auto") else None)
if music_file and os.path.exists(music_file):
    m = decode_audio(music_file, SR); reps = int(np.ceil(N / len(m))); music = np.tile(m, reps)[:N]
    fade = int(3 * SR); music[-fade:] *= np.linspace(1, 0, fade); music = music / (np.max(np.abs(music)) or 1)
else:
    music = np.zeros(N, np.float32)
    ROOTS = [55.0, 43.65, 49.0, 41.2, 46.25, 51.91, 38.89]   # A, F, G, E, F#, G#, D#  (minor moods)
    bounds = [c["start"] for c in TL.get("chapters", [])] or [0.0]
    bounds = sorted(set([0.0] + bounds)); bounds.append(DUR)
    PENTA = [0, 3, 5, 7, 10, 12, 15]
    for k in range(len(bounds) - 1):
        a, b = bounds[k], bounds[k + 1]; L = b - a + 2.0; n = int(L * SR); t = T(n); r0 = ROOTS[k % len(ROOTS)]
        x = np.zeros(n, np.float32)
        # drone
        for mul, amp in ((1, 1.0), (1.5, 0.5), (2, 0.35), (3, 0.12)): x += amp * np.sin(2 * np.pi * r0 * mul * t + k)
        x *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t + k)
        # pad: minor triad, detuned
        pad = np.zeros(n, np.float32)
        for semi in (0, 3, 7, 12):
            f = r0 * 4 * 2 ** (semi / 12)
            for det in (-0.3, 0.3): pad += np.sin(2 * np.pi * (f + det) * t + rng.random() * 6)
        pad = fft_filter(pad, hi=900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t - 1.5)) * 0.18
        x += pad
        # sparse plucks
        tt = rng.uniform(1.5, 4)
        while tt < L - 3:
            f = r0 * 8 * 2 ** (PENTA[rng.integers(len(PENTA))] / 12); m = int(3.5 * SR); u = T(m)
            note = (np.sin(2 * np.pi * f * u) + 0.3 * np.sin(4 * np.pi * f * u)) * np.exp(-u * 1.4) * np.minimum(1, u / 0.01)
            j = int(tt * SR); x[j:j + m] += note[: max(0, min(m, n - j))] * 0.22; tt += rng.uniform(2.5, 6.5)
        # tension pulse in later chapters
        if k >= 2:
            beat = boom(60, 45, 0.5, 1)
            for p in np.arange(1.0, L - 1, 1.6): j = int(p * SR); seg = beat[: max(0, min(len(beat), n - j))]; x[j:j + len(seg)] += seg * 0.25; j2 = j + int(0.28 * SR); seg2 = beat[: max(0, min(len(beat), n - j2))]; x[j2:j2 + len(seg2)] += seg2 * 0.15
        x += noise(n, 200, 2500) * 0.04
        fi = np.minimum(1, t / 1.5) * np.minimum(1, (L - t) / 1.5)
        place(music, (x * fi).astype(np.float32), a - (1.0 if k else 0))
    music /= (np.max(np.abs(music)) or 1)

# ---------------- ducking + mix ----------------
def smooth(x, w):
    c = np.cumsum(np.insert(x.astype(np.float64), 0, 0)); y = (c[w:] - c[:-w]) / w; out = np.empty(len(x), np.float32); p = w // 2
    out[p:p + len(y)] = y; out[:p] = y[0]; out[p + len(y):] = y[-1]; return out
env = smooth(np.abs(voice), int(0.25 * SR))
duck = smooth(1 - 0.6 * np.clip(env / 0.04, 0, 1), int(0.3 * SR))
mdb = float(arg("--music-db", "-17")); mg = 10 ** (mdb / 20)
mix = voice + music * mg * duck + bed * duck + sfx * 0.55
tail = int(1.5 * SR); mix[-tail:] *= np.linspace(1, 0, tail)
mix = mix[: int(DUR * SR)]; mix /= max(1.0, np.max(np.abs(mix)) / 0.97)
raw = os.path.join(proj, "build", "mix_raw.wav"); wav = os.path.join(proj, "build", "mix.wav")
import wave
with wave.open(raw, "wb") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "2", wav], check=True)
print("mix ->", wav)
if "--no-mux" not in sys.argv:
    vid = os.path.join(proj, "build", "video_silent.mp4")
    if not os.path.exists(vid): die("build/video_silent.mp4 missing - run render.mjs first")
    final = os.path.join(proj, "final.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vid, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], check=True)
    print("final ->", final)
