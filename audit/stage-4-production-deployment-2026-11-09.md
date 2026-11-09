# Stage 4 — Production Deployment Report

**تاریخ (UTC):** 2026-11-09  
**حکم:** **DEPLOYED AND VERIFIED**  
**Overlay:** `stage4-overlay-20261109-restore-date-money-sec`  
**پایه سورس:** `dee13450c316bac826bafbbf7ad663e3f68da4c6` (`release/v2.0.29`)  
**بسته sealed لوکال:** `audit/stage4-overlay-pkg-20261109T101847Z`  
**Tarball:** `audit/stage4-overlay-20261109-restore-date-money-sec.tar.gz` (61461 bytes)  
**Rollback hold:** `/var/www/doocard_backups/stage4_overlay_20261109_065518`

---

## 1. حکم

| فیلد | مقدار |
|------|--------|
| Verdict | **DEPLOYED AND VERIFIED** |
| Rollback اجرا شد؟ | خیر (نیاز نشد) |
| Migration / restore DB | **اجرا نشد** |
| Git push / Stage 5 | **انجام نشد** |
| تغییر UFW/SSH/nginx/apache2/.env | **انجام نشد** |
| `BACKUP_RESTORE_ALLOW_PRODUCTION` | **ABSENT** (قبل و بعد) |

---

## 2. هویت سورس و مطابقت Manifest

### هویت
- Branch لوکال: `release/v2.0.29`
- HEAD: `dee13450…` (کوتاه: `dee13450`)
- Overlay id: `stage4-overlay-20261109-restore-date-money-sec`
- تعداد فایل Manifest: **۱۸** — همه در بسته sealed، همه HASH_OK روی سرور

### SHA-256 بسته (از `SHA256SUMS.txt`)

```text
8ad7285729030087a2f0008ea1c8574952c3737c0a307bd894b3ca6e2cdb6c30  backend/src/backup/backup.service.ts
710254873d46a30d47b922dda9469e917a8101b8e2c39cda84efdc57fc1bd854  backend/src/backup/backup-restore.lib.ts
a9657b37e62a1b6e55519163746aaaa5523f175b3b479a5b04df3b3729d908a4  backend/src/backup/backup.service.spec.ts
41ff5133841a771f3c5dcd9b35350698fc2d3989634272b96e8475c204d18c8e  backend/src/backup/backup-restore.lib.spec.ts
b81d498e79356269cfd567459347e03b16c72405e947af244c9d35582e851820  backend/src/settings/settings.controller.ts
6d8d6af5b7f0dca7dc25d2ffa87d876fa6f2c51e86110dc1b98c354d62b1a76e  backend/src/sms/sms.controller.ts
3f0f38cc5deb16a56e315430669313ddbd914eba8014203b7a485b2897592679  backend/src/permissions/permissions.controller.ts
c1d19670f57317f19b8558da3adc2be39b26b0951eedff5a10b9530066c88d63  backend/src/main.ts
7773cd1a4e1e27712ddff8d95abf16165d2a9b039d35bc25d3385c8b973c9d42  frontend/src/app/api/settings/backup/restore/route.ts
1860a0a0ea330b1920e85f575538aff4b3dd3dd5c8190ed616f12c3e9b1bdbc4  frontend/next.config.js
0296dbd26ddd61797def12965ab8c816ca398f945885feb32651e4d84c17fb16  frontend/src/app/dashboard/settings/page.tsx
8ad63f532bee8fc7c1689d15b6ea1d9f5ded55140c267802408821ee545dbad0  frontend/src/lib/date.ts
210ffbc615618076a6d469a1774649f9ab358afdc785b6deec56c4d218b71fef  frontend/src/lib/money.ts
95371082e1bdb9f79b06da53cd84d96df20919814e37b0f3b26522beaf00a4c9  frontend/src/lib/__tests__/date-safari-hardening.spec.ts
3a8631204b3fd8eabea09efc7fb142c94a1f9a4ed393a29a928ed6ee5398d1f1  frontend/src/app/dashboard/admin/tips/page.tsx
1c4e0a7bb2f28d1b730636c7d3f2137f82e7950e53578719290da4af16cbc699  frontend/src/app/dashboard/admin/day-closing/page.tsx
a2e2c04a38ad543bdaa4ad10ca9c3525b1ab5e5ee0ad506e98038dca7ff004ed  frontend/src/app/dashboard/customers/page.tsx
8b3d7981c4108d7f2f8466e02e73dedf479153a8da8cc6020b2d37c3d825c36b  frontend/src/app/dashboard/admin/accounting/page.tsx
```

### جداسازی Category B
در tarball بررسی شد: بدون `.env`، `node_modules`، `.next`، `Offline/`، `audit/`، financial/kardex/packages/products/axios.

Spot-check پس از دیپلوی روی live:
- `route.ts` = `7773cd1a…`
- `backup-restore.lib.ts` = `71025487…`
- `backup.service.ts` = `8ad72857…`

---

## 3. Preflight تازه (قبل از تغییر)

| مورد | نتیجه |
|------|--------|
| Host / kernel | `server-45-159-114-60` / `5.15.0-190-generic` |
| Node / npm | **v20.11.1** / 10.2.4 |
| Paths | `/var/www/doocard` · BE `dist/main.js` · FE standalone `server.js` |
| PM2 | `doocard-backend` + `doocard-frontend` · **online** · **fork_mode** · تک‌instance |
| Health | BE `/api/health` 200 · DB up · FE `/` 200 |
| BUILD_ID قبل | `vN7uSYEFez8TeXnUTdnNe` (src == standalone) |
| Restore route | **ABSENT** |
| `BACKUP_RESTORE_ALLOW_PRODUCTION` | **ABSENT** |
| `BACKUP_RESTORE_SKIP_PRE_BACKUP` | **ABSENT** |
| Prisma migrate status | **up to date** (۸۷) — بدون نیاز به migration |
| Disk آزاد | **۹.۳۸GB** (~۸.۸G انسانی) |
| RAM available | ~۲.۸GB + swap |
| اندازه `.next` | ~۶۳۲MB |
| اندازه standalone | ~۵۵MB |
| اندازه `dist` | ~۴MB |

**یادداشت drift رجیستری:** رجیستری هنوز BUILD_ID قدیمی `xAWMq27E-Ibp69poSPYEY` را ثبت کرده بود؛ واقعیت live قبل از دیپلوی `vN7uSYEFez8TeXnUTdnNe` بود (با prep همخوان). این دیپلوی هویت جدید می‌سازد.

**محاسبه فضا:** اوج staging (~۷۵۵MB hold پس از build) ≪ ۹.۳۸GB آزاد → gate فضا **PASS**. حذف فایل‌های موجود برای آزادسازی **انجام نشد**.

---

## 4. Rollback point

| Artifact | مقدار |
|----------|--------|
| Hold | `/var/www/doocard_backups/stage4_overlay_20261109_065518` |
| `backend-dist.tgz` | 709865 bytes · sha256 `b96797188fefd551bf1725622503c97e2ba787d5d38f9566b1be29557044d53c` |
| `frontend-standalone.tgz` | 30139534 bytes · sha256 `672e40de1c143b667160758e8268c9e3f50b8e1de09e8c87f298502446c92ca6` |
| Sources snapshot | فایل‌های جایگزین‌شونده (route قبلاً ABSENT) |
| Script | `$HOLD/rollback.sh` (mode 700) |
| DB dump سنگین | **اجرا نشد** (بدون schema change؛ مطابق دستور) |

دستور rollback (در صورت نیاز):

```bash
bash /var/www/doocard_backups/stage4_overlay_20261109_065518/rollback.sh
```

---

## 5. Build / Deploy / Reload (exit evidence)

### Staging build (خارج از runtime زنده)
- درخت: `$HOLD/build/{frontend,backend}` با `rsync` (بدون node_modules/.next/dist) + symlink به `node_modules` زنده + overlay
- Backend: `npm run build` → **exit 0** · `dist/main.js` OK
- Frontend: `npm run build` + `sync-standalone.mjs` → **exit 0**
- BUILD_ID جدید: **`gLfFg76LTBz8WUjIQZqIv`** (src == standalone)
- Restore route در staging: **PRESENT**
- زمان تقریبی build: ~۵ دقیقه (06:56–07:01 UTC)

### Promote
1. Overlay سورس به `/var/www/doocard` از tarball تأییدشده (بدون `--delete` / بدون `git pull`)
2. **توقف کوتاه:** `pm2 stop doocard-backend` سپس `pm2 stop doocard-frontend` (fork تک‌instance → قطعی کوتاه پذیرفته‌شده)
3. جایگزینی `backend/dist` از staging
4. جایگزینی `frontend/.next/standalone` + `BUILD_ID` از staging
5. `pm2 start doocard-backend --update-env` و `pm2 start doocard-frontend --update-env`

### نکته عملیاتی
اولین `curl` health بلافاصله پس از start برای backend کد `000` داد (Nest هنوز در حال map کردن routeها بود). حدود چند ثانیه بعد health **200** و پایدار. اسکریپت promote به‌خاطر `set -e` روی `cat` فایل خالی exit زودرس داشت و **rollback را شلیک نکرد**؛ وضعیت نهایی با recheck تأیید شد. restart count همچنان 51/42 (بدون crash-loop جدید)؛ `unstable restarts = 0`.

---

## 6. Before / After

| فیلد | قبل | بعد |
|------|-----|-----|
| FE BUILD_ID | `vN7uSYEFez8TeXnUTdnNe` | **`gLfFg76LTBz8WUjIQZqIv`** |
| Restore route standalone | ABSENT | **PRESENT** |
| BE `dist/main.js` sha256 | (snapshot در hold) | `6bd57bd44d4562bc959e1d2f4e9c2d74afd7a1084125e3fe48d788450e9cf2de` (= staging) |
| Schema migrations | 87 up to date | 87 up to date |
| Restore allow flag | ABSENT | ABSENT |

---

## 7. Post-deploy verification

| چک | نتیجه |
|----|--------|
| PM2 backend/frontend | online · fork_mode · Node 20.11.1 · مسیرهای صحیح |
| `/api/health` | 200 · database up |
| `/` · `/login` | 200 |
| `/dashboard/settings` · tips · day-closing · customers | 200 (بدون mutation) |
| HTTPS apex `/login` (resolve local) | 200 |
| Restore route file | PRESENT |
| `BACKUP_RESTORE_*` flags | ABSENT |
| Content-Length >300MB + multipart CT | **HTTP 413** (بدون آپلود بزرگ) |
| Nest POST restore بدون auth | **HTTP 401** (restore اجرا نشد) |
| Prisma migrate status | up to date |
| Disk پس از دیپلوی | **۷.۶G آزاد (۸۱٪)** |
| Crash loop | مشاهده نشد |

### عمداً تست نشد
- restore واقعی / آپلود بکاپ واقعی
- فعال‌سازی `BACKUP_RESTORE_ALLOW_PRODUCTION`
- پرداخت، SMS، push، email
- تغییر داده مشتری/نوبت/حسابداری/انبار
- E2E مرورگر لاگین‌شده برای tips/day-closing UI
- Git push / به‌روزرسانی کامل path registry (Stage 5)

### ریسک باقی
- F-RST-03: buffering کامل body در Route Handler همچنان OPEN
- رجیستری مسیر (`doocard-prod-path-registry.md`) هنوز identity این ریلیز را ندارد — برای Stage 5
- لاگ تاریخی frontend (قبل از دیپلوی) شامل `Connection closed` / null message بود؛ پس از دیپلوی Ready پایدار و unstable=0
- پاسخ Next برای multipart کوچک بدون فایل فیلد بکاپ در یک نمونه 404 با متن «Cannot GET» دیده شد؛ در همان زمان Nest مستقیم 401 صحیح داد و گارد 413 روی Next تأیید شد. نیاز به پیگیری جدا (غیرمسدودکننده سلامت سرویس)

---

## 8. تأیید مرزهای ایمنی

- هیچ `git pull` روی production
- هیچ `rsync --delete`
- هیچ `prisma migrate` / `migrate reset`
- هیچ production database restore
- هیچ تنظیم `BACKUP_RESTORE_ALLOW_PRODUCTION`
- هیچ تغییر SSH/UFW/fail2ban/nginx/apache2
- هیچ چاپ secret/ENV value
- هیچ Git push / Stage 5

---

## 9. توقف

Stage 4 اینجا تمام است. برای Stage 5 (بستن رجیستری/تگ) تأیید جدا لازم است.
