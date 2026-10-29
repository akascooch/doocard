# Phase 1 — Discovery report (Doocard)

تاریخ بررسی: 2026-10-29  
محدوده: فقط خواندن کد لوکال و دستورهای read-only روی پروداکشن. هیچ migrate، restart، git pull، یا تغییر فایلی جز همین گزارش انجام نشد.

## Executive Summary

بررسی روی workspace واقعی `C:\scooch\Versions\v.2.0.4` انجام شد. رجیستری همین مسیر را لوکال معتبر می‌داند؛ `C:\scooch\ip.txt` هنوز `v.2.0.3.3` را نوشته است. بیس‌لاین پرامپت (`v2.0.7-hardened` / `9c35aff`) با گیت لوکال و با runtime پروداکشن یکی نیست.

پروداکشن در همین تاریخ: PM2 هر دو اپ نسخه `2.0.29` و online، nginx فعال و enabled، apache2 masked، Node روی `127.0.0.1:3000` و `127.0.0.1:3001`، `GET /api/health` برابر 200. گیت سرور همچنان `main` کثیف در `0537c56` با 289 خط porcelain است. BUILD_ID زنده `6P4_t4AY1ep91cV-q2HOt` با بیلد لوکال `NJ4nZ3MAtPYG6MT8eidCk` فرق دارد.

ستون یا API برای «منبع نوبت» وجود ندارد. تنها نشانهٔ موقت، `status=PENDING_CONFIRMATION` هنگام ساخت توسط نقش `CUSTOMER` است و بعد از تأیید از بین می‌رود. ادمین و آرایشگر هر دو `PENDING` می‌گیرند.

بدهی باز در `customer_debts` با `settledAt IS NULL` است (الان 10 ردیف). هشدار بدهی فقط داخل مودال تسویه است، نه روی لیست نوبت در انتظار تأیید.

پکیج تک‌سرویس است. `totalSessions` حداقل 1 است و مقدار 0 در API رد می‌شود. تاریخچهٔ مصرف در API/UI برنمی‌گردد. در پروداکشن: 1 قالب غیرفعال (80 جلسه)، 1 واگذاری، 0 مصرف.

امتیاز نمودار از جمع `loyalty_point_transactions` می‌آید و آن جدول در پروداکشن 0 ردیف دارد. تنظیم ذخیره‌شده «1000 ریال به‌ازای هر امتیاز» نرخ تبدیل به کیف پول است، نه قانون «هر 1,000,000 تومان = 5 امتیاز».

مشتری عمومی همان `customers.id = 1` است و 35,240 نوبت `SETTLED` دارد. نمودار برترها او را حذف نمی‌کند.

فروش کالای سالن در `appointment_products` هنگام تسویه نوبت ثبت می‌شود (34 ردیف). `order_items` فروشگاه 0 ردیف است. نمودار ماهانهٔ کالا وجود ندارد.

صفحهٔ مشتریان 846 ردیف `customers` را می‌شمارد و در کلاینت `isActive: true` می‌گذارد. soft-delete برای مشتری/کاربر وجود ندارد. 836 ردیف نقش `CUSTOMER` دارند و 10 ردیف متعلق به پرسنل است.

## Current State Findings (evidence with paths/commands)

### 1. Workspace و هم‌ترازی محیط

| محل | شاهد | مقدار |
|---|---|---|
| لوکال بررسی‌شده | `git -C C:\scooch\Versions\v.2.0.4` | شاخه `release/v2.0.29`، HEAD `2292eb3db4e2b1d1576636416652c61f00125ae8`، 2026-10-22 |
| نسخهٔ پکیج لوکال | `frontend/package.json` و `backend/package.json` | هر دو `"version": "2.0.29"` |
| کثیفی لوکال | `git status -sb` | فایل‌های چک/نوبت اشکان و اسکریپت‌های `_tmp_*` خارج از HEAD |
| BUILD لوکال | `frontend/.next/BUILD_ID` | `NJ4nZ3MAtPYG6MT8eidCk` |
| رجیستری | `C:\scooch\doocard-prod-path-registry.md` بخش 2 | ریشهٔ لوکال معتبر = `C:\scooch\Versions\v.2.0.4` |
| `ip.txt` | خطوط مسیر لوکال | هنوز `C:\scooch\Versions\v.2.0.3.3` |
| رجیستری «release جاری» | همان فایل، بالای سند | `v2.0.31-cheque-admin-cron` و BUILD_ID `xAWMq27E-Ibp69poSPYEY`، آخرین ثبت 2026-10-21 |
| پروداکشن گیت | `git -C /var/www/doocard` | `main` @ `0537c56a2a5544bd237ffd62305116cb6fcbd807`، `dirty_lines=289` |
| پروداکشن اپ | `pm2 status` | `doocard-backend` و `doocard-frontend` نسخه `2.0.29`، online، uptime حدود 2 روز |
| BUILD پروداکشن | هر دو مسیر `.next/BUILD_ID` و standalone | `6P4_t4AY1ep91cV-q2HOt` (با هم برابر، با لوکال نابرابر) |
| آخرین مایگریشن DB | `_prisma_migrations` | `20261022120000_lottery_circle_and_exclusions` در 2026-10-22. همین پوشه در لوکال هم هست |

ساختار ریپو (بدون اپ جداگانهٔ monorepo به نام `apps/`):

- `frontend/` — Next.js، صفحات زیر `frontend/src/app`
- `backend/` — NestJS، Prisma در `backend/prisma/schema.prisma`
- `docs/` — ران‌بوک overlay
- `deploy/` در این workspace وجود ندارد

پیشوند API: `backend/src/main.ts` مقدار `api` را global prefix می‌گذارد. nginx طبق رجیستری `/api` را به `127.0.0.1:3001` می‌فرستد.

### 2. پروداکشن read-only (2026-10-29)

دستورها از ورک‌استیشن با کلید SSH روی پورت 3031 اجرا شد. مقدار هیچ secret چاپ نشد.

- `uname -r` → `5.15.0-190-generic`
- `systemctl is-active nginx` → `active`؛ `httpd` → `inactive`؛ `apache2` → `failed`
- `systemctl is-enabled nginx` → `enabled`؛ `apache2` → `masked`
- `ss -lntp`: `0.0.0.0:3031` sshd، `127.0.0.1:3001` backend، `127.0.0.1:3000` frontend، `0.0.0.0:80` و `:443` nginx
- `curl http://127.0.0.1:3001/api/health` → `health_http=200`
- PM2 cwd: frontend = `/var/www/doocard/frontend/.next/standalone` اسکریپت `server.js`؛ backend = `/var/www/doocard/backend` اسکریپت `dist/main.js`
- ecosystem موجود: `backend/ecosystem.config.js` و `frontend/ecosystem.config.js` (هر دو 22 اکتبر). کلیدهای داخل فایل لوکال متناظر فقط `NODE_ENV` / `PORT` / `HOST` / `HOSTNAME` هستند
- کلیدهای حاضر در `/var/www/doocard/backend/.env` (فقط نام): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMS_API_KEY`, `SMS_ENABLED`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `HOST`, `PORT`, `NODE_ENV`, و کلیدهای cheque/lottery/reconcile. فایل‌های `frontend/.env`, `.env.local`, `.env.production` در آن مسیرها نیستند
- environ اولیهٔ پروسه فقط `HOST`, `NODE_ENV`, `PORT` (و برای فرانت `HOSTNAME`) را نشان داد. این environ زمان استارت PM2 است؛ Nest فایل `.env` را جدا می‌خواند
- `pm2 logs doocard-backend --lines 200 --nostream` حدود 205 خط برگرداند و شمارش `APPOINTMENT_CREATED|NOTIFY|package|ERROR|Error` برابر 0 بود. `doocard-frontend` حدود 9 خط. رخداد ساخت نوبت در این پنجرهٔ لاگ ثبت نشده است

اعداد DB (فقط SELECT):

| پرسش | نتیجه |
|---|---|
| ستون‌های شبیه منبع روی `appointments` | فقط `bookingGroupId`, `clientOpId`, `createdAt`, `notes`, `status` |
| وضعیت نوبت‌ها | `SETTLED` 37418، `PENDING` 190، `CONFIRMED` 65، `CANCELLED` 56، `PENDING_CONFIRMATION` 9. مقدار `PAID` و `COMPLETED` در دادهٔ زنده 0 است |
| `customers` | 846 |
| `users.role = CUSTOMER` | 836 |
| ردیف customer با نقش غیرمشتری | 10 = `SERVICE` 6، `ADMIN` 2، `EMPLOYEE` 2 |
| نام حاوی «عمومی» یا تلفن ثابت ایمپورت | یک ردیف: `customers.id=1`, `users.id=10`, نقش `CUSTOMER`, نام `مشتری عمومی`, کلاس تلفن = ثابت ایمپورت |
| نوبت `SETTLED` همین مشتری | 35240 ردیف؛ جمع `appointments.amount` = `514246000008` |
| `system_settings` id=1 | `loyaltyRateRialPerPoint=1000`, `loyaltyMinRedeemPoints=100` |
| `loyalty_point_transactions` | 0 ردیف |
| `service_package_templates` | 1 ردیف، `totalSessions=80`, `validityDays=365`, `isActive=false`, `pointsRequired` خالی، هیچ ردیف با جلسات 0 |
| `customer_service_packages` / `customer_package_consumptions` | 1 / 0 |
| `customer_debts` با `settledAt IS NULL` | 10 |
| `appointment_products` / `order_items` | 34 / 0 |
| نوبت حذف‌نشده با `serviceId` / با JSON `services` | 34808 / 37467 |
| `appointment_services` | 34808 ردیف |
| گروه‌های نام تکراری | 33 گروه نام یکسان (تلفن همچنان unique است) |

### 3. نقشهٔ ماژول‌های کلیدی

**نوبت**

- UI لیست ادمین: `frontend/src/app/dashboard/admin/appointments/page.tsx` → `AppointmentList`
- UI لیست آرایشگر: `frontend/src/app/dashboard/employee/appointments/page.tsx` (همان کامپوننت، `userRole="EMPLOYEE"`)
- UI مشترک: `frontend/src/components/appointments/AppointmentList.tsx`, `PaymentModal.tsx`
- API: `AppointmentsController` روی `appointments`؛ منطق ساخت در `AppointmentsService.create` و `createBookingGroup`
- DB: مدل `Appointment` در `backend/prisma/schema.prisma`

**بدهی**

- API: `GET /api/customers/:id/open-debts` و `GET /api/admin/debtors`
- سرویس: `CustomersService.listDebtors` و متد open-debts در `backend/src/customers/customers.service.ts`
- UI هشدار: `PaymentModal.tsx`؛ صفحهٔ جدا `frontend/src/app/dashboard/admin/debtors/page.tsx`
- DB: `customer_debts` (`amount`, `settledAt`, `appointmentId`, `sourceType`)

**پکیج و امتیاز**

- UI ادمین: `frontend/src/app/dashboard/admin/packages/page.tsx` (منو فقط در `adminMenuItems`)
- UI مشتری: `frontend/src/app/dashboard/customer/packages/page.tsx`
- API: `PackagesController` روی `packages`؛ `LoyaltyController` / `loyalty.service.ts`
- DB: `service_package_templates`, `customer_service_packages`, `customer_package_consumptions`, `loyalty_point_transactions`, `customer_wallet_ledger`, `system_settings`

**گزارش مالی**

- UI: `frontend/src/app/dashboard/admin/financial/page.tsx`
- API: `GET /api/admin/financial/yearly-report` و `GET /api/admin/analytics/top-customers`
- سرویس امتیاز/برتر: `backend/src/admin/admin-analytics.service.ts`

**مشتری**

- UI: `frontend/src/app/dashboard/admin/customers/page.tsx`
- API: `GET /api/customers` → `CustomersService.findAll`
- DB: `customers` + `users` (تلفن unique، `customers.userId` unique)

**کالا**

- فروش داخل تسویه نوبت: `AppointmentsService.applyAppointmentProductSales` → `appointment_products` + حرکت موجودی `APPOINTMENT_SALE`
- فروشگاه کارت‌به‌کارت: مدل `Order` / `OrderItem`، صفحهٔ `frontend/src/app/dashboard/admin/orders` (جدا از سالن؛ کامنت اسکیما: isolated from salon Transaction / AppointmentProduct)

### 4. Data-flow خلاصه

```text
نوبت
  UI admin/employee/customer booking
    → POST /api/appointments  (AppointmentsService.create | createBookingGroup)
    → INSERT appointments (status از روی role؛ بدون createdBy)
    → notifications type=APPOINTMENT_CREATED برای ADMIN (بدون نقش سازنده)
    → لیست GET /api/appointments → AppointmentList

بدهی (مسیر موجود، جدا از لیست نوبت)
  PaymentModal → GET /api/customers/:id/open-debts
    → customer_debts WHERE settledAt IS NULL

پکیج
  admin packages page → /api/packages/templates|assign
    → service_package_templates.serviceId (یک خدمت)
    → customer_service_packages
  AppointmentList → POST /api/packages/:id/consume
    → customer_package_consumptions (یک ردیف به‌ازای هر appointmentId)
    → این مسیر PaymentMethod نوبت را عوض نمی‌کند

امتیاز نمودار
  financial page → GET /api/admin/analytics/top-customers
    → groupBy appointments (SETTLED/PAID/COMPLETED, paidAt در سال جلالی)
    → SUM loyalty_point_transactions.points برای همان customerIdها (بدون فیلتر سال)

کالا
  تسویه نوبت → appointment_products
  فروشگاه → orders / order_items
  نمودار ماهانهٔ کالا: مسیر UI/API وجود ندارد

شمارنده مشتری
  customers page → GET /api/customers → customers.length در کلاینت
```

### 5. منبع نوبت — داده وجود ندارد

`Appointment` این فیلدها را دارد: `customerId`, `employeeId`, `status`, `notes`, `clientOpId`, `bookingGroupId`, `createdAt`. فیلد `createdBy` / `source` / `actorRole` در اسکیما و در `\d` پروداکشن نیست.

در `AppointmentsService.create` (حدود خط 842) و `createBookingGroup` (حدود خط 530):

- نقش `CUSTOMER` → `PENDING_CONFIRMATION`
- نقش `ADMIN` یا `EMPLOYEE` → `PENDING`
- نقش‌های دیگر و رزرو بدون تشخیص staff هم به `PENDING` می‌رسند، چون فقط شاخهٔ `CUSTOMER` وضعیت تأیید را ست می‌کند

`notifyAppointmentCreated` برای هر ساخت موفق یک `Notification` با `type: APPOINTMENT_CREATED` و `roleTarget: ADMIN` می‌سازد. متن اعلان نقش سازنده را ذخیره نمی‌کند. لاگ ساخت در 200 خط اخیر backend دیده نشد؛ کد موفق، `Logger` ساختاری برای «ساخته‌شده توسط مشتری» ندارد و فقط خطای notify/SMS را `console.warn` می‌کند.

بعد از تأیید (`confirm` فقط وقتی وضعیت `PENDING_CONFIRMATION` یا `PENDING` است) وضعیت به `CONFIRMED` عوض می‌شود و نشانهٔ موقت هم پاک می‌شود. ردیف‌های تاریخی `SETTLED` (37418) قابل بازسازی مطمئن به‌عنوان ادمین/آرایشگر/مشتری نیستند. فقط 9 ردیف هنوز `PENDING_CONFIRMATION` هستند و می‌شود آن‌ها را با احتیاط به‌عنوان «هنوز تأییدنشده و در لحظهٔ ساخت مشتری بوده» برچسب زد، به شرطی که از آن به بعد کد عوض نشده باشد.

### 6. بدهی قبل از تأیید

مدل جدا از کیف پول است.

- بدهی سالن: `CustomerDebt.amount` (BigInt ریال) تا وقتی `settledAt` خالی است
- کیف پول: `CustomerWalletLedger` (اعتبار فروشگاه/تبدیل امتیاز). این موجودی بدهی نیست
- صفحهٔ مشتریان فیلد balance ندارد

`PaymentModal` هنگام باز شدن تسویه، `GET /api/customers/:id/open-debts` را می‌خواند و اگر `count > 0` باشد هشدار نشان می‌دهد. لیست ادمین (`appointments/page.tsx`) این API را صدا نمی‌زند. پس برای نوبت `PENDING_CONFIRMATION`، قبل از زدن تسویه، هشدار بدهی روی ردیف لیست وجود ندارد. دادهٔ لازم برای همان هشدار از قبل در DB هست.

### 7. پکیج — وضعیت واقعی

قالب: `ServicePackageTemplate.serviceId` یک FK اجباری به `services`. فرم «پکیج جدید» یک `<select>` تک‌گزینه‌ای است (`admin/packages/page.tsx`).

جلسات: DTO `CreatePackageTemplateDto.totalSessions` با `@Min(1)` و `@Max(500)`. `consumePackageSession` فقط وقتی `remainingSessions > 0` کم می‌کند و اگر بعد از کسر `<= 0` شد وضعیت را `EXHAUSTED` می‌کند. مقدار 0 امروز یعنی «قابل مصرف نیست»، نه نامحدود. در پروداکشن هیچ قالبی با 0 جلسه نیست.

واگذاری: `POST /api/packages/assign` برای `ADMIN|EMPLOYEE|SERVICE`. داخل تراکنش، اگر پرداخت `WALLET` باشد از `customer_wallet_ledger` کم می‌کند و یک `customer_service_packages` با `remainingSessions = totalSessions` می‌سازد. پرداخت‌های مجاز قالب: `WALLET|CASH|CARD|COMPLIMENTARY`. متن خود صفحه می‌گوید فروش نقد/کارت پکیج در دفتر کل سالن ثبت نمی‌شود. پروداکشن 1 واگذاری دارد، پس این مسیر حداقل یک‌بار نوشته است. صحت کسر جلسه در دادهٔ زنده ثابت نشده: 0 ردیف مصرف.

تطابق خدمت موقع مصرف فقط `appointment.serviceId` و جدول `appointment_services` را می‌بیند. ساخت آنلاین در `appointments.service.ts` فقط JSON ستون `services` را می‌نویسد و `appointmentService.create` را صدا نمی‌زند (آن insert در ایمپورت اکسل هست: `appointment-commit.lib.ts`). در پروداکشن 37467 نوبت حذف‌نشده JSON سرویس دارند و 34808 تا `serviceId` دارند؛ اختلاف 2659 نوبت است که matcher پکیج آن‌ها را «بدون خدمت پکیج» می‌بیند حتی اگر JSON سرویس درست باشد.

تاریخچه: جدول `customer_package_consumptions` ستون‌های `customerPackageId`, `appointmentId`, `createdAt` را دارد و روی `appointmentId` یکتا است. `serializeOwned` مصرف‌ها را برنمی‌گرداند. UI تاریخچهٔ «چند بار، کی، کدام نوبت/خدمت» وجود ندارد. یکتایی روی خود نوبت یعنی برای یک نوبت فقط یک کسر پکیج ممکن است.

تسویه: `PaymentMethod` برابر `CASH|CARD|ONLINE|TRANSFER|CHEQUE|CARD2CARD|DEBT` است. مقدار `PACKAGE` نیست. دکمهٔ «کسر جلسه از پکیج» در `AppointmentList` جدا از مودال تسویه است و مبلغ/`paymentMethod` نوبت را عوض نمی‌کند.

پنل آرایشگر: `employeeMenuItems` لینک پکیج ندارد. همان `AppointmentList` برای `EMPLOYEE` دکمهٔ کسر و batch واجد شرایط را نشان می‌دهد. API واگذاری و `loyalty-eligible` هم به `EMPLOYEE` باز است. صفحهٔ مدیریت قالب و تنظیم امتیاز فقط در منوی ادمین است. تاریخچهٔ مخصوص ادمین جدا از این API وجود ندارد.

تنظیمات امتیاز روی همان صفحهٔ پکیج است: «ریال به‌ازای هر امتیاز» و «حداقل امتیاز برای تبدیل» و فیلد `pointsRequired` روی قالب. ثابت کد: `LOYALTY_RIALS_PER_POINT = 1000` و `LOYALTY_MIN_REDEEM_POINTS = 100` در `packages.constants.ts`. `LoyaltyService.redeemToWallet` امتیاز را منفی می‌کند و به کیف پول اعتبار می‌دهد. عمل‌های `EARNED_PURCHASE` و `EARNED_BONUS` فقط در آرایهٔ ثابت هستند و هیچ `create` ای در `backend/src` برایشان نیست. پروداکشن 0 تراکنش امتیاز دارد، پس نمودار فعلی برای همه 0 است.

### 8. گزارش مالی و مشتری عمومی

شناسایی مشتری عمومی از روی حدس نام انجام نشد. ثابت ایمپورت:

- `backend/src/import/lib/appointment-workbook.parser.ts`: `GENERIC_IMPORT_CUSTOMER_NAME = 'مشتری عمومی'` و `GENERIC_IMPORT_CUSTOMER_PHONE`
- کوئری زنده فقط یک کاربر با آن نام یا آن تلفن برگرداند: customer id `1`

`AdminAnalyticsService.getTopCustomers` این مشتری را فیلتر نمی‌کند. بازه، سال جلالی روی `paidAt` است. وضعیت‌های داخل جمع: `COMPLETED|PAID|COMPLETED` نیست؛ آرایه `COMPLETED`, `PAID`, `SETTLED` است. در دادهٔ زنده تقریباً همهٔ تسویه‌ها `SETTLED` هستند. امتیاز هر ردیف، جمع کل عمر دفتر امتیاز است (بدون فیلتر سال) و فقط برای مشتریانی که در آن سال نوبت تسویه‌شده دارند. با دفتر خالی، هر سه رتبهٔ امتیاز 0 می‌ماند، در حالی که مشتری id=1 به‌تنهایی 35240 مراجعهٔ تسویه‌شده و مبلغ خام `514246000008` در ستون `amount` دارد. UI این مبلغ را با `formatTomansFromRial` (تقسیم بر 10) به‌صورت تومان نشان می‌دهد.

نمودار ماهانهٔ تعداد و قیمت کالا در `financial/page.tsx` و `admin-financial.service.ts` نیست. منبع واقعی فروش کالای متصل به نوبت، `appointment_products` (`quantity`, `unitPriceRial`, `lineTotalRial`, `createdAt`) است. `orders` مسیر فروشگاه است و الان خالی است.

### 9. شمارندهٔ مشتریان

`CustomersService.findAll` همهٔ ردیف‌های `customers` را بدون فیلتر حذف یا نقش برمی‌گرداند. `User` و `Customer` ستون `deletedAt` ندارند. `remove()` اول ردیف customer و بعد user را سخت حذف می‌کند.

در `admin/customers/page.tsx` نگاشت کلاینت `isActive: true` ثابت است. کارت «مشتریان فعال» همان `customers.filter(c => c.isActive).length` است، پس با «کل مشتریان» برابر می‌شود. کارت کل = `customers.length`.

جمع زنده:

- 846 ردیف customer (چیزی که UI امروز نشان می‌دهد)
- 836 با نقش `CUSTOMER`
- 10 پروفایل پرسنل که ردیف customer هم دارند
- اگر مشتری عمومی (id=1) از نقش مشتری کنار گذاشته شود: 835
- 33 گروه نام تکراری؛ چون `users.phone` یکتاست این‌ها شخص تکراریِ هم‌تلفن نیستند
- soft-delete نشده‌ای برای برگرداندن به شمارش وجود ندارد
- کتابخانه یا افکت confetti در `frontend` پیدا نشد
- `NotificationType` مقدار مخصوص رسیدن به 1000 ندارد. نزدیک‌ترین نوع موجود `GENERAL` و `CUSTOMER_REGISTERED` است

فاصله تا 1000 با تعریف پیشنهادی پایین (نقش CUSTOMER بدون مشتری عمومی) برابر 165 نفر است. با شمارش خام UI برابر 154 نفر است. هیچ‌کدام به آستانهٔ هشدار نزدیک نیستند.

## Gaps & Root Causes (per task)

### (A) لیست نوبت ادمین

ریشه: منبع سازنده هرگز ذخیره نشده است. وضعیت، پروکسیِ لحظهٔ ساخت است و برای ادمین در برابر آرایشگر تمایز ندارد. هشدار بدهی در لایهٔ تسویه پیاده شده و به لیست «در انتظار تأیید» وصل نیست.

Acceptance:

- Given نوبت را مشتری ساخته و هنوز تأیید نشده، When ادمین لیست را باز می‌کند، Then ردیف badge «ثبت توسط مشتری» دارد.
- Given همان مشتری حداقل یک `customer_debts` با `settledAt` خالی دارد، When همان لیست رندر می‌شود، Then کنار ردیف جمع بدهی باز دیده می‌شود، قبل از تأیید و قبل از باز شدن تسویه.
- Given نوبت را ادمین یا آرایشگر ساخته، Then badge مشتری دیده نمی‌شود و برچسب سازنده با نقش واقعی یکی است.
- Given نوبت تأیید شد، Then برچسب منبع باقی می‌ماند.

دادهٔ لازم: ستون جدید منبع (نقش یا enum `ADMIN|EMPLOYEE|CUSTOMER`) که در `create` نوشته شود و در GET لیست برگردد. بدهی را می‌شود از API موجود به‌صورت batch خواند؛ ستون جدید برای بدهی لازم نیست. backfill تاریخی قابل اتکا نیست.

UI: badge/outline روی `AppointmentList` برای وضعیت‌های در انتظار، به‌خصوص `PENDING_CONFIRMATION`.

ریسک: مایگریشن افزایشی کم‌خطر. backfill غلط روی 37هزار نوبت تسویه‌شده خطرناک است؛ پیش‌فرض ردیف‌های قدیمی `UNKNOWN`. اگر هشدار بدهی برای هر ردیف یک HTTP جدا بزند، با 190 نوبت `PENDING` بار اضافه می‌سازد؛ یک کوئری batch لازم است.

تست: واحد برای تعیین status+source از روی role؛ یکپارچه برای ساخت مشتری و دیدن فیلد در GET؛ E2E لیست ادمین با بدهی باز و بدون بدهی.

### (B) بازطراحی پکیج

ریشه: مدل v2.0.7 تک‌سرویس و جلسه‌شمار است. امتیاز به‌صورت نرخ تبدیل کیف پول طراحی شده و مسیر کسب امتیاز خرید وجود ندارد. مصرف از تسویه جداست و خدمت را از JSON نوبت نمی‌خواند.

Acceptance:

- Given ادمین صفحهٔ پکیج را باز می‌کند، Then فرم نرخ ریال/حداقل تبدیل و فیلد «امتیاز لازم» دیده نمی‌شود. قانون ثابت کسب امتیاز، هر 1,000,000 تومان (= 10,000,000 ریال، چون UI تومان را `rial/10` حساب می‌کند) برابر 5 امتیاز است.
- Given پکیج جدید، When چند خدمت انتخاب شود، Then قالب به همان مجموعه وصل است.
- Given `totalSessions = 0`, Then واگذاری نامحدود است، کسر جلسه موجودی را تمام نمی‌کند، و وضعیت `EXHAUSTED` به‌خاطر صفر شدن ست نمی‌شود.
- Given واگذاری با مشتری و روش پرداخت معتبر، Then یک ردیف مالکیت با تاریخ انقضا ساخته می‌شود و در صورت `WALLET` موجودی کم می‌شود.
- Given مصرف، Then تاریخچه برای آن مشتری زمان، شناسه نوبت، و خدمت را برمی‌گرداند و فقط ادمین آن تاریخچه را می‌بیند.
- Given آرایشگر، Then پکیج‌های فعال مشتری مرتبط را می‌بیند و به CRUD قالب و تاریخچه دسترسی ندارد.
- Given تسویه با نوع «پکیج»، Then یک جلسه (یا بدون کاهش اگر نامحدود است) از پکیج همان خدمت کم می‌شود و روش پرداخت نوبت `PACKAGE` می‌ماند.

دادهٔ لازم: جدول واسط خدمت‌های قالب؛ معنای 0 = نامحدود در DTO و consume؛ ستون‌های تاریخچه یا join روی consumption؛ مقدار enum پرداخت. قالب غیرفعال فعلی (80 جلسه، یک خدمت) باید به جدول واسط کپی شود.

UI: multi-select در فرم ادمین؛ حذف کارت تنظیمات وفاداری؛ در آرایشگر یک نمای فقط‌خواندنی؛ در تسویه گزینهٔ پکیج به‌جای دکمهٔ جدا که مبلغ را دست نمی‌زند.

ریسک: استفاده از 0 هم‌زمان با منطق فعلی `remaining <= 0 → EXHAUSTED` اگر همه‌ٔ guardها با هم عوض نشوند، پکیج نامحدود را تمام‌شده می‌کند. امروز ردیف 0 وجود ندارد، پس تبدیل معنا روی دادهٔ زنده قفل نیست. یکتایی `appointmentId` روی consumption با چند خدمت در یک نوبت می‌جنگد. اضافه کردن `PACKAGE` به تسویه روی کمیسیون/درآمد نوبت اثر مالی دارد (سوال باز 5). تطبیق ندادن JSON سرویس یعنی کسر روی نوبت آنلاین همین حالا می‌شکند.

تست: واحد consume برای 0، برای جلسهٔ آخر، و برای خدمت خارج از مجموعه؛ یکپارچه assign+consume+تاریخچه؛ E2E ادمین multi-select و آرایشگر بدون لینک تاریخچه؛ تست دسترسی 403 برای EMPLOYEE روی endpoint تاریخچه.

### (C) گزارش مالی

ریشه: کوئری برترها مشتری id=1 را نگه می‌دارد (35240 از 37418 تسویه). امتیاز را از دفتری می‌خواند که خالی است و فرمول جدیدی در کد نیست. سری ماهانهٔ کالا نوشته نشده.

Acceptance:

- Given سال انتخاب‌شده، When نمودار مبلغ کل / مراجعه / امتیاز لود شود، Then customer id=1 در هیچ‌کدام از سه سری و در جمع‌های همان کارت نیست.
- Given مبلغ تسویه‌شدهٔ یک مشتری واقعی در آن سال، Then امتیاز = کف تقسیم تومان بر 1,000,000 ضربدر 5، با همان واحد ریال ذخیره‌شده (`amount/10` = تومان).
- Given کالاهای فروخته‌شده در تسویهٔ نوبت، When نمودار ماهانه باز شود، Then برای هر ماه جلالی جمع `quantity` و جمع `lineTotalRial` دیده می‌شود.

دادهٔ لازم: تغییر کوئری `getTopCustomers`؛ endpoint جدید تجمیع `appointment_products` روی ماه `paidAt` نوبت (یا `createdAt` ردیف کالا، باید یکی انتخاب شود؛ پیشنهاد: `appointments.paidAt` تا با گزارش سالانه یکی باشد). مایگریشن برای خود نمودار لازم نیست.

UI: همان کارت مشتریان برتر؛ یک `ComposedChart` یا دو سری روی کارت جدید زیر گزارش سالانه.

ریسک: اگر امتیاز روی هر نوبت جدا گرد شود با گرد کردن روی جمع سال فرق دارد (سوال باز 3). 34 ردیف کالا برای عملکرد مشکلی نیست. اگر بعداً سفارش فروشگاه هم وارد جمع شود، تعریف «کالای فروخته‌شده» دو منبع پیدا می‌کند.

تست: واحد کوئری با فیکسچر مشتری عمومی + مشتری عادی؛ واحد فرمول 10,000,000 ریال → 5 امتیاز و 9,999,999 ریال → 0؛ یکپارچه endpoint سال؛ E2E سه تب نمودار بدون نام «مشتری عمومی».

### (D) شمارنده تا 1000 / 1500 / …

ریشه: UI تعداد آرایهٔ لودشده را نشان می‌دهد، فعال‌بودن را جعل می‌کند، و به نقطهٔ عطف وصل نیست.

تعریف شمارش پیشنهادی (تا وقتی سوال باز 2 جواب دیگری ندهد): تعداد ردیف‌هایی که `users.role = CUSTOMER` و customer id آن‌ها مشتری عمومی (id=1) نیست. soft-delete در سیستم نیست. نام تکراری شخص دوم است چون تلفن یکتاست و نباید ادغام شود. با این تعریف عدد امروز 835 است و هدف بعدی 1000 است (165 نفر مانده). هدف بعد از عبور، 1500 است.

آستانهٔ نوتیف پیشنهادی: یک اعلان به نقش `ADMIN` وقتی مانده به هدف ≤ 20 شود (برای هدف 1000 یعنی شمارش به 980 برسد)، و یک اعلان جدا در خود 1000. تکرار در هر بار باز شدن صفحه ممنوع؛ یک ردیف اعلان به‌ازای هر `(milestone, threshold)`.

Acceptance:

- Given شمارش 835، When ادمین صفحهٔ مشتریان را باز می‌کند، Then شمارنده هدف 1000 و مانده را نشان می‌دهد و confetti اجرا نمی‌شود.
- Given شمارش از 979 به 980 می‌رسد، Then دقیقاً یک نوتیف ادمین برای آستانه ساخته می‌شود.
- Given شمارش به 1000 می‌رسد، Then افکت 60 ثانیه یک‌بار برای ادمین‌ها اجرا می‌شود و با رفرش در همان مرورگر دوباره از صفر شروع نمی‌شود.
- Given حذف سخت یک مشتری، Then شمارش کم می‌شود. ردیف soft-delete وجود ندارد که پنهان بماند.

دادهٔ لازم: endpoint شمارش سبک `COUNT` با تعریف بالا، تا صفحه مجبور نباشد 846 رکورد را برای یک عدد بکشد. برای «فقط یک‌بار» یک جدول کوچک یا یک ردیف settings با آخرین milestone اعلام‌شده. confetti کتابخانهٔ جدید سمت کلاینت است.

ریسک: اگر شمارش روی `customers.length` بماند، 10 پرسنل و مشتری عمومی داخل عدد می‌مانند و هدف زودتر جعلی رد می‌شود. اعلان داخل `findAll` در هر GET طوفان نوتیف می‌سازد؛ باید گذار شمارش را یک‌جا (بعد از create مشتری) چک کرد.

تست: واحد تعریف جمعیت؛ واحد گذار 979→980 و 999→1000 فقط یک رویداد؛ E2E تایمر 60 ثانیه و نبود افکت زیر آستانه.

## Proposed Minimal Changes (high-level only, no code)

1. روی `appointments` یک enum منبع (`CUSTOMER|EMPLOYEE|ADMIN|UNKNOWN`) اضافه شود و فقط در `create` / `createBookingGroup` از `currentUser.role` پر شود. ردیف‌های قبلی `UNKNOWN` بمانند؛ 9 ردیف فعلی `PENDING_CONFIRMATION` را می‌شود در اسکریپت جدا، بعد از تأیید صاحب محصول، به `CUSTOMER` برچسب زد. در `AppointmentList` برای منبع `CUSTOMER` یک badge نشان داده شود.
2. برای ردیف‌های `PENDING` و `PENDING_CONFIRMATION` یک فیلد `openDebt` از همان تعریف `settledAt IS NULL` به پاسخ لیست بچسبد (یک groupBy، نه N درخواست). کارت بدهکاران دست نخورد.
3. کارت تنظیمات وفاداری و `pointsRequired` از UI پکیج برداشته شود. نمودار و هر نمایش امتیاز خرید از فرمول ثابت ریال استفاده کند، نه از `system_settings`. دفتر امتیاز و تبدیل به کیف پول تا جواب سوال 4 دست نخورَد؛ چون 0 ردیف دارد، خاموش کردنش داده را خراب نمی‌کند ولی رفتار صفحهٔ مشتری را عوض می‌کند.
4. جدول واسط `template ↔ services`. `serviceId` فعلی تا پایان backfill همان یک قالب غیرفعال بماند، بعد حذف شود. فرم ادمین multi-select شود.
5. قرارداد 0 = نامحدود در DTO (`@Min(0)`) و در consume: اگر total صفر است decrement و `EXHAUSTED` اجرا نشود. همهٔ شرط‌های `remainingSessions > 0` در `eligible` هم با همین قرارداد عوض شوند.
6. matcher خدمت، JSON `appointments.services` را هم ببیند تا نوبت آنلاین بدون ردیف `appointment_services` قابل کسر باشد. این باگ امروز است و برای تسویهٔ پکیج پیش‌نیاز است.
7. یکتایی مصرف از «یک مصرف برای کل نوبت» به «یک مصرف برای هر خدمت پکیج در آن نوبت» تغییر کند، وگرنه multi-service در یک نوبت غلط می‌شود. تاریخچه = همین ردیف‌ها به‌اضافه نام خدمت و زمان، فقط با نقش `ADMIN`.
8. منوی آرایشگر یک صفحهٔ فقط‌خواندنی پکیج‌های مشتری خودش (بدون تاریخچه و بدون ساخت قالب). `POST assign` و loyalty-eligible برای `EMPLOYEE` بسته شود مگر اینکه سوال محصول خلافش را بگوید؛ امروز API بازتر از خواسته است.
9. `PaymentMethod.PACKAGE` در تسویه، که consume را داخل همان تراکنش تسویه صدا بزند. تا جواب سوال 5، درآمد نقدی برای بخش پوشش‌داده‌شده با پکیج ساخته نشود و کمیسیون روی مبلغ صفرِ همان خدمت حساب نشود. این بخش را جدا از بقیه merge کنید.
10. `getTopCustomers` مشتری id=1 را در هر سه متریک حذف کند. امتیاز همان مجموعهٔ فیلترشده را با فرمول جدید حساب کند و به دفتر خالی وابسته نباشد.
11. endpoint تجمیع ماهانهٔ `appointment_products` (تعداد و `lineTotalRial`) و یک نمودار در صفحهٔ مالی. تا جواب سوال 1، `orders` وارد این نمودار نشود.
12. شمارنده روی صفحهٔ مشتریان با COUNT سرور، هدف جاری 1000 و بعدی 1500، نوتیف در ماندهٔ 20 و در خود هدف، confetti شصت‌ثانیه‌ای یک‌باره. جمعیت پیش‌فرض: نقش `CUSTOMER` بدون id=1.

## DB / Migration Needs + risk level

| تغییر | نوع | ریسک |
|---|---|---|
| enum + ستون `appointments.createdByRole` با پیش‌فرض `UNKNOWN` | افزایشی، nullable یا default | کم. backfill گسترده انجام نشود |
| جدول واسط خدمت‌های پکیج و کپی قالب id موجود | افزایشی + یک UPDATE دادهٔ کم (1 ردیف) | متوسط به‌خاطر کد قدیمی که `serviceId` تکی می‌خواند؛ هر دو را تا یک release نگه دارید |
| معنای `totalSessions=0` | بدون تغییر نوع ستون؛ تغییر همهٔ guardها | متوسط اگر یک مسیر جا بماند. دادهٔ فعلی 0 ندارد |
| یکتایی `customer_package_consumptions.appointmentId` | drop unique تک‌ستونه و unique ترکیبی با خدمت | متوسط. امروز 0 ردیف مصرف است، پس قفل داده کم است |
| `PaymentMethod` + مقدار `PACKAGE` | `ALTER TYPE` در PostgreSQL | بالا به‌خاطر تسویه، کمیسیون، و گزارش درآمد. جدا از بقیه منتشر شود |
| حذف فیزیکی ستون‌های loyalty | پیشنهاد نمی‌شود در فاز اول | بالا و غیرلازم؛ UI را بردارید، ستون بماند |
| جدول یک‌بارمصرف milestone یا ستون روی `system_settings` | افزایشی | کم |
| enum `NotificationType` جدید | `ALTER TYPE` | کم؛ جایگزین موقت: نوع `GENERAL` بدون مایگریشن |
| ایندکس جدید برای نمودار کالا | اختیاری | کم. 34 ردیف است؛ ایندکس روی `appointmentId` از قبل هست |

قبل از هر `migrate deploy` روی پروداکشن: دامپ تازه، پنجرهٔ تأیید، و اجرا فقط با اجازهٔ صریح. آخرین مایگریشن اعمال‌شده `20261022120000_lottery_circle_and_exclusions` است.

## Test Plan Outline

واحد

- نقش → منبع نوبت و وضعیت اولیه
- batch بدهی باز برای چند customerId
- consume با جلسات 0، 1، و خدمت خارج از مجموعه
- matcher که JSON `services` را می‌بیند
- فرمول امتیاز و حذف customer id=1
- تجمیع ماهانهٔ quantity و lineTotal
- گذار شمارش 979/980 و 999/1000 فقط یک نوتیف

یکپارچه

- ساخت نوبت با توکن مشتری / آرایشگر / ادمین و دیدن فیلد در GET
- assign کیف پول ناکافی باید rollback شود
- consume و تسویهٔ `PACKAGE` در یک تراکنش؛ شکست consume نباید نوبت را نصف‌تسویه کند
- 403 تاریخچه برای EMPLOYEE و 200 برای ADMIN
- top-customers با فیکسچر مشتری عمومی

E2E

- لیست ادمین: badge مشتری + هشدار بدهی، و نبود badge برای نوبت آرایشگر
- فرم پکیج چندخدمتی بدون فیلد امتیاز
- نمودار مالی بدون «مشتری عمومی» و نمودار کالای ماهانه
- صفحهٔ مشتریان: مانده تا 1000، بدون confetti؛ سناریوی عبور از 1000 با ساعت ساختگی

پروداکشن در این فاز تست نشود. هیچ load test روی سرور زنده اجرا نشود.

## Deployment/Release Considerations

بیس‌لاین قابل اتکا برای کار بعدی، نسخهٔ پرامپت `v2.0.7-hardened` / `9c35aff` نیست. runtime زنده بستهٔ PM2 `2.0.29` است، BUILD_ID `6P4_t4AY1ep91cV-q2HOt`، مایگریشن تا 2026-10-22. رجیستری هنوز `v2.0.31` و BUILD_ID قدیمی‌تر `xAWMq27E-Ibp69poSPYEY` را «جاری» نوشته؛ این سند نسبت به سرور 2026-10-29 کهنه است و باید قبل از دیپلوی بعدی اصلاح شود، نه با حدس.

گیت `/var/www/doocard` باید git pull نشود. انتشار مثل overlayهای قبلی است: سورس مشخص، بیلد روی اوبونتو، `prisma migrate deploy` فقط برای مایگریشن این کار، بعد reload مربوط به PM2. `rsync --delete` ممنوع. apache2 باید masked بماند. nginx باید بالا بماند. UFW و پورت SSH دست نخورند.

لوکال `release/v2.0.29` به‌علاوهٔ diffهای ذخیره‌نشدهٔ چک و محدودیت نوبت اشکان است. آن diffها بخشی از این چهار تسک نیستند و نباید داخل باندل پکیج/نوبت/مالی قاطی شوند. BUILD لوکال با پروداکشن یکی نیست؛ `.next` لوکال را به‌عنوان runtime پروداکشن نگیرید. هش فایل‌به‌فایل سورس زنده با working tree در این فاز گرفته نشد.

ترتیب امن انتشار: اول گزارش و منبع نوبت و حذف مشتری عمومی از نمودار (کم‌ریسک، بدون دست زدن به تسویه)، بعد پکیج (مایگریشن)، و تسویهٔ `PACKAGE` در انتشار جدا چون به کمیسیون وصل است. شمارنده را با ساخت مشتری گره بزنید، نه با polling صفحه.

Rollback: نگه داشتن `dist` و standalone قبلی، و برای مایگریشن‌های افزایشی یک دامپ قبل از migrate. `ALTER TYPE ... ADD VALUE` در PostgreSQL به‌راحتی down نمی‌شود؛ اگر enum پرداخت اضافه شد، کد قدیمی باید مقدار ناشناس را تحمل کند یا انتشار کد و DB هم‌زمان باشد.

## Open Questions

1. نمودار ماهانهٔ کالا فقط خطوط `appointment_products` (تسویهٔ سالن، الان 34 ردیف) را بگیرد، یا سفارش فروشگاه `orders` / `order_items` (الان 0 ردیف) هم در همان جمع باشد؟
2. عدد شمارنده کدام جمعیت است: 835 (نقش `CUSTOMER` بدون customer id=1)، 836 (همهٔ نقش مشتری شامل عمومی)، یا 846 (هر ردیف `customers` شامل 10 پرسنل)؟
3. امتیاز «هر 1,000,000 تومان = 5» روی جمع سالانه یک‌بار گرد شود، یا هر نوبت جدا و بعد جمع شود؟ این دو عدد یکی نمی‌شوند.
4. با برداشتن تنظیمات وفاداری، تبدیل امتیاز به کیف پول در صفحهٔ مشتری هم خاموش شود؟ دفتر زنده خالی است.
5. تسویه با نوع پکیج مبلغ همان خدمت را برای درآمد و کمیسیون صفر کند، یا فقط جلسه را کم کند و مبلغ نوبت سر جایش بماند؟

شناسایی مشتری عمومی و محل بدهی و محل ثبت کالای سالن از روی کد و DB مشخص شد و جزو سوال‌ها نیست: customer id=1؛ بدهی باز = `customer_debts.settledAt IS NULL`؛ کالای سالن = `appointment_products`.
