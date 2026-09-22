# Build Manifest — v2.0.10 Glass Buttons (Wave A)

**Phase:** 4 — Local Packaging & Build Verification  
**Date:** 2026-09-22 18:53:13 +03:30  
**Gate inputs:** `docs/QA_GLASS_VERIFICATION_20260922.md` (SYSTEM STABLE), `docs/GLASS_IMPLEMENTATION_20260922.md`  
**Scope:** **Frontend-only** local packaging. No SSH, no rsync, no PM2, no git push/tag.

---

## Release identity

| Field | Value |
|------|--------|
| Release name | **v2.0.10-glass-buttons** |
| `frontend/package.json` version | **2.0.10** (bumped from 2.0.9 for this train) |
| Git HEAD (committed) | `29fa2100bbb844cceea1f808efb846c051b0272b` (`v2.0.9-glasschip`) |
| Working tree | **Dirty** — Wave A glass conversion + Phase 3 QA docs/tests included in this **local build** but **not** committed at packaging time |
| Prior prod tag | `v2.0.9-glasschip` / live BUILD_ID was `8Gd4etZ-wCok7njiRXtc3` (Phase 11) |

---

## Build result

| Field | Value |
|------|--------|
| Command | `cd frontend && npm run build` (+ `postbuild` → `scripts/sync-standalone.mjs`) |
| Exit code | **0** |
| Compile | ✓ Compiled successfully |
| Static pages | **66/66** generated |
| TypeScript / ESLint in build | **Skipped** by Next config (`Skipping validation of types` / `Skipping linting`) — unit suite was green in Phase 3 |
| Next.js | 14.1.0 |
| BUILD_ID (`.next` == standalone) | **`-_134KP8UC43zIyYREaCn`** |

### Standalone assembly verified

| Path | Status |
|------|--------|
| `frontend/.next/standalone/server.js` | OK |
| `frontend/.next/standalone/.next/static/` | OK (synced) |
| `frontend/.next/standalone/public/` | OK (synced) |
| `frontend/.next/standalone/public/logo/logo-2048.png` | OK |
| BUILD_ID match source ↔ standalone | OK |

---

## Artifact

| Field | Value |
|------|--------|
| Path | `C:\scooch\_backups\phase4-glass-buttons-20260922\build-v2.0.10-glass-buttons.tar.gz` |
| Contents | Packed from `frontend/.next/standalone/*` (Windows standalone runtime tree) |
| Size | **36,401,938** bytes (~34.7 MiB) |
| SHA-256 | `E5AA58CCEF759414311CD8ED688E8219A2F6DDE198B07757964068E22F5FD07E` |
| Checksum file | `C:\scooch\_backups\phase4-glass-buttons-20260922\SHA256SUMS.txt` |

Verify:

```powershell
Get-FileHash -Algorithm SHA256 'C:\scooch\_backups\phase4-glass-buttons-20260922\build-v2.0.10-glass-buttons.tar.gz'
```

---

## Backend / release scope

| Check | Result |
|------|--------|
| `git status --short backend/` | **Empty** — no unbuilt backend changes |
| Release type | **Frontend-only** Wave A glass buttons overlay |
| DB / Prisma / `.env` | Untouched |

---

## Live deployment gate notes (do not execute in this phase)

1. This artifact is a **Windows-built** standalone. Project production-safe path historically prefers **source overlay + Ubuntu `npm run build`**. Treat this tarball as **local staging / rollback reference**; confirm with release owner before copying Windows standalone to prod.
2. Working tree is dirty relative to `29fa210` — commit (or freeze) Wave A sources before tagging `v2.0.10-glass-buttons` on remote.
3. Do **not** `rsync --delete`, git-pull dirty prod `main`, or unmask apache2.

---

## State

**PACKAGING COMPLETE — READY FOR LIVE DEPLOYMENT GATE**
