#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:$PATH
CURRENT=/var/www/doocard/current
LOG=/root/finish-deploy.log
exec > >(tee -a "$LOG") 2>&1
echo "=== FINISH DEPLOY $(date -Is) ==="

# Swap for frontend build (OOM prevention)
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "SWAP_ADDED"
fi
free -h

# Backend: ensure bcrypt native module
cd "${CURRENT}/backend"
export NODE_OPTIONS="--max-old-space-size=1536"
npm rebuild bcrypt --build-from-source 2>&1 | tail -5 || true

MAIN="$(find dist -name main.js | head -1)"
test -n "$MAIN" || { echo "NO main.js in dist"; exit 1; }
echo "BACKEND_MAIN=$MAIN"

mkdir -p uploads /var/log/doocard

cat > /etc/systemd/system/doocard-backend.service <<EOF
[Unit]
Description=Doocard NestJS Backend
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=${CURRENT}/backend
EnvironmentFile=${CURRENT}/backend/.env
ExecStart=/usr/local/bin/node ${CURRENT}/backend/${MAIN}
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/doocard/backend-out.log
StandardError=append:/var/log/doocard/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable doocard-backend
systemctl restart doocard-backend
sleep 10
systemctl is-active doocard-backend
curl -sf http://127.0.0.1:3001/api/health | head -c 400 || { echo BACKEND_HEALTH_FAIL; journalctl -u doocard-backend -n 30 --no-pager; tail -30 /var/log/doocard/backend-error.log 2>/dev/null; exit 1; }
echo BACKEND_UP

# Frontend deps + build
cd "${CURRENT}/frontend"
export PRISMA_SKIP_POSTINSTALL_GENERATE=1
if [ ! -d node_modules/next ]; then
  npm ci --omit=dev --cache /root/npm-cache --prefer-offline --ignore-scripts --no-audit --fund=false
fi
npm run build 2>&1 | tail -30
test -d .next && echo FRONTEND_NEXT_OK

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
StandardOutput=append:/var/log/doocard/frontend-out.log
StandardError=append:/var/log/doocard/frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable doocard-frontend
systemctl restart doocard-frontend
sleep 12
systemctl is-active doocard-frontend
curl -sfI http://127.0.0.1:3000 | head -5 || tail -20 /var/log/doocard/frontend-error.log

# Nginx 8080
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

echo "=== SMOKE ==="
curl -sf http://127.0.0.1:3001/api/health | head -c 200
curl -sfI http://127.0.0.1:3000 | head -3
curl -sf http://127.0.0.1:8080/api/health | head -c 200 || true
echo FINISH_DEPLOY_DONE
