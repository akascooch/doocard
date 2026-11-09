# Overlay File Manifest — Stage 4 Prep (2026-11-09)

**وضعیت:** آماده برای دیپلوی پس از تأیید صریح انسان  
**روش:** overlay بدون `rsync --delete` / بدون `git pull` روی `/var/www/doocard`  
**پایه سورس:** `release/v2.0.29` @ `dee13450c316bac826bafbbf7ad663e3f68da4c6`  
**برچسب بسته:** `stage4-overlay-20261109-restore-date-money-sec`  
**هدف runtime ساخت روی سرور:** Node `v20.11.1` (تأییدشده روی prod)

---

## Category A — فقط این فایل‌ها وارد artifact ریلیز می‌شوند

### Backend (Nest / Prisma runtime پس از `npm run build`)

| مسیر | دلیل ریلیز |
|------|------------|
| `backend/src/backup/backup.service.ts` | Mutex restore → HTTP 409؛ pre-restore deterministic |
| `backend/src/backup/backup-restore.lib.ts` | Fail-closed production gate؛ skip-pre فقط با فلگ صریح |
| `backend/src/backup/backup.service.spec.ts` | تست واحد (اختیاری روی سرور؛ در سورس overlay برای همسانی) |
| `backend/src/backup/backup-restore.lib.spec.ts` | تست واحد گاردها |
| `backend/src/settings/settings.controller.ts` | گارد reset / restore path hardening |
| `backend/src/sms/sms.controller.ts` | Jwt + Permission + ADMIN |
| `backend/src/permissions/permissions.controller.ts` | Jwt + Permission + ADMIN |
| `backend/src/main.ts` | سقف body برای آپلود restore |

### Frontend (Next — نیاز به rebuild standalone روی Ubuntu)

| مسیر | دلیل ریلیز |
|------|------------|
| `frontend/src/app/api/settings/backup/restore/route.ts` | **F-RST-01** — Route Handler long-timeout + 413 @ 300MB |
| `frontend/next.config.js` | کامنت/رفتار rewrite؛ Route اختصاصی بر rewrite غالب است |
| `frontend/src/app/dashboard/settings/page.tsx` | relative `/api/...` + AbortController + سقف کلاینت ۳۰۰MB |
| `frontend/src/lib/date.ts` | Jalali/Tehran hardening (F-DATE-*) |
| `frontend/src/lib/money.ts` | نمایش تومان از ریال (F-MON-02) |
| `frontend/src/lib/__tests__/date-safari-hardening.spec.ts` | تست (اختیاری روی runtime) |
| `frontend/src/app/dashboard/admin/tips/page.tsx` | تاریخ امروز تهران |
| `frontend/src/app/dashboard/admin/day-closing/page.tsx` | Jalali string picker |
| `frontend/src/app/dashboard/customers/page.tsx` | birthdate PersianDatePicker |
| `frontend/src/app/dashboard/admin/accounting/page.tsx` | EOD از `jalaliToGregorian` |

### فهرست فشرده برای `scp` / `rsync` (بدون `--delete`)

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

**جمع:** ۱۸ مسیر سورس (۱ untracked حیاتی: Route Handler).

---

## Category B — ممنوع در overlay (جداسازی F-REL-02)

این مسیرها ممکن است در working tree کثیف باشند؛ **هرگز** به `/var/www/doocard` منتقل نشوند:

| مسیر / الگو | دسته |
|-------------|------|
| `audit/**` | گزارش‌ها، helperهای Stage 3، لاگ، اسکریپت موقت |
| `Offline/**` | محیط آفلاین لوکال |
| `backend/src/admin/admin-financial.controller.ts` | کار نیمه‌کاره financial/kardex |
| `backend/src/admin/admin-financial.service.ts` | کار نیمه‌کاره financial/kardex |
| `frontend/src/app/dashboard/admin/financial/page.tsx` | کار نیمه‌کاره |
| `frontend/src/app/dashboard/admin/packages/page.tsx` | کار نیمه‌کاره |
| `frontend/src/app/dashboard/admin/products/page.tsx` | کار نیمه‌کاره |
| `frontend/src/lib/axios.ts` | تغییر موازی kardex/client — خارج از بسته Stage 2/3 |

کنترل جداسازی: **این Manifest** مرجع نهایی artifact است (نه `git status` کامل).  
الگوی `_tmp_*` از قبل در `.gitignore` ریشه پوشش داده شده است.

---

## آنچه عمداً در این overlay نیست

- هیچ migration جدید Prisma
- هیچ تغییر schema
- فعال‌سازی `BACKUP_RESTORE_ALLOW_PRODUCTION` / `BACKUP_RESTORE_SKIP_PRE_BACKUP`
- تغییر nginx / UFW / apache2 / PM2 ecosystem mode
- Redis distributed lock (mutex همچنان process-local؛ topology تک‌instance تأیید شده)

---

## هویت ریلیز پیشنهادی (F-REL-01 — پیش‌نویس)

| فیلد | مقدار |
|------|--------|
| Base SHA | `dee13450c316bac826bafbbf7ad663e3f68da4c6` |
| Overlay id | `stage4-overlay-20261109-restore-date-money-sec` |
| Prod BUILD_ID فعلی | `vN7uSYEFez8TeXnUTdnNe` (قبل از دیپلوی) |
| Prod BUILD_ID پس از FE build | **پس از Stage 4 اندازه‌گیری و در رجیستری ثبت شود** |
| Runtime Node هدف | `v20.11.1` |
| PM2 فرض امن mutex | `doocard-backend` = `fork_mode`، تک‌instance |

---

*این فایل artifact است؛ اجرای دیپلوی تا تأیید صریح ممنوع.*
