# سیستم مدیریت آرایشگاه

این پروژه یک سیستم مدیریت آرایشگاه است که با استفاده از Next.js و TypeScript ساخته شده است.

## ویژگی‌ها

- مدیریت نوبت‌ها
- مدیریت مشتریان
- مدیریت خدمات
- داشبورد مدیریتی
- سیستم احراز هویت
- تم روشن و تاریک
- رابط کاربری مدرن و واکنش‌گرا

## تکنولوژی‌ها

- Next.js 14
- TypeScript
- Tailwind CSS
- Shadcn UI
- Framer Motion
- Lucide Icons

## نصب و راه‌اندازی

1. نصب وابستگی‌ها:
```bash
npm install
```

2. اجرای پروژه در محیط توسعه:
```bash
npm run dev
```

3. ساخت نسخه نهایی:
```bash
npm run build
```

4. اجرای نسخه نهایی:
```bash
npm start
```

## ساختار پروژه

```
src/
  ├── app/                    # صفحات برنامه
  │   ├── dashboard/         # صفحات داشبورد
  │   │   ├── appointments/  # مدیریت نوبت‌ها
  │   │   ├── customers/     # مدیریت مشتریان
  │   │   ├── services/      # مدیریت خدمات
  │   │   └── settings/      # تنظیمات
  │   ├── login/            # صفحه ورود
  │   └── register/         # صفحه ثبت‌نام
  ├── components/            # کامپوننت‌های قابل استفاده مجدد
  │   └── ui/               # کامپوننت‌های رابط کاربری
  └── lib/                  # توابع و ابزارهای کمکی
```

## مجوز

این پروژه تحت مجوز MIT منتشر شده است. 