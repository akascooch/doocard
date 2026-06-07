#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export PATH=/usr/local/bin:/usr/local/pgsql/bin:/usr/pgsql-17/bin:$PATH

APP_ROOT="/var/www/doocard"
CURRENT="${APP_ROOT}/current"
ZIP="/root/doocard-prod-prep.zip"
PG_PASS='Lord7know$'
LOG="/root/offline-deploy.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== OFFLINE DEPLOY $(date -Is) ==="

# Stop stuck prior runs
pkill -9 npm 2>/dev/null || true
pkill -9 -f remote-continue-deploy 2>/dev/null || true

echo "=== Tool versions ==="
node -v
npm -v
psql --version
redis-server --version | head -1
nginx -v 2>&1 || true

echo "=== Directories ==="
mkdir -p "${APP_ROOT}/releases" "${APP_ROOT}/shared" /var/log/doocard

echo "=== Extract package ==="
TS=$(date +%Y%m%d-%H%M%S)
REL="${APP_ROOT}/releases/${TS}"
mkdir -p "$REL"
unzip -qo "$ZIP" -d "$REL"
ln -sfn "$REL" "$CURRENT"

test -f "${CURRENT}/backend/package.json"
test -f "${CURRENT}/frontend/package.json"
test -f "${CURRENT}/backend/prisma/schema.prisma"
test -f "${CURRENT}/deploy/deploy.sh"
ls "${CURRENT}/database/"*.full.backup >/dev/null

echo "=== Environment files ==="
mkdir -p "${CURRENT}/backend/uploads"
cat > "${CURRENT}/backend/.env" <<EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:${PG_PASS}@127.0.0.1:5432/doocard?schema=public
POSTGRES_DB=doocard
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${PG_PASS}
REDIS_URL=redis://127.0.0.1:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=doocard-local-dev-jwt-secret-change-me
JWT_REFRESH_SECRET=doocard-local-dev-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://www.doocardbarbershop.com,https://doocardbarbershop.com
CORS_ORIGIN=https://www.doocardbarbershop.com,https://doocardbarbershop.com
FRONTEND_URL=https://www.doocardbarbershop.com
TRUST_PROXY=true
VAPID_PUBLIC_KEY=BHP4sJ--IgJepI-tImGr613Oqoy_bgKQHM8fZOLf4viipPbp8DKbHU2yD0VMSPtEff6rXyo5hPS8xTMvRN-ReoA
VAPID_PRIVATE_KEY=ZqBCdzLycDap2n2x0582vVe_-cAVIZug9w8nQBtaEGc
VAPID_SUBJECT=mailto:admin@doocardbarbershop.com
SMS_ENABLED=false
SMS_API_KEY=
SMS_SENDER_NUMBER=
UPLOAD_DEST=${CURRENT}/backend/uploads
LOG_LEVEL=info
SESSION_SECRET=doocard-session-secret-change-in-production
EOF

cat > "${CURRENT}/frontend/.env.production" <<EOF
NODE_ENV=production
BACKEND_URL=http://127.0.0.1:3001
NEXT_PUBLIC_API_URL=https://www.doocardbarbershop.com
NEXT_PUBLIC_WS_URL=wss://www.doocardbarbershop.com
NEXT_PUBLIC_PWA_ENABLED=true
NEXT_PUBLIC_APP_NAME=Doocard Barbershop
NEXT_PUBLIC_APP_VERSION=1.2.4
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHP4sJ--IgJepI-tImGr613Oqoy_bgKQHM8fZOLf4viipPbp8DKbHU2yD0VMSPtEff6rXyo5hPS8xTMvRN-ReoA
EOF

echo "=== PostgreSQL setup ==="
systemctl enable postgresql
systemctl start postgresql
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '${PG_PASS}';" || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='doocard'" | grep -q 1 || sudo -u postgres createdb doocard

BACKUP=$(ls "${CURRENT}/database/"*.full.backup | head -1)
echo "Restoring from $BACKUP"
set +e
sudo -u postgres pg_restore -d doocard --clean --if-exists --no-owner --no-acl "$BACKUP" 2>&1 | tee /root/pg_restore.log
RESTORE_RC=${PIPESTATUS[0]}
set -e
echo "pg_restore exit: $RESTORE_RC"

APPT_COUNT=$(sudo -u postgres psql -d doocard -tAc 'SELECT COUNT(*) FROM appointments WHERE "deletedAt" IS NULL;' 2>/dev/null || echo 0)
echo "appointments_count=$APPT_COUNT"

echo "=== NPM offline install (backend) ==="
if [ -d /root/npm-cache ]; then
  cd "${CURRENT}/backend"
  npm ci --cache /root/npm-cache --prefer-offline --no-audit --fund=false 2>&1 | tee /root/npm-backend.log
  npx prisma generate 2>&1 | tee /root/prisma-generate.log
  npm run build 2>&1 | tee /root/backend-build.log
else
  echo "SKIP backend build: /root/npm-cache missing"
fi

echo "=== NPM offline install (frontend) ==="
if [ -d /root/npm-cache ]; then
  cd "${CURRENT}/frontend"
  npm ci --cache /root/npm-cache --prefer-offline --no-audit --fund=false 2>&1 | tee /root/npm-frontend.log
  npm run build 2>&1 | tee /root/frontend-build.log
else
  echo "SKIP frontend build: /root/npm-cache missing"
fi

echo "=== systemd services ==="
cat > /etc/systemd/system/doocard-backend.service <<EOF
[Unit]
Description=Doocard NestJS Backend
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=${CURRENT}/backend
EnvironmentFile=${CURRENT}/backend/.env
ExecStart=/usr/local/bin/node dist/src/main.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/doocard-frontend.service <<EOF
[Unit]
Description=Doocard Next.js Frontend
After=network.target doocard-backend.service

[Service]
Type=simple
WorkingDirectory=${CURRENT}/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/local/bin/node node_modules/next/dist/bin/next start -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable doocard-backend doocard-frontend || true
systemctl restart doocard-backend doocard-frontend || true
sleep 10
systemctl status doocard-backend --no-pager | head -15 || true
systemctl status doocard-frontend --no-pager | head -15 || true
ss -tlnp | grep -E ':3000|:3001' || true

echo "=== Nginx site (8080 - Apache holds 80/443) ==="
cat > /etc/nginx/sites-available/doocard <<'NGXEOF'
upstream doocard_backend { server 127.0.0.1:3001; }
upstream doocard_frontend { server 127.0.0.1:3000; }
server {
  listen 8080;
  server_name www.doocardbarbershop.com doocardbarbershop.com;
  client_max_body_size 15M;
  location /api/ { proxy_pass http://doocard_backend; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /uploads/ { proxy_pass http://doocard_backend; proxy_set_header Host $host; }
  location /socket.io/ { proxy_pass http://doocard_backend; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }
  location / { proxy_pass http://doocard_frontend; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
}
NGXEOF
ln -sf /etc/nginx/sites-available/doocard /etc/nginx/sites-enabled/doocard
nginx -t && systemctl reload nginx || true

echo "=== Smoke tests ==="
curl -sf http://127.0.0.1:3001/api/health | head -c 300 || echo BACKEND_FAIL
curl -sfI http://127.0.0.1:3000 | head -5 || echo FRONTEND_FAIL
curl -sfI http://127.0.0.1:8080 | head -5 || echo NGINX8080_FAIL

echo "OFFLINE_DEPLOY_DONE"
