param(
  [string]$BuildDir = (Join-Path $PSScriptRoot "..\build"),
  [string]$SourceIcon = (Join-Path $PSScriptRoot "..\src\assets\brand\niuniu-client-icon.png")
)

Add-Type -AssemblyName System.Drawing

$resolvedBuildDir = [System.IO.Path]::GetFullPath($BuildDir)
$resolvedSourceIcon = [System.IO.Path]::GetFullPath($SourceIcon)
if (-not (Test-Path -LiteralPath $resolvedSourceIcon)) {
  throw "NiuNiu source icon not found: $resolvedSourceIcon"
}
if (-not (Test-Path -LiteralPath $resolvedBuildDir)) {
  New-Item -ItemType Directory -Path $resolvedBuildDir | Out-Null
}

function New-NiuNiuIcon([int]$size, [string]$path, [System.Drawing.Image]$source) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $sourceSide = [Math]::Min($source.Width, $source.Height)
  $sourceX = [Math]::Floor(($source.Width - $sourceSide) / 2)
  $sourceY = [Math]::Floor(($source.Height - $sourceSide) / 2)
  $sourceRect = [System.Drawing.Rectangle]::new($sourceX, $sourceY, $sourceSide, $sourceSide)
  $targetRect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
  $g.DrawImage($source, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$source = [System.Drawing.Image]::FromFile($resolvedSourceIcon)
try {
  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  foreach ($size in $sizes) {
    New-NiuNiuIcon $size (Join-Path $resolvedBuildDir "icon-$size.png") $source
  }
  Copy-Item -LiteralPath (Join-Path $resolvedBuildDir "icon-256.png") -Destination (Join-Path $resolvedBuildDir "icon.png") -Force
} finally {
  $source.Dispose()
}

Write-Host "Generated NiuNiu icon PNG assets from $resolvedSourceIcon in $resolvedBuildDir"
