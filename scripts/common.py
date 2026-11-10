"""Shared helpers for the documentary pipeline."""
import json, os, re, sys, glob, subprocess

SHOT_TYPES = {
    # type: required data fields
    "title": ["title"], "chapter": ["title"], "statement": ["text"], "number": ["value"],
    "board": ["cards"], "checklist": ["items"], "document": [], "quote": ["text"],
    "map": ["place"], "timeline": ["events"], "photo": [], "bars": ["items"],
    "xray": [], "artifact": [], "landscape": [], "molecule": [], "footage": ["clips"],
}
WPM = 150          # typical documentary narration pace
CARD_SECONDS = 3.5  # pause inserted for each chapter card


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr); sys.exit(1)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def project_dir(argv):
    if len(argv) < 2: die("usage: <script> <project_dir>")
    p = os.path.abspath(argv[1])
    if not os.path.isdir(p): die(f"no such project dir: {p}")
    return p


def find_voiceover(proj):
    for ext in ("wav", "mp3", "m4a", "aac", "flac", "ogg", "webm", "mp4", "mov"):
        hits = sorted(glob.glob(os.path.join(proj, f"voiceover*.{ext}")))
        if hits: return hits[0]
    return None


_num = re.compile(r"(?<=\d),(?=\d)")
def norm_tokens(text):
    """Lowercase word tokens; '5,300' -> '5300', hyphens split, punctuation dropped."""
    text = _num.sub("", str(text)).lower().replace("’", "'")
    text = re.sub(r"[-–—/]", " ", text)
    return [t for t in (re.sub(r"[^a-z0-9']", "", w).strip("'") for w in text.split()) if t]


def norm_word(w):
    t = norm_tokens(w)
    return t[0] if t else ""


def decode_audio(path, sr=48000):
    import numpy as np
    pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.float32).copy()


def beats(shots):
    """Yield (chapter_index, beat_index, chapter, beat) in order."""
    for ci, ch in enumerate(shots["chapters"]):
        for bi, b in enumerate(ch.get("beats", [])):
            yield ci, bi, ch, b


# --- the same cue/reveal timing rules the engine uses (engine/main.js makeS) ---
def make_s(shot):
    dur = shot["end"] - shot["start"]; words = shot.get("words", [])
    def cue(w, fb=None):
        k = norm_word(w)
        if not k: return fb
        for x in words:
            if norm_word(x["w"]) == k: return max(0, x["t"])
        for x in words:
            if norm_word(x["w"]).startswith(k): return max(0, x["t"])
        return fb
    def reveal(items, a, b):
        n = len(items); out = []
        for i, it in enumerate(items):
            c = cue(it.get("cue")) if isinstance(it, dict) and it.get("cue") else None
            out.append(c if c is not None else a * dur + (b * dur - a * dur) * (i / (n - 1) if n > 1 else 0))
        return out
    return dur, cue, reveal
