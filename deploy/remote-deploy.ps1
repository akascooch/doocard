$ErrorActionPreference = 'Stop'
$ipFile = 'C:\Users\a.hosseini\Desktop\apk\files\ip.txt'
$content = Get-Content $ipFile -Raw
$ip = ($content | Select-String 'ip:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$user = ($content | Select-String 'user:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$port = ($content | Select-String 'port:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$pass = ($content | Select-String 'password:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$hostKey = 'ssh-ed25519 255 SHA256:EJ3wNAgZiDp63Pm4yoRx9Ny01DilHKzrZJJQIWGLX1g'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$zip = 'C:\Users\a.hosseini\Desktop\apk\files\versions\doocard-prod-prep-2026-06-02-1747.zip'
$script = 'c:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.1\deploy\remote-full-deploy.sh'

function Invoke-Remote([string]$cmd) {
  & $plink -batch -ssh -P $port -l $user -pw $pass -hostkey $hostKey $ip $cmd
}

Write-Host "=== PRECHECK ==="
Invoke-Remote 'uname -a; whoami; pwd; cat /etc/os-release | head -3'

if (-not (Test-Path $zip)) { throw "ZIP missing: $zip" }
$hash = Get-FileHash $zip -Algorithm SHA256
Write-Host "ZIP SHA256=$($hash.Hash) SIZE=$((Get-Item $zip).Length)"

Write-Host "=== UPLOAD ZIP (skip if exists same size) ==="
$remoteSize = (Invoke-Remote 'stat -c%s /root/doocard-prod-prep.zip 2>/dev/null || echo 0').Trim()
if ($remoteSize -ne (Get-Item $zip).Length.ToString()) {
  & $pscp -batch -P $port -hostkey $hostKey -pw $pass $zip "${user}@${ip}:/root/doocard-prod-prep.zip"
} else { Write-Host "ZIP already on server" }

Write-Host "=== UPLOAD SCRIPT ==="
& $pscp -batch -P $port -hostkey $hostKey -pw $pass $script "${user}@${ip}:/root/remote-full-deploy.sh"

Write-Host "=== RUN DEPLOY (fix CRLF + execute) ==="
Invoke-Remote 'sed -i "s/\r$//" /root/remote-full-deploy.sh && chmod +x /root/remote-full-deploy.sh && bash /root/remote-full-deploy.sh /root/doocard-prod-prep.zip'

Write-Host "=== DEPLOY LOG TAIL ==="
Invoke-Remote 'tail -60 /var/www/doocard/deploy.log 2>/dev/null || echo NO_LOG'
