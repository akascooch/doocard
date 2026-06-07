# 📊 Excel Import Script - راهنمای استفاده

## 🎯 هدف
Import کردن داده‌های Appointments و Transactions از فایل‌های Excel به database

---

## 📁 فایل‌های مورد نیاز

Script انتظار دارد این دو فایل در **root پروژه** باشند:

```
DoocardAPK/v1.2.4/
├── Appointments.xlsx
├── Pays.xlsx
└── backend/
    └── src/
        └── scripts/
            └── import-excel-data.ts
```

---

## 📋 فرمت فایل Appointments.xlsx

**ستون‌ها (Sheet اول)**:

| ستون | نام | نوع | مثال |
|------|-----|-----|------|
| A | Customer Name | متن | مریم احمدی |
| B | Employee Name | متن | علی رضایی |
| C | Services | متن | اصلاح مو, رنگ |
| D | Date (Jalali) | تاریخ | 1404/07/23 |
| E | Time | ساعت | 14:30 |
| F | Status | متن | PENDING |
| G | Payment Method | متن | CASH |
| H | Amount (Toman) | عدد | 250,000 |
| I | Tip (Toman) | عدد | 20,000 |

**نمونه ردیف**:
```
مریم احمدی | علی رضایی | اصلاح مو | 1404/07/23 | 14:30 | PENDING | CASH | 250,000 | 20,000
```

---

## 💰 فرمت فایل Pays.xlsx

**ستون‌ها (Sheet اول)**:

| ستون | نام | نوع | مثال |
|------|-----|-----|------|
| A | Date (Jalali) | تاریخ | 1404/07/20 |
| B | Category | متن | درآمد نوبت |
| C | Description | متن | پرداخت مشتری |
| D | Amount (Toman) | عدد | 500,000 |
| E | Type | متن | INCOME |
| F | Account | متن | حساب اصلی |

**نمونه ردیف**:
```
1404/07/20 | درآمد نوبت | پرداخت مشتری | 500,000 | INCOME | حساب اصلی
```

---

## 🚀 نحوه اجرا

### گام 1: آماده‌سازی فایل‌ها
1. فایل‌های `Appointments.xlsx` و `Pays.xlsx` را در root پروژه (`v1.2.4/`) قرار دهید
2. مطمئن شوید ستون‌ها با فرمت بالا مطابقت دارند

### گام 2: اجرای Script
```bash
cd backend
npx ts-node src/scripts/import-excel-data.ts
```

### گام 3: مشاهده نتایج
Script به صورت خودکار:
- ✅ فایل‌ها را parse می‌کند
- ✅ تاریخ‌های شمسی را به میلادی تبدیل می‌کند
- ✅ تومان را به ریال تبدیل می‌کند
- ✅ کارمندان/مشتریان/دسته‌بندی‌ها را ایجاد می‌کند اگر وجود نداشته باشند
- ✅ نوبت‌ها و تراکنش‌ها را insert می‌کند
- ✅ یک report در `logs/import-report.txt` ذخیره می‌کند

---

## 🔧 منطق سیستم

### Auto-Creation

**کارمندان**:
- اگر employee با همین نام وجود داشت → استفاده می‌شود
- اگر نبود → ایجاد می‌شود با:
  - `phone`: تصادفی (09xxxxxxxxx)
  - `password`: 123654
  - `role`: EMPLOYEE

**مشتریان**:
- اگر customer با همین نام وجود داشت → استفاده می‌شود
- اگر نبود → ایجاد می‌شود با همان منطق

**دسته‌بندی‌ها**:
- اگر category وجود داشت → استفاده می‌شود
- اگر نبود → ایجاد می‌شود

**حساب‌های بانکی**:
- اگر account وجود داشت → استفاده می‌شود
- اگر نبود → ایجاد می‌شود

### تبدیل‌ها

**تاریخ شمسی → میلادی**:
```
1404/07/23 → 2025-10-15T00:00:00.000Z
1370/05/15 → 1991-08-06T00:00:00.000Z
```

**تومان → ریال**:
```
250,000 تومان → 2,500,000 ریال
500,000 → 5,000,000 ریال
```

---

## ⚠️ نکات مهم

### 1. Backup قبل از Import
```bash
# Backup database
pg_dump -U postgres MOVA > backup_before_import_$(date +%Y%m%d).sql
```

### 2. رمزهای پیش‌فرض
همه Users ایجاد شده (employees, customers) رمز `123654` دارند.

**بعد از import**:
- به کاربران بگویید رمز خود را تغییر دهند
- یا از طریق panel admin رمزها را reset کنید

### 3. شماره تلفن‌های تصادفی
Employees و Customers بدون شماره تلفن، شماره تصادفی می‌گیرند:
```
09123456789 (random)
```

برای تغییر شماره:
```sql
UPDATE users SET phone = '09xxxxxxxxx' WHERE id = X;
```

### 4. اگر خطا داشتید
- در console پیام‌های خطا نمایش داده می‌شوند
- ردیف‌های خطا skip می‌شوند (سایرین import می‌شوند)
- خطاها در report ذخیره می‌شوند

---

## 🧪 تست

### تست سریع (قبل از import اصلی)

1. یک Excel test ایجاد کنید با 2-3 ردیف
2. Script را run کنید
3. در database بررسی کنید:
```sql
SELECT * FROM appointments ORDER BY id DESC LIMIT 5;
SELECT * FROM transactions ORDER BY id DESC LIMIT 5;
```
4. در dashboard admin بررسی کنید

---

## 🔍 عیب‌یابی

### مشکل: "Cannot find module"
```bash
# نصب dependencies
cd backend
npm install
```

### مشکل: "File not found"
```bash
# مطمئن شوید فایل‌ها در مسیر صحیح هستند:
ls -la ../Appointments.xlsx
ls -la ../Pays.xlsx
```

### مشکل: "Database connection failed"
```bash
# بررسی PostgreSQL
psql -U postgres -d MOVA -c "SELECT 1;"
```

### مشکل: "Jalali date invalid"
فرمت صحیح: `YYYY/MM/DD`
```
✅ 1404/07/23
✅ 1370/05/15
❌ 04/07/23 (سال 4 رقمی)
❌ 1404-07-23 (از / استفاده کنید)
```

---

## 📊 خروجی نمونه

```
🚀 Starting Excel Import Process...

📂 Reading: .../Appointments.xlsx

📅 ===== IMPORTING APPOINTMENTS =====

➕ Creating new employee: علی رضایی
✅ Employee created: علی رضایی (id: 5, phone: 09123456789)
➕ Creating new customer: مریم احمدی
✅ Customer created: مریم احمدی (id: 12)
✅ Row 2: Appointment created for مریم احمدی
✅ Row 3: Appointment created for حسن موسوی
❌ Row 4: تاریخ نامعتبر: 04/07/23

📊 Appointments Summary:
   ✅ Created: 15
   ⚠️  Skipped: 2

📂 Reading: .../Pays.xlsx

💰 ===== IMPORTING TRANSACTIONS (PAYS) =====

✅ Category created: درآمد نوبت (INCOME)
✅ Account created: حساب اصلی
✅ Row 2: Transaction created (INCOME)
✅ Row 3: Transaction created (EXPENSE)

📊 Transactions Summary:
   ✅ Created: 23
   ⚠️  Skipped: 0

════════════════════════════════════════════════════
📊 IMPORT REPORT
════════════════════════════════════════════════════

📅 APPOINTMENTS
   ✅ Created: 15
   ⚠️  Skipped: 2

💰 TRANSACTIONS (PAYS)
   ✅ Created: 23
   ⚠️  Skipped: 0

════════════════════════════════════════════════════
🎉 Import completed at: ۱۴۰۴/۷/۲۳ ۱۵:۳۰
════════════════════════════════════════════════════

📄 Report saved: logs/import-report.txt

✅ Import process completed successfully!
```

---

## ✨ ویژگی‌ها

- ✅ **Fault-tolerant**: خطا در یک ردیف باعث fail کل process نمی‌شود
- ✅ **Auto-creation**: Employees, Customers, Categories, Accounts
- ✅ **Jalali support**: تبدیل خودکار به Gregorian
- ✅ **Toman support**: تبدیل خودکار به Rial
- ✅ **Detailed logging**: همه عملیات log می‌شوند
- ✅ **Report generation**: خروجی در فایل txt
- ✅ **Persian messages**: همه پیام‌ها فارسی

---

## 🎊 آماده برای استفاده!

```bash
cd backend
npx ts-node src/scripts/import-excel-data.ts
```

**بعد از import موفق، در Admin Dashboard بررسی کنید که data ها وارد شده‌اند!** ✅

