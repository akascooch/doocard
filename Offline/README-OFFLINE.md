# دوکارد آفلاین (Offline)

نسخهٔ محلی قابل‌اجرا روی این PC، فقط روی `127.0.0.1`.

## هویت runtime (Phase 2 — 2026-11-08)

| مورد | مقدار |
|------|--------|
| Source HEAD | `1bb7068` / tag `v.2.0.30` |
| Offline FE BUILD_ID | `wxO2ULmPuCOr6c3N_Hxy1` |
| Prisma migrations (artifact tree) | **87** — شامل `20261108120000_lottery_loan_fields` |
| Node | bundled `Offline/tools/node` |
| Live offline DB name | `doocard_offline_20261105` (نقش `doocard_offline`) |
| Postgres tools | PostgreSQL **18** (`C:\Program Files\PostgreSQL\18\bin`) |

> DB زنده تا وقتی `refresh-offline-snapshot` با تأیید `SWITCH` اجرا نشود، به اسنپ‌شات قدیمی (۸۵ migration) می‌ماند. باینری اپ به‌روز شده است؛ برای دادهٔ هم‌تراز پروداکشن باید اسکریپت همگام‌سازی را اجرا کنید.

## آدرس‌ها

- Frontend: http://127.0.0.1:3000
- Backend health: http://127.0.0.1:3001/api/health
- Stop: `scripts\stop-offline.bat`

## پشتیبان‌ها — دو مسیر جدا

1. **JSON سیستم (Admin Settings)** — `doocard-backup-*.json`  
   فقط بازیابی منطقی اپ. فایل `.dump` / `.sql` را در UI آپلود نکنید.
2. **همگام‌سازی کامل DB به آفلاین** — فقط `pg_dump -Fc` + اسکریپت زیر.

`BACKUP_RESTORE_ALLOW_PRODUCTION` در `.env` آفلاین عمداً تنظیم نشده است (`NODE_ENV=production`). بازیابی JSON از UI روی آفلاین تا وقتی این فلگ `true` نشود غیرفعال است. برای تست JSON محلی، فقط با آگاهی اپراتور اضافه کنید؛ مسیر توصیه‌شده برای دادهٔ سرور همان اسکریپت `-Fc` است.

## تازه‌سازی اسنپ‌شات پروداکشن (امن)

پیش‌نیاز رمزها (commit نشوند):

- `runtime\db_role_password.txt` — رمز نقش `doocard_offline`
- `runtime\postgres_admin_password.txt` یا env `DOOCARD_PG_SUPERUSER_PASSWORD` — برای `CREATE/ALTER DATABASE`

```bat
scripts\refresh-offline-snapshot.bat
```

یا:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\refresh-offline-snapshot.ps1
```

مراحل: بکاپ ایمنی از DB زنده → `pg_dump -Fc` از `doocard-prod` → restore به DB استیج → بررسی حداقل ۸۷ migration → فقط با تایپ `SWITCH` جابه‌جایی. بدون `SWITCH` هیچ overwriteای روی DB زنده رخ نمی‌دهد.

Dry-run با dump محلی (بدون SSH و بدون SWITCH):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\refresh-offline-snapshot.ps1 `
  -LocalDumpPath 'data\db-dumps\YOUR.dump' `
  -StagingDbName 'doocard_offline_test_verify' `
  -ExpectedMinMigrations 85 `
  -SkipLiveBackup -SkipSwitchPrompt
```

## بکاپ کار جدید آفلاین

```bat
scripts\backup-offline-db.bat
```

## امنیت

- `.env`، رمز DB، JWT، dumpها داخل `Offline` — commit نشوند (`.gitignore`)
- Bind فقط `127.0.0.1`
