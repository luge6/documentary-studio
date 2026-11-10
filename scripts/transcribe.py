#!/usr/bin/env python3
"""Word-level transcript of the user's voiceover with faster-whisper.

usage: transcribe.py <project_dir> [--model small.en]
writes <project>/words.json : {"duration": s, "words": [{"w","start","end"}...]}
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *

proj = project_dir(sys.argv)
model_name = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else "small.en"
vo = find_voiceover(proj)
if not vo: die("no voiceover.* file in project (expected voiceover.wav / .mp3 / .m4a ...)")
try:
    from faster_whisper import WhisperModel
except ImportError:
    die("faster-whisper missing: run scripts/setup.sh")

audio = decode_audio(vo, 16000)
dur = len(audio) / 16000
print(f"{os.path.basename(vo)}: {dur / 60:.1f} min - transcribing with {model_name} (about {dur / 4 / 60:.1f} min)...", flush=True)
t0 = time.time()
model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4)
# The script is used as a prompt so names and terms are spelled the way the script spells them.
prompt = None
sp = os.path.join(proj, "shots.json")
if os.path.exists(sp):
    S = load_json(sp)
    names = sorted({w for _, _, _, b in beats(S) for w in b.get("say", "").split() if w[:1].isupper()})
    prompt = " ".join(names)[:800] or None
segs, _ = model.transcribe(audio, word_timestamps=True, initial_prompt=prompt, vad_filter=False, beam_size=5)
words = []
last = 0
for s in segs:
    for w in s.words:
        words.append({"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
    if s.end - last > 60: print(f"  {s.end / 60:.1f} min", flush=True); last = s.end
save_json(os.path.join(proj, "words.json"), {"duration": round(dur, 3), "source": os.path.basename(vo), "words": words})
print(f"{len(words)} words in {time.time() - t0:.0f}s -> words.json")
