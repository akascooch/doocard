#!/usr/bin/env bash
set -ux
export DEBIAN_FRONTEND=noninteractive

echo "=== FIX STACK $(date -Is) ==="

echo "Port 80:"
ss -tlnp | grep ':80 ' || true

echo "=== Node 18 via NodeSource ==="
apt-get remove -y nodejs npm 2>/dev/null || true
apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource-setup.sh
bash /tmp/nodesource-setup.sh
apt-get install -y nodejs
node -v
npm -v
npm install -g pm2
pm2 -v

echo "=== PostgreSQL 17 ==="
apt-get install -y postgresql-common lsb-release
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update -y
apt-get install -y postgresql-17 postgresql-client-17
systemctl enable postgresql
systemctl start postgresql
psql --version

echo "=== Redis/Nginx ==="
systemctl enable redis-server
systemctl start redis-server
redis-server --version
nginx -v 2>&1

mkdir -p /var/www/doocard/releases /var/log/doocard
echo "FIX_STACK_DONE"
