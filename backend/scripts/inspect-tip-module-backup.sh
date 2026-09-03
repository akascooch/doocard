#!/bin/bash
set -e
BK=/var/backups/doocard/20260713-143733-service-tip-100pct-and-tip-module
cd "$BK"
echo "=== MANIFEST ==="
cat MANIFEST.txt 2>/dev/null | head -80 || true
echo "=== BUILT ==="
ls -la built 2>/dev/null | head -40 || true
find built -maxdepth 3 -type d 2>/dev/null | head -40
echo "=== PM2 DUMP HEAD ==="
head -c 500 pm2-dump.pm2; echo
