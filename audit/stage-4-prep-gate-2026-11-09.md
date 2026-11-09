# Stage 4 Prep Gate — 2026-11-09

**دامنه:** جداسازی dirty tree، تأیید گارد restore، بازرسی فقط‌خواندنی prod، بسته overlay  
**دیپلوی:** **اجرا نشد** — منتظر تأیید صریح  
**منبع حقیقت Stage 3:** `audit/stage-3-verification-2026-11-09.md`  
**Manifest:** `audit/overlay-manifest-stage4-2026-11-09.md`

---

## 1. خلاصه اجرایی

بسته‌ی overlay Category A آماده و از درخت کثیف جدا شده است. گارد production restore در کد fail-closed است و روی سرور فلگ اجازه‌ی restore تنظیم نشده. Topology تولید: PM2 `fork_mode` تک‌فرآیند، Node `v20.11.1`، DB schema به‌روز، health OK. Route Handler restore روی prod هنوز **ABSENT** — فقط با Stage 4 رفع می‌شود.

**حکم دروازه Stage 4 (overlay): UNBLOCKED مشروط — فقط پس از تأیید انسان برای اجرای runbook زیر.**

---

## 2. وضعیت موارد مسدودکننده Stage 3

| ID | وضعیت این Step | شواهد |
|----|----------------|--------|
| **F-REL-02** | **RESOLVED (package)** | Category A/B جدا؛ فقط ۱۸ مسیر در Manifest؛ kardex/financial/packages/products/axios/Offline/audit خارج از artifact |
| **F-REL-01** | **RESOLVED (prep)** | هویت بسته: base `dee13450` + overlay id `stage4-overlay-20261109-restore-date-money-sec`؛ BUILD_ID فعلی prod = `vN7uSYEFez8TeXnUTdnNe`؛ ثبت BUILD_ID جدید = پس از دیپلوی در رجیستری |
| **F-RST-01** | **VERIFIED READY (not applied)** | Route در سورس لوکال + Manifest؛ روی prod standalone **ABSENT**؛ رفع فقط با rebuild FE روی سرور |
| Dirty tree | **SEGREGATED** | working tree همچنان dirty؛ کنترل ریلیز = Manifest نه کل `git status` |

### F-RST-01 / سیاست restore (کد + env) — تأیید شده

| رفتار | نتیجه |
|-------|--------|
| `NODE_ENV=production` و `BACKUP_RESTORE_ALLOW_PRODUCTION !== 'true'` | `ForbiddenException` — fail-closed |
| `BACKUP_RESTORE_SKIP_PRE_BACKUP=true` | فقط با اختیار صریح؛ در غیر این صورت pre-restore الزامی در prod سخت |
| فلگ‌های `BACKUP_RESTORE_*` در `.env` prod | **غایب** (grep فقط‌خواندنی؛ نام‌ها ماسک) → restore در runtime فعلی مسدود می‌ماند |
| Mutex | `restoreInProgress` + `ConflictException`؛ با `fork_mode` تک‌instance روی prod **ایمن برای این topology** |

باقی‌ماندهٔ پذیرفته‌شده (غیرمسدودکننده این overlay): F-RST-03 buffering، F-MON-01 Float، E2E مرورگر، JWT سراسری.

---

## 3. یافته‌های فقط‌خواندنی Production (`ssh doocard-prod`)

| مورد | مقدار |
|------|--------|
| Host / kernel | `server-45-159-114-60` / `5.15.0-190-generic` |
| Node | **v20.11.1** (هم‌تراز هدف runtime) |
| `doocard-backend` | online · `fork_mode` · `dist/main.js` · cwd `/var/www/doocard/backend` |
| `doocard-frontend` | online · `fork_mode` · standalone `server.js` |
| Instance / mutex | تک‌فرآیند fork → فرض mutex درون‌حافظه‌ای **قابل قبول** |
| BUILD_ID | `vN7uSYEFez8TeXnUTdnNe` |
| Restore route در standalone | **ABSENT** |
| `/api/health` | `200` · database up |
| Prisma migrate status | **Database schema is up to date!** (۸۷ migration؛ DB `doocard` @ `127.0.0.1:5432`) |
| Disk `/` | **۸.۸G آزاد (۷۸٪)** — قبل از FE build باید فضای `.next` قدیمی/بکاپ موقت مدیریت شود |
| Memory | ~۳۹۱۲MB · available ~۲۸۵۸MB · swap آزاد کافی |
| تغییر سرویس/کانفیگ در این Step | **هیچ** |

مرجع SSH/`ip.txt`: port 3031 key-only، fail2ban، UFW 3031/80/443 — بدون جهش امنیتی جدید در این Step.

---

## 4. Overlay File Manifest (تمیز)

فقط این مسیرها:

```text
backend/src/backup/backup.service.ts
backend/src/backup/backup-restore.lib.ts
backend/src/backup/backup.service.spec.ts
backend/src/backup/backup-restore.lib.spec.ts
backend/src/settings/settings.controller.ts
backend/src/sms/sms.controller.ts
backend/src/permissions/permissions.controller.ts
backend/src/main.ts
frontend/src/app/api/settings/backup/restore/route.ts
frontend/next.config.js
frontend/src/app/dashboard/settings/page.tsx
frontend/src/lib/date.ts
frontend/src/lib/money.ts
frontend/src/lib/__tests__/date-safari-hardening.spec.ts
frontend/src/app/dashboard/admin/tips/page.tsx
frontend/src/app/dashboard/admin/day-closing/page.tsx
frontend/src/app/dashboard/customers/page.tsx
frontend/src/app/dashboard/admin/accounting/page.tsx
```

جزئیات: `audit/overlay-manifest-stage4-2026-11-09.md`

---

## 5. Runbook پیشنهادی Stage 4 (اجرا نشود تا تأیید)

### ۵.۱ Snapshot

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p /root/doocard-overlays/$TS
# کپی گزینشی فایل‌های هدف قبل از overwrite (نه کل درخت اگر فضا کم است)
cp -a --parents \
  /var/www/doocard/backend/src/backup \
  /var/www/doocard/backend/src/settings/settings.controller.ts \
  /var/www/doocard/backend/src/sms/sms.controller.ts \
  /var/www/doocard/backend/src/permissions/permissions.controller.ts \
  /var/www/doocard/backend/src/main.ts \
  /var/www/doocard/frontend/next.config.js \
  /var/www/doocard/frontend/src/app/dashboard/settings/page.tsx \
  /var/www/doocard/frontend/src/lib/date.ts \
  /var/www/doocard/frontend/src/lib/money.ts \
  /var/www/doocard/frontend/src/app/dashboard/admin/tips/page.tsx \
  /var/www/doocard/frontend/src/app/dashboard/admin/day-closing/page.tsx \
  /var/www/doocard/frontend/src/app/dashboard/customers/page.tsx \
  /var/www/doocard/frontend/src/app/dashboard/admin/accounting/page.tsx \
  /root/doocard-overlays/$TS/ 2>/dev/null || true
# همچنین snapshot از .next/standalone BUILD_ID
echo "$TS" > /root/doocard-overlays/$TS/NOTE.txt
cp -a /var/www/doocard/frontend/.next/BUILD_ID /root/doocard-overlays/$TS/BUILD_ID.prev
df -h /
```

### ۵.۲ انتقال (از ویندوز؛ بدون `--delete`)

```powershell
# فقط فایل‌های Manifest — نمونه الگوی rsync/scp
# scp -P 3031 <each Category A file> doocard-prod:/var/www/doocard/<same-relative-path>
# یا rsync -avz -e "ssh -p 3031" --files-from=overlay-list.txt ./ doocard-prod:/var/www/doocard/
# هرگز: rsync --delete ، git pull در /var/www/doocard ، prisma migrate reset
```

### ۵.۳ Build روی Linux (Node 20.11.1)

```bash
cd /var/www/doocard/backend
node -v   # must be v20.11.1
npm run build
npx prisma migrate status   # read-only expect: up to date — NO reset

cd /var/www/doocard/frontend
# در صورت نیاز فضای دیسک: حذف فقط بکاپ‌های قدیمی .next که خودتان ساخته‌اید — نه حذف کور
npm run build
# همگام‌سازی standalone طبق روال موجود پروژه (کپی static/public به standalone)
```

### ۵.۴ Reload

```bash
pm2 restart doocard-backend --update-env
pm2 restart doocard-frontend --update-env
pm2 describe doocard-backend | egrep 'status|exec mode'
curl -s -m 5 http://127.0.0.1:3001/api/health
# تأیید Route:
test -f /var/www/doocard/frontend/.next/standalone/.next/server/app/api/settings/backup/restore/route.js && echo PRESENT
```

### ۵.۵ Rollback فوری

```bash
# بازگردانی فایل‌های snapshot از /root/doocard-overlays/$TS
# سپس rebuild یا بازگردانی artifact قبلی .next در صورت نگهداری شده
pm2 restart doocard-backend
pm2 restart doocard-frontend
curl -s -m 5 http://127.0.0.1:3001/api/health
```

### ۵.۶ ممنوع مطلق در Stage 4

- `prisma migrate reset`
- `rsync --delete`
- `git pull` داخل `/var/www/doocard`
- فعال‌سازی `BACKUP_RESTORE_ALLOW_PRODUCTION` بدون پنجره نگهداری جدا
- unmask/start `apache2`
- تغییر UFW / nginx مگر تأیید جدا

---

## 6. حکم رسمی دروازه

| پرسش | پاسخ |
|------|------|
| آیا F-REL-01/02 و جداسازی dirty برای **بسته ریلیز** حل شد؟ | **بله** |
| آیا F-RST-01 برای **بسته** آماده است؟ | **بله** (روی prod هنوز ABSENT تا اجرا) |
| آیا topology برای mutex تک‌فرآیند تأیید شد؟ | **بله** (`fork_mode`) |
| آیا دیپلوی الان اجرا شود؟ | **خیر — منتظر تأیید** |
| **آیا دروازه Stage 4 UNBLOCKED است؟** | **بله — UNBLOCKED مشروط به تأیید انسان + رعایت Manifest/Runbook + مدیریت فضای دیسک ۸.۸G** |

---

## 7. توقف

**اینجا متوقف می‌شویم.** هیچ فایل production تغییر نکرد. هیچ PM2 restart / scp / build روی سرور انجام نشد.

برای ادامه: تأیید صریح اجرای Stage 4 با ارجاع به این Manifest و Runbook لازم است.
