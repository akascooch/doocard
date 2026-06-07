#!/usr/bin/env bash
# Doocard remote full deploy — idempotent where possible
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_ROOT="/var/www/doocard"
CURRENT="${APP_ROOT}/current"
LOG="${APP_ROOT}/deploy.log"
ZIP_PATH="${1:-/root/doocard-prod-prep-2026-06-02-1747.zip}"
PG_PASS="${PG_PASS:-Lord7know\$}"

exec > >(tee -a "$LOG") 2>&1
echo "=== Doocard deploy started $(date -Is) ==="

phase_bootstrap() {
  echo ">>> PHASE bootstrap"
  apt-get update -y
  apt-get install -y unzip curl git nginx redis-server certbot python3-certbot-nginx \
    build-essential wget gnupg lsb-release ca-certificates

  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
  fi
  npm install -g pm2 2>/dev/null || true

  if ! dpkg -l | grep -q postgresql-17; then
    install -d /usr/share/postgresql-common/pgdg
    curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc || true
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg 2>/dev/null || \
      apt-key adv --keyserver keyserver.ubuntu.com --recv-keys ACCC4CF8 2>/dev/null || true
    apt-get update -y
    apt-get install -y postgresql-17 postgresql-client-17 || apt-get install -y postgresql postgresql-contrib
  fi

  mkdir -p "${APP_ROOT}/releases" "${APP_ROOT}/shared" "${APP_ROOT}/database" /var/log/doocard
  systemctl enable redis-server nginx postgresql 2>/dev/null || true
  systemctl start redis-server 2>/dev/null || true
  systemctl start postgresql 2>/dev/null || true

  echo "node=$(node -v 2>/dev/null || echo MISSING)"
  echo "npm=$(npm -v 2>/dev/null || echo MISSING)"
  echo "nginx=$(nginx -v 2>&1 || echo MISSING)"
  echo "redis=$(redis-server --version 2>/dev/null || echo MISSING)"
  echo "psql=$(psql --version 2>/dev/null || echo MISSING)"
  echo "pm2=$(pm2 -v 2>/dev/null || echo MISSING)"
}

phase_extract() {
  echo ">>> PHASE extract"
  test -f "$ZIP_PATH"
  TS=$(date +%Y%m%d-%H%M%S)
  REL="${APP_ROOT}/releases/${TS}"
  mkdir -p "$REL"
  unzip -qo "$ZIP_PATH" -d "$REL"
  ln -sfn "$REL" "$CURRENT"
  test -f "${CURRENT}/backend/package.json"
  test -f "${CURRENT}/frontend/package.json"
  test -f "${CURRENT}/backend/prisma/schema.prisma"
  test -f "${CURRENT}/deploy/deploy.sh"
  ls -la "${CURRENT}/database/"*.backup 2>/dev/null || ls -la "${CURRENT}/database/"
}

phase_env() {
  echo ">>> PHASE env"
  mkdir -p "${CURRENT}/backend/uploads" /var/log/doocard
  cat > "${CURRENT}/backend/.env" <<EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:${PG_PASS}@127.0.0.1:5432/doocard?schema=public
POSTGRES_DB=doocard
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
REDIS_URL=redis://127.0.0.1:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=doocard-local-dev-jwt-secret-change-me
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=doocard-local-dev-refresh-secret
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
  echo "ENV_WRITTEN"
}

phase_db() {
  echo ">>> PHASE database"
  sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '${PG_PASS}';" 2>/dev/null || true
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='doocard'" | grep -q 1 || \
    sudo -u postgres createdb doocard
  BACKUP=$(ls "${CURRENT}/database/"*.full.backup 2>/dev/null | head -1)
  test -n "$BACKUP"
  echo "Restoring $BACKUP"
  sudo -u postgres pg_restore -d doocard --clean --if-exists --no-owner --no-acl "$BACKUP" || true
  sudo -u postgres psql -d doocard -tAc 'SELECT COUNT(*) FROM appointments WHERE "deletedAt" IS NULL;'
}

phase_build() {
  echo ">>> PHASE build"
  cd "${CURRENT}/backend"
  npm ci
  npx prisma generate
  npx prisma migrate status || true
  npm run build
  cd "${CURRENT}/frontend"
  npm ci
  npm run build
}

phase_pm2() {
  echo ">>> PHASE pm2"
  cat > "${CURRENT}/deploy/ecosystem.production.js" <<'PM2EOF'
module.exports = {
  apps: [
    {
      name: 'doocard-backend',
      cwd: '/var/www/doocard/current/backend',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3001 },
      error_file: '/var/log/doocard/backend-error.log',
      out_file: '/var/log/doocard/backend-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'doocard-frontend',
      cwd: '/var/www/doocard/current/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3000 },
      error_file: '/var/log/doocard/frontend-error.log',
      out_file: '/var/log/doocard/frontend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
PM2EOF
  pm2 delete all 2>/dev/null || true
  pm2 start "${CURRENT}/deploy/ecosystem.production.js"
  pm2 save
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
  sleep 5
  ss -tlnp | grep -E ':3000|:3001' || netstat -tlnp | grep -E ':3000|:3001' || true
}

phase_nginx() {
  echo ">>> PHASE nginx"
  cat > /etc/nginx/sites-available/doocard <<'NGXEOF'
upstream doocard_backend { server 127.0.0.1:3001; keepalive 32; }
upstream doocard_frontend { server 127.0.0.1:3000; keepalive 32; }

server {
    listen 80;
    server_name www.doocardbarbershop.com doocardbarbershop.com;
    client_max_body_size 15M;

    location /api/ {
        proxy_pass http://doocard_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ { proxy_pass http://doocard_backend; proxy_set_header Host $host; }
    location /socket.io/ {
        proxy_pass http://doocard_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    location / {
        proxy_pass http://doocard_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGXEOF
  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/doocard /etc/nginx/sites-enabled/doocard
  nginx -t
  systemctl reload nginx
}

phase_ssl() {
  echo ">>> PHASE ssl"
  certbot --nginx -d www.doocardbarbershop.com -d doocardbarbershop.com \
    --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
    echo "CERTBOT_FAILED (may need DNS or port 80)"
}

phase_smoke() {
  echo ">>> PHASE smoke"
  curl -sf "http://127.0.0.1:3001/api/health" | head -c 300 || echo "LOCAL_BACKEND_FAIL"
  curl -sfI "http://127.0.0.1:3000" | head -5 || echo "LOCAL_FRONTEND_FAIL"
  curl -sfI "http://127.0.0.1/api/health" -H "Host: www.doocardbarbershop.com" | head -5 || true
  curl -sf "https://www.doocardbarbershop.com/api/health" 2>/dev/null | head -c 300 || \
    curl -sf "http://www.doocardbarbershop.com/api/health" 2>/dev/null | head -c 300 || echo "PUBLIC_FAIL"
  pm2 list
}

phase_bootstrap
phase_extract
phase_env
phase_db
phase_build
phase_pm2
phase_nginx
phase_ssl
phase_smoke
echo "=== DEPLOY FINISHED $(date -Is) ==="
