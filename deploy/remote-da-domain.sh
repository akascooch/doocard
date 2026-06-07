#!/bin/bash
set -euo pipefail

ADMIN=$(grep ^adminname= /usr/local/directadmin/conf/setup.txt | cut -d= -f2)
PASS=$(grep ^adminpass= /usr/local/directadmin/conf/setup.txt | cut -d= -f2)
DOMAIN=doocardbarbershop.com

echo "=== Show domains before ==="
curl -sk -m 30 -u "${ADMIN}:${PASS}" "https://127.0.0.1:2222/CMD_API_SHOW_DOMAINS" || true
echo

if [ -f /usr/local/directadmin/data/users/admin/domains.list ] && grep -q "^${DOMAIN}$" /usr/local/directadmin/data/users/admin/domains.list; then
  echo "Domain already exists in DA"
else
  echo "=== Create domain ==="
  curl -sk -m 60 -u "${ADMIN}:${PASS}" \
    -d "domain=${DOMAIN}" \
    -d "action=create" \
    -d "bandwidth=unlimited" \
    -d "ubandwidth=unlimited" \
    -d "ssl=ON" \
    -d "php=OFF" \
    -d "cgi=OFF" \
    "https://127.0.0.1:2222/CMD_API_DOMAIN"
  echo
fi

echo "=== domains.list ==="
cat /usr/local/directadmin/data/users/admin/domains.list 2>/dev/null || echo empty
ls -la /usr/local/directadmin/data/users/admin/domains/ 2>/dev/null || true
ls -la /home/admin/domains/ 2>/dev/null || true

echo "=== ACME local test ==="
mkdir -p /var/www/html/.well-known/acme-challenge
echo ok > /var/www/html/.well-known/acme-challenge/local-test
chmod 644 /var/www/html/.well-known/acme-challenge/local-test
curl -sS -H "Host: www.doocardbarbershop.com" "http://45.159.114.60/.well-known/acme-challenge/local-test"
echo

echo "=== DNS current ==="
dig +short NS doocardbarbershop.com
dig +short A www.doocardbarbershop.com
dig +short A doocardbarbershop.com
dig +short AAAA www.doocardbarbershop.com

echo "=== Outbound ACME test ==="
curl -sS -m 20 -o /dev/null -w "acme:%{http_code}\n" https://acme-v02.api.letsencrypt.org/directory || echo acme-fail

echo "=== Apache proxy health ==="
curl -sS -H "Host: www.doocardbarbershop.com" http://45.159.114.60/api/health
echo
