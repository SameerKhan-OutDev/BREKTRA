$ErrorActionPreference = 'Stop'
try {
  $instanceFile = Join-Path $PSScriptRoot '.runtime\instance.json'
  if (!(Test-Path -LiteralPath $instanceFile)) { Write-Host 'BREKTRA is already stopped.'; exit 0 }
  $instance = Get-Content -LiteralPath $instanceFile -Raw | ConvertFrom-Json
  $expectedRuntime = Join-Path $PSScriptRoot 'runtime\node.exe'
  $runningProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$instance.processId)"
  if ($runningProcess -and $runningProcess.ExecutablePath -eq $expectedRuntime -and $runningProcess.CommandLine -match 'server\.mjs\s+--production') {
    Stop-Process -Id ([int]$instance.processId)
    Write-Host 'BREKTRA is stopped. You can start it again any time.'
  } else { Write-Host 'BREKTRA is already stopped. No other app was closed.' }
  Remove-Item -LiteralPath $instanceFile -ErrorAction SilentlyContinue
} catch { Write-Host "BREKTRA: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
