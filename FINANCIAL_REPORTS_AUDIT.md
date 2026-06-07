# گزارش بررسی بخش «گزارشات مالی» (Financial Reports) — Doocard

**تاریخ بررسی:** 2025-02-09  
**نوع:** بررسی فقط خواندنی (بدون پیاده‌سازی، بدون حدس، فقط بر اساس کد و اسکیما)

---

## 1️⃣ مسیر فعلی و منبع خطا

### تعریف آیتم سایدبار
- **فایل:** `frontend\src\components\RoleBasedSidebar.tsx`
- **خطوط:** 86–91
- **متن:** «گزارشات مالی»
- **مسیر (href):** `/dashboard/admin/financial`
- **آیکون:** `DollarSign`
- **توضیح:** «گزارشات مالی و حسابداری»

(در `frontend\src\components\Sidebar.tsx` خط 77 هم عبارت «گزارشات مالی» برای آیتم دیگری با مسیر `/dashboard/accounting` به‌کار رفته؛ آیتم مورد نظر ادمین همان بالا است.)

### صفحه/کامپوننت رندر شده
- **فایل:** `frontend\src\app\dashboard\admin\financial\page.tsx`
- **کامپوننت:** `AdminFinancialPage` (client component)

### درخواست داده
- صفحه با `fetch('/api/dashboard/financial-stats', { headers: { Authorization: \`Bearer ${token}\` } })` داده می‌گیرد.
- **پروکسی API:** `frontend\src\app\api\dashboard\financial-stats\route.ts` درخواست را به `${NEXT_PUBLIC_API_URL}/api/dashboard/financial-stats` فوروارد می‌کند.

### خطای احتمالی در زمان اجرا

1. **سریالایز نشدن BigInt در پاسخ بک‌اند (دلیل محتمل 500)**  
   در `backend\src\dashboard\dashboard.service.ts` متد `getFinancialStats()` در نگاشت `recentTransactions` مقدار `amount: transaction.amount` برمی‌گرداند. در Prisma مدل `Transaction` فیلد `amount` از نوع **BigInt** است. در JavaScript/Node، `JSON.stringify()` روی مقدار BigInt خطا می‌دهد:  
   **`TypeError: Do not know how to serialize a BigInt`**  
   بنابراین در ارسال پاسخ از Nest، احتمال دارد همین خطا رخ دهد و درخواست با وضعیت 500 یا بدون بدنهٔ معتبر به فرانت برگردد.

2. **پیام/نمایش در فرانت**  
   در `financial\page.tsx` اگر `response.ok` نباشد یا در `catch` بیفتد:
   - توست با عنوان «خطا» و توضیح «خطا در بارگذاری اطلاعات مالی» نمایش داده می‌شود.
   - `financialData` تنظیم نمی‌شود و کاربر متن **«اطلاعات مالی در دسترس نیست»** را می‌بیند (خطوط 146–150).

3. **عدم تطابق نوع تراکنش در UI**  
   فرانت در `financial\page.tsx` برای نوع تراکنش از `'REVENUE'` و `'EXPENSE'` استفاده می‌کند (مثلاً خطوط 399–402، 412، 413). بک‌اند در همان پاسخ مقدار `type` را به صورت **`INCOME`** یا **`EXPENSE`** برمی‌گرداند (enum در Prisma: `TransactionType` شامل INCOME, EXPENSE, TRANSFER و …). در نتیجه اگر پاسخ اصلاً برسد، تراکنش‌های درآمد به‌عنوان «هزینه» نمایش داده می‌شوند (چون `type === 'REVENUE'` هرگز برای مقدار `INCOME` برقرار نیست).

خلاصه: منبع خطا در اجرا، ترکیبی از **خطای سریالایز BigInt در بک‌اند** و در صورت رفع آن، **اشتباه نمایش نوع تراکنش (INCOME vs REVENUE)** در فرانت است. مسیر و فایل‌های مربوط در بالا ذکر شد.

---

## 2️⃣ داده‌های مالی موجود در بک‌اند

### A) هزینه‌ها (Expenses)

- **جدول اصلی:** `Transaction` (map: `transactions`) در `backend\prisma\schema.prisma` (حدود خطوط 221–253).
- **فیلدهای مرتبط:**
  - `type`: enum `TransactionType` — برای هزینه از مقدار `EXPENSE` استفاده می‌شود.
  - `amount`: **BigInt** (ریال).
  - `currency`: رشته، پیش‌فرض `"IRR"`.
  - `description`: رشته اختیاری.
  - `categoryId`: عدد اختیاری، ارجاع به `TransactionCategory`.
  - `occurredAt`: DateTime (زمان وقوع تراکنش).
  - `createdAt` / `updatedAt` / `deletedAt` (soft-delete).
- **دسته‌بندی:** نرمال و در جدول جداگانه است:
  - مدل **`TransactionCategory`** (خطوط 255–269): فیلدهای `name`, `type` (TransactionType: INCOME | EXPENSE), `parentId` برای سلسله‌مراتب، و رابطه با `Transaction`.
- **رابطه‌ها:** هر تراکنش می‌تواند به `TransactionCategory`، `BankAccount` (حساب مبدأ/مقصد) و در حالت legacy به `Appointment` (از طریق `relatedId`) وصل باشد.

مدل جداگانه‌ای با نام «expenses» یا «costs» یا «payments» به‌عنوان جدول مستقل در اسکیما وجود ندارد؛ هزینه‌ها از طریق `Transaction` با `type: EXPENSE` مدل شده‌اند.

### B) درآمد (Revenue / Customer Payments)

- **ذخیره درآمد:**
  1. **جدول `Appointment`** (خطوط 150–191):
     - `amount`: BigInt? (ریال، مبلغ کل).
     - `tipAmount`: BigInt?.
     - `paymentMethod`, `accountId`, `paidAt`, `paidBy` برای وضعیت پرداخت و تسویه.
  2. **جدول `Transaction`**:
     - تراکنش‌های نوع **INCOME** (و در کد قدیمی گاه **SERVICE**) برای درآمدهای دیگر یا لینک به نوبت (مثلاً `sourceType` / `sourceId` یا `relatedId` به `Appointment`).

- **منطق در `getFinancialStats` (dashboard.service.ts):**
  - **درآمد نوبت‌ها:** تجمع `Appointment._sum.amount` با شرط `deletedAt: null` و `amount: { not: null }` (بدون فیلتر روی `paidAt` یا وضعیت SETTLED).
  - **درآمدهای دیگر:** تجمع `Transaction` با `type: 'INCOME'` روی همان بازه‌های زمانی (کل، ماه جاری، امروز) با فیلتر روی **`createdAt`** (نه `occurredAt`).

- **جمع‌بندی:** در کد فعلی، «درآمد» از نوبت‌ها بر اساس **وجود مبلغ و تاریخ ایجاد نوبت** محاسبه می‌شود؛ معیار «فقط نوبت‌های تسویه‌شده (SETTLED)» یا `paidAt` در این متد اعمال نشده است.

---

## 3️⃣ داده‌های عملکرد کارمند (Employee Performance)

- **مالکیت نوبت:** در مدل `Appointment` فیلد **`employeeId`** (اختیاری) و رابطه با `Employee` وجود دارد؛ «صاحب» نوبت همان کارمند است (نه جدول جدا با نام barber؛ در کد از همین رابطه با نام barber در برخی جاها استفاده شده).
- **شمارش نوبت به‌ازای کارمند:** در `dashboard.service.ts` متد **`getSummary`** (برای ادمین):
  - از `prisma.appointment.groupBy({ by: ['employeeId'], _count: { id: true } })` استفاده می‌شود.
  - هیچ فیلتر زمانی (ماه/سال) یا فیلتر وضعیت (مثلاً فقط COMPLETED یا SETTLED) روی این groupBy اعمال نشده؛ یعنی شمارش روی **همهٔ نوبت‌ها** است.
- **وضعیت‌های نوبت (AppointmentStatus در schema):**  
  `PENDING`, `PENDING_CONFIRMATION`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `PAID`, `SETTLED`.
- **نتیجه:** برای «تعداد نوبت به‌ازای کارمند در یک ماه یا یک سال» و «فیلتر بر اساس وضعیت (مثلاً فقط COMPLETED/SETTLED)» در endpoint فعلی dashboard (مثل `getFinancialStats` یا `getSummary`) منطق از قبل پیاده‌سازی نشده؛ فقط شمارش کلی بدون فیلتر ماه/سال و وضعیت وجود دارد.

---

## 4️⃣ تاریخ و تقویم در سیستم

- **نوع ذخیره تاریخ در دیتابیس:** همهٔ فیلدهای تاریخ در Prisma از نوع **DateTime** هستند؛ در PostgreSQL به‌صورت timestamp ذخیره می‌شوند و در کد به‌صورت **Gregorian** با آنها کار می‌شود.
- **Timezone:** در اسکیما یا در کد dashboard/accounting مورد بررسی، timezone صریحی (مثل Asia/Tehran یا UTC) تنظیم نشده؛ ساخت `new Date()` و بازه‌های `startOfMonth` / `startOfDay` و … در `dashboard.service.ts` با زمان لوکال سرور انجام می‌شود.
- **فیلدهای تاریخ مهم:**
  - **Transaction:** `occurredAt` (زمان وقوع)، `createdAt`.
  - **Appointment:** `scheduledAt` (با کامنت UTC در اسکیما)، `createdAt`, `paidAt`.
- **استفاده در گزارش مالی:** در `getFinancialStats` برای تراکنش‌ها از **`createdAt`** برای فیلتر ماه/روز استفاده شده؛ در `accounting.service.ts` برای گزارش‌ها (مثلاً `getSummary`) از **`occurredAt`** استفاده شده.
- **Jalali در بک‌اند:** در فایل‌های بررسی‌شده (dashboard، accounting، schema) هیچ کتابخانه یا تابعی برای تبدیل Jalali (مثل dayjs با پلاگین جلالی یا moment-jalaali) در بک‌اند استفاده نشده است.
- **فرانت‌اند:** در `package.json` فرانت، **dayjs** وجود دارد؛ در صفحهٔ financial فقط `toLocaleDateString('fa-IR')` برای نمایش تاریخ استفاده شده و در این بخش تبدیل ماه‌های شمسی (مثلاً فروردین تا اسفند) یا aggregation بر اساس سال/ماه شمسی در بک‌اند وجود ندارد.

---

## 5️⃣ APIهای مالی موجود

### Dashboard (گزارشات مالی فعلی)
- **مسیر:** `GET /api/dashboard/financial-stats`
- **کنترلر:** `backend\src\dashboard\dashboard.controller.ts`، متد `getFinancialStats`، فقط نقش ADMIN.
- **خروجی (از dashboard.service.getFinancialStats):**  
  `totalRevenue`, `monthlyRevenue`, `dailyRevenue`, `totalExpenses`, `monthlyExpenses`, `dailyExpenses`, `netProfit`, `monthlyNetProfit`, `dailyNetProfit`, `totalCustomers`, `totalAppointments`, `averageAppointmentValue`, `topServices` (آرایه با name, revenue, bookings), `recentTransactions` (آرایه با id, type, amount, description, date, category, account).  
  **توجه:** این endpoint آرایهٔ `monthlyTrend` برنمی‌گرداند؛ در فرانت این آرایه با دادهٔ ثابت (ماه‌های فروردین تا شهریور و اعداد نمونه) پر می‌شود (خطوط 96–104 در financial/page.tsx).

### Accounting
- **مسیرها و متدها (همه تحت پیشوند `GET/POST .../api/accounting`):**
  - **`GET accounting/reports/summary`** — با query اختیاری `from`, `to`. خروجی: `totalIncome`, `totalExpense`, `netProfit`, `incomeCount`, `expenseCount`, `period`. از `occurredAt` برای فیلتر استفاده می‌کند.
  - **`GET accounting/reports/by-category`** — با query اختیاری `type`, `from`, `to`. خروجی: خلاصه به‌ازای هر دسته (categoryName, total, count و …).
  - **`GET accounting/reports/daily/:date`** — گزارش روزانه برای یک تاریخ.
  - **`GET accounting/reports/balance-by-account`** — مانده به‌ازای حساب.

هیچ endpoint با نام `monthly-chart` یا مشابه آن در کنترلر accounting یافت نشد؛ در فرانت، کامپوننت `overview.tsx` در مسیر `accounting` درخواست به `GET /accounting/monthly-chart?months=12` می‌زند که در بک‌اند تعریف نشده است.

**قابلیت استفاده برای چارت:**  
- `reports/summary` و `reports/by-category` با پارامتر `from`/`to` می‌توانند برای بازهٔ زمانی مشخص داده بدهند، اما خروجی به‌صورت «ماه‌به‌ماه» یا «سال» برای نمودار سالانه از قبل تعریف نشده است.
- `getFinancialStats` فقط خلاصهٔ کلی و ماه جاری و امروز را برمی‌گرداند؛ برای سه نمودار سالانه (مثلاً درآمد، هزینه، سود به‌ازای ماه) یا aggregation ماه‌های شمسی نیاز به منطق/endpoint جدید است.

---

## 6️⃣ زیرساخت چارت در فرانت

- **کتابخانه:** در `frontend\package.json` کتابخانه **recharts** (نسخه ^2.15.3) وجود دارد.
- **استفاده در پروژه:**
  - **`frontend\src\components\accounting\overview.tsx`:** استفاده از `Bar`, `BarChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`, `Legend` از recharts؛ داده از `api.get('/accounting/monthly-chart?months=12')` و `api.get('/dashboard/summary')` گرفته می‌شود.
  - **`frontend\src\components\accounting\overview-chart.tsx`** و **`frontend\src\components\accounting\monthly-chart.tsx`:** همین‌طور از recharts برای BarChart استفاده شده.
  - **`frontend\src\components\accounting\chart-with-filters.tsx`:** از `MonthlyChart` استفاده می‌کند.
- **صفحهٔ گزارشات مالی (`financial/page.tsx`):** در این صفحه از recharts استفاده **نشده**؛ فقط آیکون‌های `BarChart3` و `PieChart` از lucide-react برای ظاهر به‌کار رفته و دادهٔ `monthlyTrend` به‌صورت لیست/کارت نمایش داده می‌شود، نه نمودار واقعی. دادهٔ `monthlyTrend` از API نمی‌آید و در کد با آرایهٔ ثابت (فروردین–شهریور و اعداد نمونه) مقداردهی می‌شود.

---

## 7️⃣ خلاءها (فقط واقعیت؛ بدون پیشنهاد راه‌حل)

- **قبلاً وجود دارد:**
  - تجمع درآمد و هزینه در سطح کلی و «این ماه» و «امروز» در `getFinancialStats`.
  - تجمع درآمد/هزینه برای بازهٔ دلخواه در `accounting.reports/summary` با `from`/`to` و استفاده از `occurredAt`.
  - تجمع به‌ازای دسته در `accounting.reports/by-category`.
  - شمارش نوبت به‌ازای کارمند (بدون فیلتر ماه/سال یا وضعیت) در `dashboard.getSummary` (appointmentsByBarber).

- **وجود ندارد (نیاز به کار بک‌اند یا طراحی دارد):**
  - تجمع **ماه‌به‌ماه** برای یک سال (مثلاً ۱۲ ماه) برای درآمد/هزینه/سود، در endpoint گزارشات مالی یا accounting.
  - aggregation بر اساس **ماه‌های شمسی** (فarvardin → Esfand) در بک‌اند.
  - رتبه‌بندی/مرتب‌سازی کارمندان بر اساس عملکرد (تعداد نوبت یا درآمد) در **یک سال یا ماه مشخص** با فیلتر وضعیت نوبت (مثلاً فقط COMPLETED/SETTLED).
  - endpoint مخصوص **monthly-chart** که در فرانت accounting فراخوانی می‌شود (`/accounting/monthly-chart?months=12`).
  - فیلتر `deletedAt: null` روی `Transaction` در `getFinancialStats` برای `recentTransactions` (در کد فعلی اعمال نشده).
  - تبدیل صریح `transaction.amount` (BigInt) به عدد یا رشته قبل از برگرداندن در پاسخ `getFinancialStats`.

---

## 8️⃣ خلاصهٔ نهایی (بدون پیشنهاد راه‌حل یا طراحی)

- **چرا صفحه خطا می‌دهد:**  
  پاسخ endpoint گزارشات مالی احتمالاً به‌دلیل برگرداندن مستقیم `transaction.amount` (نوع BigInt) در `recentTransactions` هنگام سریالایز JSON در بک‌اند با خطا مواجه می‌شود؛ در نتیجه درخواست ناموفق می‌ماند و کاربر «اطلاعات مالی در دسترس نیست» و توست خطا را می‌بیند. علاوه بر این، در صورت رفع این موضوع، نمایش نوع تراکنش به‌خاطر تفاوت `INCOME` (بک‌اند) و `REVENUE` (فرانت) در UI اشتباه خواهد بود.

- **دادهٔ در دسترس:**  
  درآمد و هزینه در سطح کل، ماه جاری و روز جاری؛ لیست تراکنش‌های اخیر و سرویس‌های پربازدید؛ خلاصهٔ حسابداری با بازهٔ from/to و خلاصه به‌ازای دسته؛ شمارش نوبت به‌ازای کارمند (بدون فیلتر زمانی/وضعیت).

- **دادهٔ ناقص/غیرموجود:**  
  سری زمانی ماه‌به‌ماه برای یک سال؛ aggregation بر اساس ماه شمسی؛ رتبه‌بندی کارمندان بر اساس عملکرد در بازهٔ سال/ماه با فیلتر وضعیت؛ endpoint مخصوص monthly-chart؛ و در همین مسیر، پاک‌سازی پاسخ از BigInt و یکدست‌سازی نوع تراکنش برای نمایش.

- **آیا بک‌اند می‌تواند سه نمودار سالانه، aggregation ماهانه (فarvardین تا اسفند) و مرتب‌سازی کارمندان را پشتیبانی کند؟**  
  از نظر **داده و اسکیما** بله: جداول `Transaction`، `Appointment` و `Employee` و فیلدهای تاریخ و مبلغ و `employeeId` برای چنین گزارش‌هایی کافی هستند. از نظر **کد فعلی** خیر: endpointها و منطق aggregation ماه‌به‌ماه، سال شمسی و رتبه‌بندی کارمند با فیلتر وضعیت پیاده‌سازی نشده‌اند و باید اضافه شوند.

---

*پایان گزارش بررسی.*
