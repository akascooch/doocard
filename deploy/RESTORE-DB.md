# بازیابی پایگاه داده — Doocard

## نوع فایل پشتیبان

| فایل | نوع | ابزار |
|------|-----|-------|
| `*.full.backup` | PostgreSQL custom (`pg_dump -Fc`) | `pg_restore` |
| `*.schema.sql` | SQL schema-only | `psql -f` |

## پیش‌نیاز

- PostgreSQL 17.x (سازگار با dump فعلی)
- دیتابیس خالی یا قابل `--clean`

## بازیابی کامل (توصیه‌شده)

```bash
# روی سرور Ubuntu
sudo -u postgres psql -c "CREATE DATABASE doocard OWNER postgres;" 2>/dev/null || true

sudo -u postgres pg_restore \
  -d doocard \
  --clean --if-exists \
  --no-owner --no-acl \
  /var/www/doocard/database/doocard-2026-06-02-1732.full.backup
```

## اعتبارسنجی پس از restore

```bash
sudo -u postgres psql -d doocard -c 'SELECT COUNT(*) FROM appointments WHERE "deletedAt" IS NULL;'
sudo -u postgres psql -d doocard -c "SELECT batch_id, status FROM import_jobs ORDER BY id DESC LIMIT 3;"
```

انتظار: ~12483 نوبت فعال (batch `prod-migration-2026-05-31-v3`).

## Prisma پس از restore

```bash
cd /var/www/doocard/backend
npx prisma migrate status   # باید up to date باشد
npx prisma generate
```

## نکات ایمنی

1. **قبل از restore روی prod** — از DB فعلی سرور backup بگیرید.
2. dump شامل PII و تراکنش مالی است — محرمانه.
3. restore را **اول روی local** تست کنید.
4. `--clean` اشیاء قبلی را drop می‌کند — با احتیاط.

## Rollback

از backup قبلی سرور با همان دستور `pg_restore` بازیابی کنید.
