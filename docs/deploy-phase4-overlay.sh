#!/usr/bin/env bash
# Phase 4 overlay: cheque SMS T-2/T-1/T-0, auth polish, 2h booking, hygiene.
# Source overlay + Ubuntu build. Never git-pull, rsync --delete, prisma migrate,
# Windows .next/dist, .env overwrite, or apache2 unmask.
#
#   DEPLOY_CONFIRM=GO_FOR_PROD bash /tmp/deploy-phase4-overlay.sh

set -euo pipefail

ROOT=/var/www/doocard
BE="$ROOT/backend"
FE="$ROOT/frontend"
BACKUP_DB=/var/backups/doocard
BACKUP_CODE="$ROOT/_backups/code"
BE_TAR=/tmp/backend-phase4-overlay.tar.gz
FE_TAR=/tmp/frontend-phase4-overlay.tar.gz
TS="$(date -u +%Y%m%d_%H%M%S)"
LOG="/tmp/deploy-phase4-${TS}.log"

fail() { echo "FATAL: $*" | tee -a "$LOG" >&2; exit 1; }
info() { echo "$*" | tee -a "$LOG"; }

require_confirm() {
  if [[ "${DEPLOY_CONFIRM:-}" != "GO_FOR_PROD" ]]; then
    fail "refusing to run. Set DEPLOY_CONFIRM=GO_FOR_PROD after owner sign-off."
  fi
}

preflight() {
  info "=== 1. preflight ==="
  [[ "$(systemctl is-active nginx)" == "active" ]] || fail "nginx is not active"
  apache_load="$(systemctl show apache2 -p LoadState --value 2>/dev/null || true)"
  [[ "$apache_load" == "masked" ]] || fail "apache2 is not masked (LoadState=${apache_load:-unknown})"
  httpd_active="$(systemctl is-active httpd 2>/dev/null || true)"
  [[ "$httpd_active" != "active" ]] || fail "httpd is active"
  command -v pm2 >/dev/null || fail "pm2 missing"
  pm2 list | grep -q 'doocard-backend' || fail "pm2 app doocard-backend missing"
  pm2 list | grep -q 'doocard-frontend' || fail "pm2 app doocard-frontend missing"
  [[ -f "$BE/.env" ]] || fail "missing backend .env"
  [[ -f "$BE_TAR" && -f "$FE_TAR" ]] || fail "missing overlay tarballs in /tmp"
  if tar -tzf "$BE_TAR" | grep -E '(^|/)\.env($|\.)|node_modules|query_engine-windows' >/dev/null; then
    fail "backend tarball contains .env, node_modules, or Windows Prisma engine"
  fi
  if tar -tzf "$FE_TAR" | grep -E '(^|/)\.env($|\.)|node_modules|(^|/)\.next(/|$)' >/dev/null; then
    fail "frontend tarball contains .env, node_modules, or .next"
  fi
  tar -tzf "$BE_TAR" | grep -F 'src/sms/cheque-due-sms-reminder.service.ts' >/dev/null \
    || fail "backend tarball missing cheque reminder service"
  tar -tzf "$BE_TAR" | grep -F 'src/appointments/appointments.service.ts' >/dev/null \
    || fail "backend tarball missing appointments.service.ts"
  tar -tzf "$FE_TAR" | grep -F 'src/app/login/page.tsx' >/dev/null \
    || fail "frontend tarball missing login page"
  tar -tzf "$FE_TAR" | grep -F 'next.config.js' >/dev/null \
    || fail "frontend tarball missing next.config.js"
  be_health="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3001/api/health || true)"
  fe_login="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000/login || true)"
  info "pre_health backend=${be_health} login=${fe_login}"
  [[ "$be_health" == "200" ]] || fail "preflight backend health expected 200 got ${be_health}"
  [[ "$fe_login" == "200" ]] || fail "preflight /login expected 200 got ${fe_login}"
  df -h / /var /tmp | tee -a "$LOG"
  info "preflight ok"
}

backup_db() {
  info "=== 2. database backup ==="
  mkdir -p "$BACKUP_DB"
  chmod 700 "$BACKUP_DB" 2>/dev/null || true
  local dump="$BACKUP_DB/doocard_pre_phase4_${TS}.dump"
  local tmp="/tmp/doocard-pre-phase4-${TS}.dump"
  sudo -u postgres pg_dump -Fc -d doocard -f "$tmp"
  mv "$tmp" "$dump"
  chmod 600 "$dump"
  local sum size
  sum="$(sha256sum "$dump" | awk '{print $1}')"
  size="$(stat -c %s "$dump")"
  [[ "$size" -gt 1000000 ]] || fail "backup dump too small (${size} bytes)"
  info "BACKUP_FILE=$dump"
  info "BACKUP_BYTES=$size"
  info "CHECKSUM=$sum"
  ls -lh "$dump" | tee -a "$LOG"
  printf 'BACKUP_FILE=%s\nBACKUP_BYTES=%s\nCHECKSUM=%s\n' "$dump" "$size" "$sum" \
    > /tmp/deploy_phase4_backup_info.txt
}

backup_trees() {
  info "=== 3. runtime tree backup ==="
  mkdir -p "$BACKUP_CODE"
  tar -czf "$BACKUP_CODE/backend-dist-before-phase4-${TS}.tgz" -C "$BE" dist \
    || fail "backend dist backup failed"
  tar -czf "$BACKUP_CODE/frontend-standalone-before-phase4-${TS}.tgz" -C "$FE" .next/standalone \
    || fail "standalone backup failed"
  tar -czf "$BACKUP_CODE/frontend-src-before-phase4-${TS}.tgz" \
    -C "$FE" src public next.config.js \
    || fail "frontend src backup failed"
  tar -czf "$BACKUP_CODE/backend-src-before-phase4-${TS}.tgz" -C "$BE" src \
    || fail "backend src backup failed"
  ls -lh "$BACKUP_CODE"/*phase4-${TS}.tgz | tee -a "$LOG"
}

overlay() {
  info "=== 4. overlay source (no --delete, env untouched) ==="
  [[ -f "$BE/.env" ]] || fail "backend .env missing before overlay"
  ( cd "$BE" && tar -xzf "$BE_TAR" )
  ( cd "$FE" && tar -xzf "$FE_TAR" )
  [[ -f "$BE/.env" ]] || fail "backend .env missing after overlay"
  grep -F "0 9 * * *" "$BE/src/sms/cheque-due-sms-reminder.service.ts" >/dev/null \
    || fail "cheque cron 09:00 not present after overlay"
  grep -F "زمان رزرو باید حداقل ۲ ساعت از زمان فعلی جلوتر باشد" \
    "$BE/src/appointments/appointments.service.ts" >/dev/null \
    || fail "2h booking message missing after overlay"
  grep -F "Strict-Transport-Security" "$FE/next.config.js" >/dev/null \
    || fail "HSTS missing from next.config.js after overlay"
  [[ -f "$FE/src/lib/booking-lead-time.ts" ]] || fail "booking-lead-time.ts missing"
  [[ -f "$FE/public/logo/logo-512.png" ]] || fail "logo-512.png missing"
  info "overlay ok"
}

build() {
  info "=== 5. Ubuntu builds (not Windows dist/.next) ==="
  cd "$BE"
  npm run build
  [[ -f "$BE/dist/main.js" ]] || fail "backend dist/main.js missing"
  grep -F "0 9 * * *" "$BE/dist/sms/cheque-due-sms-reminder.service.js" >/dev/null \
    || fail "compiled cheque cron missing 09:00"
  grep -F "زمان رزرو باید حداقل ۲ ساعت از زمان فعلی جلوتر باشد" \
    "$BE/dist/appointments/appointments.service.js" >/dev/null \
    || fail "compiled 2h message missing"
  cd "$FE"
  npm run build
  [[ -f "$FE/.next/standalone/server.js" ]] || fail "standalone/server.js missing"
  [[ -d "$FE/.next/standalone/.next/static" ]] || fail "standalone static missing"
  [[ -f "$FE/.next/standalone/public/logo/logo-512.png" ]] || fail "standalone logo missing"
  local src_id rt_id
  src_id="$(cat "$FE/.next/BUILD_ID")"
  rt_id="$(cat "$FE/.next/standalone/.next/BUILD_ID")"
  [[ "$src_id" == "$rt_id" ]] || fail "BUILD_ID mismatch src=$src_id rt=$rt_id"
  info "BUILD_ID=$src_id"
}

reload_pm2() {
  info "=== 6. PM2 reload (fork mode restarts Nest so cron registers) ==="
  chmod -R u=rwX,go=rX "$FE/.next/standalone/.next/static" 2>/dev/null || true
  chmod -R u=rwX,go=rX "$FE/.next/standalone/public" 2>/dev/null || true
  pm2 reload doocard-backend --update-env || pm2 restart doocard-backend --update-env
  sleep 3
  pm2 reload doocard-frontend --update-env || pm2 restart doocard-frontend --update-env
  pm2 save
  pm2 list | tee -a "$LOG"
}

smoke() {
  info "=== 7. smoke ==="
  sleep 10
  local be login logo
  be="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3001/api/health || true)"
  login="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/login || true)"
  logo="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/logo/logo-512.png || true)"
  info "be_health=$be fe_login=$login logo=$logo"
  [[ "$be" == "200" ]] || fail "backend /api/health expected 200 got $be"
  [[ "$login" == "200" ]] || fail "frontend /login expected 200 got $login"
  [[ "$logo" == "200" ]] || fail "logo expected 200 got $logo"
  curl -sS --max-time 15 http://127.0.0.1:3000/login | grep -q 'aurora-auth-shell' \
    || fail "live /login HTML missing aurora-auth-shell"
  systemctl is-active nginx | grep -qx active || fail "nginx dropped during deploy"
  apache_load="$(systemctl show apache2 -p LoadState --value 2>/dev/null || true)"
  [[ "$apache_load" == "masked" ]] || fail "apache2 is no longer masked"
  info "SMOKE_OK TS=$TS BUILD_ID=$(cat "$FE/.next/BUILD_ID")"
}

main() {
  require_confirm
  umask 077
  : > "$LOG"
  info "deploy-phase4 start TS=$TS log=$LOG"
  preflight
  backup_db
  backup_trees
  umask 022
  overlay
  build
  reload_pm2
  smoke
  info "DONE phase4. Rollback dumps: $BACKUP_DB/doocard_pre_phase4_${TS}.dump"
  info "Rollback code: $BACKUP_CODE/*phase4-${TS}.tgz then rebuild/reload"
}

main "$@"
