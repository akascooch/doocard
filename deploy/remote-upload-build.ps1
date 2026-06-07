$ipFile = 'C:\Users\a.hosseini\Desktop\apk\files\ip.txt'
$c = Get-Content $ipFile -Raw
$ip = ($c | Select-String 'ip:\s*(.+)').Matches.Groups[1].Value.Trim()
$user = ($c | Select-String 'user:\s*(.+)').Matches.Groups[1].Value.Trim()
$port = ($c | Select-String 'port:\s*(.+)').Matches.Groups[1].Value.Trim()
$pass = ($c | Select-String 'password:\s*(.+)').Matches.Groups[1].Value.Trim()
$hk = 'ssh-ed25519 255 SHA256:EJ3wNAgZiDp63Pm4yoRx9Ny01DilHKzrZJJQIWGLX1g'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$partsDir = 'C:\Users\a.hosseini\Desktop\apk\files\versions\npm-cache-parts'
$repo = 'c:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.1\deploy'

& $plink -batch -ssh -P $port -l $user -pw $pass -hostkey $hk $ip 'rm -f /root/npm-cache.tar.gz /root/npm-cache.part-*'

Get-ChildItem $partsDir -Filter 'part-*' | Sort-Object Name | ForEach-Object {
  Write-Host "Uploading $($_.Name)..."
  & $pscp -batch -P $port -pw $pass -hostkey $hk $_.FullName "${user}@${ip}:/root/$($_.Name)"
  if ($LASTEXITCODE -ne 0) { throw "Upload failed for $($_.Name)" }
}

& $plink -batch -ssh -P $port -l $user -pw $pass -hostkey $hk $ip 'cat /root/part-* > /root/npm-cache.tar.gz; wc -c /root/npm-cache.tar.gz; rm -f /root/part-*; cd /root && tar -xzf npm-cache.tar.gz; test -d /root/npm-cache && echo NPM_CACHE_OK'

foreach ($f in @('remote-build-start.sh')) {
  $src = Join-Path $repo $f
  $content = [IO.File]::ReadAllText($src).Replace("`r`n", "`n")
  [IO.File]::WriteAllText($src, $content)
  & $pscp -batch -P $port -pw $pass -hostkey $hk $src "${user}@${ip}:/root/$f"
}

& $plink -batch -ssh -P $port -l $user -pw $pass -hostkey $hk $ip 'nohup bash /root/remote-build-start.sh > /root/build-start.stdout 2>&1 & echo BUILD_STARTED'
