# 🚀 راهنمای تست PWA Doocard

## ✅ وضعیت فعلی PWA

### فایل‌های ایجاد شده:
- ✅ `manifest.json` - تنظیمات کامل PWA
- ✅ `sw.js` - Service Worker برای offline support  
- ✅ `PWAInstallPrompt.tsx` - کامپوننت نصب اپلیکیشن
- ✅ `offline/page.tsx` - صفحه آفلاین
- ✅ `browserconfig.xml` - تنظیمات Windows
- ✅ `robots.txt` - SEO optimization
- ✅ `sitemap.xml` - نقشه سایت

### تنظیمات PWA:
- ✅ **نام**: Doocard - سیستم مدیریت سالن زیبایی
- ✅ **رنگ پس‌زمینه**: سفید (#ffffff)
- ✅ **رنگ تم**: سفید (#ffffff)  
- ✅ **حالت نمایش**: standalone
- ✅ **لوگوها**: 192x192 و 512x512 پیکسل
- ✅ **Service Worker**: فعال و بهینه شده

## 🧪 مراحل تست PWA

### 1. تست در مرورگر Desktop (Chrome/Edge):

#### الف) بررسی Manifest:
1. باز کردن `http://localhost:3000`
2. فشار دادن `F12` (Developer Tools)
3. رفتن به تب `Application` > `Manifest`
4. بررسی موارد زیر:
   - ✅ نام اپلیکیشن: "Doocard"
   - ✅ رنگ پس‌زمینه: #ffffff
   - ✅ رنگ تم: #ffffff
   - ✅ لوگوها: 192x192 و 512x512
   - ✅ حالت نمایش: standalone

#### ب) بررسی Service Worker:
1. در تب `Application` > `Service Workers`
2. بررسی موارد زیر:
   - ✅ Service Worker ثبت شده
   - ✅ وضعیت: activated and running
   - ✅ Scope: /

#### ج) تست نصب:
1. دکمه "نصب" در نوار آدرس ظاهر می‌شود
2. کلیک روی دکمه نصب
3. تایید نصب
4. بررسی اپلیکیشن در Start Menu/Desktop

### 2. تست در موبایل (Android):

#### الف) Chrome Mobile:
1. باز کردن `http://localhost:3000` در Chrome موبایل
2. منوی سه نقطه > "Add to Home screen"
3. تایید نصب
4. بررسی آیکون در صفحه اصلی

#### ب) Samsung Internet:
1. باز کردن سایت
2. منوی سه خط > "Add page to" > "Home screen"
3. تایید نصب

### 3. تست در iOS (Safari):

#### الف) Safari Mobile:
1. باز کردن `http://localhost:3000` در Safari
2. دکمه اشتراک‌گذاری (مربع با فلش بالا)
3. انتخاب "Add to Home Screen"
4. تایید نصب
5. بررسی آیکون در صفحه اصلی

### 4. تست حالت آفلاین:

#### الف) Chrome Desktop:
1. Developer Tools > Network tab
2. انتخاب "Offline" از dropdown
3. رفرش صفحه
4. بررسی نمایش صفحه آفلاین

#### ب) Chrome Mobile:
1. Settings > Site Settings > Doocard
2. خاموش کردن "Use data"
3. رفرش صفحه
4. بررسی عملکرد آفلاین

## 🔍 بررسی‌های فنی

### 1. Lighthouse PWA Audit:
```bash
# در Chrome DevTools:
1. F12 > Lighthouse tab
2. انتخاب "Progressive Web App"
3. کلیک "Generate report"
4. بررسی امتیاز PWA (باید 100 باشد)
```

### 2. بررسی Console:
```bash
# بررسی Service Worker:
console.log('Service Worker registered:', navigator.serviceWorker.controller)

# بررسی Manifest:
console.log('Manifest:', document.querySelector('link[rel="manifest"]').href)
```

### 3. بررسی Network:
- ✅ manifest.json با status 200
- ✅ sw.js با status 200
- ✅ لوگوها با status 200
- ✅ Cache headers مناسب

## 🎯 انتظارات PWA

### عملکرد:
- ✅ بارگذاری سریع (< 3 ثانیه)
- ✅ عملکرد آفلاین
- ✅ نصب آسان
- ✅ تجربه native-like

### ویژگی‌ها:
- ✅ آیکون مخصوص در صفحه اصلی
- ✅ اجرا در حالت standalone
- ✅ پشتیبانی از push notifications
- ✅ Cache هوشمند

## 🚨 مشکلات احتمالی و راه‌حل

### 1. Service Worker ثبت نمی‌شود:
```bash
# بررسی:
- HTTPS فعال باشد
- مسیر /sw.js درست باشد
- Console errors بررسی شود
```

### 2. لوگو نمایش داده نمی‌شود:
```bash
# بررسی:
- فایل‌های PNG موجود باشند
- سایزها 192x192 و 512x512 باشند
- مسیرها در manifest درست باشند
```

### 3. نصب کار نمی‌کند:
```bash
# بررسی:
- manifest.json معتبر باشد
- Service Worker فعال باشد
- HTTPS در production فعال باشد
```

## 📱 تست نهایی

### چک‌لیست کامل:
- [ ] Manifest درست بارگذاری می‌شود
- [ ] Service Worker ثبت و فعال است
- [ ] لوگوها نمایش داده می‌شوند
- [ ] نصب روی Android کار می‌کند
- [ ] نصب روی iOS کار می‌کند
- [ ] نصب روی Desktop کار می‌کند
- [ ] حالت آفلاین کار می‌کند
- [ ] اپلیکیشن standalone اجرا می‌شود
- [ ] آیکون در صفحه اصلی ظاهر می‌شود
- [ ] عملکرد سریع و روان است

## 🎉 نتیجه

اگر تمام موارد بالا تایید شوند، PWA شما کاملاً آماده و بهینه است و می‌تواند به عنوان یک اپلیکیشن موبایل کامل استفاده شود!

---

**نکته**: برای production، حتماً HTTPS فعال کنید و در سرور واقعی تست کنید.
