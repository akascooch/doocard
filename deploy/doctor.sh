#!/usr/bin/env bash
# Doocard production health check — run on server as root
# Usage: bash /var/www/doocard/current/deploy/doctor.sh
set -uo pipefail

DOMAIN="${DOOCARD_DOMAIN:-www.doocardbarbershop.com}"
APP_ROOT="${DOOCARD_ROOT:-/var/www/doocard/current}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*"; }

section() {
  echo
  echo "=== $1 ==="
}

check_service() {
  local name="$1"
  if systemctl is-active --quiet "$name" 2>/dev/null; then
    ok "$name is active"
    return 0
  fi
  fail "$name is NOT active"
  systemctl status "$name" --no-pager 2>/dev/null | head -6 || true
  return 1
}

section "Doocard Doctor — $(date -Is)"
echo "Host: $(hostname -f 2>/dev/null || hostname)"
echo "Domain: $DOMAIN"
echo "App root: $APP_ROOT"

# --- Services ---
section "Services"
svc_ok=0
check_service doocard-backend  && ((svc_ok++)) || true
check_service doocard-frontend && ((svc_ok++)) || true
check_service httpd            && ((svc_ok++)) || true
check_service postgresql       || warn "postgresql not active (may use different unit name)"
check_service redis-server     || warn "redis-server not active"

if ss -tlnp 2>/dev/null | grep -q ':3001'; then ok "Port 3001 listening (backend)"; else fail "Port 3001 NOT listening"; fi
if ss -tlnp 2>/dev/null | grep -q ':3000'; then ok "Port 3000 listening (frontend)"; else fail "Port 3000 NOT listening"; fi

# --- Memory ---
section "Memory"
if command -v free >/dev/null 2>&1; then
  free -h
  avail_kb=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  total_kb=$(awk '/MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 1)
  if [ "$total_kb" -gt 0 ]; then
    pct=$(( (total_kb - avail_kb) * 100 / total_kb ))
    if [ "$pct" -ge 90 ]; then fail "Memory usage ~${pct}%"; elif [ "$pct" -ge 75 ]; then warn "Memory usage ~${pct}%"; else ok "Memory usage ~${pct}%"; fi
  fi
else
  warn "free command not available"
fi

# --- Disk ---
section "Disk"
df -h / /var/www 2>/dev/null || df -h /
root_use=$(df / 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}')
if [ -n "${root_use:-}" ]; then
  if [ "$root_use" -ge 90 ]; then fail "Root disk ${root_use}% full"
  elif [ "$root_use" -ge 80 ]; then warn "Root disk ${root_use}% full"
  else ok "Root disk ${root_use}% used"; fi
fi
if [ -d /var/www/doocard ]; then
  du -sh /var/www/doocard 2>/dev/null | awk '{print "App tree: " $1}' || true
fi

# --- Apache config ---
section "Apache"
if command -v httpd >/dev/null 2>&1; then
  if httpd -t 2>&1 | grep -q 'Syntax OK'; then ok "httpd -t Syntax OK"; else fail "httpd config invalid"; httpd -t 2>&1 | tail -5; fi
  if [ -f /etc/httpd/conf/extra/httpd-doocard-proxy.conf ]; then ok "Doocard proxy vhost present"; else warn "httpd-doocard-proxy.conf missing"; fi
else
  warn "httpd not found"
fi

# --- SSL ---
section "SSL"
ssl_days=""
if command -v openssl >/dev/null 2>&1; then
  cert_info=$(echo | openssl s_client -connect "${DOMAIN}:443" -servername "$DOMAIN" 2>/dev/null \
    | openssl x509 -noout -subject -issuer -enddate 2>/dev/null || true)
  if [ -n "$cert_info" ]; then
    echo "$cert_info"
    enddate=$(echo "$cert_info" | grep notAfter | sed 's/notAfter=//')
    if [ -n "$enddate" ]; then
      end_epoch=$(date -d "$enddate" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$enddate" +%s 2>/dev/null || echo 0)
      now_epoch=$(date +%s)
      if [ "$end_epoch" -gt 0 ]; then
        ssl_days=$(( (end_epoch - now_epoch) / 86400 ))
        if [ "$ssl_days" -lt 14 ]; then fail "SSL expires in ${ssl_days} days"
        elif [ "$ssl_days" -lt 30 ]; then warn "SSL expires in ${ssl_days} days"
        else ok "SSL expires in ${ssl_days} days"; fi
      fi
    fi
  else
    warn "Could not fetch public SSL cert for $DOMAIN"
  fi
  # Local cert file if Apache uses DA combined cert
  for cert in /etc/httpd/conf/ssl.crt/server.crt.combined \
              /usr/local/directadmin/data/users/admin/domains/doocardbarbershop.com.cert.combined \
              /etc/letsencrypt/live/www.doocardbarbershop.com/fullchain.pem; do
    if [ -f "$cert" ]; then
      ok "Local cert file: $cert"
      openssl x509 -in "$cert" -noout -subject -enddate 2>/dev/null || true
      break
    fi
  done
fi

# --- Health endpoints ---
section "Health endpoints"
local_health=$(curl -sf --max-time 10 "http://127.0.0.1:3001/api/health" 2>/dev/null || true)
if echo "$local_health" | grep -q '"status":"ok"'; then ok "Local backend health OK"; else fail "Local backend health FAIL: ${local_health:-empty}"; fi

proxy_health=$(curl -sf --max-time 10 -H "Host: $DOMAIN" "http://127.0.0.1/api/health" 2>/dev/null || true)
if echo "$proxy_health" | grep -q '"status":"ok"'; then ok "Apache proxy health OK"; else warn "Apache proxy health: ${proxy_health:-empty}"; fi

public_health=$(curl -sf --max-time 15 "https://${DOMAIN}/api/health" 2>/dev/null || true)
if echo "$public_health" | grep -q '"status":"ok"'; then ok "Public HTTPS health OK"; else fail "Public HTTPS health FAIL: ${public_health:-empty}"; fi

public_fe=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 15 "https://${DOMAIN}/" 2>/dev/null || echo "000")
if [ "$public_fe" = "200" ]; then ok "Public frontend HTTP $public_fe"; else fail "Public frontend HTTP $public_fe"; fi

# --- Summary ---
section "Summary"
issues=0
systemctl is-active --quiet doocard-backend  || ((issues++))
systemctl is-active --quiet doocard-frontend || ((issues++))
systemctl is-active --quiet httpd            || ((issues++))
echo "$public_health" | grep -q '"status":"ok"' || ((issues++))

if [ "$issues" -eq 0 ]; then
  ok "All critical checks passed"
  exit 0
else
  fail "$issues critical check(s) failed — review output above"
  exit 1
fi
