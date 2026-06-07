#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:$PATH
export NODE_OPTIONS="--max-old-space-size=2048"
CURRENT=/var/www/doocard/current
LOG=/root/frontend-start.log
exec > >(tee -a "$LOG") 2>&1
echo "=== FRONTEND START $(date -Is) ==="

cd "${CURRENT}/frontend"

if [ -f /root/frontend-next-lite.tar.gz ]; then
  rm -rf .next
  tar -xzf /root/frontend-next-lite.tar.gz -C .
  echo "NEXT_EXTRACTED"
fi

if [ ! -d .next ]; then
  echo "Building on server..."
  npm run build
fi

test -d .next || { echo "NO .next"; exit 1; }

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
sleep 10
systemctl is-active doocard-frontend
curl -sfI http://127.0.0.1:3000 | head -5 || journalctl -u doocard-frontend -n 25 --no-pager

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

curl -sf http://127.0.0.1:8080/api/health | head -c 200
curl -sfI http://127.0.0.1:8080 | head -3
echo FRONTEND_START_DONE
