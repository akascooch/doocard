# Doocard — Offline Source Package

## 1. Project / version

- **Project:** Doocard  
- **Version:** `v.2.0.4`  
- **Package type:** source-based offline (Windows destination)

## 2. Source statement

This package was derived from the **Production** application source and verified against the approved production-derived tarball:

- **Tarball path:** `/tmp/doocard-v204-source.tgz`  
- **Tarball SHA-256:** `8c2eb03d9259c1b703c0bfe552a29eb84b5d2145d30a045e2f6d08701944bf49`

### Production application paths used as source

- Backend: `/var/www/doocard/backend`  
- Frontend: `/var/www/doocard/frontend`  
- Root orchestration files (limited): `/var/www/doocard` (`package.json`, `package-lock.json`, `.gitignore`)

Destination folder:

- `C:\scooch\Versions\v.2.0.4`

## 3. What is included

- Backend TypeScript source (`backend/src`)
- Prisma schema and migrations (`backend/prisma`)
- Backend package manifests and lockfile
- Backend config files needed to rebuild (`nest-cli.json`, `tsconfig.json`, etc.)
- Sanitized env templates only (for example `.env.example` / `*.example`)
- Frontend source (`frontend/src`)
- Frontend public/static assets (`frontend/public`)
- Frontend package manifests, lockfile, and rebuild configs (`next.config.js`, Tailwind/PostCSS/TS configs, scripts)
- Root `package.json` / `package-lock.json` as present on production (no invented scripts)

## 4. What is excluded

- Databases and database dumps  
- Backups / restore snapshots  
- Real environment/secret files (`.env`, `.env.local`, `.env.production`, `.env.test`, env backups)  
- JWT/SMS/VAPID/SMTP credentials and connection strings  
- SSH material and SSL/private certificates  
- Linux runtime/build artifacts: `node_modules`, `dist`, `.next`, `.next/standalone`  
- Logs, caches, PID/socket/temp runtime files  

## 5. System requirements (aligned with Production)

- **Node.js:** `20.11.1` (Node 20 LTS)  
- **npm:** `10.2.4`  
- **PostgreSQL** (required for app boot — `DATABASE_URL` is validated)  
- **Redis** (recommended for queue/cache features that may be enabled; install for parity with production)

## 6. Offline setup steps on Windows

1. Install Node.js **20.11.1** and matching npm **10.x**.  
2. Install and start **PostgreSQL** and **Redis** locally.  
3. Copy env templates to real env files and fill values manually (do **not** reuse production secrets):  
   - `backend/.env.example` → `backend/.env`  
   - `frontend/.env.example` → `frontend/.env.local`  
4. Install dependencies separately:  
   - `cd backend` → `npm ci` (or `npm install`)  
   - `cd frontend` → `npm ci` (or `npm install`)  
   - Optionally install root lockfile deps if needed for calendar helper packages: `npm ci` at package root.  
5. Generate Prisma client from `backend`:  
   - `npx prisma generate`  
6. Against a **local** database only: apply migrations with `npx prisma migrate deploy` (never against production).  
7. Run apps locally:  
   - Backend: `npm run start:dev` (from `backend`)  
   - Frontend: `npm run dev` (from `frontend`)

## 7. Prisma notes

- Run `npx prisma generate` after dependency install.  
- Migrations live under `backend/prisma/migrations`.  
- Use `migrate deploy` only on a disposable/local database you control.  
- Do not point this package at the production database.

## 8. Environment setup notes

- No real secrets are included in this package.  
- You must fill JWT, database URL, CORS/frontend URLs, and optional SMS/VAPID values manually.  
- Production credentials are intentionally excluded.

## 9. Notes about `npm run dev:all`

- **`npm run dev:all` does not exist on the production source.**  
- Root `package.json` on production has **no scripts** field.  
- Equivalent scripts on source:  
  - Backend: `start:dev`  
  - Frontend: `dev`  
- No root orchestrator was invented or added to this package.

## 10. Verification summary

- Destination was compared to the approved tarball using a **per-file SHA-256 inventory**.  
- Result: **exact match** (no missing, extra, size, type, or hash mismatches).  
- Forbidden content check: **clean**.  
- No overwrite of existing package files was performed during verification.  
- No delete was performed.  
- This README and `VERSION_MANIFEST.json` were created **only after** exact verification succeeded.