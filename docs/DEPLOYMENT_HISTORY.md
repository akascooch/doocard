# Doocard deployment history

Authoritative live identity also lives in `C:\scooch\doocard-prod-path-registry.md`.  
Do not git-pull `/var/www/doocard`. Never `rsync --delete`. Never unmask apache2. Never prisma migrate from this overlay.

---

## 2026-09-21 — Phase 4 overlay (LIVE)

| Field | Value |
|------|--------|
| Date | 2026-09-21 ~12:47–12:51 +0330 (UTC overlay TS `20260921_091707`) |
| Release name | Phase 4 overlay on v2.0.9 + C1 + Aurora |
| Status | **LIVE** — Phase 6 public HTTPS **COMPLETED - VERIFIED GREEN (200 OK across apex & www)** |
| Local tag | `v2.0.9-phase4-live` (annotated closeout on `release/v2.0.7`) |
| TLS notAfter | **2026-11-28** 09:09:33 GMT (Let’s Encrypt YR1, `CN=doocardbarbershop.com`) |
| Scope | Backend + frontend **source** overlay; Ubuntu `npm run build` (66/66). Windows `dist` / `.next/standalone` not copied. No git-pull, no `rsync --delete`, no Prisma migrate/reset, `.env` untouched. |
| Build ID | `l_E4fUOsSFUY1q_5_1o_i` (source `.next/BUILD_ID` == standalone) |
| Previous BUILD_ID | `GXqDfIChPN-l8H_zu6d8l` (Aurora 2026-09-20) |
| Backend PID | `1125564` (was `997096`) |
| Frontend PID | `1125586` (was `1047125`) |
| DB dump | `/var/backups/doocard/doocard_pre_phase4_20260921_091707.dump` |
| Dump size | 6,085,113 bytes (5.9M) |
| Dump SHA256 | `6cee713b3d94b9aafdc0693ddddd5db394ce741e57560963b82f5f96f5f1415a` |
| Code backups | `/var/www/doocard/_backups/code/` `backend-dist-before-phase4-20260921_091707.tgz` (616K); `backend-src-before-phase4-20260921_091707.tgz` (353K); `frontend-src-before-phase4-20260921_091707.tgz` (29M); `frontend-standalone-before-phase4-20260921_091707.tgz` (56M) |

### What shipped

Cheque due SMS cron `0 9 * * *` Asia/Tehran with T-2 / T-1 / T-0 only; public booking `now+2h` server+UI lock (staff bypass kept); login/auth polish + `/logo/logo-512.png`; appointment/auth `console.log` hygiene; `POST /appointments` throttle 12/min; production HSTS on Next headers.

### Rollback procedure (owner-approved only)

Do **not** restore the DB dump unless data is damaged. Restore runtime first:

```bash
ssh doocard-prod 'set -euo pipefail
BK=/var/www/doocard/_backups/code
BE=/var/www/doocard/backend
FE=/var/www/doocard/frontend
tar -xzf "$BK/backend-dist-before-phase4-20260921_091707.tgz" -C "$BE"
tar -xzf "$BK/frontend-standalone-before-phase4-20260921_091707.tgz" -C "$FE"
test "$(cat "$FE/.next/BUILD_ID" 2>/dev/null || cat "$FE/.next/standalone/.next/BUILD_ID")" = "$(cat "$FE/.next/standalone/.next/BUILD_ID")"
pm2 reload doocard-backend --update-env || pm2 restart doocard-backend --update-env
pm2 reload doocard-frontend --update-env || pm2 restart doocard-frontend --update-env
'
```

Optional source restore (then Ubuntu rebuild): `backend-src-before-phase4-20260921_091707.tgz` and `frontend-src-before-phase4-20260921_091707.tgz`. Do not git-pull. Do not prisma migrate. Do not overwrite `.env`. Do not unmask apache2.

---

## 2026-09-21 — Phase 6 public HTTPS / nginx Host-header smoke (COMPLETED)

| Field | Value |
|------|--------|
| Status | **COMPLETED - VERIFIED GREEN (200 OK across apex & www)** |
| When | 2026-09-21 ~13:12–13:13 +0330 (loopback) and ~13:12:50 +0330 (workstation public DNS) |
| Domains | `doocardbarbershop.com`, `www.doocardbarbershop.com` (nginx `sites-enabled/doocard`) |
| Routes | `/login` 200 Next.js; `/logo/logo-512.png` 200 `image/png` 227744 bytes; `/api/health` 200 JSON 101 bytes via `proxy_pass http://doocard_backend` |
| HTTP :80 | 301 → `https://doocardbarbershop.com/login` |
| TLS | Let’s Encrypt YR1; notBefore 2026-08-30; **notAfter 2026-11-28** 09:09:33 GMT; curl `ssl_verify=0` |
| Security headers on `/login` | HSTS `max-age=63072000; includeSubDomains; preload`; `X-Content-Type-Options: nosniff`; `X-Frame-Options: DENY`; `X-Powered-By: Next.js` |
| nginx errors | No `111` Connection refused in probe window. Tail was scanner `.env` denies (`access forbidden by rule`). |
| Production mutation | None (read-only curl / openssl / log tail). apache2 remained **masked**. |

---

## 2026-09-21 — Phase 7 local release closeout (CLOSED)

| Field | Value |
|------|--------|
| Status | **MILESTONE CLOSED** — ready for regular salon operations |
| Git branch | `release/v2.0.7` |
| Local tag | `v2.0.9-phase4-live` |
| Production | Not mutated. Dirty prod `main` was not git-pulled. |
| Path registry | `C:\scooch\doocard-prod-path-registry.md` (outside this git root; updated in place) |

---

## 2026-09-20 — Aurora v2.0.9 UI Overlay (superseded by Phase 4)

| Field | Value |
|------|--------|
| Date | 2026-09-20 |
| Release name | Aurora v2.0.9 UI Overlay |
| Status | **SUPERSEDED** — runtime replaced by Phase 4 BUILD_ID `l_E4fUOsSFUY1q_5_1o_i` |
| Git commit | `115ab729b6915bb8ab026ff6546b1b4593caa715` (`115ab72`) on `release/v2.0.7` |
| Auth commit (included) | `479de77f80f96ba2a897a9ad5712332e8afb45bf` |
| Local tag | `v2.0.9-aurora-live` (annotated, freeze at `115ab72`) |
| Build ID | `GXqDfIChPN-l8H_zu6d8l` (source `.next/BUILD_ID` == standalone) |
| Previous BUILD_ID | `Yp0c2YCiBG5xjj0NfDSrA` |
| Scope | Frontend-only. Backend PID unchanged. No DB, no `.env`, no git-pull. |
| Live backup | `/var/www/doocard/frontend_backup_aurora/20260920_084749/` |
| Backup files | `frontend-src.tgz` (29M), `frontend-standalone.tgz` (44M) |

### What shipped

Obsidian auth shell, `DashboardShell` / `DashboardTopbar`, scoped Aurora CSS, primitive/token polish, removal of `Sidebar.tsx`, `AdminSidebar.tsx`, `header.tsx`. Ubuntu `npm run build` 66/66 then `pm2 reload doocard-frontend`.

### Rollback procedure (owner-approved only)

The src tarball was packed with `-C /var/www/doocard/frontend` (entries are `src/…`, `public/…`, not a nested inner `src`). Extracting into `frontend/src` would create `src/src` and will **not** restore the previous tree.

**Preferred (restore pre-Aurora Linux standalone, no rebuild):**

```bash
ssh doocard-prod 'set -euo pipefail
BK=/var/www/doocard/frontend_backup_aurora/20260920_084749
FE=/var/www/doocard/frontend
tar -xzf "$BK/frontend-src.tgz" -C "$FE"
tar -xzf "$BK/frontend-standalone.tgz" -C "$FE"
test "$(cat "$FE/.next/BUILD_ID")" = "$(cat "$FE/.next/standalone/.next/BUILD_ID")"
pm2 reload doocard-frontend --update-env || pm2 restart doocard-frontend --update-env
'
```

**Alternative (restore source, rebuild on Ubuntu):**

```bash
ssh doocard-prod 'set -euo pipefail
BK=/var/www/doocard/frontend_backup_aurora/20260920_084749
FE=/var/www/doocard/frontend
tar -xzf "$BK/frontend-src.tgz" -C "$FE"
cd "$FE" && npm run build
pm2 reload doocard-frontend --update-env || pm2 restart doocard-frontend --update-env
'
```

Do not restore unless explicitly approved. Do not git-pull. Do not prisma migrate. Do not overwrite `.env`.

---

## 2026-09-19 — C1 settle-lock (backend, still live under Phase 4)

| Field | Value |
|------|--------|
| Commit | `6864c5c` |
| Scope | Backend `SELECT … FOR UPDATE` in appointment `settle()` |
| Frontend | Not rebuilt at that time (BUILD_ID was `Yp0c2YCiBG5xjj0NfDSrA`) |
