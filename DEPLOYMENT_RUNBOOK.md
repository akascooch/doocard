# PRODUCTION DEPLOYMENT RUNBOOK

**System:** Doocard Barbershop Platform (LIVE)  
**Release:** Calendar portal fix + Tehran-time “today” detection  
**Date:** 2026-02

---

## 1. Preconditions

Before starting, ensure:

- [ ] Production server is reachable via SSH (host, port, and credentials as provided).
- [ ] PM2 is installed and processes `doocard-backend` and `doocard-frontend` are known.
- [ ] Node.js and npm are available on the server (e.g. `node -v`, `npm -v`).
- [ ] You have the two updated files from the local workspace (see paths below).
- [ ] No other deployments or restarts are in progress.

**Server:** `185.255.88.158`  
**SSH:** `ssh root@185.255.88.158 -p 3031`  
**Auth:** Use the project SSH credentials (password or key) as provided by the project owner.

---

## 2. Frontend Deployment

**Purpose:** Deploy calendar overflow fix (explicit portal to `document.body`).

| Item | Value |
|------|--------|
| **Source file (local)** | `frontend/src/components/ui/PersianDatePicker.tsx` |
| **Destination (server)** | `/var/www/doocard/frontend/src/components/ui/PersianDatePicker.tsx` |

### Steps

1. **Copy file to server**  
   From your machine (where the Doocard repo is cloned), using SCP or your usual method:

   ```bash
   scp -P 3031 frontend/src/components/ui/PersianDatePicker.tsx root@185.255.88.158:/var/www/doocard/frontend/src/components/ui/PersianDatePicker.tsx
   ```

   On Windows (PowerShell), if using PuTTY’s `pscp`:

   ```powershell
   pscp -P 3031 "frontend\src\components\ui\PersianDatePicker.tsx" root@185.255.88.158:/var/www/doocard/frontend/src/components/ui/PersianDatePicker.tsx
   ```

2. **SSH into the server**

   ```bash
   ssh root@185.255.88.158 -p 3031
   ```

3. **Build frontend**

   ```bash
   cd /var/www/doocard/frontend
   npm run build
   ```

   Resolve any build errors before continuing. Do not restart the frontend until the build succeeds.

4. **Restart frontend**

   ```bash
   pm2 restart doocard-frontend
   ```

5. **Confirm process**

   ```bash
   pm2 list
   ```

   Expect `doocard-frontend` to be **online** with a recent restart time.

---

## 3. Backend Deployment

**Purpose:** Deploy Tehran-time “today” detection so the min+2h rule applies only for the current day in Asia/Tehran.

| Item | Value |
|------|--------|
| **Source file (local)** | `backend/src/appointments/appointments.service.ts` |
| **Destination (server)** | `/var/www/doocard/backend/src/appointments/appointments.service.ts` |

### Steps

1. **Copy file to server**

   ```bash
   scp -P 3031 backend/src/appointments/appointments.service.ts root@185.255.88.158:/var/www/doocard/backend/src/appointments/appointments.service.ts
   ```

   Windows (PowerShell) with `pscp`:

   ```powershell
   pscp -P 3031 "backend\src\appointments\appointments.service.ts" root@185.255.88.158:/var/www/doocard/backend/src/appointments/appointments.service.ts
   ```

2. **SSH into the server** (if not already connected)

   ```bash
   ssh root@185.255.88.158 -p 3031
   ```

3. **Build backend**

   ```bash
   cd /var/www/doocard/backend
   npm run build
   ```

   Fix any TypeScript/build errors before reloading.

4. **Reload backend (zero-downtime)**

   ```bash
   pm2 reload doocard-backend --update-env
   ```

5. **Confirm process**

   ```bash
   pm2 list
   pm2 logs doocard-backend --lines 20 --nostream
   ```

   Expect `doocard-backend` **online** and no crash/restart loop in logs.

---

## 4. Rollback

If something goes wrong after deploy:

### Frontend rollback

1. Restore the previous `PersianDatePicker.tsx` (from backup or git on the server).
2. Re-copy that file to `/var/www/doocard/frontend/src/components/ui/PersianDatePicker.tsx`.
3. On server:

   ```bash
   cd /var/www/doocard/frontend
   npm run build
   pm2 restart doocard-frontend
   ```

### Backend rollback

1. Restore the previous `appointments.service.ts` to `/var/www/doocard/backend/src/appointments/`.
2. On server:

   ```bash
   cd /var/www/doocard/backend
   npm run build
   pm2 reload doocard-backend --update-env
   ```

### Optional: keep backups before deploy

On the server, before overwriting files:

```bash
cp /var/www/doocard/frontend/src/components/ui/PersianDatePicker.tsx /var/www/doocard/frontend/src/components/ui/PersianDatePicker.tsx.bak
cp /var/www/doocard/backend/src/appointments/appointments.service.ts /var/www/doocard/backend/src/appointments/appointments.service.ts.bak
```

---

## 5. Post-Deploy Verification Checklist

Run these checks on **production** (https://www.doocardbarbershop.com or your live domain).

### 5.1 Calendar overflow (frontend)

- [ ] Open the site and log in as a user who can book (e.g. customer).
- [ ] Open the booking modal and go to the step where the date picker is shown.
- [ ] Open the calendar (click the date field).
- [ ] **Pass:** Calendar is fully visible and not cut off by the modal; it can extend outside the central dialog.
- [ ] **Fail:** Calendar is clipped inside the modal or hidden.

### 5.2 Today – slots &lt; 2h blocked

- [ ] Select **today** as the appointment date.
- [ ] Select a service and an employee so time slots load.
- [ ] **Pass:** Slots that start in less than 2 hours from now are disabled or marked unavailable.
- [ ] **Pass:** Slots that start 2+ hours from now are available (if not already booked).

### 5.3 Tomorrow – slots available (no false “no slots”)

- [ ] Select **tomorrow** (or another future day) as the appointment date.
- [ ] Select a service and an employee so time slots load.
- [ ] **Pass:** If the employee has schedule for that day, time slots appear as expected.
- [ ] **Fail:** You see “در این تاریخ زمان خالی موجود نیست” when there should be slots (e.g. a normal working day with no full bookings).

### 5.4 Backend logs (optional)

- [ ] `pm2 logs doocard-backend --lines 50`
- [ ] No repeated errors or restarts; slot-related logs look normal.

---

**End of runbook.**  
For credentials and access details, use only the information provided by the project owner. Do not commit passwords or secrets to the repository.
