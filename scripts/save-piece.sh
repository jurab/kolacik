#!/bin/bash
# Save current mixer state as a named piece
# Usage: ./save-piece.sh <name>

set -e

NAME="${1:?Usage: scripts/save-piece.sh <name>}"
DIR="artifacts/$NAME"

if [ -d "$DIR" ]; then
  echo "Overwriting existing piece: $DIR"
  rm -rf "$DIR"
fi

mkdir -p "$DIR/tracks"
cp tracks/*.strudel "$DIR/tracks/" 2>/dev/null || true
cp mix.json "$DIR/mix.json"

echo "Saved to $DIR/"
echo "  $(ls "$DIR/tracks/" | wc -l | tr -d ' ') tracks"
echo "  mix.json"
