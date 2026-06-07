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
$repo = 'c:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.1\deploy'

function Invoke-Remote([string]$cmd) {
  & $plink -batch -ssh -P $port -l $user -pw $pass -hostkey $hostKey $ip $cmd
}

Write-Host "=== UPLOAD STABILIZATION SCRIPTS ==="
& $pscp -batch -P $port -hostkey $hostKey -pw $pass `
  "$repo\doctor.sh" `
  "$repo\production-stabilize.sh" `
  "${user}@${ip}:/root/"

Write-Host "=== UPLOAD AI CONTEXT ==="
& $pscp -batch -P $port -hostkey $hostKey -pw $pass -r `
  "$repo\ai" `
  "${user}@${ip}:/root/ai-context/"

Write-Host "=== RUN STABILIZATION ==="
Invoke-Remote 'sed -i "s/\r$//" /root/doctor.sh /root/production-stabilize.sh && chmod +x /root/doctor.sh /root/production-stabilize.sh && bash /root/production-stabilize.sh'

Write-Host "=== DOCTOR OUTPUT ==="
Invoke-Remote 'bash /var/www/doocard/current/deploy/doctor.sh 2>/dev/null || bash /root/doctor.sh'

Write-Host "=== STABILIZE LOG TAIL ==="
Invoke-Remote 'tail -40 /var/log/doocard/stabilize.log 2>/dev/null || echo NO_LOG'
