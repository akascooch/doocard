#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:$PATH
pkill -9 -f "remote-build-start" 2>/dev/null || true
pkill -9 -f "npm ci" 2>/dev/null || true
sleep 2

CURRENT=/var/www/doocard/current
LOG=/root/build-resume.log
exec > >(tee -a "$LOG") 2>&1
echo "=== RESUME $(date -Is) ==="

cd "${CURRENT}/backend"
export PRISMA_SKIP_POSTINSTALL_GENERATE=1
npm ci --cache /root/npm-cache --prefer-offline --ignore-scripts --no-audit --fund=false

mkdir -p node_modules/@prisma/engines node_modules/.prisma/client
cp -f /root/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node node_modules/@prisma/engines/ 2>/dev/null || cp -f /root/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node || true
cp -f /root/prisma-engines/schema-engine-debian-openssl-3.0.x node_modules/@prisma/engines/ 2>/dev/null || true

export PRISMA_QUERY_ENGINE_LIBRARY="${CURRENT}/backend/node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node"
export PRISMA_SCHEMA_ENGINE_BINARY="${CURRENT}/backend/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x"
npx prisma generate
npm rebuild bcrypt --build-from-source || npm rebuild bcrypt || true
npm run build

cd "${CURRENT}/frontend"
npm ci --cache /root/npm-cache --prefer-offline --ignore-scripts --no-audit --fund=false
npm run build

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
sleep 15
systemctl status doocard-backend --no-pager | head -12
systemctl status doocard-frontend --no-pager | head -12
journalctl -u doocard-backend -n 20 --no-pager || true

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

curl -sf http://127.0.0.1:3001/api/health || echo BACKEND_FAIL
curl -sfI http://127.0.0.1:3000 | head -3 || echo FRONTEND_FAIL
curl -sfI http://127.0.0.1:8080/api/health | head -5 || echo NGINX_FAIL
echo RESUME_DONE
