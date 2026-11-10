#!/usr/bin/env python3
"""Prepare footage for `footage` shots: download clips, extract graded-ready frames, write timing into timeline.json.

usage: footage.py <project_dir>      (run after align.py, before render.mjs)
needs  <project>/assets/clips.json : {"clipId": {"url": ".../x.mp4" | "file": "assets/clips/x.mp4", "credit", "source", "ai"}}
shot   {"type": "footage", "clips": ["clipId", {"id": "clipId", "start": 3, "caption": "...", "sub": "..."}], "overlay": {...}}
writes frames to assets/frames/sNNN_K/f_00001.jpg, data.segs into timeline.json, credits.md
"""
import os, sys, json, subprocess, urllib.request, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(__file__))
from common import *

proj = project_dir(sys.argv)
FPS = 24
reg = load_json(os.path.join(proj, "assets", "clips.json"))
TL = load_json(os.path.join(proj, "timeline.json"))
clipdir = os.path.join(proj, "assets", "clips"); os.makedirs(clipdir, exist_ok=True)

def clip_path(cid):
    r = reg.get(cid) or die(f"clip '{cid}' is not in assets/clips.json")
    if r.get("file"): p = os.path.join(proj, r["file"])
    else:
        p = os.path.join(clipdir, cid + ".mp4")
        if not os.path.exists(p):
            req = urllib.request.Request(r["url"], headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as resp, open(p + ".part", "wb") as f: f.write(resp.read())
            os.replace(p + ".part", p)
    if not os.path.exists(p): die(f"clip file missing: {p}")
    return p

def duration(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout.strip() or 0)

jobs, used = [], {}
for si, sh in enumerate(TL["shots"]):
    if sh["type"] != "footage": continue
    d = sh["data"]; specs = [c if isinstance(c, dict) else {"id": c} for c in d.get("clips", [])]
    if not specs: die(f"footage shot {si} has no clips")
    dur = sh["end"] - sh["start"]; n = len(specs); segs = []
    for k, c in enumerate(specs):
        t0, t1 = dur * k / n, dur * (k + 1) / n
        out = f"assets/frames/s{si:03d}_{k}"
        segs.append({"dir": out, "t0": round(t0, 3), "t1": round(t1, 3), "caption": c.get("caption"), "sub": c.get("sub")})
        jobs.append((si, k, c, t1 - t0 + (0.4 if k < n - 1 else 0.1), out))
        used[c["id"]] = reg[c["id"]]
    d["segs"] = segs

print(f"{len(jobs)} footage segments from {len(used)} clips")
for cid in used: clip_path(cid)

def extract(job):
    si, k, c, seglen, out = job
    p = clip_path(c["id"]); L = duration(p)
    start = c.get("start", 0.5 if not reg[c["id"]].get("ai") else 0.0)
    start = min(start, max(0.0, L - 1.0)); avail = max(0.5, L - start)
    factor = min(3.0, max(1.0, seglen / avail))
    full = os.path.join(proj, out); os.makedirs(full, exist_ok=True)
    for f in os.listdir(full): os.remove(os.path.join(full, f))
    vf = f"setpts={factor:.4f}*PTS,fps={FPS},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-i", p, "-t", f"{seglen / factor + 0.1:.2f}", "-vf", vf, "-an", "-q:v", "4", os.path.join(full, "f_%05d.jpg")], check=True)
    return si, k, len(os.listdir(full)), factor

with cf.ThreadPoolExecutor(4) as ex:
    for si, k, nf, factor in ex.map(extract, jobs):
        seg = TL["shots"][si]["data"]["segs"][k]; seg["n"] = nf
        if nf == 0: die(f"no frames extracted for shot {si} seg {k}")
        if factor > 1.01: print(f"  shot {si} seg {k}: slowed x{factor:.2f}")
save_json(os.path.join(proj, "timeline.json"), TL)

lines = ["# Footage credits", "", "Stock footage from Pexels (free license). Thank you to:", ""]
for cid, r in sorted(used.items(), key=lambda x: x[1].get("credit", "")):
    if not r.get("ai"): lines.append(f"- {r['credit']} — {r['source']}")
if any(r.get("ai") for r in used.values()): lines += ["", "Scenes labeled \"Dramatization\" are AI-generated reconstructions."]
open(os.path.join(proj, "credits.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("frames ready; credits.md written")
