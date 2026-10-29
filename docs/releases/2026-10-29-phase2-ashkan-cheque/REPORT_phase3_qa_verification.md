# گزارش فاز ۳ — QA جامع، تأیید مایگریشن و تست لبه (Doocard v2.0.29)

**تاریخ اجرا:** ۱۴۰۴/۰۸/۰۷ (2026-10-29)  
**محیط:** صرفاً Local — `C:\scooch\Versions\v.2.0.4`  
**دیتابیس:** PostgreSQL `Doocard` @ `localhost:5432`  
**پایه گیت:** `2292eb3` (`release/v2.0.29`)  
**اسکریپت شواهد:** `backend/_tmp_phase3_qa_verify.js`  
**خروجی ماشین‌خوان:** `_tmp_phase3_qa_results.json`  
**خلاصه نهایی اسکریپت:** `pass: 41` / `fail: 0` / `note: 1`

---

## ۱) خلاصه اجرایی

تغییرات فاز ۲ روی لوکال با شواهد DB، سرویس‌ها، بیلد و رگرسیون گیت اعتبارسنجی شد. مایگریشن `20261029160000_phase2_appointments_packages_finance` روی لوکال اعمال و schema up-to-date است. ماتریس سناریوها بدون Fail بسته شد. بیلد Backend و Frontend سبز است. تغییرات اشکان/چک در درخت کاری باقی‌اند و توسط فاز ۲ خراب نشده‌اند.

**تصمیم: Go** برای مرحله بعد (تهیه بسته دیپلوی لوکال/overlay) — با شروط بخش ۷.

---

## ۲) تأییدیه سلامت مایگریشن (Local)

### ۲.۱ بازرسی DDL فایل

مسیر: `backend/prisma/migrations/20261029160000_phase2_appointments_packages_finance/migration.sql`

| بررسی | نتیجه | شواهد |
|--------|--------|--------|
| `ADD COLUMN` با پیش‌فرض / Nullable | Pass | `createdSource ... NOT NULL DEFAULT 'UNKNOWN'`؛ `serviceId`/`consumedByUserId` روی consumptions بدون NOT NULL |
| `DROP COLUMN` / `DROP TABLE` / تغییر TYPE ناسازگار | Pass (وجود ندارد) | اسکن regex روی فایل: هیچ تطبیقی |
| Enum جدید / مقدار PACKAGE | Pass | `AppointmentCreatedSource`؛ `PaymentMethod ADD VALUE 'PACKAGE'` |
| جدول junction پکیج | Pass | `service_package_template_services` + FKها |
| عملیات محدودکنندهٔ آگاهانه | Pass با توضیح | حذف unique تک‌نوبتی `customer_package_consumptions_appointmentId_key` و جایگزینی با unique سه‌تایی `(customerPackageId, appointmentId, serviceId)` — لازم برای چندخدمتی؛ مخربِ داده نیست |
| نرم‌کردن `service_package_templates.serviceId` | Pass | فقط `DROP NOT NULL` برای سازگاری چندخدمتی |

### ۲.۲ اجرای Prisma روی لوکال

| فرمان | نتیجه | شواهد |
|--------|--------|--------|
| `npx prisma migrate deploy` (اجرای قبلی همین نشست) | Pass | `MIG-applied` → `finished_at=Thu Oct 29 2026 16:18:26 GMT+0330` |
| `npx prisma migrate status` (پس از QA) | Pass | `Database schema is up to date!` — ۸۵ مایگریشن |
| `npx prisma generate` | Pass | Client Types بدون ناهماهنگی؛ اسکریپت QA از `dist/` و `@prisma/client` سالم import شد |
| ستون `appointments.createdSource` | Pass | default `'UNKNOWN'::"AppointmentCreatedSource"`، `is_nullable=NO` |
| enum `PaymentMethod.PACKAGE` | Pass | `enumlabel=PACKAGE present` |

### ۲.۳ ایندکس‌ها و FK

| مورد | وضعیت | شواهد |
|------|--------|--------|
| `customer_debts(customerId)` | Pass | `customer_debts_customerId_idx` |
| `customer_debts(settledAt)` | Pass | `customer_debts_settledAt_idx` |
| **ترکیبی** `(customerId, settledAt)` | **NOTE** | در مایگریشن فاز ۲ اضافه نشده؛ ایندکس‌های تک‌ستونی جدا وجود دارند. Bitmap Index Scan معمولاً کافی است؛ برای دیپلوی پروداکشن اختیاریاً می‌توان ایندکس ترکیبی افزود (خارج از scope همین Go) |
| FK junction → template / service | Pass | `service_package_template_services_*_fkey` |
| FK consumption → service / user | Pass | `customer_package_consumptions_*_fkey` |
| Unique مصرف چندخدمتی | Pass | `customer_package_consumptions_pkg_appt_service_key` |

---

## ۳) جدول نتایج سناریوها

منبع: اجرای موفق نهایی `node backend/_tmp_phase3_qa_verify.js` (exit 0) + `_tmp_phase3_qa_results.json`.

### تسک ۱ و ۲ — Source Badge و هشدار بدهی باز

| ID | سناریو | نتیجه | شواهد |
|----|--------|--------|--------|
| S1.1-map | نقش CUSTOMER → `createdSource=CUSTOMER` | **Pass** | `role CUSTOMER -> createdSource CUSTOMER` |
| S1.1-db | ایجاد نوبت مشتری در DB | **Pass** | `appointment#76816 createdSource=CUSTOMER status=PENDING_CONFIRMATION` |
| S1.2-map-admin | ADMIN → ADMIN | **Pass** | `role ADMIN -> ADMIN` |
| S1.2-map-barber | EMPLOYEE → BARBER | **Pass** | `role EMPLOYEE -> BARBER` |
| S1.2-db | نوبت ادمین بدون سورس مشتری | **Pass** | `appointment#76817 createdSource=ADMIN (not CUSTOMER)` |
| S1.3 | بدهی باز → `hasOpenDebt` + مبلغ با یک `groupBy` | **Pass** | `hasOpenDebt=true openDebtAmountRial=5000000 via single groupBy (N+1 avoided)` |
| S1.4 | پس از `settledAt` هشدار خاموش | **Pass** | `after settledAt set, groupBy returns no open debt for customer` |

کد مسیر batch: `appointments.service.ts` → `presentMany` خطوط ~2619–2654 — یک `customerDebt.groupBy` روی `customerId IN (...)` و `settledAt: null`.

### تسک ۳ — پکیج‌ها

| ID | سناریو | نتیجه | شواهد |
|----|--------|--------|--------|
| S3.1 | قالب چندخدمتی M2M | **Pass** | `template=edf174d5-... links=42,43` |
| S3.2 | `sessionsCount=0` نامحدود؛ ۳ مصرف بدون کسر | **Pass** | `unlimited=true remaining=0`؛ سپس `logs=3 (no decrement/exhaust)` |
| S3.3 | ۲ جلسه؛ سوم Rejected | **Pass** | `after1=1 after2=0 thirdRejected=جلسهٔ قابل مصرف باقی نمانده است` |
| S3.4 | تطبیق سرویس از JSON نوبت | **Pass** | `appointment_services=0; consume ok remaining=0 via JSON services` |
| S3.5-assigned | آرایشگر: مشاهده جلسات باقیمانده | **Pass** | `listCustomerPackages returned 1 items (EMPLOYEE allowed by Roles)` |
| S3.5-roles | قالب/تاریخچه فقط ADMIN | **Pass** | `@Roles('ADMIN')` روی `history` و `POST` قالب؛ `assigned` شامل EMPLOYEE — **توجه:** 403 زنده با JWT HTTP در این اسکریپت زده نشد؛ قفل در لایه Controller تأیید شد |

### تسک ۴ — مشتریان برتر و امتیاز

| ID | سناریو | نتیجه | شواهد |
|----|--------|--------|--------|
| S4.1 | سه تب spend/visits/points | **Pass** | `spend=20 visits=20 points=20` (سقف API = ۲۰) |
| S4.2 public | حذف `id=1` | **Pass** | `public id=1 absent ... (year=1405)` |
| S4.2 staff | حذف مشتری لینک‌شده به پرسنل | **Pass** | `staff-linked customer#774 absent` |
| S4.3-formula | ۲٫۵M تومان → ۱۰؛ ۹۰۰k → ۰ | **Pass** | `pointsFromPaidAppointmentRial` |
| S4.3-api-points | مسیر همان `groupBy` سرویس آنالیتیکس | **Pass** | `customer#775 spendRial=25000000 points=10`؛ `appointment_products lineTotal=1000000000 NOT in amount` |
| S4.3-api-points-low | ۹۰۰k تومان → ۰ امتیاز | **Pass** | `customer#776 spendRial=9000000 points=0` |

فرمول اثبات‌شده: `floor(paidToman / 1_000_000) * 5` با `toman = rial / 10` در `loyalty-points.ts`. خرید کالا در `amount` نوبت وارد نمی‌شود → استقلال از کالا اثبات شد.

### تسک ۵ — نمودار فروش کالا

| ID | سناریو | نتیجه | شواهد |
|----|--------|--------|--------|
| S5.1 / S5.2 | دو ماه؛ qty/price؛ بدون `order_items` | **Pass** | `m1 qty=2 price=1000000000; m2 qty=3 price=300000000; source=appointment_products only`؛ `order_items count untouched=0` |

منبع کد: `AdminFinancialService.getMonthlyProductSales` — فقط `appointmentProduct.findMany`.

### تسک ۶ — شمارنده / نوتیفیکیشن / جشن

| ID | سناریو | نتیجه | شواهد |
|----|--------|--------|--------|
| S6.1 | شمارش خالص | **Pass** | `count=638 target=1000 remaining=362` — فیلتر `id ≠ 1` و `user.role = CUSTOMER` در `CustomersService.getMilestoneStats` |
| S6.2 | آستانه نزدیکی (موک ۹۸۵) | **Pass** | `remaining=15 => isNearTarget=true` |
| S6.3 | Confetti + Idempotency | **Pass** | کلید `doocard.milestone.confetti.{n}` در `localStorage`؛ تایمر ۶۰٬۰۰۰ms — `admin/customers/page.tsx` + `MilestoneConfetti.tsx` |

---

## ۴) گزارش کارایی (Performance)

| مسیر | الگوی کوئری | نتیجه | شواهد |
|------|-------------|--------|--------|
| لیست نوبت‌ها + بدهی باز | یک `groupBy` برای همه `customerId`های صفحه؛ نه per-row | **Pass — بدون N+1** | `presentMany`؛ `PERF-debt-groupby: single groupBy for 4 customers ... in 2ms` |
| مشتریان برتر | یک `appointment.groupBy` + یک `customer.findMany` | **Pass** | `admin-analytics.service.ts` |
| فروش ماهانه کالا | یک `appointmentProduct.findMany` در بازه سال | **Pass** | بدون حلقه N+1 روی ماه/سفارش |

**یادداشت:** نبود ایندکس ترکیبی `(customerId, settledAt)` روی `customer_debts` به‌عنوان NOTE ثبت شد؛ برای حجم فعلی لوکال (و احتمالاً پروداکشن فعلی) ایندکس‌های تک‌ستونی کفایت کرده‌اند. پیشنهاد غیرمسدودکننده برای فاز دیپلوی: افزودن ایندکس ترکیبی اختیاری در مایگریشن جدا اگر `EXPLAIN` پروداکشن Bitmap/SeqScan نامطلوب نشان دهد.

---

## ۵) رگرسیون و یکپارچگی بیلد

| بررسی | نتیجه | شواهد |
|--------|--------|--------|
| Backend `npm run build` | **Pass** | `doocard-backend@2.0.29` — exit 0 |
| Frontend `npm run build` | **Pass** | Next.js 14.1.0 compile OK؛ `postbuild` sync-standalone OK؛ نسخه `doocard-frontend@2.0.29` |
| ایزولاسیون اشکان | **حفظ شده** | فایل‌های untracked: `ashkan-online-booking-restriction.ts` (7135 B) + spec؛ import و فراخوانی در `appointments.service.ts` برقرار |
| ایزولاسیون چک | **حفظ شده** | diff فعال: `accounting.service.ts`, `query-cheque-leaves.dto.ts`, `chequebooks.tsx`, `cheque-leaf-due-date-filter*.ts` |
| فاز ۲ در کنار موارد بالا | هم‌زیستی در working tree | وضعیت dirty ترکیبی؛ فاز ۳ تغییری روی منطق اشکان/چک اعمال نکرد |

`git status` نشان می‌دهد درخت کاری همزمان شامل تغییرات فاز ۲، اشکان، و چک است — برای بسته دیپلوی باید صریحاً مشخص شود آیا overlay فقط فاز ۲ است یا مجموعهٔ کامل dirty tree.

---

## ۶) محدودیت‌های شواهد / Unknown

1. **S3.5 HTTP 403 زنده:** نقش‌ها از سورس Controller و موفقیت مسیر `assigned` اثبات شد؛ درخواست واقعی با JWT باربر به Nest HTTP در این فاز اجرا نشد (بدون بالا آوردن سرور جداگانه). ریسک باقی‌مانده: پایین — Guards استاندارد Nest/`@Roles` در پروژه فعال‌اند.
2. **Confetti UI در مرورگر:** Idempotency از روی کد صفحه + کامپوننت تأیید شد؛ Refresh واقعی مرورگر در این فاز اجرا نشد.
3. **ایندکس ترکیبی بدهی:** NOTE — نه Fail.
4. **پروداکشن:** هیچ تماس SSH/DB/PM2 انجام نشد (ممنوع طبق محدوده). وضعیت migrate پروداکشن برای این مایگریشن هنوز **Unknown** و باید در preflight فاز ۴ فقط خواندنی بررسی شود.

---

## ۷) اعلام آمادگی (Go / No-Go)

### **Go** — مجاز برای ورود به مرحله تهیه بسته دیپلوی (Local packaging / overlay prep)

دلایل قطعی:
- مایگریشن لوکال سالم، additive، و applied
- ۴۱ مورد Pass / ۰ Fail
- بیلد Backend و Frontend سبز
- N+1 بدهی در لیست نوبت‌ها مردود نشده
- تغییرات اشکان/چک دست‌نخورده در درخت باقی مانده‌اند

### شروط قبل از هر عمل پروداکشن (هنوز اجرا نشود مگر تأیید صریح کاربر)

1. Preflight فقط خواندنی روی سرور: وجود/عدم وجود مایگریشن `20261029160000_...` در `_prisma_migrations`.
2. تصمیم بسته: فقط فاز ۲، یا فاز ۲ + اشکان + چک با هم.
3. اختیاری: ایندکس ترکیبی `customer_debts(customerId, settledAt)` اگر EXPLAIN پروداکشن ایجاب کند.
4. بدون `git push`، بدون restart، بدون migrate پروداکشن تا تأیید صریح مرحله بعد.

---

## ۸) فهرست فایل‌های شواهد

| فایل | نقش |
|------|-----|
| `backend/_tmp_phase3_qa_verify.js` | رانر سناریوها |
| `_tmp_phase3_qa_results.json` | نتیجه ماشین‌خوان (41/0/1) |
| `backend/prisma/migrations/20261029160000_phase2_appointments_packages_finance/migration.sql` | DDL بررسی‌شده |
| `REPORT_phase2_changes.md` | مرجع پیاده‌سازی فاز ۲ |
| این فایل | گزارش فاز ۳ |

---

*پایان گزارش فاز ۳ — محیط Local فقط؛ بدون تعامل پروداکشن.*
