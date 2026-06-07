#!/bin/bash
set -euo pipefail

CONF_SRC="/root/httpd-doocard-proxy.conf"
CONF_DST="/etc/httpd/conf/extra/httpd-doocard-proxy.conf"
INCLUDES="/etc/httpd/conf/extra/httpd-includes.conf"
INCLUDE_LINE='Include conf/extra/httpd-doocard-proxy.conf'
TS="$(date +%Y%m%d-%H%M%S)"

echo "=== Backup ==="
cp -a "$INCLUDES" "${INCLUDES}.bak.${TS}" 2>/dev/null || true
[ -f "$CONF_DST" ] && cp -a "$CONF_DST" "${CONF_DST}.bak.${TS}"

echo "=== Install proxy config ==="
install -m 644 "$CONF_SRC" "$CONF_DST"

echo "=== Ensure include in httpd-includes.conf ==="
if ! grep -qF "$INCLUDE_LINE" "$INCLUDES" 2>/dev/null; then
  printf '\n# Doocard reverse proxy\n%s\n' "$INCLUDE_LINE" >> "$INCLUDES"
fi

mkdir -p /var/www/html/.well-known/acme-challenge
chmod -R 755 /var/www/html/.well-known

echo "=== Apache config test ==="
httpd -t

echo "=== Graceful reload ==="
systemctl reload httpd || systemctl restart httpd
systemctl is-active httpd

echo "=== Local smoke tests ==="
curl -sS -H 'Host: www.doocardbarbershop.com' http://127.0.0.1/api/health
echo
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -H 'Host: www.doocardbarbershop.com' http://127.0.0.1/
curl -sk -o /dev/null -w 'HTTPS %{http_code}\n' -H 'Host: www.doocardbarbershop.com' https://127.0.0.1/api/health

echo "=== apachectl -S (doocard) ==="
apachectl -S 2>&1 | grep -i doocard || true

echo "DONE"
