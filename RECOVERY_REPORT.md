# Doocard Barbershop Platform — Recovery Report

**Date:** 2025-02-09  
**Mode:** Read-only forensic recovery (no refactors, no builds, no fixes)  
**Source:** Production server `185.255.88.158:3031` → local `Doocard.V2.0.0`

---

## 1. Discovery phase (confirmed)

### Active production release

| Item | Value |
|------|--------|
| **Backend** | `/var/www/doocard/backend` |
| **Frontend** | `/var/www/doocard/frontend` |
| **Root** | `/var/www/doocard` (monorepo root with `package.json` + `package-lock.json`) |
| **Shared/domain packages** | None (no separate `shared` directory) |

### PM2 runtime (verified)

| Process | Status | Version | Exec CWD | Script |
|---------|--------|---------|----------|--------|
| doocard-backend | online | 1.2.4 | `/var/www/doocard/backend` | `dist/main.js` (Node 20.19.5) |
| doocard-frontend | online | N/A | `/var/www/doocard/frontend` | `npm start` (Next.js) |

---

## 2. Extraction and transfer

- **Full snapshot created on server:** `/tmp/doocard-production-snapshot.tar.gz` (~444 MB) — includes `node_modules` and frontend `.next`.
- **Slim snapshot used for transfer:** `/tmp/doocard-production-snapshot-slim.tar.gz` (~28 MB) — excludes `backend/node_modules`, `frontend/node_modules`, `frontend/.next` to allow transfer over the available link.
- **Contents of snapshot:** `package.json`, `package-lock.json`, `backend/`, `frontend/` (exact directory structure, configs, lock files, backend `dist/`, Prisma, source).

---

## 3. Local restoration

- **Restored to:** `c:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.0`
- **Method:** Extract `doocard-production-snapshot-slim.tar.gz` into workspace root.
- **Layout:** Matches production (root + backend + frontend). No files removed or auto-generated during restore.

---

## 4. Directory tree (high level)

```
Doocard.V2.0.0/
├── package.json
├── package-lock.json
├── doocard-production-snapshot-slim.tar.gz   (snapshot archive — can be removed or archived)
├── doocard-production-snapshot.tar.gz       (optional full snapshot if downloaded separately)
├── backend/
│   ├── dist/           (compiled backend; production runs from here)
│   ├── prisma/         (schema, migrations, seed)
│   ├── scripts/
│   ├── src/            (NestJS source)
│   ├── test/
│   ├── package.json
│   ├── package-lock.json
│   ├── .env* (present on server; not in slim snapshot — use .env.example and local values)
│   └── ...
└── frontend/
    ├── src/            (Next.js app, components, styles)
    ├── public/
    ├── cypress/
    ├── package.json
    ├── package-lock.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── .env* (present on server; not in slim snapshot — use env.local.example and local values)
    └── (no .next/ — excluded in slim snapshot; no node_modules — excluded)
```

---

## 5. Detected tech stack

| Layer | Technology |
|-------|------------|
| **Root** | npm monorepo (concurrently, cross-env, wait-on); Node ≥18 |
| **Backend** | NestJS, TypeScript, Prisma, Node 20.x on server |
| **Frontend** | Next.js 14.1.0, React 18, TypeScript, Tailwind, Radix UI, Framer Motion, Cypress |
| **Database** | PostgreSQL (Prisma ORM) |
| **Production process** | PM2 (fork mode) |

---

## 6. Release / version identifiers

| Location | Version / identifier |
|----------|----------------------|
| Root `package.json` | **1.2.4** |
| `backend/package.json` | **1.2.4** |
| `frontend/package.json` | **1.2.4** |
| PM2 backend process | **1.2.4** |
| Server `v1.2.4.zip` (in `/var/www/doocard/`) | Matches same release |

---

## 7. Risks and inconsistencies

1. **Slim snapshot only**
   - `node_modules` and frontend `.next` were not transferred. To run locally you must:
     - Run `npm run install:all` (or `npm install` at root, then in `backend` and `frontend`).
     - For backend: already has `dist/`; for a clean run you may use `npm run build` in backend.
     - For frontend: run `npm run build` then `npm run start`, or `npm run dev` for development.
   - Full snapshot (~444 MB) remains on server at `/tmp/doocard-production-snapshot.tar.gz` if you want to pull it later (e.g. via a long-running pscp or better link).

2. **Environment files**
   - Production `.env` (and variants) in `backend/` and `frontend/` were not included in the snapshot (security). Use:
     - `backend/.env.example` and `frontend/env.local.example` (or similar) and fill with **local** DB and API URLs (e.g. PostgreSQL on localhost:5433, DB name MOVA, as in your pgAdmin details). Do not copy production secrets.

3. **Backend entry path**
   - Server PM2 runs `dist/main.js`; root `package.json` and backend scripts use `dist/src/main.js`. Confirm which path your local Node uses (likely `dist/src/main.js` from package.json). No change was made to code.

4. **Database**
   - Restored tree does not include DB dumps. Use your existing local PostgreSQL (localhost:5433, MOVA) and apply migrations from `backend/prisma` when you are ready to run the app.

5. **Optional cleanup**
   - You may delete or move `doocard-production-snapshot-slim.tar.gz` (and `doocard-production-snapshot.tar.gz` if present) from the project root after verifying the restored tree.

---

## 8. Next steps (only when you decide to continue)

- Install dependencies: `npm run install:all`.
- Configure local env: copy example env files in backend and frontend, set DB and API URLs for local.
- Generate Prisma client: `npm run db:generate`.
- Run migrations (if needed): `npm run db:migrate`.
- Start dev: `npm run dev` (or run backend and frontend separately).

---

**Recovery completed. Stopping here as requested; no further builds, refactors, or fixes were performed. Await your explicit instruction to continue development.**
