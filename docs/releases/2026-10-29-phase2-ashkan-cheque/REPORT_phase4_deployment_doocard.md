# گزارش فاز ۴ — ریلیز پروداکشن، بک‌آپ DB و دیپلوی Overlay (Doocard v2.0.29 Phase2)

**تاریخ اجرا:** ۱۴۰۴/۰۸/۰۷ (2026-10-29، حدود ۱۶:۳۴–۱۷:۳۰ +0330)  
**مبدأ:** `C:\scooch\Versions\v.2.0.4`  
**مقصد:** `ssh doocard-prod` → `root@45.159.114.60:3031`  
**روش:** Overlay / Artifact — **بدون** `git pull` / `git checkout` / `rsync --delete` / `prisma migrate reset` / unmask `apache2`  
**وضعیت نهایی:** **LIVE — موفق با شرایط ثبت‌شده**

---

## ۱) خلاصه اجرایی

| مرحله | نتیجه |
|--------|--------|
| Preflight SSH / nginx / UFW / PM2 / health | Pass |
| Hot dump PostgreSQL | Pass — ۶٫۷MB، SHA256 ثبت شد |
| Snapshot rollback (dist + standalone) | Pass |
| `prisma migrate deploy` (فاز۲) | Pass — ۸۵/۸۵ up to date |
| ایندکس ترکیبی CONCURRENTLY بدهی | Pass |
| Overlay `backend/dist` + FE standalone/static/public | Pass (جایگزین `rsync` با `tar`+`scp` به‌دلیل نبود rsync روی ویندوز) |
| `prisma generate` + `pm2 reload` هر دو اپ | Pass |
| Smoke محلی و HTTPS | Pass — health/login/root = 200 |
| apache2 / UFW / SSH:3031 | Pass — masked / فعال / listen |

---

## ۲) Preflight (گام ۱)

| بررسی | شواهد |
|--------|--------|
| SSH | `SSH Connection OK` |
| Kernel / uptime | `5.15.0-190-generic`؛ up ~۵۳ روز |
| nginx | `active` و `enabled` |
| apache2 | `masked` |
| UFW | فقط `3031/80/443` ALLOW؛ `3000/3001` DENY |
| PM2 قبل از دیپلوی | `doocard-backend` / `doocard-frontend` online، version `2.0.29` |
| Health قبل | `http://127.0.0.1:3001/api/health` → 200، `database.up` |
| BUILD_ID قبل | `6P4_t4AY1ep91cV-q2HOt` (source == standalone) |
| مایگریشن فاز۲ روی سرور | **absent** قبل از دیپلوی |
| `migrate status` قبل | ۸۴ مایگریشن، schema up to date |

**Drift ثبت‌شده قبل از mutate:** رجیستری آخرین ریلیز را `v2.0.31-cheque-admin-cron` با BUILD_ID `xAWMq27E-Ibp69poSPYEY` نشان می‌داد؛ واقعیت سرور BUILD_ID `6P4_t4AY1ep91cV-q2HOt` و آخرین مایگریشن `20261022120000_lottery_circle_and_exclusions` بود. طبق قانون registry، واقعیت سرور مبنا قرار گرفت.

**دامنه آرتیفکت لوکال:** بیلد ویندوز از working tree کثیف شامل فاز۲ + تغییرات اشکان/چک بود — overlay کامل همین مجموعه را به runtime برد (نه فقط فایل‌های فاز۲ به‌صورت ایزوله).

---

## ۳) بک‌آپ داغ و Rollback Hold (گام ۲)

| مورد | مقدار |
|------|--------|
| Dump | `/var/backups/doocard/backup_pre_v2.0.29_phase4_20261029_163727.dump` |
| اندازه | ۶٫۷M (`6931752` بایت) |
| SHA256 | `6713483202db5c28203a3a51a09d74bfd1f44ecdfbb069764edf01d4981f2300` |
| فرمت | `pg_dump -F c -b` از `DATABASE_URL` (پارامتر `?schema=` حذف شد چون `pg_dump` آن را رد می‌کند) |
| Rollback hold | `/var/www/doocard_backups/phase4_v2029_20261029_163727/` |
| محتویات hold | `dist.tgz` (۶۷۷K)، `standalone.tgz` (۴۴M)، `schema.prisma.bak`، `rollback.sh` |

بازگردانی کد (نه DB):

```bash
bash /var/www/doocard_backups/phase4_v2029_20261029_163727/rollback.sh
```

بازگردانی DB فقط در حادثهٔ داده و با تأیید صریح:

```bash
# مثال — اجرا نشود مگر تأیید: pg_restore از dump بالا
```

---

## ۴) مایگریشن و ایندکس (گام ۳ — DB)

### ۴.۱ همگام‌سازی فایل‌ها
- `.../prisma/migrations/20261029160000_phase2_appointments_packages_finance/migration.sql`
- `.../prisma/schema.prisma`

### ۴.۲ `npx prisma migrate deploy`

```
Applying migration `20261029160000_phase2_appointments_packages_finance`
All migrations have been successfully applied.
Database schema is up to date!   # 85 migrations
```

تأیید اشیاء:
- `appointments.createdSource` default `'UNKNOWN'::"AppointmentCreatedSource"`
- جدول `service_package_template_services`
- enum `PaymentMethod.PACKAGE`

### ۴.۳ ایندکس اختیاری پرفورمنس

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_debts_customer_settled
  ON customer_debts("customerId", "settledAt");
```

نتیجه: ایندکس `idx_customer_debts_customer_settled` در `pg_indexes` ثبت شد.

---

## ۵) همگام‌سازی آرتیفکت (گام ۳ — کد)

`rsync` روی میزبان ویندوز موجود نبود → انتقال با `scp` + استخراج `tar` (بدون `--delete`).

| آرتیفکت | مسیر مقصد |
|---------|-----------|
| `backend/dist` | `/var/www/doocard/backend/dist/` |
| standalone | `/var/www/doocard/frontend/.next/standalone/` |
| static | standalone `.next/static` + `/var/www/doocard/frontend/.next/static` |
| public | standalone `public` + `/var/www/doocard/frontend/public` |

پس از اعمال:
- `dist/main.js` موجود
- `standalone/server.js` موجود
- `dist/common/utils/loyalty-points.js` موجود
- `dist/appointments/appointment-created-source.js` موجود
- **BUILD_ID جدید:** `4dXMrGVG_5bVwxGQxevT-` (source == standalone)

---

## ۶) ریلود و لاگ (گام ۴)

| عمل | نتیجه |
|-----|--------|
| `npx prisma generate` | Prisma Client v6.19.3 — موفق |
| `pm2 reload doocard-backend --update-env` | online، pid `3918723` |
| `pm2 reload doocard-frontend --update-env` | online، pid `3918742` |
| Nest bootstrap | `Nest application successfully started` روی `127.0.0.1:3001` |
| Next | `Ready in 709ms` روی `127.0.0.1:3000` |
| Unhandled Exception جدید مرتبط با ریلیز | مشاهده نشد |
| نکات از پیش موجود در لاگ | کمبود اعتبار SMS.ir؛ هشدار `sharp` در FE؛ `jwt expired` کلاینت‌های قدیمی |

Health بلافاصله ۳ ثانیه بعد از reload یک‌بار `000` داد (cold start)؛ حدود یک دقیقه بعد پایدار ۲۰۰ شد.

---

## ۷) Smoke زنده (گام ۵)

| هدف | نتیجه |
|-----|--------|
| `http://127.0.0.1:3001/api/health` | **200** — `{"status":"ok","database":"up"}` |
| `http://127.0.0.1:3000/` | **200** |
| `http://127.0.0.1:3000/login` | **200** |
| `https://www.doocardbarbershop.com/api/health` | **HTTP/2 200** (nginx) |
| `https://www.doocardbarbershop.com/login` | **HTTP/2 200** |
| `https://www.doocardbarbershop.com/` | **HTTP/2 200** |
| SSH `:3031` | listen |
| Node bind | `127.0.0.1:3000` و `:3001` |
| nginx | active |
| apache2 | masked |
| UFW | 3031/80/443 only |

---

## ۸) ریسک‌ها و محدودیت‌ها

1. **آرتیفکت ترکیبی:** runtime فعلی شامل فاز۲ + اشکان + چک از لوکال dirty tree است؛ جداسازی فقط-فاز۲ انجام نشد.
2. **بیلد ویندوز روی لینوکس:** طبق سابقهٔ v2.0.16 قابل‌قبول بود و smoke سبز شد؛ الگوی ترجیحی registry همچنان source overlay + Ubuntu build است.
3. **سورس TS روی سرور:** فقط `schema.prisma` + migration + `dist`/`standalone` همگام شد؛ درخت `src/` پروداکشن لزوماً ۱:۱ با لوکال نیست (رفتار تاریخی overlay).
4. **SMS.ir اعتبار ناکافی:** خطای از پیش موجود؛ ریلیز باعث آن نشده.
5. **رجیستری مسیر:** هنوز به ریلیز قبلی اشاره می‌کند و باید در گام مستندسازی جدا به‌روز شود.
6. **بازگردانی مایگریشن:** DDL فاز۲ عمدتاً additive است؛ rollback کد با `rollback.sh` ممکن است، ولی برگرداندن schema نیاز به restore dump یا migration معکوس دستی دارد (عمداً ساخته نشد).

---

## ۹) اعلام وضعیت

### **Go / LIVE**

دیپلوی فاز ۴ روی پروداکشن با شواهد بالا کامل و پایدار است. سرویس‌ها online، مایگریشن اعمال، health عمومی ۲۰۰، کنترل‌های امنیتی (nginx، apache2 masked، UFW، SSH 3031)Intact.

**Rollback فوری کد:**  
`bash /var/www/doocard_backups/phase4_v2029_20261029_163727/rollback.sh`

**Dump DB:**  
`/var/backups/doocard/backup_pre_v2.0.29_phase4_20261029_163727.dump`

---

## ۱۰) پیشنهاد گام بعدی (خارج از اجرا مگر تأیید)

1. به‌روزرسانی `C:\scooch\doocard-prod-path-registry.md` با BUILD_ID `4dXMrGVG_5bVwxGQxevT-` و این ریلیز.
2. شارژ اعتبار SMS.ir (عملیاتی، مستقل از کد).
3. در ریلیز بعدی: ترجیح source overlay + Ubuntu `npm run build` برای FE جهت کاهش ریسک باینری ویندوز/`sharp`.

---

*پایان گزارش فاز ۴ — بدون git-pull پروداکشن؛ بدون migrate reset؛ بدون rsync --delete.*
