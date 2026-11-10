#!/usr/bin/env bash
# One-time setup for the documentary-video skill.
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SKILL"
[ -d node_modules/three ] || npm install --no-audit --no-fund three@0.170.0
python3 -c "import faster_whisper" 2>/dev/null || pip install -q faster-whisper
command -v ffmpeg >/dev/null || { echo "ffmpeg missing: install it (apt-get install -y ffmpeg)"; exit 1; }
node -e "require('playwright')" 2>/dev/null || node -e "require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright')" 2>/dev/null \
  || { echo "playwright missing: npm i -g playwright && npx playwright install chromium"; exit 1; }
fc-list | grep -qi "inter" || echo "note: Inter font not found - a fallback sans font will be used"
echo "documentary-video skill ready: $SKILL"
