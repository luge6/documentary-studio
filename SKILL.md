---
name: documentary-video
description: Make complete 8-12 minute 3D documentary YouTube videos (forensic / history / mystery style) from a topic or a script. Use when the user asks to "make a documentary video", "write a documentary script", "turn this topic into a YouTube video", "I recorded the voiceover", "render the video", or wants 3D evidence boards, X-ray scans, artifacts, maps and timelines narrated over their own voice. Phase 1 researches and writes the script with a shot plan and stops for the user's recording; phase 2 takes the user's voiceover and produces the finished 16:9 1080p MP4 with music, sound design, chapters, subtitles and a thumbnail.
---

# Documentary Video Studio

Turns a topic into a finished 16:9, 1080p, 24 fps, 8-12 minute documentary. **The user records the narration.**
Every visual is a real-time 3D scene (Three.js rendered in headless Chromium): evidence boards, parchment on a desk
with a rubber stamp, extruded gold numbers and titles, X-ray skeletons, museum artifacts, relief maps, terrain
flyovers, timelines, molecules. Music and sound design are generated and synced to what is on screen.

`$SKILL` below means this skill's directory. A project is a folder (e.g. `~/docs/<slug>/`).

## Phase 0 - setup (once per machine/session)
```bash
bash $SKILL/scripts/setup.sh
```
Installs Three.js and faster-whisper and checks ffmpeg/Chromium. Whisper downloads its model from Hugging Face on
first use (hosts `huggingface.co`, `cas-bridge.xethub.hf.co`, `cas-server.xethub.hf.co`, `us.aws.cdn.hf.co`); if a
download is blocked, those hosts must be allowed in the environment's network settings.

## Phase 1 - research and script  (then STOP)
1. Agree the topic and angle. If the user gave a script, use it verbatim as the narration and only plan shots.
2. Research (web search) per `references/script-guide.md`; save `sources.md` in the project.
3. Write `<project>/shots.json` - the single source of truth for narration *and* visuals:
   ```json
   {"title": "...", "fps": 24, "subtitles": false, "music": "auto",
    "chapters": [
      {"title": "Cold open", "beats": [ {"say": "...", "shot": {"type": "landscape", ...}} ]},
      {"num": 1, "title": "The Body in the Ice", "subtitle": "Ötztal Alps, 1991", "beats": [ ... ]}
    ]}
   ```
   Chapters with `num` get a 3D chapter card and an automatic pause in the audio; the cold open has no `num`.
   Shot types and every field: `references/shots.md`. Writing rules and pacing: `references/script-guide.md`.
   Example: `examples/iceman/shots.json`.
4. Validate and produce the recording script:
   ```bash
   python3 $SKILL/scripts/export_script.py <project>
   ```
   Fix every ERROR; get the estimate into 8-12 minutes.
5. Give the user `script.md` (send the file) with recording tips: quiet room, consistent distance from the mic,
   calm documentary pace, a breath between chapters, one file `voiceover.wav`/`.mp3`. Then **stop and wait** for the
   recording. Do not render anything before the voiceover exists.

## Phase 2 - voiceover to finished video
When the user provides the recording, save it as `<project>/voiceover.<ext>` and run, in order:

```bash
python3 $SKILL/scripts/transcribe.py <project>          # word timestamps -> words.json (~1/4 of real time)
python3 $SKILL/scripts/align.py <project>               # beats -> real timing -> timeline.json, subtitles.srt, chapters.txt
node $SKILL/scripts/render.mjs <project> --sheet        # QC: one frame per shot -> qc/sheet_XX.png
```
- Read `align.py` output: the match rate should be > 80 %. Warnings name beats that were skipped/ad-libbed (their
  timing is interpolated) and shots that run long (> 14 s) - split those beats in `shots.json` and re-run `align.py`.
- **Look at every contact sheet** (Read the PNGs). Check text fits, nothing is cut off, the right shot is on the
  right line. Fix `shots.json` and re-run align + sheet until clean. Show the user a sheet or two.
- Optional preview of a section: `node $SKILL/scripts/render.mjs <project> --range 60-90` -> `build/preview.mp4`.

Full render (long - run it in the background and monitor `render.log`):
```bash
node $SKILL/scripts/render.mjs <project> --workers 4 > <project>/render.log 2>&1
python3 $SKILL/scripts/sound.py <project>               # voice + music + SFX, ducking, -14 LUFS -> final.mp4
```
Render speed on a 4-core cloud machine is about 4-5 frames/s: **a 10-minute video takes roughly 50-60 minutes.**
Tell the user before starting. `--quality "scale=1"` renders the 3D at full 1080p (about 1.5x slower);
`--quality "aa=0&scale=0.5"` is a fast draft.

Music: generated ambient score that changes key per chapter (default). To use the user's own licensed track:
`"music": "assets/track.mp3"` in shots.json or `sound.py <project> --music file.mp3`; level with `--music-db -17`.

## Phase 3 - YouTube package
- Thumbnail: pick the most dramatic shot index from the contact sheet, then
  `node $SKILL/scripts/render.mjs <project> --thumb <shotIndex> "LINE ONE|LINE TWO" ACCENTWORD` -> `thumbnail.png`
  (2-4 big words; the accent word turns red).
- Write `youtube.md` in the project: 3 title options (< 60 chars, curiosity + specificity), description (hook
  paragraph, the contents of `chapters.txt` verbatim, sources from `sources.md`), 10-15 tags.
- Deliver: `final.mp4`, `thumbnail.png`, `subtitles.srt` (upload as captions), `youtube.md`. Send the files to the user.

## Troubleshooting
- `PAGE ERROR` from render.mjs: a shot's data is malformed - the message names the function; fix that beat.
- Text too long for a shot: shorten it (statements <= 14 words, labels <= 6 words, documents <= 80 words).
- Low match rate: the user read a different script - re-transcribe with `--model medium.en` for accuracy, or
  update `say` texts to what was actually recorded.
- The container is temporary: keep projects and this skill in a git repo, or download `final.mp4` promptly.
