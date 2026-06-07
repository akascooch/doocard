# متغیرهای محیطی مورد نیاز — Doocard Production

## Backend (`/var/www/doocard/backend/.env`)

| متغیر | الزامی | توضیح | مثال امن | در پکیج |
|-------|--------|-------|----------|---------|
| `NODE_ENV` | بله | محیط اجرا | `production` | template |
| `PORT` | بله | پورت API | `3001` | template |
| `HOST` | خیر | bind address | `0.0.0.0` | template |
| `DATABASE_URL` | بله | اتصال Prisma | `postgresql://USER:PASS@127.0.0.1:5432/doocard` | **دستی** |
| `POSTGRES_*` | اختیاری | اجزای URL | — | template |
| `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` | بله* | Bull queue SMS | `redis://127.0.0.1:6379` | **دستی** |
| `JWT_SECRET` | بله | امضای توکن | رشته تصادفی 64+ کاراکتر | **دستی** |
| `JWT_REFRESH_SECRET` | بله | refresh token | رشته تصادفی | **دستی** |
| `JWT_EXPIRES_IN` | خیر | TTL access | `15m` | template |
| `JWT_REFRESH_EXPIRES_IN` | خیر | TTL refresh | `7d` | template |
| `CORS_ORIGIN` | بله | دامنه‌های مجاز | `https://www.doocardbarbershop.com` | **دستی** |
| `ALLOWED_ORIGINS` | بله | همان CORS | همان | **دستی** |
| `FRONTEND_URL` | بله | لینک فرانت | `https://www.doocardbarbershop.com` | **دستی** |
| `TRUST_PROXY` | بله در prod | پشت Nginx | `true` | template |
| `SMS_API_KEY` | برای SMS | IPPanel Edge | — | **دستی** |
| `SMS_SENDER_NUMBER` | برای SMS | خط ارسال | `3000xxxxx` | **دستی** |
| `SMS_CUSTOMER_API_KEY` | اختیاری | ثبت مشتری | — | **دستی** |
| `SMS_ENABLED` | بله | کلید اصلی فعال‌سازی | `false` در تست | template |
| `VAPID_PUBLIC_KEY` | برای push | کلید عمومی | — | template |
| `VAPID_PRIVATE_KEY` | برای push | کلید خصوصی | — | **دستی** |
| `VAPID_EMAIL` / `VAPID_SUBJECT` | برای push | subject | `mailto:admin@...` | template |
| `UPLOAD_DEST` | بله | مسیر آپلود | `/var/www/doocard/backend/uploads` | template |
| `SESSION_SECRET` | بله | session | تصادفی | **دستی** |
| `LOG_LEVEL` | خیر | لاگ | `info` | template |

\* بدون Redis، صف Bull SMS و cache ممکن است خطا بدهد.

## Frontend (`/var/www/doocard/frontend/.env.production`)

| متغیر | الزامی | توضیح | مثال |
|-------|--------|-------|------|
| `NODE_ENV` | بله | `production` | |
| `BACKEND_URL` | بله | URL داخلی backend | `http://127.0.0.1:3001` |
| `NEXT_PUBLIC_API_URL` | بله | API عمومی | `https://www.doocardbarbershop.com` |
| `NEXT_PUBLIC_WS_URL` | بله | WebSocket | `wss://www.doocardbarbershop.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | برای PWA push | همان backend | |
| `NEXT_PUBLIC_PWA_ENABLED` | خیر | `true` | |

## تأثیر نبود متغیر

| نبود | اثر |
|------|-----|
| `DATABASE_URL` | backend بالا نمی‌آید |
| `JWT_SECRET` | login شکست |
| `REDIS` | SMS queue / cache خطا |
| `SMS_API_KEY` خالی | SMS ارسال نمی‌شود (fail-safe در کد) |
| `NEXT_PUBLIC_API_URL` | فرانت به API وصل نمی‌شود |

## فایل‌های template در پکیج

- `backend/.env.production.example`
- `frontend/.env.production.example`

**هرگز** فایل `.env` واقعی با secret را در git یا zip عمومی قرار ندهید.
