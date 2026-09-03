#!/bin/bash
set -e
echo "=== BACKUPS ==="
ls -lt /var/backups/doocard | head -30
echo "=== LOOK FOR DIST BACKUPS ==="
find /var/backups/doocard -maxdepth 3 -type d -name 'dist' 2>/dev/null | head -20
find /var/backups/doocard -maxdepth 2 -name '*.tgz' 2>/dev/null | head -20
find /var/backups/doocard -maxdepth 2 -name '*backend*' 2>/dev/null | head -30
# Also check if previous tip deploy left a full backup
ls /var/backups/doocard/20260713-143733-service-tip-100pct-and-tip-module/ 2>/dev/null | head -40 || true
