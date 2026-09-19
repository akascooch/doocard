# Pack v2.0.9 source overlay tarballs on Windows (local only).
# Does NOT SSH, deploy, or migrate production.
# After operator GO FOR PROD: scp the two tarballs + docs/deploy-v209.sh to doocard-prod:/tmp/

$ErrorActionPreference = 'Stop'
$root = 'C:\scooch\Versions\v.2.0.4'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$out = "C:\scooch\_backups\v209-overlay-$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$beTar = Join-Path $out 'backend-v209-overlay.tar.gz'
$feTar = Join-Path $out 'frontend-v209-overlay.tar.gz'

tar -C "$root\backend" -czf $beTar `
  --exclude=node_modules `
  --exclude=dist `
  --exclude=.env `
  --exclude=.env.* `
  --exclude=uploads `
  --exclude=scripts/local-mint-admin-jwt.ts `
  --exclude=scripts/local-http-packaging-smoke.ts `
  --exclude=scripts/local-packaging-kardex-smoke.ts `
  --exclude=scripts/local-frog-datekey-inspect.ts `
  --exclude=scripts/local-packaging-migrate-verify.ts `
  src prisma scripts package.json package-lock.json nest-cli.json tsconfig.json ecosystem.config.js

tar -C "$root\frontend" -czf $feTar `
  --exclude=node_modules `
  --exclude=.next `
  --exclude=.env `
  --exclude=.env.* `
  --exclude=.env.local `
  --exclude=.env.production `
  src public scripts jest.config.js next.config.js package.json package-lock.json tsconfig.json tailwind.config.ts postcss.config.js ecosystem.config.js

Copy-Item "$root\docs\deploy-v209.sh" "$out\deploy-v209.sh"

$beListing = @(tar -tzf $beTar)
$feListing = @(tar -tzf $feTar)
$beText = $beListing -join "`n"
$feText = $feListing -join "`n"
if ($beText -match '(^|/)\.env($|\.)' -or $feText -match '(^|/)\.env($|\.)') {
  throw 'Packed archive contains a .env file — abort'
}
if ($beText -match 'node_modules/' -or $feText -match 'node_modules/') {
  throw 'Packed archive contains node_modules — abort'
}
if ($feText -match '(^|/)\.next(/|$)' -or $beText -match 'query_engine-windows') {
  throw 'Packed archive looks like a Windows build artifact — abort'
}
if ($beText -notmatch 'prisma/migrations/20260919180000_frog_dual_reminders/migration.sql') {
  throw 'Backend archive missing frog dual-reminder migration'
}
if ($beText -notmatch 'prisma/migrations/20260919181000_package_points_required/migration.sql') {
  throw 'Backend archive missing package pointsRequired migration'
}
if ($beText -notmatch 'scripts/backfill-cleared-cheque-expenses.ts') {
  throw 'Backend archive missing cheque backfill script'
}
if ($feText -notmatch 'scripts/sync-standalone.mjs') {
  throw 'Frontend archive missing sync-standalone.mjs'
}
if ($feText -notmatch 'public/sw.js') {
  throw 'Frontend archive missing public/sw.js'
}

Get-FileHash -Algorithm SHA256 $beTar, $feTar, (Join-Path $out 'deploy-v209.sh') |
  Format-Table Algorithm, Hash, Path -AutoSize

Write-Host "PACKED=$out"
Write-Host "After GO FOR PROD only:"
Write-Host "  scp -P 3031 `"$beTar`" `"$feTar`" `"$out\deploy-v209.sh`" doocard-prod:/tmp/"
Write-Host "  ssh doocard-prod `"sed -i 's/\r$//' /tmp/deploy-v209.sh && DEPLOY_CONFIRM=GO_FOR_PROD bash /tmp/deploy-v209.sh`""
