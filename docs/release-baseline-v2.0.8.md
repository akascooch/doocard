# Doocard production release baseline — v2.0.8

**Status:** RELEASE OFFICIALLY CLOSED  
**Authoritative for:** production runtime identity after 2026-09-17 overlay deploy  
**Do not git-pull** `/var/www/doocard`. Overlay source, build on Ubuntu. Never unmask apache2. Never `rsync --delete`.

## Identity

| Field | Value |
|------|--------|
| Current production release | `v2.0.8` |
| Release commit | `21f407bf43da0927e2aa5c85c22d56737d51d893` |
| Local tags | annotated `v2.0.8`, also `v2.0.8-rc1` (same commit) |
| Production SHA | `21f407b` — local branch pointer `release/v2.0.8` matches this SHA |
| Working branch | `release/v2.0.7` (may include later docs-only commits; tag stays on `21f407b`) |
| Deployment date | 2026-09-17 |
| Previous baseline | `v2.0.7-hardened` plus frog overlay tag `v2.0.7-frog-patch` (`9c35aff`) |
| Tag publication | `origin` — `v2.0.8` and `release/v2.0.8` published 2026-09-17 after DEVICE QA PASS |

## Production runtime

| Role | Path / name |
|------|-------------|
| Backend entry | `/var/www/doocard/backend/dist/main.js` |
| Frontend entry | `/var/www/doocard/frontend/.next/standalone/server.js` |
| PM2 backend | `doocard-backend` (cwd `/var/www/doocard/backend`) |
| PM2 frontend | `doocard-frontend` (cwd `/var/www/doocard/frontend/.next/standalone`) |
| Local health | `http://127.0.0.1:3001/api/health`, `http://127.0.0.1:3000/` |
| Public | nginx :443 → localhost Node; apache2 **masked** |

Post-deploy BUILD_ID pair (2026-09-17): `RzQl9JH-p0hoPReNOfWOg`

## Rollback artifacts (do not restore unless owner-approved)

- Dump: `/var/www/doocard/_backups/db/doocard-prod-pre-v2.0.8-20260917_171852.dump` (mode 600, 5999204 bytes, SHA256 `b63c0840dd0d5a0dc8c117eaaa4b954c3c5a30076ef74621402232e434a5577b`)
- Code tarballs: `/var/www/doocard/_backups/code/*-before-v208-20260917_171852.tgz`
- Applied migration (do not re-run): `20260917120000_product_packaging_snapshots` (`finished_at=2026-09-17 20:54:46 +03:30`, not rolled back)

## Local workspace

- Root: `C:\scooch\Versions\v.2.0.4`
- Packer: `docs/pack-v208-overlay.ps1`
- Deploy runner: `docs/deploy-v208.sh` (`npm ci --no-audit --no-fund`; `pipefail`-safe tar member checks)
- Local JWT/smoke helpers: `backend/scripts/local-*.ts` — **gitignored**, do not commit
- Connection: `C:\scooch\ip.txt` (SSH `doocard-prod`, port 3031, key-only). Network/UFW facts in that file are unchanged by this release.

## Closure

- Physical iPhone Safari QA: **PASS** (operator 2026-09-17).
- Origin: `release/v2.0.7`, `release/v2.0.8`, tag `v2.0.8` published after DEVICE QA PASS.
