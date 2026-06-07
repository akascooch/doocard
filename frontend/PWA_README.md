# Doocard PWA - راهنمای Progressive Web App

## 🚀 ویژگی‌های PWA فعال شده

### ✅ فایل‌های PWA ایجاد شده:
- `manifest.json` - تنظیمات اصلی PWA
- `sw.js` - Service Worker برای offline support
- `offline/page.tsx` - صفحه آفلاین
- `PWAInstallPrompt.tsx` - کامپوننت نصب اپلیکیشن
- `browserconfig.xml` - تنظیمات Windows/Microsoft Store
- `robots.txt` - SEO optimization
- `sitemap.xml` - نقشه سایت

### 🎯 تنظیمات PWA:
- **نام اپلیکیشن**: Doocard - سیستم مدیریت سالن زیبایی
- **نام کوتاه**: Doocard
- **رنگ پس‌زمینه**: سفید (#ffffff)
- **رنگ تم**: سفید (#ffffff)
- **حالت نمایش**: standalone
- **لوگوها**: 192x192 و 512x512 پیکسل
- **شروع**: صفحه اصلی (/)

### 📱 قابلیت‌های فعال:

#### 1. نصب روی دستگاه
- **Android**: دکمه "نصب اپلیکیشن" در مرورگر
- **iOS**: "افزودن به صفحه اصلی" از منوی اشتراک‌گذاری
- **Desktop**: دکمه نصب در نوار آدرس

#### 2. حالت آفلاین
- Service Worker برای cache کردن فایل‌های مهم
- صفحه آفلاین با راهنمای کامل
- همگام‌سازی خودکار پس از اتصال

#### 3. عملکرد بهتر
- Cache هوشمند برای فایل‌های استاتیک
- بارگذاری سریع‌تر صفحات
- به‌روزرسانی خودکار

## 🔧 نحوه تست PWA

### 1. تست نصب:
```bash
# Build پروژه
npm run build

# اجرای production
npm start
```

### 2. تست در مرورگر:
1. باز کردن `http://localhost:3000`
2. باز کردن Developer Tools (F12)
3. رفتن به تب Application > Manifest
4. بررسی تنظیمات PWA
5. تست Service Worker در تب Application > Service Workers

### 3. تست نصب روی موبایل:
1. باز کردن سایت در Chrome موبایل
2. کلیک روی "Add to Home Screen"
3. تایید نصب
4. تست اجرا از صفحه اصلی

### 4. تست حالت آفلاین:
1. باز کردن Developer Tools
2. رفتن به تب Network
3. انتخاب "Offline"
4. رفرش صفحه
5. بررسی نمایش صفحه آفلاین

## 📋 چک‌لیست PWA

### ✅ الزامات PWA:
- [x] manifest.json موجود
- [x] Service Worker فعال
- [x] HTTPS (در production)
- [x] لوگوهای مناسب
- [x] نمایش standalone

### ✅ ویژگی‌های اضافی:
- [x] صفحه آفلاین
- [x] Install prompt
- [x] Cache strategy
- [x] SEO optimization
- [x] Cross-platform support

## 🚀 Deploy و Production

### 1. Build:
```bash
npm run build
```

### 2. Deploy:
- فایل‌های `out/` یا `dist/` رو به سرور آپلود کنید
- مطمئن شوید HTTPS فعال باشد
- تنظیمات سرور برای PWA headers

### 3. بررسی نهایی:
- تست نصب روی دستگاه‌های مختلف
- تست عملکرد آفلاین
- بررسی سرعت بارگذاری
- تست SEO

## 🔍 عیب‌یابی

### مشکلات رایج:

#### 1. Service Worker ثبت نمی‌شود:
- بررسی HTTPS
- بررسی مسیر `/sw.js`
- بررسی console errors

#### 2. لوگو نمایش داده نمی‌شود:
- بررسی مسیر لوگوها
- بررسی سایز لوگوها (192x192, 512x512)
- بررسی فرمت PNG

#### 3. نصب کار نمی‌کند:
- بررسی manifest.json
- بررسی Service Worker
- بررسی HTTPS

## 📞 پشتیبانی

در صورت بروز مشکل:
1. بررسی console errors
2. تست در مرورگرهای مختلف
3. بررسی تنظیمات سرور
4. تماس با تیم توسعه

---

**نکته**: این PWA کاملاً آماده و بهینه شده است و می‌تواند به عنوان یک اپلیکیشن موبایل کامل استفاده شود.
