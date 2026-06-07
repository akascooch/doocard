#!/usr/bin/env bash
# Doocard production stabilization — run ON SERVER as root
# Phases 1-7: AI context, health, security, SSL, backups, doctor, logrotate
# Usage: bash /root/production-stabilize.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

APP_ROOT="/var/www/doocard/current"
AI_DIR="${APP_ROOT}/ai"
DEPLOY_DIR="${APP_ROOT}/deploy"
BACKUP_DIR="/var/backups/doocard"
LOG="/var/log/doocard/stabilize.log"
DOMAIN="www.doocardbarbershop.com"
APEX="doocardbarbershop.com"
SERVER_IP="45.159.114.60"

mkdir -p "$(dirname "$LOG")" /var/log/doocard
exec > >(tee -a "$LOG") 2>&1

echo "========================================"
echo " Doocard Production Stabilize"
echo " Started: $(date -Is)"
echo "========================================"

require_root() {
  [ "$(id -u)" -eq 0 ] || { echo "Must run as root"; exit 1; }
}

# ---------------------------------------------------------------------------
# PHASE 1 — AI context (auto-detect live state)
# ---------------------------------------------------------------------------
phase1_ai_context() {
  echo ">>> PHASE 1: AI context"
  mkdir -p "$AI_DIR"

  local node_ver npm_ver pg_ver redis_ver httpd_ver da_ver
  node_ver=$(node -v 2>/dev/null || echo "unknown")
  npm_ver=$(npm -v 2>/dev/null || echo "unknown")
  pg_ver=$(psql --version 2>/dev/null | head -1 || echo "unknown")
  redis_ver=$(redis-server --version 2>/dev/null | head -1 || echo "unknown")
  httpd_ver=$(httpd -v 2>/dev/null | head -1 || echo "unknown")
  da_ver=$(/usr/local/directadmin/directadmin v 2>/dev/null | head -1 || echo "DirectAdmin unknown")

  local backend_main ssl_cert ssl_key
  backend_main=$(find "${APP_ROOT}/backend/dist" -name main.js 2>/dev/null | head -1 || echo "dist/src/main.js")
  ssl_cert=$(grep -m1 'SSLCertificateFile' /etc/httpd/conf/extra/httpd-doocard-proxy.conf 2>/dev/null | awk '{print $2}' || echo "/etc/httpd/conf/ssl.crt/server.crt.combined")
  ssl_key=$(grep -m1 'SSLCertificateKeyFile' /etc/httpd/conf/extra/httpd-doocard-proxy.conf 2>/dev/null | awk '{print $2}' || echo "/etc/httpd/conf/ssl.key/server.key")

  cat > "${AI_DIR}/AI_CONTEXT_PRODUCTION.md" <<EOF
# Doocard — AI Production Context

**Generated:** $(date -Is)  
**Environment:** LIVE PRODUCTION  
**Domain:** https://${DOMAIN}  
**Server IP:** ${SERVER_IP}  
**OS:** $(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-Ubuntu 22.04}" || echo "Ubuntu 22.04")  
**Control Panel:** DirectAdmin ${da_ver}

## Application

| Component | Path | Port |
|-----------|------|------|
| App root (current) | ${APP_ROOT} | — |
| Backend (NestJS) | ${APP_ROOT}/backend | 3001 |
| Frontend (Next.js) | ${APP_ROOT}/frontend | 3000 |
| Backend entry | ${backend_main} | — |

## Runtime services (systemd)

- \`doocard-backend.service\` → Node backend on :3001
- \`doocard-frontend.service\` → Next.js on :3000
- \`httpd\` → Apache edge proxy (80/443)
- \`nginx\` → internal proxy on :8080 only
- \`postgresql\` → database \`doocard\`
- \`redis-server\` → Bull queue / cache

## Edge routing (Apache)

Config: \`/etc/httpd/conf/extra/httpd-doocard-proxy.conf\`  
Included via: \`/etc/httpd/conf/extra/httpd-includes.conf\`

| Path | Upstream |
|------|----------|
| /api/ | http://127.0.0.1:3001/api/ |
| /uploads/ | http://127.0.0.1:3001/uploads/ |
| /socket.io/ | ws://127.0.0.1:3001/socket.io/ |
| / | http://127.0.0.1:3000/ |

## SSL

- Certificate file: \`${ssl_cert}\`
- Private key: \`${ssl_key}\`
- Issuer: Let's Encrypt (via DirectAdmin AutoSSL or certbot)
- DNS: Cloudflare (not modifiable from server)

## Stack versions

- Node: ${node_ver}
- npm: ${npm_ver}
- PostgreSQL: ${pg_ver}
- Redis: ${redis_ver}
- Apache: ${httpd_ver}

## Health check

\`\`\`bash
curl -sf https://${DOMAIN}/api/health
# Expected: {"status":"ok","info":{"database":{"status":"up"}}}
\`\`\`

## Deploy authority

Scripts in \`${APP_ROOT}/deploy/\` and \`/root/\` are operational source of truth.  
Never rebuild server. Never change DNS from server. Never change app ports.
EOF

  cat > "${AI_DIR}/SERVER_TOPOLOGY.md" <<EOF
# Doocard Server Topology

**Server:** ${SERVER_IP}  
**Generated:** $(date -Is)

## Request flow

\`\`\`
Internet
  │
  ▼
Cloudflare DNS (${DOMAIN} → ${SERVER_IP})
  │
  ▼
Apache httpd (:80 / :443)  ← public edge
  │
  ├─ /api/*      → 127.0.0.1:3001  (doocard-backend)
  ├─ /uploads/*  → 127.0.0.1:3001
  ├─ /socket.io/ → 127.0.0.1:3001 (WebSocket)
  └─ /*          → 127.0.0.1:3000  (doocard-frontend)

nginx (:8080) — internal only, not public edge
\`\`\`

## Directory layout

\`\`\`
/var/www/doocard/
├── current/          → active release (symlink)
│   ├── backend/
│   ├── frontend/
│   ├── deploy/
│   └── ai/           → AI context (this directory)
├── releases/         → timestamped deploys
└── shared/

/var/log/doocard/     → application logs
/var/log/httpd/       → doocard-access.log, doocard-ssl-*.log
/var/backups/doocard/ → PostgreSQL daily dumps
\`\`\`

## Systemd units

| Unit | WorkingDirectory | ExecStart |
|------|------------------|-----------|
| doocard-backend | ${APP_ROOT}/backend | node ${backend_main} |
| doocard-frontend | ${APP_ROOT}/frontend | next start -p 3000 |

## Config reload safety

\`\`\`bash
httpd -t && systemctl reload httpd
nginx -t && systemctl reload nginx   # internal only
\`\`\`

## SSH access

- Port: 3031 (DirectAdmin custom)
- User: root
- Do NOT disable password auth without key-based fallback confirmed
EOF

  cat > "${AI_DIR}/INCIDENT_HISTORY.md" <<EOF
# Doocard Incident History

**Last updated:** $(date -Is)

## 2026-06-02 — Production cutover to ${SERVER_IP}

- Migrated from legacy server 185.255.88.158
- Apache reverse proxy configured (httpd-doocard-proxy.conf)
- systemd services: doocard-backend, doocard-frontend
- DNS cutover required manual Cloudflare A-record change
- Let's Encrypt SSL issued after DNS propagation

## 2026-06-02 — Apache vhost binding

- vhost binds to ${SERVER_IP}:80/443 (not 127.0.0.1)
- Local curl requires \`Host: ${DOMAIN}\` header when testing via IP

## 2026-02 — Calendar / timezone fix

- PersianDatePicker portal fix deployed
- Tehran-time "today" detection in appointments.service.ts

## Known constraints

| Constraint | Reason |
|------------|--------|
| No DNS changes from server | Cloudflare controlled externally |
| No port changes | Apache proxy hardcoded to 3000/3001 |
| No server rebuild | Live production with customer data |
| Memory before build | Frontend build OOM without swap |

## Recovery commands

\`\`\`bash
systemctl status doocard-backend doocard-frontend httpd
journalctl -u doocard-backend -n 50 --no-pager
bash ${DEPLOY_DIR}/doctor.sh
httpd -t && systemctl reload httpd
\`\`\`
EOF

  cat > "${AI_DIR}/AI_OPERATION_RULES.md" <<EOF
# AI Operation Rules — Doocard Production

## Hard constraints

1. **Never** rebuild or reprovision the server
2. **Never** modify DNS (Cloudflare only)
3. **Never** change application ports (3000 frontend, 3001 backend)
4. **Never** run destructive DB commands without explicit approval
5. **Never** commit or expose secrets (.env, keys, passwords)
6. **Never** skip \`httpd -t\` before Apache reload
7. **Never** lock out SSH (verify before changing PermitRootLogin, PasswordAuthentication, UFW)

## Session startup checklist

1. \`systemctl status doocard-backend doocard-frontend httpd\`
2. DNS: \`dig +short ${DOMAIN} A\` → ${SERVER_IP}
3. SSL expiry check
4. \`curl -sf https://${DOMAIN}/api/health\`

## Safe deploy workflow

1. Edit files in ${APP_ROOT} or upload via pscp
2. Backend: \`cd backend && npm run build && systemctl restart doocard-backend\`
3. Frontend: verify memory/swap, \`npm run build\`, \`systemctl restart doocard-frontend\`
4. Config: \`httpd -t && systemctl reload httpd\`
5. Smoke: \`bash ${DEPLOY_DIR}/doctor.sh\`

## Authoritative scripts

| Script | Purpose |
|--------|---------|
| ${DEPLOY_DIR}/doctor.sh | Health monitoring |
| ${DEPLOY_DIR}/production-stabilize.sh | Full stabilization |
| /root/remote-apache-proxy.sh | Apache proxy apply |
| /root/remote-cutover-finish.sh | DNS + SSL cutover |

## DirectAdmin notes

- Panel path: /usr/local/directadmin/
- SSL: DirectAdmin AutoSSL or certbot webroot /var/www/html
- NOT cPanel — do not assume cPanel paths
EOF

  chmod 644 "${AI_DIR}"/*.md
  echo "AI context written to ${AI_DIR}"
  ls -la "${AI_DIR}"
}

# ---------------------------------------------------------------------------
# PHASE 2 — Health verification
# ---------------------------------------------------------------------------
phase2_health() {
  echo ">>> PHASE 2: Health verification"
  systemctl status doocard-backend --no-pager | head -12 || true
  systemctl status doocard-frontend --no-pager | head -12 || true
  httpd -t
  curl -sf "http://127.0.0.1:3001/api/health" | head -c 200; echo
  curl -sf -o /dev/null -w "frontend_local:%{http_code}\n" "http://127.0.0.1:3000/" || true
  curl -sf -o /dev/null -w "public:%{http_code}\n" "https://${DOMAIN}/" || true
  curl -sf "https://${DOMAIN}/api/health"; echo
}

# ---------------------------------------------------------------------------
# PHASE 3 — Security hardening (non-destructive)
# ---------------------------------------------------------------------------
phase3_security() {
  echo ">>> PHASE 3: Security hardening"

  # fail2ban
  if ! dpkg -l fail2ban 2>/dev/null | grep -q '^ii'; then
    apt-get update -y
    apt-get install -y fail2ban
    echo "fail2ban installed"
  else
    echo "fail2ban already installed"
  fi

  mkdir -p /etc/fail2ban/jail.d
  cat > /etc/fail2ban/jail.d/doocard.local <<'F2B'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port    = 3031,22
filter  = sshd
logpath = /var/log/auth.log
maxretry = 5

[apache-auth]
enabled = true
port    = http,https
filter  = apache-auth
logpath = /var/log/httpd/*error*log
maxretry = 5
F2B

  systemctl enable fail2ban
  systemctl restart fail2ban
  fail2ban-client status 2>/dev/null || true

  # UFW audit only — do NOT auto-enable restrictive rules on DirectAdmin
  echo "--- UFW status ---"
  if command -v ufw >/dev/null 2>&1; then
    ufw status verbose 2>/dev/null || true
    echo "NOTE: UFW not auto-modified (DirectAdmin may manage firewall)"
  else
    echo "ufw not installed"
  fi

  echo "--- Listening ports (public-facing) ---"
  ss -tlnp | grep -E ':(22|80|443|3031)\s' || true

  echo "--- SSH policy (audit only, NOT changed) ---"
  grep -E '^(PermitRootLogin|PasswordAuthentication|Port|MaxAuthTries)' /etc/ssh/sshd_config 2>/dev/null || true
  echo "SSH policy left unchanged to avoid lockout"
}

# ---------------------------------------------------------------------------
# PHASE 4 — SSL safety
# ---------------------------------------------------------------------------
phase4_ssl() {
  echo ">>> PHASE 4: SSL safety"

  echo "--- Certificate expiry ---"
  for cert in /etc/httpd/conf/ssl.crt/server.crt.combined \
              /usr/local/directadmin/data/users/admin/domains/${APEX}.cert.combined \
              /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; do
    if [ -f "$cert" ]; then
      echo "File: $cert"
      openssl x509 -in "$cert" -noout -subject -issuer -dates 2>/dev/null || true
    fi
  done

  echo | openssl s_client -connect "${DOMAIN}:443" -servername "$DOMAIN" 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates 2>/dev/null || true

  echo "--- Renewal dry-run ---"
  if [ -x /usr/local/directadmin/scripts/letsencrypt.sh ]; then
    echo "DirectAdmin LE script present: /usr/local/directadmin/scripts/letsencrypt.sh"
    echo "DA manages renewal — check CustomBuild cron"
  fi
  if command -v certbot >/dev/null 2>&1; then
    certbot renew --dry-run 2>&1 | tail -15 || echo "certbot dry-run failed (may be DA-managed)"
  else
    echo "certbot not installed — SSL likely managed by DirectAdmin"
  fi

  echo "--- Auto-renew cron ---"
  grep -r -l 'letsencrypt\|certbot\|lego' /etc/cron.* /var/spool/cron 2>/dev/null | head -10 || true
  ls -la /etc/cron.d/ 2>/dev/null | grep -iE 'ssl|cert|le' || true
}

# ---------------------------------------------------------------------------
# PHASE 5 — Database backup
# ---------------------------------------------------------------------------
phase5_backup() {
  echo ">>> PHASE 5: Database backup"

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  cat > /usr/local/bin/doocard-pg-backup <<'BKUP'
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/var/backups/doocard"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="${BACKUP_DIR}/doocard-${STAMP}.sql.gz"
mkdir -p "$BACKUP_DIR"
sudo -u postgres pg_dump -Fc doocard | gzip > "$FILE"
chmod 600 "$FILE"
find "$BACKUP_DIR" -name 'doocard-*.sql.gz' -type f | sort | head -n -7 | xargs -r rm -f
echo "$(date -Is) backup OK: $FILE ($(du -h "$FILE" | awk '{print $1}'))"
BKUP
  chmod 750 /usr/local/bin/doocard-pg-backup

  # Cron at 3 AM daily
  CRON_LINE="0 3 * * * root /usr/local/bin/doocard-pg-backup >> /var/log/doocard/backup.log 2>&1"
  if [ -f /etc/cron.d/doocard-backup ]; then
    grep -q doocard-pg-backup /etc/cron.d/doocard-backup || echo "$CRON_LINE" > /etc/cron.d/doocard-backup
  else
    echo "$CRON_LINE" > /etc/cron.d/doocard-backup
    chmod 644 /etc/cron.d/doocard-backup
  fi

  echo "--- Test pg_dump ---"
  /usr/local/bin/doocard-pg-backup
  ls -lh "$BACKUP_DIR" | tail -8
}

# ---------------------------------------------------------------------------
# PHASE 6 — Install doctor.sh
# ---------------------------------------------------------------------------
phase6_doctor() {
  echo ">>> PHASE 6: Monitoring script"
  mkdir -p "$DEPLOY_DIR"
  if [ -f /root/doctor.sh ]; then
    install -m 755 /root/doctor.sh "${DEPLOY_DIR}/doctor.sh"
  elif [ -f "${DEPLOY_DIR}/doctor.sh" ]; then
    chmod 755 "${DEPLOY_DIR}/doctor.sh"
  else
    echo "WARN: doctor.sh not found — upload from repo deploy/doctor.sh"
  fi
  if [ -x "${DEPLOY_DIR}/doctor.sh" ]; then
    bash "${DEPLOY_DIR}/doctor.sh" || true
  fi
}

# ---------------------------------------------------------------------------
# PHASE 7 — Log rotation
# ---------------------------------------------------------------------------
phase7_logrotate() {
  echo ">>> PHASE 7: Log rotation"

  cat > /etc/logrotate.d/doocard <<'LR'
/var/log/doocard/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
    sharedscripts
    postrotate
        systemctl reload doocard-backend 2>/dev/null || true
    endscript
}

/var/log/httpd/doocard-*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        /bin/systemctl reload httpd > /dev/null 2>/dev/null || true
    endscript
}
LR

  echo "--- logrotate config test ---"
  logrotate -d /etc/logrotate.d/doocard 2>&1 | tail -10 || true
  echo "logrotate config installed: /etc/logrotate.d/doocard"
}

# ---------------------------------------------------------------------------
main
# ---------------------------------------------------------------------------
require_root
phase1_ai_context
phase2_health
phase3_security
phase4_ssl
phase5_backup
phase6_doctor
phase7_logrotate

echo "========================================"
echo " STABILIZE COMPLETE: $(date -Is)"
echo " AI context: ${AI_DIR}"
echo " Doctor: ${DEPLOY_DIR}/doctor.sh"
echo " Backups: ${BACKUP_DIR}"
echo " Log: ${LOG}"
echo "========================================"
