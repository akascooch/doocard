# Phase 2 — Local Implementation Report (Doocard)

تاریخ: 2026-10-29  
محدوده: فقط لوکال روی `C:\scooch\Versions\v.2.0.4` شاخه `release/v2.0.29` @ `2292eb3`.  
هیچ دیپلوی / SSH mutating / `git pull` پروداکشن / `prisma migrate reset` انجام نشد.  
فایل‌های چک و محدودیت نوبت اشکان دست نخورده ماندند (به‌جز افزودن‌های لازم داخل `appointments.service.ts` برای `createdSource` و تسویهٔ پکیج، بدون بازگردانی/ادغام منطق اشکان).

## 1) فهرست فایل‌های ساخته‌شده / ویرایش‌شده

### ساخته‌شده
- `backend/prisma/migrations/20261029160000_phase2_appointments_packages_finance/migration.sql`
- `backend/src/appointments/appointment-created-source.ts`
- `backend/src/common/utils/loyalty-points.ts`
- `backend/src/common/utils/loyalty-points.spec.ts`
- `frontend/src/components/customers/MilestoneConfetti.tsx`
- `frontend/src/app/dashboard/employee/packages/page.tsx`
- `REPORT_phase2_changes.md` (همین فایل)

### ویرایش‌شده (بک‌اند)
- `backend/prisma/schema.prisma`
- `backend/src/appointments/appointments.service.ts`
- `backend/src/appointments/appointments.module.ts`
- `backend/src/appointments/dto/settle-appointment.dto.ts`
- `backend/src/appointments/dto/query-appointments.dto.ts`
- `backend/src/packages/packages.service.ts`
- `backend/src/packages/packages.controller.ts`
- `backend/src/packages/packages.module.ts`
- `backend/src/packages/dto/packages.dto.ts`
- `backend/src/packages/packages.service.spec.ts`
- `backend/src/admin/admin-analytics.service.ts`
- `backend/src/admin/admin-financial.service.ts`
- `backend/src/admin/admin-financial.controller.ts`
- `backend/src/customers/customers.service.ts`
- `backend/src/customers/customers.controller.ts`

### ویرایش‌شده (فرانت)
- `frontend/src/lib/appointment.ts`
- `frontend/src/lib/payment-method.ts`
- `frontend/src/components/appointments/AppointmentList.tsx`
- `frontend/src/components/appointments/PaymentModal.tsx`
- `frontend/src/components/RoleBasedSidebar.tsx`
- `frontend/src/app/dashboard/admin/packages/page.tsx`
- `frontend/src/app/dashboard/admin/financial/page.tsx`
- `frontend/src/app/dashboard/admin/customers/page.tsx`

## 2) اسکریپت میگریشن Prisma

مسیر:
`backend/prisma/migrations/20261029160000_phase2_appointments_packages_finance/migration.sql`

محتوای اصلی (additive):
1. enum `AppointmentCreatedSource` + ستون `appointments.createdSource` پیش‌فرض `UNKNOWN`
2. مقدار enum پرداخت `PACKAGE`
3. جدول واسط `service_package_template_services` + backfill از `serviceId` قدیمی
4. nullable شدن `service_package_templates.serviceId`
5. ستون‌های `serviceId` / `consumedByUserId` روی `customer_package_consumptions`
6. جایگزینی unique تک‌نوبتی با unique ترکیبی `(customerPackageId, appointmentId, serviceId)`

**اعمال روی پروداکشن:** هنوز انجام نشده. فقط با تأیید صریح و دامپ قبلی.

## 3) خروجی بیلد لوکال

| گام | نتیجه |
|---|---|
| `npx prisma generate` (backend) | موفق (exit 0) |
| `npm run build` (backend Nest) | موفق (exit 0) |
| `npm run build` (frontend Next 14.1.0) | موفق — `✓ Compiled successfully` |
| Frontend `BUILD_ID` پس از بیلد | `z6HmRDxZNfWTH9Q2r7KOv` |
| تست واحد متمرکز `loyalty-points.spec` + `packages.service.spec` | 7/7 پاس |

## 4) خلاصهٔ پیاده‌سازی به‌ازای تسک

### ۱) مبدأ ثبت نوبت
- فیلد `createdSource`: `CUSTOMER|STAFF|ADMIN|BARBER|UNKNOWN`
- نقش‌ها: CUSTOMER→CUSTOMER، ADMIN→ADMIN، EMPLOYEE→BARBER، SERVICE/MANAGER/ACCOUNTANT→STAFF
- رکورد قدیمی پیش‌فرض DB: `UNKNOWN`
- UI ادمین: badge «ثبت توسط مشتری» + حاشیه/رنگ amber روی کارت/ردیف

### ۲) هشدار بدهی
- در `presentMany` یک `groupBy` روی `customer_debts` با `settledAt IS NULL` (بدون N+1)
- فیلدهای پاسخ: `hasOpenDebt`, `openDebtAmountRial`, `openDebtCount`
- UI: badge قرمز برای نوبت‌های در انتظار تأیید / مشتری‌ساختهٔ معلق وقتی بدهی باز هست

### ۳) پکیج
- حذف UI تنظیمات وفاداری از صفحهٔ ادمین پکیج
- multi-select خدمات + جدول واسط
- `totalSessions=0` = نامحدود (UI برچسب «نامحدود»؛ consume بدون decrement)
- matcher خدمت: `appointment_services` + `serviceId` + JSON `services`
- تاریخچه ادمین: `GET /api/packages/history?customerId=`
- پنل آرایشگر: `/dashboard/employee/packages` فقط مشاهده
- تسویه: روش `PACKAGE` + `customerPackageId` داخل همان تراکنش settle و consume

### ۴) مشتریان برتر
- حذف `customers.id=1` و نقش‌های غیر `CUSTOMER`
- امتیاز از فرمول ثابت تومان نوبت‌های تسویه‌شده سال: `floor(toman/1e6)*5`
- مستقل از دفتر `loyalty_point_transactions` و فروش کالا

### ۵) نمودار فروش کالا
- `GET /api/admin/financial/product-sales-monthly?year=`
- منبع فقط `appointment_products`
- نمودار ComposedChart تعداد + مبلغ تومان ماهانه در صفحه مالی

### ۶) شمارنده milestone
- `GET /api/customers/milestone-stats`
- شمارش: نقش CUSTOMER و `id <> 1`
- هدف پویا 1000 سپس 1500…
- بنر نزدیک بودن (≤20 مانده)
- confetti CSS یک‌دقیقه‌ای با idempotency در `localStorage` (`doocard.milestone.confetti.{n}`)

## 5) نکات فنی برای تست فاز ۳

1. **مایگریشن را اول روی staging/local DB اعمال کنید** (`prisma migrate deploy`)؛ بدون آن، generate/runtime با schema جدید روی DB قدیمی می‌شکند.
2. **رکوردهای قدیمی نوبت** `createdSource=UNKNOWN` می‌مانند؛ فقط نوبت‌های جدید برچسب واقعی دارند. ۹ نوبت فعلی `PENDING_CONFIRMATION` در پرود هنوز UNKNOWN می‌مانند مگر backfill اختیاری.
3. **تسویه پکیج** مبلغ خدمت را `0` می‌نویسد و کمیسیون/کسورات آرایشگر را برای این مسیر صفر می‌کند؛ tip دستی جداگانه اگر نیاز باشد باید با روش غیرپکیج یا حساب بانکی تست شود.
4. **پکیج نامحدود** `remainingSessions` را روی 0 نگه می‌دارد؛ UI باید `unlimited/totalSessions===0` را چک کند نه فقط remaining.
5. **آرایشگر** به `GET /packages/history` دسترسی 403 دارد؛ فقط `assigned/eligible`.
6. **امتیاز مالی** دیگر از دفتر امتیاز نمی‌آید؛ اگر کسی هنوز UI تبدیل امتیاز مشتری را باز کند، آن مسیر قدیمی wallet redeem سر جایش است ولی از صفحه پکیج ادمین حذف شده.
7. **Confetti** فقط وقتی `latestReachedMilestone` از API برگردد و کلید localStorage خالی باشد اجرا می‌شود؛ برای تست دستی کلید را پاک کنید.
8. **diffهای اشکان/چک** را در باندل فاز ۲ include نکنید.
9. قبل از پروداکشن: دامپ DB، overlay سورس، migrate، build اوبونتو، `pm2 reload` جداگانه بک/فرانت، بدون `git pull` روی درخت کثیف.

## 6) وضعیت نسبت به پروداکشن

- Runtime زنده در فاز ۱: `2.0.29` با BUILD_ID `6P4_t4AY1ep91cV-q2HOt`
- بیلد لوکال این فاز: BUILD_ID `z6HmRDxZNfWTH9Q2r7KOv`
- مایگریشن فاز ۲ روی پرود اعمال نشده است.
- انتشار فقط پس از تأیید صریح مالک سیستم.
