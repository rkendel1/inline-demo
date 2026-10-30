#!/usr/bin/env bash
# Generate a looping preview GIF + poster from a video, locally, with ffmpeg.
# Use this when your deploy host (e.g. Vercel serverless) has no ffmpeg: run it on your
# machine, then upload the resulting preview.gif as the demo's poster/chip image.
#
# Usage:
#   scripts/make-preview.sh INPUT.mp4 [OUTDIR] [START_SECONDS] [LENGTH_SECONDS] [WIDTH] [FPS]
# Example:
#   scripts/make-preview.sh demo.mp4 ./out 2 4 320 12
set -euo pipefail

IN="${1:?Usage: make-preview.sh INPUT [OUTDIR] [START] [LEN] [WIDTH] [FPS]}"
OUT="${2:-./preview-out}"
START="${3:-0}"
LEN="${4:-4}"
WIDTH="${5:-320}"
FPS="${6:-12}"

mkdir -p "$OUT"
VF="fps=${FPS},scale=${WIDTH}:-1:flags=lanczos"

echo "Generating palette..."
ffmpeg -y -ss "$START" -t "$LEN" -i "$IN" -vf "${VF},palettegen=stats_mode=diff" "$OUT/palette.png"

echo "Generating GIF..."
ffmpeg -y -ss "$START" -t "$LEN" -i "$IN" -i "$OUT/palette.png" \
  -lavfi "${VF} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3" -loop 0 "$OUT/preview.gif"

echo "Generating poster..."
ffmpeg -y -ss "$START" -i "$IN" -frames:v 1 -vf "scale=${WIDTH}:-1:flags=lanczos" -q:v 3 "$OUT/poster.jpg"

echo "Done:"
ls -lh "$OUT/preview.gif" "$OUT/poster.jpg"
