# Regenerates tracked logo sizes from the gitignored source PNG.
# Usage (from frontend/): powershell -File scripts/regenerate-logo.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'public\logo\new\main logo doocard.png'
if (-not (Test-Path -LiteralPath $source)) {
  throw "Missing source logo: $source"
}
$src = [System.Drawing.Bitmap]::FromFile($source)
function Save-Png([int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $bmp.SetResolution(96, 96)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, 0, 0, $size, $size)
  $path = Join-Path $root "public\logo\$name"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Output $path
}
Save-Png 1024 'doocard-mark-1024.png'
Save-Png 512 'doocard-icon-512.png'
Save-Png 192 'doocard-icon-192.png'
Save-Png 180 'doocard-apple-touch-180.png'
Save-Png 32 'doocard-icon-32.png'
$small = New-Object System.Drawing.Bitmap 32, 32
$g2 = [System.Drawing.Graphics]::FromImage($small)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.Clear([System.Drawing.Color]::Transparent)
$g2.DrawImage($src, 0, 0, 32, 32)
$icon = [System.Drawing.Icon]::FromHandle($small.GetHicon())
$icoPath = Join-Path $root 'public\favicon.ico'
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$g2.Dispose()
$small.Dispose()
$src.Dispose()
Write-Output $icoPath
