# Doocard v2.0.5 production deploy guide

**Status (2026-09-06):** documentation + **database backup only**.  
Code sync, `prisma migrate deploy`, and PM2 restart are **blocked** until the production Git drift below is resolved.

Always read first:

- `C:\scooch\ip.txt`
- `C:\scooch\doocard-prod-path-registry.md`

Do not guess paths. If live server state disagrees with this file, stop and report drift.

---

## 1. Purpose

Release `v2.0.5` (GitHub branch `release/v2.0.5`, HEAD `fc6caa5`) adds:

- Cheque due SMS T-3 through T-0 with bank details
- Chequebook archive/restore (`isActive`)
- Staff sales **amount** chart (Rial in API, Toman in UI)
- Staff withdrawals list + ledger ACL for EMPLOYEE
- Tip alerts in-app + push, **no SMS**
- Daily reconcile reminders (13:00 / 20:00 Asia/Tehran)
- Cheque `STAFF_SALARY` payroll expense (`sourceType=CHEQUE_LEAF_PAYROLL`)
- PM2 bind to `127.0.0.1` in ecosystem files
- Ignore local backup dumps in Git

This document is the repeatable, safe production path. It is **not** a license to `git pull` a dirty tree.

---

## 2. Pre-requisites

### Local

- Node.js **20.11.1**, npm ≥ 10
- Prisma 6 CLI (via `backend/node_modules`)
- Git
- SSH client with host `doocard-prod` (port **3031**, key-only)

Authoritative local tree for this release: `C:\scooch\Versions\v.2.0.4`  
(`ip.txt` still mentions `v.2.0.3.3` — path drift.)

### Production (verified 2026-09-06 live SSH)

| Item | Evidence |
|------|----------|
| Host | `45.159.114.60` (`ssh doocard-prod`) |
| Kernel | `5.15.0-190-generic` |
| Node | `v20.11.1` |
| PostgreSQL | **14.24** on `127.0.0.1:5432` (not 18) |
| Database name | `doocard` |
| App root | `/var/www/doocard` |
| FE source | `/var/www/doocard/frontend` |
| FE runtime | `/var/www/doocard/frontend/.next/standalone` + `server.js` |
| BE cwd | `/var/www/doocard/backend` + `dist/main.js` |
| PM2 | `doocard-frontend`, `doocard-backend` (use **names**, not IDs) |
| nginx | **active**, enabled on boot |
| `httpd` | inactive / disabled |
| `apache2` | **masked** — do not unmask |
| UFW | allow 3031/80/443; deny 3000/3001/2222/3306 |
| fail2ban | sshd jail on 3031 |
| Node bind | `127.0.0.1:3000` and `127.0.0.1:3001` |

### Config files (never commit secrets)

- Local backend `.env` — not in Git
- Production backend `.env` — `/var/www/doocard/backend/.env`
- `C:\scooch\ip.txt` — SSH/host notes; contains secrets; **never commit**

### Production Git (blocking drift)

Verified:

- `/var/www/doocard` **is** a Git repo
- Branch: `main` tracking `origin/main`
- HEAD: `0537c56` (“first commit”)
- Working tree: **dirty** (~284 porcelain lines: deleted `Backend/`/`Frontend/` plus untracked live `backend/`/`frontend/`)
- Remote: `git@github.com:akascooch/doocard.git`

**Forbidden on this tree:** `git checkout release/v2.0.5`, `git pull origin release/v2.0.5`, `git reset --hard`. Those would not update the live lowercase trees and can destroy the checkout.

**Correct code path:** rsync/scp **source trees** into `frontend/` and `backend/` (exclude `node_modules`, `.next`, `dist`, `.env`), then build in those directories. See path registry §10.

---

## 3. Pre-deploy security checklist

- [ ] Local `release/v2.0.5` is clean and matches `origin/release/v2.0.5` (`fc6caa5` as of 2026-09-06).
- [ ] No `.env`, `ip.txt`, or backup dumps staged/committed.
- [ ] SSH key-only on 3031 (`ssh doocard-prod`).
- [ ] UFW / nginx / apache2 masked / fail2ban as in the table above.
- [ ] **Full DB backup** taken and checksum recorded (see §4.1).
- [ ] Migrations only via `npx prisma migrate deploy` from **`/var/www/doocard/backend`**. Never `db push`. Never `migrate reset`.
- [ ] **SMS gate:** production `SMS_ENABLED=true`. Reconcile flags are **unset** (code defaults enable live SMS at 13:00 and 20:00 Tehran). Before first v2.0.5 backend start, set in **production** `.env`:
  - `RECONCILE_REMINDER_DRY_RUN=true` **or** `RECONCILE_REMINDER_ENABLED=false`
- [ ] Cheque due SMS volume increases (T-3). Recipients are still hardcoded in code.
- [ ] Pending migrations on prod (dirs missing as of 2026-09-06):
  - `20260903120000_add_cheque_payee_kind`
  - `20260906120000_add_notification_type_account_reconcile`

---

## 4. Deploy procedure (safe)

Order is mandatory: **backup → sync code → install/build → migrate → env gate → PM2 reload → verify**.

### 4.1 Production database backup (do this first)

Database: `doocard` on `127.0.0.1`. Dump as OS user `postgres` (peer auth). Write under `/var/www/doocard/_backups/db/` (not `/home/doocard/...`).

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
cd /tmp
TS=$(date -u +%Y%m%d_%H%M%S)
DIR=/var/www/doocard/_backups/db
mkdir -p "$DIR"
TMP="/tmp/doocard-prod-backup-${TS}.dump"
OUT="$DIR/doocard-prod-backup-${TS}.dump"
sudo -u postgres pg_dump -Fc -d doocard -f "$TMP"
mv "$TMP" "$OUT"
chmod 600 "$OUT"
SUM=$(sha256sum "$OUT" | awk '{print $1}')
printf 'BACKUP_FILE=%s\nCHECKSUM=%s\nDB_NAME=doocard\n' "$OUT" "$SUM" | tee /tmp/deploy_backup_info.txt
ls -l "$OUT"
EOF
```

Do not print `DATABASE_URL`. Restore (manual only): `pg_restore --clean --if-exists -d doocard FILE.dump` after owner approval.

**Taken 2026-09-06:**  
`/var/www/doocard/_backups/db/doocard-prod-pre-v2.0.5-20260906_122633.dump`  
SHA256 `f843e65d0d6bf0d3fe614df7e57bc9e2a18cae5d36cf0a9a8c0877c4e183321d` (5671930 bytes).

### 4.2 Sync code (not git pull)

Do **not** run the following on today’s production Git tree:

```bash
# FORBIDDEN while /var/www/doocard is dirty main@0537c56
git checkout release/v2.0.5
git pull origin release/v2.0.5
```

Instead (after a dedicated approve for code sync):

1. From local `C:\scooch\Versions\v.2.0.4`, pack `frontend/` and `backend/` excluding `node_modules`, `.next`, `dist`, `.env`.
2. On server, tar-backup current `frontend/src` and `backend/src` into `/var/www/doocard/_backups/`.
3. Extract into `/var/www/doocard/frontend` and `/var/www/doocard/backend`.
4. Keep production `.env` files; do not overwrite them with local secrets.

Optional: `bash /var/www/doocard/deploy/prod-release-v2.0.3.3.sh` only after confirming that script still matches this layout (legacy name).

### 4.3 Install and build

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
cd /var/www/doocard/backend
npm ci
npx prisma generate
npm run build

cd /var/www/doocard/frontend
npm ci
npm run build
# postbuild must run scripts/sync-standalone.mjs
test -f .next/standalone/server.js
test -d .next/standalone/.next/static
test "$(cat .next/BUILD_ID)" = "$(cat .next/standalone/.next/BUILD_ID)"
EOF
```

Do not `npm install --omit=dev` at `/var/www/doocard` root. Root `package.json` is not the app.

### 4.4 Prisma migrate deploy

Only after backup §4.1 and backend source contains the two v2.0.5 migration folders.

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
cd /var/www/doocard/backend
npx prisma migrate deploy
npx prisma migrate status
EOF
```

Never `prisma db push`. Never `migrate reset`.

### 4.5 Restart services

After SMS/reconcile env gate:

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
pm2 reload doocard-frontend --update-env || pm2 restart doocard-frontend --update-env
pm2 reload doocard-backend --update-env || pm2 restart doocard-backend --update-env
pm2 save
pm2 describe doocard-frontend | sed -n '1,25p'
pm2 describe doocard-backend | sed -n '1,25p'
EOF
```

Do not use numeric PM2 IDs. Do not `pm2 logs` without `--lines` / timeout (it follows forever).

### 4.6 Post-deploy verification

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
systemctl is-active nginx
systemctl is-enabled apache2 || true
pm2 list | grep doocard
curl -sS -o /dev/null -w 'be=%{http_code}\n' http://127.0.0.1:3001/api/health
curl -sS -o /dev/null -w 'fe=%{http_code}\n' http://127.0.0.1:3000/
H='Host: www.doocardbarbershop.com'
curl -sS -k -o /dev/null -w 'https_health=%{http_code}\n' -H "$H" https://127.0.0.1/api/health
cat /var/www/doocard/frontend/.next/BUILD_ID
cat /var/www/doocard/frontend/.next/standalone/.next/BUILD_ID
bash /var/www/doocard/deploy/verify-frontend-prod.sh
EOF
```

Success is not HTTP 200 alone. Require matching BUILD_IDs, PM2 cwd = standalone / backend, nginx still on 80/443, Node still on localhost.

---

## 5. Environment notes

- Local `.env`: development only; Gitignored.
- Production `.env`: `/var/www/doocard/backend/.env`. Print flags only, never `DATABASE_URL` / JWT / SMS provider keys.
- Backup metadata: `/tmp/deploy_backup_info.txt` on the server after a dump.
- `ip.txt`: operator notes on the Windows machine; never push to GitHub.

---

## 6. Rollback (manual, owner-approved)

1. Restore code tarball from `/var/www/doocard/_backups/`.
2. Rebuild or restore previous `dist` / `.next/standalone`.
3. Database: restore the `.dump` with `pg_restore` **only** if a migration was applied and must be undone. Prisma does not ship a safe automatic `migrate down` for these additive enum/column migrations.
4. `pm2 restart doocard-frontend doocard-backend --update-env`.
5. Re-run §4.6.

Additive migrations (`ChequePayeeKind`, `ACCOUNT_RECONCILE_REMINDER`) are hard to reverse; prefer forward-fix unless data is corrupt.

---

## 7. First-run result (2026-09-06)

| Step | Result |
|------|--------|
| Guide written | This file |
| Prod DB backup | **PASS** (path + SHA256 in §4.1) |
| `git pull` on server | **NOT RUN** (dirty `main`, wrong layout) |
| `npm ci` / build | **NOT RUN** |
| `prisma migrate deploy` | **NOT RUN** (v2.0.5 migration dirs absent; code not synced) |
| PM2 reload | **NOT RUN** (SMS_ENABLED=true + reconcile defaults) |
| Health (pre-change) | backend `/api/health` 200, frontend :3000 200, BUILD_ID `yrHR96YXpeGYoAxlZyPps` both trees |

**Next approved step after owner confirmation:** code sync (not git pull) + set reconcile dry-run + migrate + reload.
