param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,

  [string[]]$ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ExePath)) {
  throw "Executable not found: $ExePath"
}

$source = @'
using System;
using System.Runtime.InteropServices;

public static class WindowSmokeNative {
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsZoomed(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

Add-Type -TypeDefinition $source

function Get-ProcessTree([int]$RootPid) {
  $all = @(Get-CimInstance Win32_Process)
  $ids = New-Object System.Collections.Generic.HashSet[int]
  [void]$ids.Add($RootPid)

  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($process in $all) {
      if ($ids.Contains([int]$process.ParentProcessId) -and -not $ids.Contains([int]$process.ProcessId)) {
        [void]$ids.Add([int]$process.ProcessId)
        $changed = $true
      }
    }
  }

  $all | Where-Object { $ids.Contains([int]$_.ProcessId) }
}

function Wait-ForMainWindow([int]$RootPid, [datetime]$StartedAt) {
  $deadline = (Get-Date).AddSeconds(90)
  do {
    $tree = @(Get-ProcessTree $RootPid)
    $candidateIds = @($tree | ForEach-Object { [int]$_.ProcessId })
    if ($candidateIds.Count -gt 0) {
      $window = Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $candidateIds -contains $_.Id -and $_.MainWindowHandle -ne 0 } |
        Select-Object -First 1
      if ($window) {
        return $window
      }
    }

    $recentWindow = Get-Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.MainWindowHandle -ne 0 -and
        $_.StartTime -gt $StartedAt.AddSeconds(-2) -and
        ($_.ProcessName -like "*electron_niuniu*" -or $_.ProcessName -like "*NiuNiu*" -or $_.MainWindowTitle -like "*牛牛开盘*" -or $_.MainWindowTitle -like "*Review Studio*")
      } |
      Select-Object -First 1
    if ($recentWindow) {
      return $recentWindow
    }

    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  return $null
}

function Wait-ForWindowCondition([IntPtr]$Handle, [string]$Label, [scriptblock]$Predicate) {
  $deadline = (Get-Date).AddSeconds(12)
  do {
    if (& $Predicate) {
      return $true
    }
    Start-Sleep -Milliseconds 200
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Label"
}

$startedAt = Get-Date
$startOptions = @{
  FilePath = $ExePath
  WorkingDirectory = Split-Path -Parent $ExePath
  PassThru = $true
}
if ($ExtraArgs.Count -gt 0) {
  $startOptions.ArgumentList = $ExtraArgs
}
$launcher = Start-Process @startOptions
$windowProcess = $null

try {
  $windowProcess = Wait-ForMainWindow -RootPid $launcher.Id -StartedAt $startedAt
  if (-not $windowProcess) {
    if ($launcher.HasExited) {
      throw "Executable exited before creating a main window. ExitCode=$($launcher.ExitCode)"
    }
    throw "Main window was not created within the timeout."
  }

  $handle = [IntPtr]$windowProcess.MainWindowHandle
  [void][WindowSmokeNative]::SetForegroundWindow($handle)

  if (-not [WindowSmokeNative]::IsWindowVisible($handle)) {
    throw "Main window is not visible."
  }

  [void][WindowSmokeNative]::ShowWindow($handle, 3)
  Wait-ForWindowCondition -Handle $handle -Label "maximized packaged window" -Predicate { [WindowSmokeNative]::IsZoomed($handle) } | Out-Null

  [void][WindowSmokeNative]::ShowWindow($handle, 9)
  Wait-ForWindowCondition -Handle $handle -Label "restored packaged window" -Predicate { -not [WindowSmokeNative]::IsZoomed($handle) -and -not [WindowSmokeNative]::IsIconic($handle) } | Out-Null

  [void][WindowSmokeNative]::ShowWindow($handle, 6)
  Wait-ForWindowCondition -Handle $handle -Label "minimized packaged window" -Predicate { [WindowSmokeNative]::IsIconic($handle) } | Out-Null

  [void][WindowSmokeNative]::ShowWindow($handle, 9)
  Wait-ForWindowCondition -Handle $handle -Label "restored from minimized packaged window" -Predicate { -not [WindowSmokeNative]::IsIconic($handle) } | Out-Null

  [pscustomobject]@{
    exe = (Resolve-Path -LiteralPath $ExePath).Path
    extraArgs = $ExtraArgs
    launcherPid = $launcher.Id
    windowPid = $windowProcess.Id
    title = $windowProcess.MainWindowTitle
    maximized = $true
    minimized = $true
    restored = $true
  } | ConvertTo-Json -Depth 3
} finally {
  $targets = @()
  if ($windowProcess) {
    $targets += @(Get-ProcessTree $windowProcess.Id)
  }
  $targets += @(Get-ProcessTree $launcher.Id)
  $targets |
    Sort-Object ProcessId -Unique |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
