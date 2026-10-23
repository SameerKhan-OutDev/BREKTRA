param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$runtimePath = Join-Path $appRoot 'runtime\node.exe'
$runtimeState = Join-Path $appRoot '.runtime'
$sha = [System.Security.Cryptography.SHA256]::Create()
try { $workspaceId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($appRoot.Replace('\', '/').ToLowerInvariant())))).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }
$startupMutex = New-Object System.Threading.Mutex($false, "Local\BREKTRA-$workspaceId")
$hasMutex = $false
function Get-BrektraHealth([int]$Port) {
  try { return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 1 }
  catch { return $null }
}
function Test-PortInUse([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $Port); return $true }
  catch { return $false }
  finally { $client.Dispose() }
}
function Save-Instance([int]$Port, [int]$ProcessId) {
  @{ port = $Port; processId = $ProcessId; workspaceId = $workspaceId } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeState 'instance.json') -Encoding UTF8
}
try {
  $hasMutex = $startupMutex.WaitOne(20000)
  if (!$hasMutex) { throw 'Another launch is still in progress. Please try again in a moment.' }
  if (!(Test-Path -LiteralPath $runtimePath) -or !(Test-Path -LiteralPath (Join-Path $appRoot 'server.mjs'))) { throw 'Some app files are missing. Extract the entire ZIP into a normal folder before opening START BREKTRA.' }
  New-Item -Path $runtimeState -ItemType Directory -Force | Out-Null
  $preferredPort = 4310
  $environmentFile = Join-Path $appRoot '.env'
  if (Test-Path -LiteralPath $environmentFile) {
    foreach ($line in Get-Content -LiteralPath $environmentFile) {
      if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') { $preferredPort = [int]$Matches[1] }
    }
  }
  if ($preferredPort -lt 1024 -or $preferredPort -gt 65524) { throw 'PORT in .env must be between 1024 and 65524.' }
  $instanceFile = Join-Path $runtimeState 'instance.json'
  if (Test-Path -LiteralPath $instanceFile) {
    try { $savedInstance = Get-Content -LiteralPath $instanceFile -Raw | ConvertFrom-Json } catch { $savedInstance = $null }
    if ($savedInstance -and $savedInstance.workspaceId -eq $workspaceId) {
      $health = Get-BrektraHealth ([int]$savedInstance.port)
      if ($health -and $health.app -eq 'BREKTRA' -and $health.workspaceId -eq $workspaceId) {
        $url = "http://127.0.0.1:$([int]$savedInstance.port)"
        if (!$NoBrowser) { Start-Process $url }
        Write-Host "BREKTRA is already running: $url"
        exit 0
      }
    }
  }
  $availablePort = 0
  foreach ($candidate in $preferredPort..($preferredPort + 10)) {
    if (!(Test-PortInUse $candidate)) { $availablePort = $candidate; break }
    $health = Get-BrektraHealth $candidate
    if ($health -and $health.app -eq 'BREKTRA' -and $health.workspaceId -eq $workspaceId) {
      Save-Instance $candidate $health.pid
      $url = "http://127.0.0.1:$candidate"
      if (!$NoBrowser) { Start-Process $url }
      Write-Host "BREKTRA is already running: $url"
      exit 0
    }
  }
  if (!$availablePort) { throw 'No free local port is available. Close another BREKTRA copy and try again.' }
  Write-Host 'Starting BREKTRA. Your browser will open in a moment...'
  $env:PORT = [string]$availablePort
  $process = Start-Process -FilePath $runtimePath -ArgumentList @('--no-warnings', 'server.mjs', '--production') -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeState 'server.log') -RedirectStandardError (Join-Path $runtimeState 'error.log')
  Save-Instance $availablePort $process.Id
  $started = $false
  for ($attempt = 0; $attempt -lt 300; $attempt++) {
    $health = Get-BrektraHealth $availablePort
    if ($health -and $health.app -eq 'BREKTRA' -and $health.workspaceId -eq $workspaceId) { $started = $true; break }
    if ($process.HasExited) { break }
    Start-Sleep -Milliseconds 100
  }
  if (!$started) {
    if (!$process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue }
    throw "BREKTRA could not start. See the error log in $runtimeState, or extract a fresh copy of the ZIP."
  }
  $url = "http://127.0.0.1:$availablePort"
  if (!$NoBrowser) { Start-Process $url }
  Write-Host "BREKTRA is ready: $url"
  Write-Host 'Use STOP BREKTRA when you want to close the app completely.'
} catch {
  Write-Host "BREKTRA: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  if ($hasMutex) { $startupMutex.ReleaseMutex() }
  $startupMutex.Dispose()
}
