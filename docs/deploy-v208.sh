#!/usr/bin/env bash
# deploy-v208.sh — production overlay for Doocard v2.0.8 (Sprint 2)
# RUN ON doocard-prod ONLY after local pack + scp of tarballs to /tmp
# and after owner types: GO FOR PROD
#
# Refuse to start unless: DEPLOY_CONFIRM=GO_FOR_PROD
# Never: git pull / checkout / reset, rsync --delete, prisma migrate reset/dev/db push,
#        overwrite .env, unmask apache2, copy Windows node_modules/.next/dist
#
# Usage (on server, after tarballs are in /tmp):
#   DEPLOY_CONFIRM=GO_FOR_PROD bash /tmp/deploy-v208.sh

set -euo pipefail

ROOT=/var/www/doocard
BE="$ROOT/backend"
FE="$ROOT/frontend"
BACKUP_DB="$ROOT/_backups/db"
BACKUP_CODE="$ROOT/_backups/code"
BE_TAR=/tmp/backend-v208-overlay.tar.gz
FE_TAR=/tmp/frontend-v208-overlay.tar.gz
TS="$(date -u +%Y%m%d_%H%M%S)"
LOG="/tmp/deploy-v208-${TS}.log"
MIG=20260917120000_product_packaging_snapshots

fail() { echo "FATAL: $*" | tee -a "$LOG" >&2; exit 1; }
info() { echo "$*" | tee -a "$LOG"; }

# Capture listing first. `set -o pipefail` + `grep -q` SIGPIPEs tar (exit 141)
# and falsely reports a missing member.
tar_list() { tar -tzf "$1"; }
tar_has() {
  local listing
  listing="$(tar_list "$1")" || return 1
  printf '%s\n' "$listing" | grep -F -- "$2" >/dev/null
}
tar_has_re() {
  local listing
  listing="$(tar_list "$1")" || return 1
  printf '%s\n' "$listing" | grep -Eq -- "$2"
}

require_confirm() {
  if [[ "${DEPLOY_CONFIRM:-}" != "GO_FOR_PROD" ]]; then
    fail "refusing to run. Set DEPLOY_CONFIRM=GO_FOR_PROD after owner sign-off."
  fi
}

preflight() {
  info "=== 1. preflight (read-only gates) ==="
  [[ "$(systemctl is-active nginx)" == "active" ]] || fail "nginx is not active"
  apache_load="$(systemctl show apache2 -p LoadState --value 2>/dev/null || true)"
  apache_en="$(systemctl is-enabled apache2 2>/dev/null || true)"
  if [[ "$apache_load" != "masked" && "$apache_en" != "masked" ]]; then
    fail "apache2 is not masked (LoadState=${apache_load:-unknown} enabled=${apache_en:-unknown}; do not unmask)"
  fi
  httpd_active="$(systemctl is-active httpd 2>/dev/null || true)"
  if [[ "$httpd_active" == "active" ]]; then
    fail "httpd is active; abort"
  fi
  command -v pm2 >/dev/null || fail "pm2 missing"
  pm2 list | grep -q 'doocard-backend' || fail "pm2 app doocard-backend missing"
  pm2 list | grep -q 'doocard-frontend' || fail "pm2 app doocard-frontend missing"
  [[ -f "$BE/.env" ]] || fail "missing $BE/.env (do not invent)"
  [[ -d "$BE" && -d "$FE" ]] || fail "live trees missing"
  [[ -f "$BE_TAR" ]] || fail "missing $BE_TAR -- pack+scp from Windows first"
  [[ -f "$FE_TAR" ]] || fail "missing $FE_TAR -- pack+scp from Windows first"
  if tar_has_re "$BE_TAR" '(^|/)\.env($|\.)|node_modules|query_engine-windows'; then
    fail "backend tarball contains .env, node_modules, or Windows Prisma engine"
  fi
  if tar_has_re "$FE_TAR" '(^|/)\.env($|\.)|node_modules|(^|/)\.next(/|$)'; then
    fail "frontend tarball contains .env, node_modules, or .next"
  fi
  tar_has "$BE_TAR" "prisma/migrations/${MIG}/migration.sql" \
    || fail "backend tarball missing migration $MIG"
  tar_has "$BE_TAR" 'scripts/repair-frog-gregorian-datekeys.ts' \
    || fail "backend tarball missing frog dateKey repair script"
  tar_has "$FE_TAR" 'scripts/sync-standalone.mjs' \
    || fail "frontend tarball missing sync-standalone.mjs"
  df -h / /var /tmp | tee -a "$LOG"
  info "preflight ok nginx=active apache2=masked pm2=named-apps tarballs=present"
}

backup_db() {
  info "=== 2. database backup ==="
  mkdir -p "$BACKUP_DB"
  chmod 700 "$BACKUP_DB" 2>/dev/null || true
  local dump="$BACKUP_DB/doocard-prod-pre-v2.0.8-${TS}.dump"
  local tmp="/tmp/doocard-prod-backup-v208-${TS}.dump"
  # Write as postgres to /tmp first; redirect into _backups can fail on ownership.
  sudo -u postgres pg_dump -Fc -d doocard -f "$tmp"
  mv "$tmp" "$dump"
  chmod 600 "$dump"
  local sum size
  sum="$(sha256sum "$dump" | awk '{print $1}')"
  size="$(stat -c %s "$dump" 2>/dev/null || wc -c < "$dump")"
  info "BACKUP_FILE=$dump"
  info "BACKUP_BYTES=$size"
  info "CHECKSUM=$sum"
  info "DB_NAME=doocard"
  printf 'BACKUP_FILE=%s\nBACKUP_BYTES=%s\nCHECKSUM=%s\nDB_NAME=doocard\nTS=%s\n' \
    "$dump" "$size" "$sum" "$TS" > "/tmp/deploy_backup_info_v208.txt"
}

backup_trees() {
  info "=== 3. source/runtime tree backup ==="
  mkdir -p "$BACKUP_CODE"
  tar -czf "$BACKUP_CODE/backend-src-before-v208-${TS}.tgz" \
    -C "$BE" src prisma scripts package.json package-lock.json nest-cli.json tsconfig.json ecosystem.config.js 2>/dev/null || true
  tar -czf "$BACKUP_CODE/frontend-src-before-v208-${TS}.tgz" \
    -C "$FE" src public scripts next.config.js package.json package-lock.json tsconfig.json tailwind.config.ts postcss.config.js ecosystem.config.js 2>/dev/null || true
  tar -czf "$BACKUP_CODE/backend-dist-before-v208-${TS}.tgz" -C "$BE" dist 2>/dev/null || true
  tar -czf "$BACKUP_CODE/frontend-standalone-before-v208-${TS}.tgz" -C "$FE" .next/standalone 2>/dev/null || true
  ls -lh "$BACKUP_CODE"/*v208-${TS}.tgz | tee -a "$LOG"
}

preserve_env() {
  info "=== 4a. preserve production env files ==="
  mkdir -p "/tmp/v208-env-${TS}"
  cp -a "$BE/.env" "/tmp/v208-env-${TS}/backend.env"
  [[ -f "$FE/.env.production" ]] && cp -a "$FE/.env.production" "/tmp/v208-env-${TS}/frontend.env.production" || true
  [[ -f "$FE/.env.local" ]] && cp -a "$FE/.env.local" "/tmp/v208-env-${TS}/frontend.env.local" || true
}

overlay() {
  info "=== 4b. overlay source tarballs (no --delete, no .env in archive) ==="
  preserve_env
  ( cd "$BE" && tar -xzf "$BE_TAR" )
  ( cd "$FE" && tar -xzf "$FE_TAR" )
  cp -a "/tmp/v208-env-${TS}/backend.env" "$BE/.env"
  [[ -f "/tmp/v208-env-${TS}/frontend.env.production" ]] && cp -a "/tmp/v208-env-${TS}/frontend.env.production" "$FE/.env.production" || true
  [[ -f "/tmp/v208-env-${TS}/frontend.env.local" ]] && cp -a "/tmp/v208-env-${TS}/frontend.env.local" "$FE/.env.local" || true
  [[ -f "$BE/.env" ]] || fail "backend .env missing after overlay restore"
  [[ -f "$BE/prisma/migrations/${MIG}/migration.sql" ]] || fail "missing migration $MIG after overlay"
  [[ -f "$BE/scripts/repair-frog-gregorian-datekeys.ts" ]] || fail "missing frog repair script after overlay"
  [[ -f "$FE/scripts/sync-standalone.mjs" ]] || fail "sync-standalone.mjs missing"
  rm -f "$BE_TAR" "$FE_TAR"
  info "overlay ok; production .env restored"
}

migrate() {
  info "=== 4c. prisma generate + migrate deploy ==="
  cd "$BE"
  npm ci --no-audit --no-fund
  npx prisma generate
  npx prisma migrate deploy
  npx prisma migrate status | tee -a "$LOG"
}

build() {
  info "=== 4d. Linux builds (do not copy Windows dist/.next) ==="
  cd "$BE"
  npm run build
  [[ -f "$BE/dist/main.js" ]] || fail "backend dist/main.js missing"
  cd "$FE"
  npm ci --no-audit --no-fund
  npm run build
  [[ -f "$FE/.next/standalone/server.js" ]] || fail "standalone/server.js missing"
  [[ -d "$FE/.next/standalone/.next/static" ]] || fail "standalone static missing"
  local src_id rt_id
  src_id="$(cat "$FE/.next/BUILD_ID")"
  rt_id="$(cat "$FE/.next/standalone/.next/BUILD_ID")"
  [[ "$src_id" == "$rt_id" ]] || fail "BUILD_ID mismatch src=$src_id rt=$rt_id"
  info "BUILD_ID=$src_id"
}

repair_frog_datekeys() {
  info "=== 4e. frog dateKey repair (dry-run then apply) ==="
  cd "$BE"
  npx ts-node -r tsconfig-paths/register scripts/repair-frog-gregorian-datekeys.ts | tee -a "$LOG"
  npx ts-node -r tsconfig-paths/register scripts/repair-frog-gregorian-datekeys.ts --apply | tee -a "$LOG"
  npx ts-node -r tsconfig-paths/register scripts/repair-frog-gregorian-datekeys.ts | tee -a "$LOG"
}

reload_pm2() {
  info "=== 5a. PM2 reload/restart by name ==="
  # Nest cron / providers: restart backend if reload is insufficient.
  pm2 reload doocard-backend --update-env || pm2 restart doocard-backend --update-env
  pm2 reload doocard-frontend --update-env || pm2 restart doocard-frontend --update-env
  pm2 save
  pm2 list | grep doocard | tee -a "$LOG"
}

smoke() {
  info "=== 5b. smoke ==="
  local be fe
  be="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3001/api/health || true)"
  fe="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/ || true)"
  info "be_health=$be fe_home=$fe"
  [[ "$be" == "200" ]] || fail "backend /api/health expected 200 got $be"
  [[ "$fe" == "200" ]] || fail "frontend / expected 200 got $fe"
  systemctl is-active nginx | grep -qx active || fail "nginx dropped during deploy"
  pm2 logs doocard-backend --lines 40 --nostream | tee -a "$LOG" || true
  pm2 logs doocard-frontend --lines 20 --nostream | tee -a "$LOG" || true
  if [[ -x "$ROOT/deploy/verify-frontend-prod.sh" ]]; then
    bash "$ROOT/deploy/verify-frontend-prod.sh" || fail "verify-frontend-prod.sh failed"
  else
    info "NOTE: $ROOT/deploy/verify-frontend-prod.sh not executable/present — skipped"
  fi
  info "SMOKE_OK v2.0.8 TS=$TS"
}

main() {
  require_confirm
  umask 077
  : > "$LOG"
  info "deploy-v208 start TS=$TS log=$LOG"
  preflight
  backup_db
  backup_trees
  umask 022
  overlay
  migrate
  build
  chmod -R u=rwX,go=rX "$FE/.next/standalone/.next/static" 2>/dev/null || true
  chmod -R u=rwX,go=rX "$FE/.next/standalone/public" 2>/dev/null || true
  chmod u=rwX,go=rX "$FE" "$FE/.next" "$FE/.next/standalone" "$FE/.next/standalone/.next" 2>/dev/null || true
  repair_frog_datekeys
  reload_pm2
  sleep 8
  smoke
  info "deploy-v208 COMPLETE — review $LOG and /tmp/deploy_backup_info_v208.txt"
}

main "$@"
