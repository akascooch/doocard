# Deploy Doocard frontend to production via plink + pscp
# Usage: powershell -ExecutionPolicy Bypass -File deploy\deploy-frontend-production.ps1

$ErrorActionPreference = 'Stop'

$ipFile   = 'C:\Users\a.hosseini\Desktop\apk\files\ip.txt'
$content  = Get-Content $ipFile -Raw
$ip       = (($content | Select-String '(?m)^ip:\s*$' -AllMatches).Count -gt 0) ?
            (Get-Content $ipFile | Where-Object { $_ -match '\S' } | Select-Object -Skip 1 -First 1) :
            (($content | Select-String '(?mi)^ip:\s*(.+)$').Matches.Groups[1].Value.Trim())
$lines    = Get-Content $ipFile | Where-Object { $_.Trim() -ne '' }
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^ip:\s*$')      { $ip   = $lines[$i+1].Trim() }
    if ($lines[$i] -match '^user:\s*$')    { $user = $lines[$i+1].Trim() }
    if ($lines[$i] -match '^port:\s*$')    { $port = $lines[$i+1].Trim() }
    if ($lines[$i] -match '^password:\s*$'){ $pass = $lines[$i+1].Trim() }
    if ($lines[$i] -match '^ip:\s*(.+)$')       { $ip   = $Matches[1].Trim() }
    if ($lines[$i] -match '^user:\s*(.+)$')     { $user = $Matches[1].Trim() }
    if ($lines[$i] -match '^port:\s*(.+)$')     { $port = $Matches[1].Trim() }
    if ($lines[$i] -match '^password:\s*(.+)$') { $pass = $Matches[1].Trim() }
}
if (-not $user) { $user = 'root' }
if (-not $port) { $port = '3031' }

$hostKey  = 'ssh-ed25519 255 SHA256:EJ3wNAgZiDp63Pm4yoRx9Ny01DilHKzrZJJQIWGLX1g'
$plink    = 'C:\Program Files\PuTTY\plink.exe'
$pscp     = 'C:\Program Files\PuTTY\pscp.exe'
$repoRoot = 'C:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.1'
$frontend = Join-Path $repoRoot 'frontend'
$remote   = '/var/www/doocard/doocard-repo'

function Invoke-Remote([string]$cmd) {
    Write-Host "`n>>> $cmd" -ForegroundColor Cyan
    & $plink -batch -ssh -P $port -l $user -pw $pass -hostkey $hostKey $ip $cmd
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed (exit $LASTEXITCODE)" }
}

Write-Host "=== STEP 1: Verify SSH ===" -ForegroundColor Yellow
try {
    Invoke-Remote 'echo CONNECTED'
} catch {
    Write-Host "Retrying with verbose output..." -ForegroundColor DarkYellow
    & $plink -v -batch -ssh -P $port -l $user -pw $pass -hostkey $hostKey $ip 'echo CONNECTED'
    throw $_
}

Write-Host "=== STEP 2: Upload frontend ===" -ForegroundColor Yellow
Write-Host "Uploading $frontend -> ${user}@${ip}:${remote}/"
& $pscp -batch -r -P $port -hostkey $hostKey -pw $pass $frontend "${user}@${ip}:${remote}/"
if ($LASTEXITCODE -ne 0) { throw "pscp upload failed (exit $LASTEXITCODE)" }

Write-Host "=== STEP 3: Node prerequisites ===" -ForegroundColor Yellow
Invoke-Remote @'
apt update -y && apt install -y nodejs npm curl && node -v && npm -v
NODE_MAJOR=$(node -v 2>/dev/null | sed "s/v//" | cut -d. -f1)
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  node -v && npm -v
fi
'@

Write-Host "=== STEP 4: Clean old build ===" -ForegroundColor Yellow
Invoke-Remote "cd ${remote}/frontend && rm -rf .next node_modules"

Write-Host "=== STEP 5: Production build ===" -ForegroundColor Yellow
Invoke-Remote "cd ${remote}/frontend && npm install && npm run build"
Invoke-Remote "ls -la ${remote}/frontend/.next"

Write-Host "=== STEP 6: Fix symlink ===" -ForegroundColor Yellow
Invoke-Remote "ln -sfn ${remote}/frontend /var/www/doocard/current && ls -la /var/www/doocard/current"

Write-Host "=== STEP 7: Restart services ===" -ForegroundColor Yellow
Invoke-Remote 'systemctl restart doocard-backend && systemctl restart nginx && systemctl status doocard-backend --no-pager && systemctl status nginx --no-pager'

Write-Host "=== STEP 8: Final verification ===" -ForegroundColor Yellow
Invoke-Remote 'journalctl -u doocard-backend -n 50 --no-pager'

Write-Host "`nDeployment complete." -ForegroundColor Green
