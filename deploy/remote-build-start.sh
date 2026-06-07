#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:/usr/local/pgsql/bin:$PATH
CURRENT=/var/www/doocard/current
LOG=/root/build-start.log
exec > >(tee -a "$LOG") 2>&1
echo "=== BUILD START $(date -Is) ==="

if [ ! -d /root/npm-cache ]; then
  echo "Extracting npm cache..."
  cd /root
  tar -xzf npm-cache.tar.gz
fi

mkdir -p "${CURRENT}/backend/uploads"

cat > "${CURRENT}/backend/.env" <<'EOF'
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:Lord7know$@127.0.0.1:5432/doocard?schema=public
POSTGRES_DB=doocard
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Lord7know$
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
UPLOAD_DEST=/var/www/doocard/current/backend/uploads
LOG_LEVEL=info
SESSION_SECRET=doocard-session-secret-change-in-production
EOF

cat > "${CURRENT}/frontend/.env.production" <<'EOF'
NODE_ENV=production
BACKEND_URL=http://127.0.0.1:3001
NEXT_PUBLIC_API_URL=https://www.doocardbarbershop.com
NEXT_PUBLIC_WS_URL=wss://www.doocardbarbershop.com
NEXT_PUBLIC_PWA_ENABLED=true
NEXT_PUBLIC_APP_NAME=Doocard Barbershop
NEXT_PUBLIC_APP_VERSION=1.2.4
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHP4sJ--IgJepI-tImGr613Oqoy_bgKQHM8fZOLf4viipPbp8DKbHU2yD0VMSPtEff6rXyo5hPS8xTMvRN-ReoA
EOF

echo "=== Backend npm ci ==="
cd "${CURRENT}/backend"
npm ci --cache /root/npm-cache --prefer-offline --no-audit --fund=false
npx prisma generate
npm run build

echo "=== Frontend npm ci ==="
cd "${CURRENT}/frontend"
npm ci --cache /root/npm-cache --prefer-offline --no-audit --fund=false
npm run build

echo "=== systemd ==="
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
systemctl enable doocard-backend doocard-frontend
systemctl restart doocard-backend doocard-frontend
sleep 12
systemctl is-active doocard-backend doocard-frontend
ss -tlnp | grep -E ':3000|:3001' || true

echo "=== Nginx 8080 ==="
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
nginx -t && systemctl reload nginx

echo "=== Smoke ==="
curl -sf http://127.0.0.1:3001/api/health || echo BACKEND_FAIL
curl -sfI http://127.0.0.1:3000 | head -3 || echo FRONTEND_FAIL
curl -sfI http://127.0.0.1:8080 | head -3 || echo NGINX_FAIL
echo BUILD_START_DONE
