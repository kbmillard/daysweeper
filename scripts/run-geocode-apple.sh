#!/usr/bin/env bash
# Build and run the Apple geocoder script (macOS only).
# Usage: DAYSWEEPER_URL=http://localhost:3000 ./scripts/run-geocode-apple.sh
#        DAYSWEEPER_URL=https://your-app.vercel.app ./scripts/run-geocode-apple.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$SCRIPT_DIR/geocode-apple"
SRC="$SCRIPT_DIR/geocode-apple.swift"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Apple geocoding (CLGeocoder) is only available on macOS." >&2
  exit 1
fi

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi

# Compile if needed (or if source is newer)
if [[ ! -x "$BIN" ]] || [[ "$SRC" -nt "$BIN" ]]; then
  echo "Compiling geocode-apple..." >&2
  xcrun swiftc -O -framework CoreLocation -framework Foundation "$SRC" -o "$BIN"
fi

export DAYSWEEPER_URL="${DAYSWEEPER_URL:-http://localhost:3000}"
export MISSING_ONLY="${MISSING_ONLY:-true}"
exec "$BIN"
