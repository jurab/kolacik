#!/bin/bash
# Load a saved piece into the mixer
# Usage: ./load-piece.sh <name>

set -e

NAME="${1:?Usage: scripts/load-piece.sh <name>}"
DIR="artifacts/$NAME"

if [ ! -d "$DIR" ]; then
  echo "Piece not found: $DIR"
  echo "Available pieces:"
  ls -1 artifacts/
  exit 1
fi

# Clear current tracks
rm -f tracks/*.strudel

# Load tracks and state
if [ -d "$DIR/tracks" ]; then
  cp "$DIR/tracks/"*.strudel tracks/ 2>/dev/null || true
fi
cp "$DIR/mix.json" mix.json

echo "Loaded $NAME"
echo "  $(ls tracks/*.strudel 2>/dev/null | wc -l | tr -d ' ') tracks"
echo "Sync server will pick up changes automatically."
