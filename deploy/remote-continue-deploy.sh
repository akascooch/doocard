#!/usr/bin/env bash
set -ux
export DEBIAN_FRONTEND=noninteractive
export PATH=/usr/local/bin:$PATH

APP_ROOT="/var/www/doocard"
CURRENT="${APP_ROOT}/current"
ZIP="/root/doocard-prod-prep.zip"
PG_PASS='Lord7know$'
LOG="/root/continue-deploy.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== CONTINUE $(date -Is) ==="
node -v
npm -v
npm install -g pm2 || true
pm2 -v || true

echo "=== PostgreSQL 17 ==="
apt-get install -y postgresql-common lsb-release ca-certificates curl gnupg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update -y
apt-get install -y postgresql-17 postgresql-client-17 || apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
psql --version

echo "=== Extract package ==="
mkdir -p "${APP_ROOT}/releases" /var/log/doocard
TS=$(date +%Y%m%d-%H%M%S)
REL="${APP_ROOT}/releases/${TS}"
mkdir -p "$REL"
unzip -qo "$ZIP" -d "$REL"
ln -sfn "$REL" "$CURRENT"
ls "$CURRENT/backend/package.json" "$CURRENT/database/"*.backup

echo "=== Env ==="
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

echo "=== DB restore ==="
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '${PG_PASS}';" || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='doocard'" | grep -q 1 || sudo -u postgres createdb doocard
BACKUP=$(ls "${CURRENT}/database/"*.full.backup | head -1)
sudo -u postgres pg_restore -d doocard --clean --if-exists --no-owner --no-acl "$BACKUP" || true
sudo -u postgres psql -d doocard -tAc 'SELECT COUNT(*) FROM appointments WHERE "deletedAt" IS NULL;'

echo "=== Build backend ==="
cd "${CURRENT}/backend"
npm ci
npx prisma generate
npm run build

echo "=== Build frontend ==="
cd "${CURRENT}/frontend"
npm ci
npm run build

echo "=== PM2 ==="
cat > "${CURRENT}/deploy/ecosystem.production.js" <<'PM2EOF'
module.exports = {
  apps: [
    { name: 'doocard-backend', cwd: '/var/www/doocard/current/backend', script: 'dist/src/main.js', env: { NODE_ENV: 'production', PORT: 3001 }, error_file: '/var/log/doocard/backend-error.log', out_file: '/var/log/doocard/backend-out.log', merge_logs: true, time: true },
    { name: 'doocard-frontend', cwd: '/var/www/doocard/current/frontend', script: 'node_modules/next/dist/bin/next', args: 'start -p 3000', env: { NODE_ENV: 'production', PORT: 3000 }, error_file: '/var/log/doocard/frontend-error.log', out_file: '/var/log/doocard/frontend-out.log', merge_logs: true, time: true },
  ],
};
PM2EOF
pm2 delete all || true
pm2 start "${CURRENT}/deploy/ecosystem.production.js"
pm2 save
sleep 8
ss -tlnp | grep -E ':3000|:3001' || true

echo "=== Nginx (port 8080 to avoid httpd conflict) ==="
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
nginx -t && systemctl start nginx || true

echo "=== Smoke ==="
curl -sf http://127.0.0.1:3001/api/health | head -c 200 || echo BACKEND_FAIL
curl -sfI http://127.0.0.1:3000 | head -3 || echo FRONTEND_FAIL
pm2 list
echo "CONTINUE_DONE"
