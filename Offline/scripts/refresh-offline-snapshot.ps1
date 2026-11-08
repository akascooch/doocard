#Requires -Version 5.1
<#
.SYNOPSIS
  Refresh Offline PostgreSQL from production using pg_dump -Fc only.

.DESCRIPTION
  1) Safety-backups the live offline DB
  2) Fetches production dump via ssh doocard-prod OR uses -LocalDumpPath
  3) Restores into an isolated staging database
  4) Verifies Prisma migration count
  5) Requires typing SWITCH before renaming over the live offline DB

  Never writes to production. Never drops the live offline DB without SWITCH.

.PARAMETER LocalDumpPath
  Skip SSH fetch and restore this existing -Fc dump (QA / dry-run).

.PARAMETER LiveDbName
  Current offline database name (default doocard_offline_20261105).

.PARAMETER ExpectedMinMigrations
  Minimum finished _prisma_migrations rows required on staging (default 87).

.PARAMETER SkipSwitchPrompt
  Stop after staging verification (exit 0). Leaves staging DB in place.
#>
param(
  [string]$LocalDumpPath = '',
  [string]$LiveDbName = 'doocard_offline_20261105',
  [string]$StagingDbName = '',
  [int]$ExpectedMinMigrations = 87,
  [switch]$SkipSwitchPrompt,
  [switch]$SkipLiveBackup
)

$ErrorActionPreference = 'Stop'
$OfflineRoot = Split-Path $PSScriptRoot -Parent
$PgDump = 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe'
$PgRestore = 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe'
$Psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$DumpDir = Join-Path $OfflineRoot 'data\db-dumps'
$BackupDir = Join-Path $OfflineRoot 'data\backups'
$RuntimeDir = Join-Path $OfflineRoot 'runtime'
$RolePassFile = Join-Path $RuntimeDir 'db_role_password.txt'
$AdminPassFile = Join-Path $RuntimeDir 'postgres_admin_password.txt'

function Read-SecretFile([string]$path, [string]$label) {
  if (-not (Test-Path $path)) {
    throw "Missing $label secret file: $path"
  }
  $value = (Get-Content $path -Raw).Trim()
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Empty $label secret file: $path"
  }
  return $value
}

function Get-PostgresAdminPassword {
  if ($env:DOOCARD_PG_SUPERUSER_PASSWORD -and $env:DOOCARD_PG_SUPERUSER_PASSWORD.Trim().Length -gt 0) {
    return $env:DOOCARD_PG_SUPERUSER_PASSWORD.Trim()
  }
  if (Test-Path $AdminPassFile) {
    return Read-SecretFile $AdminPassFile 'postgres admin'
  }
  throw @"
Postgres superuser password not found.
Set env DOOCARD_PG_SUPERUSER_PASSWORD or create ACL-limited file:
  $AdminPassFile
Do not commit this file.
"@
}

foreach ($exe in @($PgDump, $PgRestore, $Psql)) {
  if (-not (Test-Path $exe)) { throw "PostgreSQL 18 tool missing: $exe" }
}

$RolePass = Read-SecretFile $RolePassFile 'doocard_offline role'
$AdminPass = Get-PostgresAdminPassword
$Ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$StagingDb = if ($StagingDbName) { $StagingDbName } else { "doocard_offline_staging_$Ts" }
$StagingDumpRemote = "/tmp/doocard_offline_refresh_$Ts.dump"
$LocalDump = if ($LocalDumpPath) { $LocalDumpPath } else { Join-Path $DumpDir "doocard_offline_snap_$Ts.dump" }
$PriorBackup = Join-Path $BackupDir "pre_refresh_offline_$Ts.dump"
$priorHash = 'skipped'

New-Item -ItemType Directory -Force -Path $DumpDir, $BackupDir, $RuntimeDir | Out-Null

if ($SkipLiveBackup) {
  Write-Host "[1/6] SkipLiveBackup set — not dumping live offline DB."
} else {
  Write-Host "[1/6] Safety backup of live offline DB '$LiveDbName'..."
  $env:PGPASSWORD = $RolePass
  & $PgDump -U doocard_offline -h 127.0.0.1 -p 5432 -Fc -b -d $LiveDbName -f $PriorBackup
  if ($LASTEXITCODE -ne 0) { throw "Local safety backup failed (exit $LASTEXITCODE)" }
  $priorHash = (Get-FileHash -Algorithm SHA256 $PriorBackup).Hash.ToLower()
  Write-Host "  Prior backup: $PriorBackup"
  Write-Host "  SHA256: $priorHash"
}

$localHash = $null
if ($LocalDumpPath) {
  Write-Host "[2/6] Using local dump (SSH skipped): $LocalDumpPath"
  if (-not (Test-Path $LocalDumpPath)) { throw "LocalDumpPath not found: $LocalDumpPath" }
  $localHash = (Get-FileHash -Algorithm SHA256 $LocalDumpPath).Hash.ToLower()
  Write-Host "  SHA256: $localHash"
} else {
  Write-Host "[2/6] Capture production snapshot via ssh doocard-prod (read-only dump)..."
  $remoteLog = @"
set -euo pipefail
OUT='$StagingDumpRemote'
echo CUTOFF_UTC=`$(date -u '+%Y-%m-%dT%H:%M:%SZ')
echo CUTOFF_TEHRAN=`$(TZ=Asia/Tehran date '+%Y-%m-%dT%H:%M:%S%z')
sudo -u postgres pg_dump -Fc -b -d doocard -f "`$OUT"
sha256sum "`$OUT"
wc -c "`$OUT"
"@
  $log = $remoteLog | ssh -o BatchMode=yes -o ConnectTimeout=30 doocard-prod 'bash -s'
  $log | Tee-Object -FilePath "$LocalDump.remote-log.txt" | Out-Host
  $remoteHash = ([regex]::Match($log, '([a-f0-9]{64})\s+/tmp/')).Groups[1].Value
  if (-not $remoteHash) { throw 'Missing remote checksum' }

  Write-Host "[3/6] Download dump and verify checksum..."
  scp -P 3031 "doocard-prod:$StagingDumpRemote" $LocalDump
  $localHash = (Get-FileHash -Algorithm SHA256 $LocalDump).Hash.ToLower()
  if ($localHash -ne $remoteHash) { throw "Checksum mismatch local=$localHash remote=$remoteHash" }
  ssh -o BatchMode=yes doocard-prod "rm -f '$StagingDumpRemote'"
}

$stepRestore = if ($LocalDumpPath) { '[3/6]' } else { '[4/6]' }
Write-Host "$stepRestore Restore into staging DB $StagingDb (live '$LiveDbName' untouched)..."
$env:PGPASSWORD = $AdminPass
& $Psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 -c "CREATE DATABASE `"$StagingDb`" OWNER doocard_offline ENCODING 'UTF8';"
if ($LASTEXITCODE -ne 0) { throw "CREATE DATABASE staging failed" }
& $PgRestore -U postgres -h 127.0.0.1 -p 5432 -d $StagingDb --no-owner --role=doocard_offline $LocalDump
# pg_restore may return 1 for non-fatal ACL warnings; require migrations next
$mig = (& $Psql -U postgres -h 127.0.0.1 -p 5432 -d $StagingDb -tAc "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;").Trim()
$latest = (& $Psql -U postgres -h 127.0.0.1 -p 5432 -d $StagingDb -tAc "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1;").Trim()
if ([int]$mig -lt $ExpectedMinMigrations) {
  throw "Staging migrations=$mig below expected minimum $ExpectedMinMigrations (latest=$latest)"
}
Write-Host "  Staging migrations=$mig latest=$latest"

$stepGate = if ($LocalDumpPath) { '[4/6]' } else { '[5/6]' }
Write-Host "$stepGate Manual switch gate — staging verified."
Write-Host "  Staging DB: $StagingDb"
Write-Host "  Live offline DB remains: $LiveDbName"
Write-Host "  Prior backup: $PriorBackup"

if ($SkipSwitchPrompt) {
  Write-Host "SkipSwitchPrompt set — leaving staging DB in place. No overwrite."
  Write-Host "DROP later if unused: DROP DATABASE `"$StagingDb`";"
  exit 0
}

$ans = Read-Host "Type SWITCH to rename staging over live offline DB (or anything else to abort)"
if ($ans -ne 'SWITCH') {
  Write-Host "Aborted. Staging DB left for inspection. No automatic overwrite."
  exit 2
}

$stepSwitch = if ($LocalDumpPath) { '[5/6]' } else { '[6/6]' }
Write-Host "$stepSwitch Switching databases..."
$hold = "doocard_offline_hold_$Ts"
& $Psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$LiveDbName','$StagingDb') AND pid <> pg_backend_pid();"
& $Psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 -c "ALTER DATABASE `"$LiveDbName`" RENAME TO `"$hold`";"
& $Psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 -c "ALTER DATABASE `"$StagingDb`" RENAME TO `"$LiveDbName`";"

@"
snapshot_file=$LocalDump
snapshot_sha256=$localHash
prior_offline_backup=$PriorBackup
prior_offline_backup_sha256=$priorHash
hold_db_before_switch=$hold
staging_migrations=$mig
staging_latest_migration=$latest
switched_at_local=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')
"@ | Set-Content (Join-Path $DumpDir 'SNAPSHOT_META.txt') -Encoding UTF8

Write-Host "DONE. New offline DB active as $LiveDbName. Old offline renamed to $hold."
Write-Host "Restart offline app with start-offline.bat"
