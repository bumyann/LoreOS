#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# LoreOS build script — run before deploying
# Stamps sw.js with current unix timestamp so the SW
# cache busts automatically on every deploy.
#
# Cloudflare Pages build command: bash build.sh
# ═══════════════════════════════════════════════════════
TS=$(date +%s)
# Replace the timestamp in sw.js
sed -i "s/const CACHE = 'loreos-[0-9]*/const CACHE = 'loreos-$TS/" sw.js
echo "Build complete — cache key: loreos-$TS"
