param(
  [ValidateSet("x64", "arm64", "universal")]
  [string]$Arch = "x64"
)

$ErrorActionPreference = "Stop"

$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
if (-not $env:VITE_API_BASE_URL) {
  $env:VITE_API_BASE_URL = "https://niuniu.cylonai.cn"
}

$builderArgs = @("--mac", "dmg", "zip")
switch ($Arch) {
  "x64" { $builderArgs += "--x64" }
  "arm64" { $builderArgs += "--arm64" }
  "universal" { $builderArgs += "--universal" }
}

npx electron-builder @builderArgs
