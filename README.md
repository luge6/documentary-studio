# Documentary Video Studio

A Claude Code skill that turns a topic into a finished 8-12 minute, 16:9, 1080p 3D documentary for YouTube.
You record the narration; the skill writes the script, plans every shot, aligns the visuals to your voice,
renders real-time 3D scenes (Three.js), and adds music, sound design, chapters, subtitles and a thumbnail.

## Install as a skill
```bash
git clone <this repo> ~/documentary-studio
mkdir -p ~/.claude/skills && ln -sfn ~/documentary-studio ~/.claude/skills/documentary-video
bash ~/documentary-studio/scripts/setup.sh
```
Then ask Claude: "make a documentary video about ..." - see `SKILL.md` for the full workflow.

## Layout
- `SKILL.md` - workflow Claude follows
- `references/` - shot types and script-writing guide
- `engine/` - the 3D renderer (Three.js, runs in headless Chromium)
- `scripts/` - export_script, transcribe (Whisper), align, render, sound
- `projects/windover/` - "168 Bodies Found in a Florida Pond..." script, shot plan and sources
