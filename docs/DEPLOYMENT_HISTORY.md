# Doocard deployment history

Authoritative live identity also lives in `C:\scooch\doocard-prod-path-registry.md`.  
Do not git-pull `/var/www/doocard`. Never `rsync --delete`. Never unmask apache2. Never prisma migrate from this overlay.

---

## 2026-09-22 — Phase 11 closeout (`v2.0.9-glasschip`)

| Field | Value |
|------|--------|
| Date | 2026-09-22 (~18:00–18:30 +0330) |
| Status | **SUCCESS** — cycle **CLOSED** |
| Build ID | `8Gd4etZ-wCok7njiRXtc3` (src == standalone) |
| Overlay SHA-256 | `843FD253CF9A63937583280246B103DEE13AE34266DCCE640829F6159CC8BFD8` (`doocard-overlay-v2.0.9-glasschip-20260922-173110-47b3fea.tar.gz`) |
| Tag | `v2.0.9-glasschip` (annotated) |
| Verification | GlassChip Active; `/api/health` **200**; PM2 online (backend **1214691**, frontend **1214714**); unstable_restarts **0** |
| Monitoring | Post-deploy **spot check** (not full 24h elapsed). Err logs: pre-existing `sharp` missing, push `endpoint` unique, `jwt expired`, slow requests — **no** new crash storm / OOM after Phase 10 PIDs |
| Local archive | `C:\scooch\_archives\2026-09-22-v209-glasschip\phase9-overlay-20260922_172016\` (moved from `_backups`) |
| Server `/tmp` cleanup | Removed glasschip BE/FE tarballs + `deploy-phase10-20260922_142340.log`. **DB dump intact:** `/var/backups/doocard/doocard_pre_phase10_20260922_142340.dump` |
| Residual (non-blocking) | Install `sharp` in FE standalone; push-subscription unique handling — follow-up cycle |

---

## 2026-09-22 — Phase 10 production overlay LIVE (`v2.0.9` GlassChip)

| Field | Value |
|------|--------|
| Status | **LIVE** — source overlay + Ubuntu build; false-negative smoke (`curl\|grep` curl 23) ignored after repeat verify |
| When | 2026-09-22 ~17:53–18:05 +0330 (UTC TS `20260922_142340`) |
| Artifacts | BE `A7977B51…71BD` + FE `D5530CF8…8839` (archived Phase 11 → `C:\scooch\_archives\2026-09-22-v209-glasschip\phase9-overlay-20260922_172016\`) |
| Method | Separate extract into `/var/www/doocard/{backend,frontend}` (not root bundle dump). No `--delete`, no git-pull, `.env` untouched |
| Pre BUILD_ID | `l_E4fUOsSFUY1q_5_1o_i` |
| New BUILD_ID | `8Gd4etZ-wCok7njiRXtc3` (src == standalone) |
| DB backup | `/var/backups/doocard/doocard_pre_phase10_20260922_142340.dump` (6 105 635 B) SHA256 `bd0cadfdbbedbe5cd0976e12aa28356694174a84ed2d5b9df386e36ec5a615b4` |
| Code backups | `/var/www/doocard/_backups/code/*-before-phase10-20260922_142340.tgz` |
| PM2 | backend pid **1214691**, frontend pid **1214714** (reload both) |
| Smoke | `/api/health` `/login` `/logo` 200; login HTML has `aurora-auth-shell`; G6 curl 92 (no HTML); apex/www `/login` 200; nginx active; apache2 masked |
| GlassChip | Present on disk; appointments page imports `GlassChip` |

Rollback (owner-approved only): restore `frontend-standalone-before-phase10-20260922_142340.tgz` + matching src/dist backups, `pm2 reload`; DB restore only if data damage.

---

## 2026-09-22 — Phase 9 local packaging (`v2.0.9` GlassChip overlay)

| Field | Value |
|------|--------|
| Scope | **Local only.** No production SSH, scp, or write. |
| Artifact dir | `C:\scooch\_backups\phase9-overlay-20260922_172016\` |
| Combined bundle | `doocard-overlay-v2.0.9-glasschip-20260922-173110-47b3fea.tar.gz` (SHA256 `843FD253CF9A63937583280246B103DEE13AE34266DCCE640829F6159CC8BFD8`) — wraps BE+FE tarballs + manifests; **not** named v2.0.8 (drift rejected) |
| Bundle manifest | `manifest-20260922-173110.txt` |
| Backend tarball | `backend-v2.0.9-glasschip-20260922_172016-47b3fea.tar.gz` (580 314 B) |
| Frontend tarball | `frontend-v2.0.9-glasschip-20260922_172016-47b3fea.tar.gz` (30 029 570 B) |
| SHA256 backend | `A7977B51609ADD64F9C6569E343562E35F11B1AC929F68182B7356788DBD71BD` |
| SHA256 frontend | `D5530CF86178CB62453CC673ECDD7F07DA98B22CF0DD9281D5CD5A887CA68839` |
| Manifests | `backend-manifest.txt` (749 entries), `frontend-manifest.txt` (475 entries) |
| Layout validation | `layout-validation.txt` — maps to `/var/www/doocard/{backend,frontend}`; no `--delete` |
| Phase 10 gate | `PHASE10-CHECKLIST.md` (not executed) |
| Lineage | HEAD `47b3fea` / describe `v2.0.9-phase4-live-1-g47b3fea` + **uncommitted** Phase 8.1 GlassChip/Auth UI. Prompt claim `v2.0.8@21f407b` = **DRIFT rejected**. |
| type-check | FE + BE **PASS** (0 errors) |
| build | FE **PASS** — Generating static pages **(66/66)**; local BUILD_ID `wTw3w1Po1zpw8fdx7qgVm` (Windows verify only; prod must Ubuntu-rebuild) |
| Secrets audit | **CLEAN** — no `.env*`, keys, `node_modules`, `.next`, Windows Prisma engine, or `%TEMP%` password in archives |
| git status | **Not clean** — approved overlay dirty tree (GlassChip + AuthSplitShell + related; docs). Not force-committed. |
| OVERLAY-READY | Still **YES (Fully Verified)** from Phase 8.2; packaging complete. **Phase 10 not started.** |

---

## 2026-09-22 — Phase 8.2 final browser smoke (`v2.0.9`)

| Field | Value |
|------|--------|
| Scope | Local only. No production SSH. No app logic change this phase. |
| Admin session | Real local ADMIN `aurora-visual-qa-admin@local.test` (password rotated only for this local QA user; stored under `%TEMP%\phase82-admin-pass.txt`, not logged). |
| Visual Sign-off | **SIGNED** |
| OVERLAY-READY | **YES (Fully Verified)** |

### Gates

| Gate | Result | Evidence |
|------|--------|----------|
| CSS: no blanket idle `!important` lock on GlassChip | **PASS** | `blanketIdleLockPresent=false`; hover + selected:hover rules present |
| Booking hover delta | **PASS** | idle `rgba(17,24,39,0.05)` → hover `0.1` / border `0.25` |
| Booking selected | **PASS** | `data-selected=true` / `aria-pressed=true` |
| Dashboard status = GlassChip (not Select) | **PASS** | 5 chips; `selectComboboxInFilters=0` |
| Filter click / focus | **PASS** | focusOk; selected after click |
| No forced login redirect / session modal | **PASS** | stayed on `/dashboard/appointments` |
| DevTools console errors | **PASS** | `realConsole=[]` |
| Network 4xx/5xx (non-benign) | **PASS** | `realNet=[]` |

Note: intentional theme `!important` still exists on public-booking chip **hover/selected** rules so they win over the light-island CSS; the obstructive blanket idle lock from Phase 8 is gone.

---

## 2026-09-22 — Phase 8.1 GlassChip hover + dashboard filter 2b (`v2.0.9`)

| Field | Value |
|------|--------|
| Scope | Local only. No production SSH. |
| Files | `frontend/src/app/aurora-dashboard.css`; `frontend/src/app/dashboard/appointments/page.tsx` |
| Visual Sign-off | **SUPERSEDED by Phase 8.2 Fully Verified** |
| OVERLAY-READY | **SUPERSEDED** — see Phase 8.2 **YES (Fully Verified)**. Residual from 8.1 (stub session) closed. |

### Re-QA matrix

| Item | Evidence | Result |
|------|----------|--------|
| Public booking GlassChip hover | idle `rgba(17,24,39,0.05)` → hover `rgba(17,24,39,0.1)` border `0.25` | **PASS** |
| Public booking selected | `data-selected=true` / `aria-pressed=true`; selected/hover `~0.16` | **PASS** |
| Dashboard status filters | 5× `GlassChip` (همه / نیاز به تأیید / تأیید شده / تسویه شده / لغو شده); click sets `data-selected`; dark glass `bg-white/15` + amber ring; mobile overflow-x=0 | **PASS** (UI) |
| GlassChip unit | 7/7 | **PASS** |
| Hydration / React overlay | none on booking or appointments shell | **PASS** |
| Clean console on dashboard | stub token → expected 401/500 API noise | **residual** |

Root cause hover: blanket `.aurora-public-booking button.glass-chip { background… !important }` locked idle. Fixed with `:not([data-selected])` + `:hover` / selected hover rules.

---

## 2026-09-22 — Phase 8 local visual QA (`v2.0.9`)

| Field | Value |
|------|--------|
| Scope | Local only (`C:\scooch\Versions\v.2.0.4`). No production SSH. No source change. |
| Runtime | Next `http://127.0.0.1:3000` + Nest local (after Nest listen). Playwright/msedge. |
| Viewports | Desktop **1280×800** (≥1024). Mobile **390×844** (≤430). |
| Visual Sign-off | **SUPERSEDED by Phase 8.1** — was NOT SIGNED (hover FAIL; filters 2b FAIL). |
| OVERLAY-READY | **SUPERSEDED** — see Phase 8.1 **YES (Local Verified)**. |

### Matrix (historical Phase 8)

| Item | Desktop | Mobile | Result |
|------|---------|--------|--------|
| `/login` AuthSplitShell: no aside, card centered (`cardCenterOffsetPx=0`), no overflow-x | aside=false, card 448px centered | aside=false, card 350px centered | **PASS** |
| `/login?staff=1` same shell, password fields, no overflow | same | — | **PASS** |
| GlassChip on `/book-appointment` step 2: idle `rgba(17,24,39,0.05)` + `blur(12px)` + dark type; selected `data-selected=true` / `aria-pressed=true` / `rgba(17,24,39,0.12)` | 7 chips, grid OK | 3-col grid OK | **PASS** (idle/selected/layout) |
| GlassChip hover | computed bg unchanged (public `!important` idle rule) | same | **FAIL** → fixed in 8.1 |
| GlassChip disabled live | no disabled slot in sample | — | **not observed** |
| Dashboard filters (phase 2b) | `/dashboard/appointments` redirected to `/login` (no local admin session). Source still shadcn `Select`, **not** `GlassChip`. | — | **FAIL** → fixed in 8.1 |

Browser console on `/login`, staff login, and booking chip flow: **empty** (no hydration overlay / React error). Next server log had `ECONNREFUSED :3001` only before Nest finished starting — not a client hydration failure.

---

## 2026-09-22 — Phase 7 nginx Host-header harden (`v2.0.9-phase7-hardened`)

| Field | Value |
|------|--------|
| Status | **LIVE** — G6 Host-header leak closed. App overlay unchanged (`BUILD_ID` `l_E4fUOsSFUY1q_5_1o_i`). |
| When | 2026-09-22 12:18:54 UTC / 15:48:54 +0330 |
| Scope | nginx only. Two new `default_server` blocks prepended. Existing apex/www vhosts **not** edited. |
| Backup | `/etc/nginx/sites-available/doocard.bak.20260922T121854Z` (not under `sites-enabled/`; `include *` would have loaded a `.bak` there) |
| nginx | 1.18.0 (Ubuntu). Exact `ssl_reject_handshake` **rejected** (`unknown directive`). Compat: `listen 443 ssl default_server` + same Let’s Encrypt certs + `return 444`. Port 80: `return 444`. |
| Reload | `nginx -t` OK then `systemctl reload nginx`. apache2 still masked. UFW/SSH untouched. |

### G6 evidence (after reload)

Loopback `curl -skI -H "Host: evil.invalid" https://127.0.0.1/`: curl **92**, `http=000 bytes=0`, `HTTP/2 stream 0 was not closed cleanly: PROTOCOL_ERROR` — no HTML.

Loopback HTTP: `curl: (52) Empty reply from server` (nginx 444).

External `curl -skI -H "Host: evil.invalid" https://45.159.114.60/`: curl **56** `schannel: server closed abruptly (missing close_notify)`.

Known traffic still **200** apex/www; HTTP/80 known still **301** to `https://doocardbarbershop.com/`; `:3000` and `/api/health` **200**.

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
