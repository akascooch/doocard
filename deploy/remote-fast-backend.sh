#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:$PATH
pkill -9 npm 2>/dev/null || true
CURRENT=/var/www/doocard/current
LOG=/root/fast-backend.log
exec > >(tee -a "$LOG") 2>&1
echo "=== FAST BACKEND $(date -Is) ==="

cd "${CURRENT}/backend"
rm -rf node_modules dist
tar -xzf /root/backend-dist.tar.gz
npm ci --omit=dev --cache /root/npm-cache --prefer-offline --ignore-scripts --no-audit --fund=false

mkdir -p node_modules/@prisma/engines node_modules/.prisma/client
cp /root/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node node_modules/@prisma/engines/
cp /root/prisma-engines/schema-engine-debian-openssl-3.0.x node_modules/@prisma/engines/
chmod +x node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x

export PRISMA_QUERY_ENGINE_LIBRARY="${CURRENT}/backend/node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node"
export PRISMA_SCHEMA_ENGINE_BINARY="${CURRENT}/backend/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x"
npx prisma generate
npm rebuild bcrypt --build-from-source || true

mkdir -p uploads
test -f .env || cp /dev/null .env

systemctl restart doocard-backend || true
sleep 8
curl -sf http://127.0.0.1:3001/api/health || journalctl -u doocard-backend -n 30 --no-pager
echo FAST_BACKEND_DONE
