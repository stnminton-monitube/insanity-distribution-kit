#!/bin/bash
# Double-click launcher for Media Distribution Toolkit (Mac)
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  # try the standard Node install location in case Terminal doesn't have it in PATH
  export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "  Node.js isn't installed yet."
  echo "  1. Go to  https://nodejs.org  and download the LTS version"
  echo "  2. Run the installer (keep clicking Continue)"
  echo "  3. Double-click this file again"
  echo ""
  read -p "Press Enter to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run — downloading components (one time, ~2 min)..."
  npm install || { echo "Install failed — check your internet connection and try again."; read -p "Press Enter to close..."; exit 1; }
fi

# Self-repair: newer npm blocks install scripts by default ("allow-scripts"),
# which leaves Electron and FFmpeg half-installed. Run their installers directly.
FW="node_modules/electron/dist/Electron.app/Contents/Frameworks"
if [ ! -d "$FW" ]; then
  echo "Repairing the Electron engine — downloading directly from electron's official releases (~100 MB)..."
  EV="31.7.7"
  EARCH="$(uname -m | sed 's/x86_64/x64/')"   # arm64 or x64
  EZIP="electron-v${EV}-darwin-${EARCH}.zip"
  BASE="https://github.com/electron/electron/releases/download/v${EV}"
  TMPD="$(mktemp -d)"
  curl -fSL -o "$TMPD/$EZIP" "$BASE/$EZIP" \
    || { echo "Download failed — check your internet connection and run this again."; read -p "Press Enter to close..."; exit 1; }
  curl -fsSL -o "$TMPD/SHASUMS256.txt" "$BASE/SHASUMS256.txt" \
    || { echo "Could not fetch checksums."; read -p "Press Enter to close..."; exit 1; }
  WANT="$(grep " \*$EZIP\$" "$TMPD/SHASUMS256.txt" | awk '{print $1}')"
  GOT="$(shasum -a 256 "$TMPD/$EZIP" | awk '{print $1}')"
  if [ -z "$WANT" ] || [ "$WANT" != "$GOT" ]; then
    echo "Checksum verification FAILED — not installing. Run this again."
    rm -rf "$TMPD"; read -p "Press Enter to close..."; exit 1
  fi
  echo "Checksum verified. Unpacking with macOS ditto..."
  rm -rf node_modules/electron/dist node_modules/electron/path.txt
  mkdir -p node_modules/electron/dist
  ditto -x -k "$TMPD/$EZIP" node_modules/electron/dist/ \
    || { echo "Unpack failed."; rm -rf "$TMPD"; read -p "Press Enter to close..."; exit 1; }
  rm -rf "$TMPD"
  printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt
  if [ ! -d "$FW" ]; then
    echo ""
    echo "Unpack completed but the engine still looks incomplete."
    echo "Please tell Claude: 'ditto unpack still incomplete'"
    read -p "Press Enter to close..."
    exit 1
  fi
  echo "Engine repaired and verified."
fi

# OCR engine (pure JS, no install scripts needed)
if [ ! -d node_modules/tesseract.js ]; then
  echo "Installing OCR engine (one time)..."
  npm install tesseract.js --no-audit --no-fund || echo "OCR install failed — the Verify step won't work until it succeeds."
fi

# Same for the bundled FFmpeg binary
if [ -d node_modules/ffmpeg-static ] && [ ! -f node_modules/ffmpeg-static/ffmpeg ]; then
  echo "Finishing the FFmpeg download..."
  ( cd node_modules/ffmpeg-static && node install.js ) || echo "FFmpeg download failed — QC/Build tabs may not work until this succeeds."
fi

echo "Starting Media Distribution Toolkit..."
npm start
