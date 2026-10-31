$ErrorActionPreference = 'Stop'
try {
  $administrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (!$administrator) {
    $elevated = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'))
    exit $elevated.ExitCode
  }
  $runtime = Join-Path $PSScriptRoot 'runtime\node.exe'
  if (!(Test-Path -LiteralPath $runtime)) { throw 'Extract the complete BREKTRA package first.' }
  $port = 4310
  $environmentFile = Join-Path $PSScriptRoot '.env'
  if (Test-Path -LiteralPath $environmentFile) {
    foreach ($line in Get-Content -LiteralPath $environmentFile) {
      if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') { $port = [int]$Matches[1] }
    }
  }
  if ($port -lt 1024 -or $port -gt 65535) { throw 'Invalid BREKTRA port.' }
  $ruleName = 'BREKTRA-LAN-' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($PSScriptRoot)).Replace('=', '')
  $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
  if ($existing) { $existing | Remove-NetFirewallRule }
  New-NetFirewallRule -Name $ruleName -DisplayName 'BREKTRA - trusted LAN devices' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Program $runtime -RemoteAddress LocalSubnet -Profile Any -EdgeTraversalPolicy Block | Out-Null
  'Windows Firewall now allows local-subnet devices to reach this BREKTRA copy.' | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'LAN-ACCESS-RESULT.txt')
} catch {
  Write-Host "BREKTRA LAN access: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
