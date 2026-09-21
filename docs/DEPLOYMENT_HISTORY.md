# Doocard deployment history

Authoritative live identity also lives in `C:\scooch\doocard-prod-path-registry.md`.  
Do not git-pull `/var/www/doocard`. Never `rsync --delete`. Never unmask apache2. Never prisma migrate from this overlay.

---

## 2026-09-21 — Phase 4 overlay (LIVE, archived)

Full operational log, rollback commands, Phase 6 GREEN evidence, and Phase 7 closeout: [`docs/archive/v2.0.9-phase4-log.md`](archive/v2.0.9-phase4-log.md).

| Field | Value |
|------|--------|
| Status | **LIVE** — `PRODUCTION_TRAFFIC_VERIFIED_GREEN` |
| Tag | `v2.0.9-phase4-live` → `9e5d99171679be710c115b512614cff1681a69a5` |
| BUILD_ID | `l_E4fUOsSFUY1q_5_1o_i` |
| TLS notAfter | **2026-11-28** |

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
