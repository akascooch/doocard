# تم تاریک مدرن Doocard - راهنمای پیاده‌سازی

## مشکل قبلی
تصاویر نشان می‌داد که هنوز تم روشن با رنگ‌های قهوه‌ای روشن و صورتی نمایش داده می‌شد، نه تم تاریک مدرن با رنگ‌های `#1C2529` و `#A1D1B1` که درخواست شده بود.

## راه‌حل پیاده‌سازی شده

### 1. فایل‌های CSS اصلی
- **`globals.css`**: بازنویسی کامل با CSS variables و `!important` rules
- **`force-dark-theme.css`**: فایل اضافی برای override کردن تمام استایل‌های قدیمی

### 2. Tailwind Configuration
- **`tailwind.config.ts`**: رنگ‌های دقیق تعریف شده با fallback values
- رنگ‌های اصلی:
  - Primary Background: `#1C2529`
  - Accent Color: `#A1D1B1`
  - Light Contrast: `#FAFAFA`

### 3. Layout و Meta Tags
- **`layout.tsx`**: 
  - `color-scheme: dark` در viewport
  - Meta tags برای PWA با رنگ‌های تاریک
  - JavaScript script برای force کردن تم تاریک

### 4. JavaScript Override Script
Script داخلی که:
- فوراً تم تاریک را اعمال می‌کند
- تمام کلاس‌های `.light` را به `.dark` تبدیل می‌کند
- Meta theme-color را به `#1C2529` تنظیم می‌کند
- استایل‌های اضافی با `!important` اضافه می‌کند

## رنگ‌های استفاده شده

### رنگ‌های اصلی (دقیقاً طبق درخواست)
```css
--background: #1C2529;        /* پس‌زمینه اصلی */
--primary: #A1D1B1;           /* رنگ accent */
--foreground: #FAFAFA;        /* متن روشن */
```

### رنگ‌های مکمل
```css
--card: #232D32;              /* پس‌زمینه کارت‌ها */
--muted: #2D373C;            /* پس‌زمینه عناصر muted */
--border: #374146;           /* رنگ border */
--input: #2D373C;            /* پس‌زمینه input ها */
```

## Override Rules

### CSS با !important
```css
html, body, #__next {
  background-color: #1C2529 !important;
  color: #FAFAFA !important;
  color-scheme: dark !important;
}

.bg-white, .bg-gray-50, .bg-gray-100 {
  background-color: #232D32 !important;
  color: #FAFAFA !important;
}

.bg-blue-500, .bg-blue-600, .bg-indigo-500 {
  background-color: #A1D1B1 !important;
  color: #1C2529 !important;
}
```

### JavaScript Override
```javascript
function forceDarkTheme() {
  document.documentElement.style.colorScheme = 'dark';
  document.documentElement.classList.add('dark');
  document.documentElement.classList.remove('light');
  
  document.body.style.backgroundColor = '#1C2529';
  document.body.style.color = '#FAFAFA';
  
  // اضافه کردن استایل‌های اضافی
  // Override کردن تمام کلاس‌های قدیمی
}
```

## تست و تأیید

### مواردی که باید بررسی شوند:
1. **پس‌زمینه اصلی**: `#1C2529` (تاریک)
2. **رنگ accent**: `#A1D1B1` (سبز روشن) برای دکمه‌ها و عناصر interactive
3. **متن**: `#FAFAFA` (سفید/روشن) برای خوانایی
4. **کارت‌ها**: `#232D32` (تیره‌تر از پس‌زمینه)

### عناصر کلیدی:
- Header/Sidebar: باید تاریک باشند
- دکمه‌ها: باید رنگ `#A1D1B1` داشته باشند
- متن: باید `#FAFAFA` باشد
- Input ها: باید پس‌زمینه تاریک داشته باشند

## نکات مهم

1. **Cache Clearing**: ممکن است نیاز باشد cache مرورگر را پاک کنید
2. **Hard Refresh**: Ctrl+Shift+R یا Cmd+Shift+R
3. **DevTools**: در Developer Tools بررسی کنید که CSS ها load شده‌اند
4. **Service Worker**: ممکن است نیاز باشد service worker را clear کنید

## فایل‌های تغییر یافته

- ✅ `frontend/src/app/globals.css` - بازنویسی کامل
- ✅ `frontend/tailwind.config.ts` - رنگ‌های دقیق
- ✅ `frontend/src/app/layout.tsx` - meta tags و script
- ✅ `frontend/src/app/force-dark-theme.css` - override rules
- ✅ تمام component های UI - به‌روزرسانی شده

## نتیجه نهایی

حالا باید:
- پس‌زمینه اصلی: `#1C2529` (تاریک)
- رنگ accent: `#A1D1B1` (سبز روشن)
- متن: `#FAFAFA` (سفید/روشن)
- تم کاملاً تاریک و مدرن

اگر هنوز مشکل دارید، لطفاً:
1. Cache مرورگر را پاک کنید
2. Hard refresh انجام دهید
3. Developer Tools را بررسی کنید
4. تصویر جدیدی ارسال کنید

