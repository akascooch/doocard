$ipFile = 'C:\Users\a.hosseini\Desktop\apk\files\ip.txt'
$content = Get-Content $ipFile -Raw
$ip = ($content | Select-String 'ip:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$user = ($content | Select-String 'user:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$port = ($content | Select-String 'port:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$pass = ($content | Select-String 'password:\s*(.+)' ).Matches.Groups[1].Value.Trim()
$plink = 'C:\Program Files\PuTTY\plink.exe'
$hostKey = 'ssh-ed25519 255 SHA256:EJ3wNAgZiDp63Pm4yoRx9Ny01DilHKzrZJJQIWGLX1g'
$cmd = 'uname -a; echo TOOLS; which node npm pm2 nginx psql redis-cli pg_restore 2>/dev/null; node -v 2>/dev/null; df -h /; ls -la /var/www 2>/dev/null || echo NO_VAR_WWW'
& $plink -batch -ssh -P $port -l $user -pw $pass -hostkey $hostKey $ip $cmd
