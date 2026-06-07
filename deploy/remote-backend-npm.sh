#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:$PATH
pkill -9 -f "npm ci" 2>/dev/null || true
sleep 2
CURRENT=/var/www/doocard/current
cd "${CURRENT}/backend"
export PRISMA_SKIP_POSTINSTALL_GENERATE=1
export PRISMA_GENERATE_SKIP_AUTOINSTALL=1
npm ci --cache /root/npm-cache --prefer-offline --ignore-scripts --no-audit --fund=false
echo BACKEND_NPM_CI_DONE
