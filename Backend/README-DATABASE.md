# راهنمای مدیریت دیتابیس

## پاک کردن داده‌ها

برای پاک کردن تمام داده‌های دیتابیس (بدون پاک کردن ساختار جداول):

```bash
npm run prisma:clear
```

## ریست کامل دیتابیس

برای پاک کردن داده‌ها و راهنمایی برای ریست migration ها:

```bash
npm run prisma:reset
```

## ریست کامل سیستم

برای ریست کامل سیستم با ایجاد کاربر ادمین و تنظیمات اولیه:

```bash
npm run prisma:full-reset
```

## ریست کامل migration ها

برای ریست کامل migration ها و ساختار دیتابیس:

```bash
npm run prisma:migrate
```

## تولید Prisma Client

بعد از تغییرات schema:

```bash
npm run prisma:generate
```

## اضافه کردن داده‌های نمونه

برای اضافه کردن داده‌های نمونه (اختیاری):

```bash
npm run prisma:seed
```

## مراحل کامل ریست

1. **پاک کردن داده‌ها:**
   ```bash
   npm run prisma:clear
   ```

2. **ریست migration ها (اختیاری):**
   ```bash
   npm run prisma:migrate
   ```

3. **تولید Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

4. **ایجاد کاربر ادمین:**
   ```bash
   npm run prisma:create-admin
   ```

5. **اجرای سرور:**
   ```bash
   npm run start:dev
   ```

## نکات مهم

- قبل از ریست کردن، از داده‌های مهم backup بگیرید
- بعد از ریست، باید یک کاربر ادمین جدید بسازید
- تمام تنظیمات SMS و حسابداری پاک می‌شوند 