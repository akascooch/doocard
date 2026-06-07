# معماری: حقوق کارمندان (حقوق کارمندان) – گزارش اکتشافی

**تاریخ:** 2026-02-24  
**فاز:** DISCOVERY ONLY – بدون کدنویسی، بدون deploy، بدون تغییر دیتابیس

---

## 1️⃣ Appointment Revenue Source (منبع درآمد نوبت)

### ستون‌های مرتبط
| ستون | جدول | نوع | توضیح |
|------|------|-----|--------|
| **amount** | appointments | BigInt? | **منبع اصلی درآمد** – مبلغ دریافتی نوبت در ریال |
| **tipAmount** | appointments | BigInt? | انعام روی همان نوبت (جدای از amount) |
| **appointmentServices** | appointment_services | price: Float | مبلغ هر سرویس در لحظه رزرو – برای محاسبات جزئی |
| **transactions** | transactions | amount: BigInt | تراکنش‌های مالی (SERVICE, TIP, INCOME و غیره) – برای Day Closing و حسابداری |

### منبع معتبر (Authoritative)
- **درآمد سرویس:** `appointments.amount` – این مقدار هنگام تسویه نوبت ست می‌شود و در گزارش‌های مالی استفاده می‌شود.
- `AdminFinancialService` و `SalaryService` هر دو از `appointments.amount` استفاده می‌کنند.
- `appointmentServices.price` برای جزئیات و محاسبات در لحظه رزرو است؛ برای درآمد نوبت، `appointment.amount` معتبر است.

### نوبت‌های لغو شده (CANCELLED)
- **خارج از درآمد:** status `CANCELLED` نباید در محاسبه درآمد لحاظ شود.
- در `AdminFinancialService` فقط COMPLETED، PAID، SETTLED استفاده می‌شوند؛ CANCELLED حذف می‌شود.

### وضعیت‌های درآمدزا
- فقط وضعیت‌های COMPLETED، PAID، SETTLED تولید درآمد می‌کنند.

### انعام (Tip)
- جدول `Tip`: `appointmentId`, `employeeId`, `amount` (Float) – سهم کارمند از انعام.
- ستون `appointments.tipAmount`: انعام روی نوبت (BigInt ریال).
- برای «حقوق کارمندان» فعلاً می‌توان فقط `amount` (سرویس) را لحاظ کرد؛ انعام جداگانه یا بعداً اضافه شود.

### واحد ذخیره‌سازی
- **ریال (Rial):** `appointments.amount` و `transactions.amount` در ریال (IRR) ذخیره می‌شوند.
- نمایش: تومان = ریال ÷ 10 (`money-utils.ts`, `toThousandTomans`).

---

## 2️⃣ Status Logic

### مقادیر enum AppointmentStatus
```
PENDING
CONFIRMED
COMPLETED
CANCELLED
PAID
SETTLED
PENDING_CONFIRMATION
```

### وضعیت‌های درآمدزا
| وضعیت | درآمدزا |
|-------|---------|
| COMPLETED | ✅ بله |
| PAID | ✅ بله |
| SETTLED | ✅ بله |
| PENDING | ❌ خیر |
| CONFIRMED | ❌ خیر |
| CANCELLED | ❌ خیر |
| PENDING_CONFIRMATION | ❌ خیر |

### منطق پیشنهادی برای حقوق کارمندان
```ts
status: { in: [COMPLETED, PAID, SETTLED] }
```

---

## 3️⃣ Timezone Handling

### نحوه ذخیره scheduledAt
- `scheduledAt` به صورت UTC در دیتابیس ذخیره می‌شود.

### فیلتر تاریخ
- **عدم تطابق فعلی:**  
  - `AdminFinancialService`: فیلتر روی `paidAt` (نه `scheduledAt`).  
  - `SalaryService`: فیلتر روی `scheduledAt`.
- برای «حقوق کارمندان»:
  - اگر هدف، تاریخ انجام خدمت است → استفاده از **scheduledAt** منطقی‌تر است.
  - اگر هدف، تاریخ دریافت وجه است → استفاده از **paidAt** منطقی است.

### توصیه
- برای محاسبه حقوق بر اساس «تاریخ ارائه خدمت»، از **scheduledAt** استفاده شود.
- تبدیل تاریخ‌های ورودی (جلالی) با `getJalaliMonthRanges` یا `toGregorian` انجام شود و بازه در UTC ساخته شود.

### calendarDateId
- `calendar_dates` برای هر روز تقویمی یک رکورد دارد.
- `calendarDateId` برای group‌کردن بر اساس روز/هفته مناسب است و از مشکل timezone کم‌تر رنج می‌برد.
- برای بازه‌های دلخواه (مثلاً 10 روز)، استفاده از **scheduledAt** با UTC range ساده‌تر است.

---

## 4️⃣ Financial Edge Cases

| مورد | رفتار پیشنهادی |
|------|----------------|
| `amount = null` | این نوبت‌ها را در محاسبه درآمد لحاظ نکن (`amount: { not: null }`) |
| نوبت‌های جزئی پرداخت‌شده | فقط status درآمدزا مهم است؛ اگر COMPLETED/PAID/SETTLED بود، amount را در نظر بگیر |
| بازپرداخت | در مدل فعلی refund جدا مدل نشده؛ اگر CANCELLED شد، از محاسبه حذف شود |
| `deletedAt != null` | حتماً `deletedAt: null` در where باشد |
| انعام در جدول Tip | جدول Tip برای انعام است؛ در نسخه اول حقوق می‌توان آن را نادیده گرفت و بعداً اضافه کرد |

---

## 5️⃣ Prisma Query Design

### استراتژی پیشنهادی

**برای بازه ≤ 10 روز (گزارش روزانه):**
```
1. appointment.aggregate با where (employeeId, status, deletedAt, scheduledAt range, amount not null)
2. appointment.groupBy با by: [calendarDateId] یا date trunc برای daily
```
- یک aggregate برای مجموع کل.
- یک groupBy برای breakdown روزانه.

**برای بازه > 10 روز (گزارش هفتگی):**
```
1. appointment.aggregate برای مجموع کل
2. groupBy با calendarDate.isoWeek یا date_trunc('week', scheduledAt)
```
- برای هفته، استفاده از `calendarDateId` و join با `calendar_dates` و group روی `jalaliYear` و `isoWeek` یا معادل آن مناسب است.

**پیشنهاد عملی:**
- یک query اصلی: `findMany` با select محدود (id, amount, scheduledAt, calendarDateId).
- aggregate در حافظه برای breakdown روزانه/هفتگی، چون تعداد ردیف‌ها معمولاً کم است.

**عملکرد (10k+ appointments):**
- با index روی `employeeId`, `scheduledAt`, `status`, `deletedAt` پرس‌وجو قابل قبول است.
- برای بازه‌های طولانی و employees با خیلی نوبت، می‌توان:
  - محدودیت بازه در UI گذاشت، یا
  - از `groupBy` مستقیم استفاده کرد و از raw SQL یا Prisma groupBy برای date bucketing استفاده کرد.

**ساختار پیشنهادی Prisma:**
```prisma
// Single aggregate for totals
prisma.appointment.aggregate({
  _sum: { amount: true },
  _count: { id: true },
  where: {
    employeeId,
    status: { in: [COMPLETED, PAID, SETTLED] },
    deletedAt: null,
    amount: { not: null },
    scheduledAt: { gte: start, lte: end },
  },
})

// For breakdown: findMany + in-memory group by day/week
// Or: raw SQL with date_trunc if performance critical
```

---

## 6️⃣ UI Placement Analysis

### تعریف آیتم‌های سایدبار ادمین
| فایل | مسیر |
|------|------|
| AdminSidebar | `frontend/src/components/AdminSidebar.tsx` |
| RoleBasedSidebar | `frontend/src/components/RoleBasedSidebar.tsx` |

### آیتم‌های فعلی مرتبط
- گزارشات مالی: `/dashboard/admin/financial` (RoleBasedSidebar)
- گزارشات: `/dashboard/admin/reports` (AdminSidebar – احتمالاً مسیر جدا)
- حسابداری: `/dashboard/admin/accounting`

### مسیر پیشنهادی برای «حقوق کارمندان»
- `/dashboard/admin/employee-salary` یا `/dashboard/admin/salary-report`

### ساختار روت‌های ادمین
```
frontend/src/app/dashboard/admin/
├── page.tsx
├── financial/page.tsx
├── accounting/page.tsx
├── day-closing/page.tsx
├── employees/page.tsx
└── ...
```

### صفحه مالی فعلی
- `frontend/src/app/dashboard/admin/financial/page.tsx`
- از `Select` برای سال جلالی، `BarChart`، `Table` استفاده می‌کند.
- API: `/admin/financial/yearly-report?year=1404` و `/dashboard/financial-stats`

### کامپوننت‌های قابل استفاده برای بازه تاریخ
| کامپوننت | مسیر | کاربرد |
|----------|------|--------|
| DateRangeFilter | `frontend/src/components/accounting/date-range-filter.tsx` | بازه سفارشی، ۶ ماه، سال جاری و ... |
| PersianDatePicker | `frontend/src/components/ui/PersianDatePicker.tsx` | انتخاب تک تاریخ |
| PersianDatePicker (alt) | `frontend/src/components/ui/persian-date-picker.tsx` | نسخه دیگر date picker |

---

## 7️⃣ Future Salary System Compatibility

### سناریوهای بعدی
- ثبت پرداخت حقوق
- ایجاد تراکنش مالی (SALARY)
- ثبت settlement
- قفل کردن دوره برای جلوگیری از پرداخت تکراری

### طراحی سازگار با آینده
1. **Read-only در فاز اول:** API و UI فقط محاسبه و نمایش انجام دهند؛ هیچ Salary یا Transaction ثبت نشود.
2. **جداسازی لایه محاسبه:** تابع `calculateEmployeeShare(start, end, employeeId, percentage)` جدا از منطق پرداخت باشد تا بعداً دوباره استفاده شود.
3. **Period-based keys:** استفاده از بازه `periodStart` و `periodEnd` به‌صورت ثابت برای لینک‌کردن به Salary record در آینده.
4. **بدون تغییر مدل Salary:** مدل `Salary` با `periodStart`, `periodEnd`, `amount`, `status` وجود دارد؛ در فاز بعدی فقط از همین فیلدها استفاده شود.
5. **Locking:** بعداً می‌توان `Salary` با status PAID برای یک دوره ایجاد کرد و در UI همان دوره را غیرقابل پرداخت مجدد کرد.
6. **تناقض date field:** الان `AdminFinancialService` از `paidAt` و `SalaryService` از `scheduledAt` استفاده می‌کند. باید یک معیار واحد تعریف شود (مثلاً `scheduledAt` برای حقوق) و در مستندات مشخص شود.

---

## 📋 خلاصه توصیه‌ها

| موضوع | توصیه |
|-------|-------|
| منبع درآمد | `appointments.amount` (ریال) |
| وضعیت‌ها | COMPLETED, PAID, SETTLED |
| فیلتر تاریخ | `scheduledAt` برای حقوق، با UTC range |
| حذف شده‌ها | `deletedAt: null` |
| amount null | نادیده گرفتن (`amount: { not: null }`) |
| Tip | در نسخه اول خارج از scope |
| Query | aggregate برای مجموع؛ findMany + group در حافظه یا groupBy برای breakdown |
| مسیر UI | `/dashboard/admin/employee-salary` |
| کامپوننت بازه | `DateRangeFilter` یا `PersianDatePicker` برای from/to |
| آینده | لایه محاسبه جدا؛ استفاده از periodStart/periodEnd؛ بدون ثبت Salary در فاز اول |

---

*این سند صرفاً برای برنامه‌ریزی معماری است و نباید به‌عنوان پیاده‌سازی تفسیر شود.*
