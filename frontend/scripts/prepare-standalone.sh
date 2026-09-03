#!/usr/bin/env bash
# Deterministic frontend standalone prepare (run after npm run build / postbuild).
set -euo pipefail
FE="${1:-/var/www/doocard/frontend}"
cd "$FE"
node scripts/sync-standalone.mjs
cp -f .env.production .next/standalone/.env.production 2>/dev/null || true
test -f .next/standalone/public/logo/logo-2048.png
test -d .next/standalone/.next/static
echo "standalone ready"
