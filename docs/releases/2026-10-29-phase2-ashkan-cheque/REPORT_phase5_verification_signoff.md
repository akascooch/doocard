# Phase 5 — Final Production Verification & Sign-off

**تاریخ:** ۱۴۰۴/۰۸/۰۷ (2026-10-29 ~17:41 +0330)  
**محیط:** Production `ssh doocard-prod` — فقط خواندنی  
**ریلیز مرجع فاز ۴:** BUILD_ID `4dXMrGVG_5bVwxGQxevT-`  
**لاگ شواهد:** `/tmp/phase5_verify_20261029_174113.log`

---

## Executive Summary

| حوزه | حکم |
|------|-----|
| Runtime / PM2 | **Pass** — هر دو اپ online، `unstable_restarts=0`، بدون restart loop پس از دیپلوی |
| Health / HTTPS | **Pass** — local + `https://www.doocardbarbershop.com` → 200؛ Redis `PONG` |
| محدودیت آنلاین اشکان (emp#3) | **Pass** — D+0..D+2 عمومی خالی؛ bypass ادمین با `staffAccess=true` موفق؛ بدون `staffAccess` همچنان مسدود |
| فیلتر سررسید چک | **Pass** — `dueFrom`/`dueTo` → 200؛ بازه معکوس/فرمت بد → 400 (نه 500)؛ بدون توکن → 401 |
| Schema / Prisma (۸۵ مایگریشن) | **Pass** — PG 14.24، `createdSource` زنده، PACKAGE/junction/frog reminders/ایندکس بدهی تأیید شد |
| کنترل‌های امنیتی پایه | **Pass** — nginx active، apache2 masked، UFW 3031/80/443 |

### **Sign-off: APPROVED / PRODUCTION HEALTHY**

---

## ۱) PM2 و Runtime

| اپ | status | pid | uptime (~) | unstable | restarts (انباشته) |
|----|--------|-----|------------|----------|---------------------|
| `doocard-backend` | online | 3918723 | ~۱۲ min از reload فاز۴ | **0** | 43 (تاریخی) |
| `doocard-frontend` | online | 3918742 | ~۱۲ min | **0** | 39 (تاریخی) |

- Health: `{"status":"ok","database":{"status":"up"}}`
- BUILD_ID source == standalone == `4dXMrGVG_5bVwxGQxevT-`
- اسکن ۴۰ خط آخر error logs: **بدون** Unhandled / ECONNREFUSED / pool saturation / Prisma FATAL / missing module
- نکات ازپیش‌موجود (غیرمسدودکنندهٔ sign-off): کمبود اعتبار SMS.ir؛ هشدارهای `sharp` در FE

---

## ۲) منطق کسب‌وکار — دو فیکس کلیدی

### ۲.۱ محدودیت رزرو آنلاین اشکان (`employeeId=3` / اشکان اشتیش)

تاریخ‌های تهران در زمان تست: **2026-10-29 .. 2026-10-31** (D+0..D+2)

| سناریو | نتیجه | شواهد |
|--------|--------|--------|
| Public `GET /api/appointments/slots?employeeId=3&date=D+0..D+2` | **Pass** | هر سه روز: `http=200`, `slotsLen=0`, `availableSlots=0`, `first=null` |
| کنترل: `employeeId=1` در D+0 | **Pass (اختصاصی بودن)** | `availableSlots=4`, `slotsLen=24` — محدودیت فقط روی اشکان |
| ADMIN + `staffAccess=true` روی D+0..D+2 | **Pass (bypass)** | D0: `availableSlots=17`؛ D1/D2: `24` |
| ADMIN **بدون** `staffAccess` در D+0 | **Pass (harden)** | `availableSlots=0` — کوکی ادمین عمومی را دور نمی‌زند |
| Env | Present | `ONLINE_BOOKING_RESTRICTED_EMPLOYEE_IDS` روی سرور تنظیم است (مقدار چاپ نشد) |

### ۲.۲ فیلتر سررسید برگه‌های چک

`chequebookId=1` حذف‌شده/نامعتبر بود → 404؛ روی **`chequebookId=2` (active)**:

| درخواست | HTTP | شواهد |
|---------|------|--------|
| `.../chequebooks/2/leaves?dueFrom=2026-10-01&dueTo=2026-10-31&take=5` | **200** | `data[]` با `dueDate` در بازه (مثلاً leaf 294506 / 2026-10-31) |
| `.../cheque-leaves?chequebookId=2&dueFrom=...&dueTo=...` | **200** | همان فیلتر |
| `dueFrom > dueTo` | **400** | `dueFrom must be on or before dueTo` — نه 500 |
| `dueFrom=not-a-date` | **400** | `dueFrom must start with YYYY-MM-DD` |
| بدون Authorization | **401** | محافظت auth سالم |

---

## ۳) یکپارچگی دیتابیس و کلاینت Prisma

| بررسی | نتیجه |
|--------|--------|
| PostgreSQL | **14.24** (Ubuntu jammy) @ `127.0.0.1:5432` / DB `doocard` |
| `prisma migrate status` | **۸۵ مایگریشن — schema up to date** |
| `appointments.createdSource` | ستون زنده؛ توزیع نمونه: UNKNOWN≈37749، BARBER=3 |
| Prisma Client probe | `createdSourceNonNull=37752`؛ count probe OK |
| `PaymentMethod.PACKAGE` | موجود |
| `service_package_template_services` | موجود (count≥1) |
| Frog reminders | `reminder2hSent/At`, `reminder15mSent/At`, `reminderSent/At` روی `admin_daily_frogs` |
| ایندکس فاز۴ | `idx_customer_debts_customer_settled` موجود |

---

## ۴) سطح سرویس بیرونی

| چک | نتیجه |
|----|--------|
| `https://www.doocardbarbershop.com/api/health` | 200 |
| `https://www.doocardbarbershop.com/login` | 200 |
| Redis | `PONG` |
| nginx / apache2 / UFW | active / masked / 3031+80+443 |

---

## ۵) ریسک‌های باقیمانده (غیرمسدودکننده)

1. اعتبار SMS.ir همچنان ناکافی — نوتیفیکیشن ارسال fail می‌شود (از قبل از فاز۴).
2. هشدارهای `sharp` در standalone FE — بهینه‌سازی تصویر؛ صفحه login/health سالم است.
3. رجیستری مسیر (`doocard-prod-path-registry.md`) هنوز ریلیز قبلی را نشان می‌دهد — نیاز به به‌روزرسانی مستندات جدا.
4. شمارنده restart انباشته PM2 تاریخی است؛ از زمان reload فاز۴ حلقهٔ ناپایدار دیده نشد (`unstable=0`).

---

## ۶) حکم نهایی

**Production Verification: SIGNED OFF**

سیستم پس از دیپلوی فاز۴ پایدار است؛ دو فیکس اشکان و فیلتر سررسید چک روی ترافیک زنده تأیید شدند؛ schema/Prisma سالم است. اقدام mutate بیشتری برای بستن این چرخه لازم نیست.

*روش: read-only SSH/curl/psql؛ بدون git-pull، بدون restart، بدون migrate.*
