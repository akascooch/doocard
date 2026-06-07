# Doocard local bootstrap — PostgreSQL 17 @ localhost:5432/doocard
# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/bootstrap-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "==> [1/6] Checking backend/.env DATABASE_URL (expect doocard@5432)"
$envFile = Join-Path $Root "backend\.env"
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $Root "backend\.env.example") $envFile
  Write-Host "    Created backend/.env from .env.example"
}
if ((Get-Content $envFile -Raw) -notmatch "5432/doocard") {
  Write-Host "    WARNING: backend/.env may not point to localhost:5432/doocard"
}

Write-Host "==> [2/6] npm run install:all (skip if node_modules present)"
if (-not (Test-Path (Join-Path $Root "backend\node_modules"))) {
  npm run install:all
} else {
  Write-Host "    node_modules found — skipping install"
}

Write-Host "==> [3/6] Prisma generate + migrate deploy"
Set-Location (Join-Path $Root "backend")
npx prisma generate
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "migrate deploy failed" }

Write-Host "==> [4/6] Optional calendar seed"
npx ts-node prisma/seed.ts

Write-Host "==> [5/6] Admin user (09370504588) + password Lord7knows"
npx ts-node prisma/seedAdmin.ts
npx ts-node scripts/reset-admin-password.ts
if ($LASTEXITCODE -ne 0) { throw "admin password reset failed" }

Write-Host "==> [6/6] Migrate status"
npx prisma migrate status

Set-Location $Root
Write-Host ""
Write-Host "Bootstrap complete."
Write-Host "Next: ensure Redis on 127.0.0.1:6379, then: npm run dev"
Write-Host "Login: phone 09370504588 / password Lord7knows"
