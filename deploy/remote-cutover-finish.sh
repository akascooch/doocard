#!/bin/bash
# Doocard final cutover: DNS watch + SSL + smoke test
set -euo pipefail

TARGET_IP="45.159.114.60"
DOMAIN="doocardbarbershop.com"
WWW="www.doocardbarbershop.com"
WELLKNOWN="/var/www/html/.well-known/acme-challenge"
PROXY_CONF="/etc/httpd/conf/extra/httpd-doocard-proxy.conf"
LE_CONF="/etc/letsencrypt/live/${WWW}"
DA_LE="/usr/local/directadmin/scripts/letsencrypt.sh"
LOG="/var/log/doocard-cutover.log"

exec > >(tee -a "$LOG") 2>&1
echo "=== Doocard cutover $(date -Is) ==="

wait_dns() {
  local max_attempts="${1:-60}"
  local sleep_s="${2:-30}"
  local i a w
  for ((i=1; i<=max_attempts; i++)); do
    a=$(dig +short A "$DOMAIN" @8.8.8.8 | tail -1)
    w=$(dig +short A "$WWW" @8.8.8.8 | tail -1)
    echo "DNS check $i/$max_attempts: apex=$a www=$w"
    if [ "$a" = "$TARGET_IP" ] && [ "$w" = "$TARGET_IP" ]; then
      echo "DNS OK"
      return 0
    fi
    sleep "$sleep_s"
  done
  echo "DNS still wrong after $max_attempts attempts"
  return 1
}

test_acme_path() {
  local token="cutover-test-$(date +%s)"
  mkdir -p "$WELLKNOWN"
  echo "ok" > "${WELLKNOWN}/${token}"
  chmod 644 "${WELLKNOWN}/${token}"
  local url="http://${WWW}/.well-known/acme-challenge/${token}"
  echo "Testing ACME path: $url"
  if curl -fsS -m 20 "$url" | grep -q ok; then
    echo "ACME webroot reachable publicly"
    rm -f "${WELLKNOWN}/${token}"
    return 0
  fi
  echo "ACME webroot NOT reachable publicly"
  rm -f "${WELLKNOWN}/${token}"
  return 1
}

issue_ssl_da() {
  if [ -x "$DA_LE" ] && [ -x /usr/local/bin/lego ]; then
    echo "Trying DirectAdmin letsencrypt.sh for $DOMAIN"
    "$DA_LE" request "$DOMAIN" "$WWW" && return 0
  fi
  echo "Trying certbot webroot"
  certbot certonly --webroot -w /var/www/html \
    -d "$WWW" -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email \
    --preferred-challenges http
}

update_apache_ssl() {
  local cert key
  if [ -f "/usr/local/directadmin/data/users/admin/domains/${DOMAIN}.cert.combined" ]; then
    cert="/usr/local/directadmin/data/users/admin/domains/${DOMAIN}.cert.combined"
    key="/usr/local/directadmin/data/users/admin/domains/${DOMAIN}.key"
  elif [ -f "${LE_CONF}/fullchain.pem" ]; then
    cert="${LE_CONF}/fullchain.pem"
    key="${LE_CONF}/privkey.pem"
  else
    echo "No LE cert files found"
    return 1
  fi
  echo "Updating SSL in $PROXY_CONF -> $cert"
  sed -i "s|SSLCertificateFile .*|SSLCertificateFile ${cert}|" "$PROXY_CONF"
  sed -i "s|SSLCertificateKeyFile .*|SSLCertificateKeyFile ${key}|" "$PROXY_CONF"
  httpd -t
  systemctl reload httpd
}

smoke_test() {
  echo "=== Public smoke test ==="
  curl -fsSI -m 20 "http://${WWW}/" | head -5
  curl -fsS -m 20 "https://${WWW}/api/health"
  echo
  curl -fsSI -m 20 "https://${WWW}/" | head -8
  curl -fsS -o /dev/null -w "CSS %{http_code}\n" -m 20 "https://${WWW}/_next/static/css/696b205bd5d7f219.css"
  echo | openssl s_client -connect "${WWW}:443" -servername "$WWW" 2>/dev/null | openssl x509 -noout -subject -issuer -dates
}

add_domain_da() {
  if [ -f /usr/local/directadmin/data/users/admin/domains.list ] && grep -q "^${DOMAIN}$" /usr/local/directadmin/data/users/admin/domains.list 2>/dev/null; then
    echo "Domain already in DirectAdmin"
    return 0
  fi
  local admin pass
  admin=$(grep ^adminname= /usr/local/directadmin/conf/setup.txt | cut -d= -f2)
  pass=$(grep ^adminpass= /usr/local/directadmin/conf/setup.txt | cut -d= -f2)
  echo "Adding $DOMAIN to DirectAdmin user admin"
  /usr/local/directadmin/directadmin admin "$admin" "$pass" CMD_API_DOMAIN \
    domain="$DOMAIN" action=create bandwidth=unlimited ubandwidth=unlimited ssl=ON php=OFF cgi=OFF
}

main() {
  add_domain_da || true
  if ! wait_dns "${1:-60}" "${2:-30}"; then
    exit 2
  fi
  test_acme_path
  issue_ssl_da
  update_apache_ssl
  smoke_test
  echo "CUTOVER COMPLETE"
}

main "$@"
