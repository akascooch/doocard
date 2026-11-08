#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$OfflineRoot = Split-Path $PSScriptRoot -Parent
$LogDir = Join-Path $OfflineRoot 'logs'
$Runtime = Join-Path $OfflineRoot 'runtime'
$Node = Join-Path $OfflineRoot 'tools\node\node.exe'
$RedisServer = Join-Path $OfflineRoot 'tools\redis\redis-server.exe'
$RedisCli = Join-Path $OfflineRoot 'tools\redis\redis-cli.exe'
$RedisConf = Join-Path $OfflineRoot 'tools\redis\redis.windows-offline.conf'
$BeDir = Join-Path $OfflineRoot 'backend'
$FeDir = Join-Path $OfflineRoot 'frontend\.next\standalone'
$Lock = Join-Path $Runtime 'offline.lock'
$Log = Join-Path $LogDir 'launcher.log'

New-Item -ItemType Directory -Force -Path $LogDir, $Runtime | Out-Null
function Write-Log([string]$m) {
  Add-Content -Path $Log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m)
}

function Test-Url([string]$url) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $url
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch { return $false }
}

Write-Log '=== START ==='
if (-not (Test-Path $Node)) { throw "Node missing: $Node" }
if (-not (Test-Path (Join-Path $BeDir '.env'))) { throw 'Missing backend/.env' }
if (-not (Test-Path (Join-Path $FeDir 'server.js'))) { throw 'Missing frontend standalone server.js' }

# Duplicate guard: if healthy, just open browser
if ((Test-Url 'http://127.0.0.1:3001/api/health') -and (Test-Url 'http://127.0.0.1:3000/login')) {
  Write-Host '[INFO] Offline already healthy — opening browser'
  Start-Process 'http://127.0.0.1:3000/login'
  exit 0
}

# PostgreSQL service
$svc = Get-Service -Name 'postgresql-x64-18' -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Running') {
  Write-Host '[INFO] Starting PostgreSQL 18...'
  Start-Service 'postgresql-x64-18'
}

# Redis
$pong = $null
try {
  $pong = (& $RedisCli -h 127.0.0.1 -p 6379 ping 2>$null | Out-String).Trim()
} catch {
  $pong = $null
}
if ($pong -ne 'PONG') {
  if (-not (Test-Path $RedisConf)) {
    @"
bind 127.0.0.1
port 6379
maxmemory 128mb
maxmemory-policy allkeys-lru
dir $Runtime
logfile $LogDir\redis.log
dbfilename offline-redis.rdb
"@ | Set-Content $RedisConf -Encoding ASCII
  }
  Write-Host '[INFO] Starting Redis...'
  Start-Process -FilePath $RedisServer -ArgumentList $RedisConf -WindowStyle Minimized
  Start-Sleep -Seconds 2
  try {
    $pong = (& $RedisCli -h 127.0.0.1 -p 6379 ping 2>$null | Out-String).Trim()
  } catch {
    $pong = $null
  }
  if ($pong -ne 'PONG') { throw 'Redis not ready on 127.0.0.1:6379' }
}

# Backend
if (-not (Test-Url 'http://127.0.0.1:3001/api/health')) {
  Write-Host '[INFO] Starting backend 127.0.0.1:3001 ...'
  $be = Start-Process -FilePath $Node -ArgumentList 'dist\main.js' -WorkingDirectory $BeDir -WindowStyle Minimized -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir 'backend.out.log') -RedirectStandardError (Join-Path $LogDir 'backend.err.log')
  Set-Content (Join-Path $Runtime 'backend.pid') $be.Id
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-Url 'http://127.0.0.1:3001/api/health') { $ok = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ok) { throw 'Backend health timeout — see logs\backend.err.log' }
}

# Frontend
if (-not (Test-Url 'http://127.0.0.1:3000/login')) {
  Write-Host '[INFO] Starting frontend 127.0.0.1:3000 ...'
  $env:NODE_ENV = 'production'
  $env:HOSTNAME = '127.0.0.1'
  $env:HOST = '127.0.0.1'
  $env:PORT = '3000'
  $env:BACKEND_URL = 'http://127.0.0.1:3001'
  $env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:3001'
  $env:NEXT_PUBLIC_BACKEND_URL = 'http://127.0.0.1:3001'
  $fe = Start-Process -FilePath $Node -ArgumentList 'server.js' -WorkingDirectory $FeDir -WindowStyle Minimized -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir 'frontend.out.log') -RedirectStandardError (Join-Path $LogDir 'frontend.err.log')
  Set-Content (Join-Path $Runtime 'frontend.pid') $fe.Id
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-Url 'http://127.0.0.1:3000/login') { $ok = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ok) { throw 'Frontend readiness timeout — see logs\frontend.err.log' }
}

Set-Content $Lock ("{0}`n{1}" -f (Get-Date -Format o), $PID)
Write-Log 'READY'
Write-Host '[OK] http://127.0.0.1:3000'
Write-Host 'Snapshot cutoff: Offline\data\db-dumps\SNAPSHOT_META.txt'
Start-Process 'http://127.0.0.1:3000/login'
