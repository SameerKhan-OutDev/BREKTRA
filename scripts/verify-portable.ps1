param([string]$Archive = (Join-Path (Split-Path $PSScriptRoot -Parent) 'release\BREKTRA-Windows-x64.zip'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivePath = (Resolve-Path -LiteralPath $Archive).Path
$root = Split-Path $PSScriptRoot -Parent
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $files = @($zip.Entries | Where-Object { !$_.FullName.EndsWith('/') })
  $exact = @('server.mjs', '.env.example', 'READ ME FIRST.txt', 'THIRD-PARTY-NOTICES.txt',
    'START BREKTRA.cmd', 'STOP BREKTRA.cmd', 'Run-Brektra.ps1', 'Stop-Brektra.ps1',
    'runtime/node.exe', 'runtime/LICENSE.txt', 'dist/index.html', 'docs/WORKING_NOTES.md',
    'docs/BACKEND_IMPLEMENTATION_PLAN.md', 'docs/IMPLEMENTATION_STATUS.md', 'docs/PERSISTENCE.md')
  foreach ($entry in $files) {
    $path = $entry.FullName.Replace('\', '/')
    if (!$path.StartsWith('BREKTRA/')) { throw "Unexpected archive root: $path" }
    $relative = $path.Substring(8)
    if ($relative -notin $exact -and $relative -notmatch '^dist/assets/[A-Za-z0-9_-]+\.(js|css)$') {
      throw "Non-allowlisted file in ZIP: $path"
    }
  }
  foreach ($required in $exact) {
    if (!($files | Where-Object { $_.FullName.Replace('\', '/') -eq "BREKTRA/$required" })) { throw "Missing $required" }
  }
  $fileCount = $files.Count
} finally { $zip.Dispose() }

$verificationRoot = Join-Path ([IO.Path]::GetTempPath()) ('BREKTRA-Verify-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $verificationRoot | Out-Null
& tar.exe -xf $archivePath -C $verificationRoot
if ($LASTEXITCODE -ne 0) { throw 'ZIP extraction failed.' }
$appRoot = Join-Path $verificationRoot 'BREKTRA'
$run = Join-Path $appRoot 'Run-Brektra.ps1'
$stop = Join-Path $appRoot 'Stop-Brektra.ps1'
$started = $false
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $run -NoBrowser
  if ($LASTEXITCODE -ne 0) { throw 'Packaged startup failed.' }
  $started = $true
  $instance = Get-Content -LiteralPath (Join-Path $appRoot '.runtime\instance.json') -Raw | ConvertFrom-Json
  $url = "http://127.0.0.1:$($instance.port)"
  $health = Invoke-RestMethod "$url/api/health"
  if ($health.app -ne 'BREKTRA' -or $health.pid -ne $instance.processId -or $health.workspaceId -ne $instance.workspaceId) { throw 'Packaged identity mismatch.' }
  $workspace = Invoke-RestMethod "$url/api/workspace"
  if ($workspace.health.mode -ne 'demo' -or $workspace.state.accounts.Count -ne 1 -or $workspace.state.settings[0].trainingCollection) { throw 'Fresh package did not start with clean demo state.' }
  if ($workspace.state.trainingExamples.Count -ne 0 -or $workspace.state.trainingFeedback.Count -ne 0) { throw 'Package contains captured personal state.' }
  $html = Invoke-WebRequest $url -UseBasicParsing
  if ($html.StatusCode -ne 200 -or $html.Content -notmatch 'BREKTRA') { throw 'Frontend was not served.' }
  $assets = [regex]::Matches($html.Content, '(?:src|href)="(/assets/[^\"]+)"')
  if (!$assets.Count) { throw 'Built frontend assets are missing.' }
  foreach ($asset in $assets) {
    if ((Invoke-WebRequest ($url + $asset.Groups[1].Value) -UseBasicParsing).StatusCode -ne 200) { throw 'Frontend asset failed.' }
  }
  foreach ($name in @('WORKING_NOTES.md', 'BACKEND_IMPLEMENTATION_PLAN.md', 'IMPLEMENTATION_STATUS.md', 'PERSISTENCE.md')) {
    $packaged = (Get-FileHash -LiteralPath (Join-Path $appRoot "docs\$name") -Algorithm SHA256).Hash
    $source = (Get-FileHash -LiteralPath (Join-Path $root "docs\$name") -Algorithm SHA256).Hash
    if ($packaged -ne $source) { throw "Packaged document differs: $name" }
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $run -NoBrowser
  if ($LASTEXITCODE -ne 0 -or (Invoke-RestMethod "$url/api/health").pid -ne $health.pid) { throw 'Repeated launch did not reuse the process.' }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stop
  if ($LASTEXITCODE -ne 0) { throw 'Packaged shutdown failed.' }
  $started = $false
  Start-Sleep -Milliseconds 500
  $stillRunning = $false
  try { $null = Invoke-RestMethod "$url/api/health" -TimeoutSec 1; $stillRunning = $true } catch {}
  if ($stillRunning) { throw 'Packaged server remained after stop.' }
  # A forced launcher stop must also release the new OS ownership lock.
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $run -NoBrowser
  if ($LASTEXITCODE -ne 0) { throw 'Packaged restart could not reacquire ownership.' }
  $started = $true
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stop
  if ($LASTEXITCODE -ne 0) { throw 'Final packaged stop failed.' }
  $started = $false
  [pscustomobject]@{
    archive = $archivePath
    sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    extraction = $appRoot
    allowlistedFiles = $fileCount
    checks = 'startup, health identity, clean workspace, frontend/assets, document hashes, repeat-start reuse, shutdown, ownership reacquisition, private-file allowlist'
  } | ConvertTo-Json
} finally {
  if ($started) { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stop }
}
