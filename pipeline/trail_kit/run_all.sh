#!/usr/bin/env bash
# Build one trail end to end. Every step skips work that is already cached.
# Usage: ./run_all.sh angels_landing
set -euo pipefail
T="${1:-angels_landing}"
PY="${PYTHON:-python3}"
cd "$(dirname "$0")/pipeline"
"$PY" check_config.py   "$T" || { echo "Fix the config problems above (see docs/LESSONS_LEARNED.md) before downloading."; exit 1; }
"$PY" s1_fetch_osm.py    "$T"
"$PY" s2_fetch_tiles.py  "$T"
"$PY" s3_build_route.py  "$T"
"$PY" s4_fetch_photos.py "$T"
"$PY" s6_season_tiles.py "$T"   # snow / colour overlay tiles for the season toggle (needs the "seasons" block)
"$PY" s5_build_page.py   "$T"
echo "Preview: python -m http.server -d output/$T 8000  ->  http://localhost:8000"
