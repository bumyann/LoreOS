#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# LoreOS — start.sh (Mac / Linux)
# Run this script to launch LoreOS locally.
# Starts a local HTTP server and opens the browser.
# ═══════════════════════════════════════════════════════

PORT=8080
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  LoreOS // loreos.net"
echo "  ----------------------------"

# ── Check Python ──
if ! command -v python3 &>/dev/null; then
  echo "  X Python 3 not found."
  echo "    Install it from https://python.org and try again."
  exit 1
fi

# ── Start server ──
echo ""
echo "  Starting server at http://localhost:$PORT"
echo "  Press Ctrl+C to stop."
echo ""

# Open browser (Mac: open, Linux: xdg-open)
if command -v open &>/dev/null; then
  open "http://localhost:$PORT" 2>/dev/null &
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:$PORT" 2>/dev/null &
fi

cd "$DIR"
python3 -m http.server $PORT
