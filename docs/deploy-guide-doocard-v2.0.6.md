# Doocard v2.0.6 production deploy guide

**Status (2026-09-07):** local verification + Git commit on `release/v2.0.6`.  
**SSH / production mutation: NOT RUN.** This file is the runbook only.

Always read first:

- `C:\scooch\ip.txt`
- `C:\scooch\doocard-prod-path-registry.md`

Do not guess paths. If live server state disagrees with the registry, **stop and report drift** before overlay.

---

## 1. Purpose

Release `v2.0.6` (GitHub branch `release/v2.0.6`) adds:

- Luxury monochrome public landing (`frontend/src/app/page.tsx`)
- Tabbed admin homepage CMS (hero, slides, landing staff)
- Prisma `LandingSlide` + homepage/employee CMS fields
- `GET /api/homepage/public-data`, slides CRUD, `POST /api/homepage/upload`
- Mobile header: login / register / booking always visible + drawer
- Additive migration `20260907180000_add_landing_page_cms_and_slides`

This document is **not** a license to `git pull` a dirty production tree.

---

## 2. Why not overlay Windows `dist/` / `.next/standalone`

Local is **win32**. Production is **Ubuntu + Node v20.11.1**.

- Next `output: 'standalone'` embeds platform `node_modules`. A Windows-built `.next/standalone` **will not** run on Linux.
- Prisma query engines are also platform-specific. Never copy `node_modules` from Windows.
- **Correct path:** overlay **source** (`src`, `prisma`, configs, `public`) → `npx prisma generate` + `npm run build` **on the server**.

True blue/green zero-downtime is **not** how this host is wired (nginx aliases a single standalone path). Expect a **short reload window** during frontend `npm run build` + `pm2 reload`.

---

## 3. Production Git (blocking)

Last documented (2026-09-06, `ip.txt` / v2.0.5 guide):

- `/var/www/doocard` is Git `main` @ `0537c56`, **dirty**
- Live apps are untracked lowercase `backend/` and `frontend/`
- **Forbidden:** `git checkout`, `git pull origin/release/v2.0.6`, `git reset --hard`

**Correct code path:** tar overlay into those live trees, then build in place. Re-verify porcelain **read-only** immediately before overlay; if it changed, stop.

---

## 4. Pre-deploy drift check (read-only, first SSH)

Do this before any backup/mutate. Record output; do not change anything yet.

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
uname -r
systemctl is-active nginx; systemctl is-enabled apache2 || true
pm2 list | grep doocard
curl -sS -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:3001/api/health
curl -sS -o /dev/null -w 'home=%{http_code}\n' http://127.0.0.1:3000/
echo 'BUILD_ID_SRC='$(cat /var/www/doocard/frontend/.next/BUILD_ID 2>/dev/null || echo MISSING)
echo 'BUILD_ID_RT='$(cat /var/www/doocard/frontend/.next/standalone/.next/BUILD_ID 2>/dev/null || echo MISSING)
cd /var/www/doocard && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD
cd /var/www/doocard/backend && npx prisma migrate status || true
test -d prisma/migrations/20260907180000_add_landing_page_cms_and_slides && echo LANDING_MIGRATION_DIR=present || echo LANDING_MIGRATION_DIR=absent
EOF
```

Stop if: nginx is not active, apache2 is unmasked/running, BUILD_IDs mismatch, or Git layout is no longer dirty-`main` + live `backend/`/`frontend/`.

---

## 5. Deploy procedure (after explicit owner approval)

Order is mandatory: **read-only drift → DB backup → code-tree backup → overlay source → install/generate → migrate → build → PM2 reload → verify**.

### 5.1 Database backup

Database: `doocard` on `127.0.0.1`. Dump as OS user `postgres` (peer auth). Write under `/var/www/doocard/_backups/db/`.

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
TS=$(date -u +%Y%m%d_%H%M%S)
DIR=/var/www/doocard/_backups/db
mkdir -p "$DIR"
TMP="/tmp/doocard-prod-backup-${TS}.dump"
OUT="$DIR/doocard-prod-pre-v2.0.6-${TS}.dump"
sudo -u postgres pg_dump -Fc -d doocard -f "$TMP"
mv "$TMP" "$OUT"
chmod 600 "$OUT"
SUM=$(sha256sum "$OUT" | awk '{print $1}')
printf 'BACKUP_FILE=%s\nCHECKSUM=%s\nDB_NAME=doocard\n' "$OUT" "$SUM" | tee /tmp/deploy_backup_info_v206.txt
ls -l "$OUT"
EOF
```

Do not print `DATABASE_URL`. Restore (manual, owner-approved only):  
`sudo -u postgres pg_restore --clean --if-exists -d doocard FILE.dump`

### 5.2 Live tree backup (source + runtime)

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
TS=$(date -u +%Y%m%d_%H%M%S)
DIR=/var/www/doocard/_backups
mkdir -p "$DIR"
tar -czf "$DIR/backend-src-before-v206-$TS.tgz" \
  -C /var/www/doocard/backend src prisma package.json package-lock.json nest-cli.json tsconfig.json ecosystem.config.js || true
tar -czf "$DIR/frontend-src-before-v206-$TS.tgz" \
  -C /var/www/doocard/frontend src public scripts next.config.js package.json package-lock.json ecosystem.config.js || true
tar -czf "$DIR/backend-dist-before-v206-$TS.tgz" -C /var/www/doocard/backend dist || true
tar -czf "$DIR/frontend-standalone-before-v206-$TS.tgz" -C /var/www/doocard/frontend .next/standalone || true
ls -lh "$DIR"/*v206-$TS.tgz "$DIR"/db/doocard-prod-pre-v2.0.6-*.dump | tail -20
EOF
```

### 5.3 Overlay source from local (Windows)

From `C:\scooch\Versions\v.2.0.4` (PowerShell). Do **not** pack `node_modules`, `.next`, `dist`, `.env`.

```powershell
$root = 'C:\scooch\Versions\v.2.0.4'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$out = "C:\scooch\_backups\v206-overlay-$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null

tar -C "$root\backend" -czf "$out\backend-src.tgz" `
  --exclude=node_modules --exclude=dist --exclude=.env --exclude=uploads `
  src prisma package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json ecosystem.config.js

tar -C "$root\frontend" -czf "$out\frontend-src.tgz" `
  --exclude=node_modules --exclude=.next --exclude=.env --exclude=.env.local --exclude=.env.production `
  src public scripts next.config.js package.json package-lock.json ecosystem.config.js

Get-FileHash -Algorithm SHA256 "$out\backend-src.tgz","$out\frontend-src.tgz"
scp -P 3031 "$out\backend-src.tgz" "$out\frontend-src.tgz" doocard-prod:/tmp/
```

On the server (extract **into** live trees; keep production `.env`):

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
cd /var/www/doocard/backend
tar -xzf /tmp/backend-src.tgz
cd /var/www/doocard/frontend
tar -xzf /tmp/frontend-src.tgz
test -f /var/www/doocard/backend/.env
test -f /var/www/doocard/backend/prisma/migrations/20260907180000_add_landing_page_cms_and_slides/migration.sql
test -f /var/www/doocard/frontend/src/app/page.tsx
test -f /var/www/doocard/frontend/src/components/landing/LandingHeader.tsx
rm -f /tmp/backend-src.tgz /tmp/frontend-src.tgz
EOF
```

Never overwrite `/var/www/doocard/backend/.env` or `/var/www/doocard/frontend/.env.production`.

### 5.4 Install, generate, migrate (before replacing runtime)

Additive migration: extra columns + `landing_slides`. Old `dist` can keep serving until rebuild.

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
cd /var/www/doocard/backend
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
EOF
```

Never `prisma db push`. Never `migrate reset`. Never `migrate dev` on production.

### 5.5 Build (this is the short-downtime window for frontend)

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
cd /var/www/doocard/backend
npm run build
test -f dist/main.js

cd /var/www/doocard/frontend
npm ci
npm run build
test -f .next/standalone/server.js
test -d .next/standalone/.next/static
test -d .next/standalone/public
test "$(cat .next/BUILD_ID)" = "$(cat .next/standalone/.next/BUILD_ID)"
EOF
```

`frontend` `postbuild` must run `scripts/sync-standalone.mjs`.

### 5.6 Graceful PM2 reload

Use **names**, not numeric IDs.

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
pm2 reload doocard-backend --update-env || pm2 restart doocard-backend --update-env
pm2 reload doocard-frontend --update-env || pm2 restart doocard-frontend --update-env
pm2 save
pm2 describe doocard-frontend | sed -n '1,30p'
pm2 describe doocard-backend | sed -n '1,30p'
EOF
```

Do not `pm2 logs` without `--lines` / a timeout.

### 5.7 Post-deploy smoke

```bash
ssh doocard-prod 'bash -s' << 'EOF'
set -euo pipefail
systemctl is-active nginx
systemctl is-enabled apache2 || true
pm2 list | grep doocard
curl -sS -o /dev/null -w 'be_health=%{http_code}\n' http://127.0.0.1:3001/api/health
curl -sS -o /dev/null -w 'public_data=%{http_code}\n' http://127.0.0.1:3001/api/homepage/public-data
curl -sS -o /dev/null -w 'fe_home=%{http_code}\n' http://127.0.0.1:3000/
H='Host: www.doocardbarbershop.com'
curl -sS -k -o /dev/null -w 'https_health=%{http_code}\n' -H "$H" https://127.0.0.1/api/health
curl -sS -k -o /dev/null -w 'https_home=%{http_code}\n' -H "$H" https://127.0.0.1/
curl -sS -k -o /dev/null -w 'https_public_data=%{http_code}\n' -H "$H" https://127.0.0.1/api/homepage/public-data
echo SRC=$(cat /var/www/doocard/frontend/.next/BUILD_ID)
echo RT=$(cat /var/www/doocard/frontend/.next/standalone/.next/BUILD_ID)
bash /var/www/doocard/deploy/verify-frontend-prod.sh
EOF
```

HTTP 200 is necessary but not sufficient. Require:

- matching BUILD_IDs
- PM2 cwd backend = `/var/www/doocard/backend`, frontend = `.../frontend/.next/standalone`
- nginx still on 80/443; Node still `127.0.0.1:3000/3001`
- `public-data` JSON includes `heroTitle`, `slides`, `staff`
- homepage HTML is monochrome (no live `#c6a75e` hero)

Manual UI (owner): `/`, `/login`, `/register`, `/dashboard/admin/homepage` as ADMIN (upload one slide).

---

## 6. Rollback (owner-approved)

1. Restore `backend-src` / `frontend-src` tarballs from `/var/www/doocard/_backups/`.
2. Restore `backend-dist` and `frontend-standalone` tarballs **or** rebuild previous source.
3. Database: restore the `.dump` **only** if the landing migration must be undone. Prisma has **no** down migration. Additive columns/table can usually stay.
4. `pm2 restart doocard-frontend doocard-backend --update-env`
5. Re-run §5.7.

---

## 7. Environment notes

- Local `.env`: development only; Gitignored.
- Production backend `.env`: `/var/www/doocard/backend/.env`. Print flags only, never secrets.
- `uploads/landing/` must exist or be creatable by the backend process (`mkdir` on first upload).
- nginx already aliases `/uploads/` to backend; do not change nginx for this release.
- `ip.txt` must never be committed.

---

## 8. First-run result (2026-09-07)

| Step | Result |
|------|--------|
| Local prisma generate | PASS |
| Local backend tsc + nest build | (recorded in release chat) |
| Local frontend tsc + next build | (recorded in release chat) |
| Git branch | `release/v2.0.6` |
| Production SSH | **NOT RUN** |
| Prod DB backup / overlay / migrate / PM2 | **NOT RUN** |
