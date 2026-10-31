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
  if (!$env:BREKTRA_LAN) { $env:BREKTRA_LAN = '1' }
  if (Test-Path -LiteralPath $environmentFile) {
    foreach ($line in Get-Content -LiteralPath $environmentFile) {
      if ($line -match '^\s*BREKTRA_LAN\s*=\s*([01])\s*$') { $env:BREKTRA_LAN = $Matches[1] }
      if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') { $preferredPort = [int]$Matches[1] }
    }
  }
  if ($preferredPort -lt 1024 -or $preferredPort -gt 65535) { throw 'PORT in .env must be between 1024 and 65535.' }
  $instanceFile = Join-Path $runtimeState 'instance.json'
  if (Test-Path -LiteralPath $instanceFile) {
    try { $savedInstance = Get-Content -LiteralPath $instanceFile -Raw | ConvertFrom-Json } catch { $savedInstance = $null }
    if ($savedInstance -and $savedInstance.workspaceId -eq $workspaceId) {
      $health = Get-BrektraHealth ([int]$savedInstance.port)
      if ($health -and $health.app -eq 'BREKTRA' -and $health.workspaceId -eq $workspaceId) {
        if ([int]$savedInstance.port -ne $preferredPort) { throw "This installation is still running on port $($savedInstance.port). Use STOP BREKTRA, then start again to use the fixed port $preferredPort." }
        $url = "http://127.0.0.1:$([int]$savedInstance.port)"
        if (!$NoBrowser) { Start-Process $url }
        Write-Host "BREKTRA is already running: $url"
        exit 0
      }
    }
  }
  $availablePort = $preferredPort
  if (Test-PortInUse $preferredPort) {
    $health = Get-BrektraHealth $preferredPort
    if ($health -and $health.app -eq 'BREKTRA' -and $health.workspaceId -eq $workspaceId) {
      Save-Instance $preferredPort $health.pid
      $url = "http://127.0.0.1:$preferredPort"
      if (!$NoBrowser) { Start-Process $url }
      Write-Host "BREKTRA is already running: $url"
      exit 0
    }
    if ($health -and $health.app -eq 'BREKTRA') { throw "Another BREKTRA installation is using port $preferredPort. Stop that copy first. This installation has separate accounts and will not open on a different address." }
    throw "Port $preferredPort is in use by another application. Close that application or deliberately set PORT in .env. BREKTRA will not silently change its address."
  }
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
  if ($env:BREKTRA_LAN -eq '1') {
    try {
      $addresses = foreach ($adapter in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($adapter.OperationalStatus -ne [Net.NetworkInformation.OperationalStatus]::Up) { continue }
        $properties = $adapter.GetIPProperties()
        $hasGateway = @($properties.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and $_.Address.ToString() -ne '0.0.0.0' }).Count -gt 0
        foreach ($unicast in $properties.UnicastAddresses) {
          $address = $unicast.Address.ToString()
          if ($unicast.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and $address -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)') {
            [pscustomobject]@{ Address=$address; Gateway=$hasGateway }
          }
        }
      }
      foreach ($entry in $addresses | Sort-Object -Property @{Expression='Gateway';Descending=$true},Address -Unique) {
        Write-Host "Other devices on this network: http://$($entry.Address):$availablePort"
      }
      if (!$addresses) { Write-Host 'No private LAN address was found. Connect WiFi or Ethernet and restart.' }
    } catch { Write-Host 'Sign in and open Settings to view network addresses.' }
    Write-Host 'If another device cannot connect, run ALLOW LAN ACCESS to configure Windows Firewall.'
  }
  Write-Host 'Use STOP BREKTRA when you want to close the app completely.'
} catch {
  Write-Host "BREKTRA: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  if ($hasMutex) { $startupMutex.ReleaseMutex() }
  $startupMutex.Dispose()
}
