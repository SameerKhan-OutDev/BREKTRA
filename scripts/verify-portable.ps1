param([string]$Archive = (Join-Path (Split-Path $PSScriptRoot -Parent) 'release\BREKTRA-Windows-x64.zip'))
$ErrorActionPreference = 'Stop'
$env:STORAGE_MODE = 'demo'
$env:BREKTRA_USE_ENV = '0'
$env:BREKTRA_HOSTED = '0'
$env:BREKTRA_AUTH = '0'
$env:OLLAMA_URL = 'http://127.0.0.1:1'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivePath = (Resolve-Path -LiteralPath $Archive).Path
$root = Split-Path $PSScriptRoot -Parent
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $files = @($zip.Entries | Where-Object { !$_.FullName.EndsWith('/') })
  $exact = @('server.mjs', 'VERSION.txt', 'README.md', 'ABOUT_BREKTRA.md', 'CHANGELOG.md', '.env.example', 'READ ME FIRST.txt', 'THIRD-PARTY-NOTICES.txt',
    'START BREKTRA.cmd', 'STOP BREKTRA.cmd', 'Run-Brektra.ps1', 'Stop-Brektra.ps1',
    'runtime/node.exe', 'runtime/LICENSE.txt', 'dist/index.html', 'docs/WORKING_NOTES.md',
    'docs/BACKEND_IMPLEMENTATION_PLAN.md', 'docs/IMPLEMENTATION_STATUS.md', 'docs/PERSISTENCE.md',
    'docs/OUTREACH_EXPANSION_PLAN.md', 'docs/HOSTED_SETUP.md', 'docs/UPDATE_0.3.0_IMPLEMENTATION_PLAN.md', 'docs/COMPANY_MIGRATION.md', 'docs/LOCAL_SETUP.md')
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
  $expectedVersion = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
  if ($health.version -ne $expectedVersion -or (Get-Content -LiteralPath (Join-Path $appRoot 'VERSION.txt') -Raw).Trim() -ne $expectedVersion) { throw 'Packaged version mismatch.' }
  foreach ($name in @('README.md', 'ABOUT_BREKTRA.md', 'CHANGELOG.md')) {
    if ((Get-FileHash -LiteralPath (Join-Path $appRoot $name)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $root $name)).Hash) { throw "Packaged document differs: $name" }
  }
  $workspace = Invoke-RestMethod "$url/api/workspace"
  if ($workspace.health.mode -ne 'demo' -or $workspace.state.accounts.Count -ne 1 -or $workspace.state.settings[0].trainingCollection) { throw 'Fresh package did not start with clean demo state.' }
  if ($workspace.state.trainingExamples.Count -ne 0 -or $workspace.state.trainingFeedback.Count -ne 0) { throw 'Package contains captured personal state.' }
  if ($workspace.auth.required -or $workspace.state.members.Count -ne 0 -or $workspace.state.outreachActions.Count -ne 0) { throw 'Package contains configured team/outreach state.' }
  if ($workspace.state.mailboxes[0].provider -ne 'demo' -or $workspace.state.mailboxes[0].sendingEnabled) { throw 'Fresh package has a real or enabled sending mailbox.' }
  if ($workspace.state.companies.Count -ne 0 -or $workspace.state.companyMigrations.Count -ne 0 -or $workspace.state.companyMemberships.Count -ne 0) { throw 'Fresh package contains configured company data.' }
  $setup = Invoke-RestMethod "$url/api/setup"
  if (!$setup.local -or $setup.connected -or $setup.spreadsheetId -or ($setup | ConvertTo-Json -Depth 10) -match 'private_key') { throw 'Packaged setup exposes configuration or is not available in clean local mode.' }
  $html = Invoke-WebRequest $url -UseBasicParsing
  if ($html.StatusCode -ne 200 -or $html.Content -notmatch 'BREKTRA') { throw 'Frontend was not served.' }
  $assets = [regex]::Matches($html.Content, '(?:src|href)="(/assets/[^\"]+)"')
  if (!$assets.Count) { throw 'Built frontend assets are missing.' }
  foreach ($asset in $assets) {
    $assetResponse = Invoke-WebRequest ($url + $asset.Groups[1].Value) -UseBasicParsing
    if ($assetResponse.StatusCode -ne 200) { throw 'Frontend asset failed.' }
    if ($asset.Groups[1].Value.EndsWith('.js') -and $assetResponse.Content -notmatch 'Real workspace setup') { throw 'Guided setup UI is missing from bundled frontend.' }
  }
  foreach ($name in @('WORKING_NOTES.md', 'BACKEND_IMPLEMENTATION_PLAN.md', 'IMPLEMENTATION_STATUS.md', 'PERSISTENCE.md', 'OUTREACH_EXPANSION_PLAN.md', 'HOSTED_SETUP.md', 'UPDATE_0.3.0_IMPLEMENTATION_PLAN.md', 'COMPANY_MIGRATION.md', 'LOCAL_SETUP.md')) {
    $packaged = (Get-FileHash -LiteralPath (Join-Path $appRoot "docs\$name") -Algorithm SHA256).Hash
    $source = (Get-FileHash -LiteralPath (Join-Path $root "docs\$name") -Algorithm SHA256).Hash
    if ($packaged -ne $source) { throw "Packaged document differs: $name" }
  }
  # Exercise the actual bundled feature with disposable in-memory demo state.
  $preview = Invoke-RestMethod "$url/api/settings/company-migration"
  $preparation = @{ name = 'Portable verification company'; fingerprint = $preview.fingerprint; backupConfirmed = $true } | ConvertTo-Json
  $null = Invoke-RestMethod "$url/api/settings/company-migration" -Method Post -ContentType 'application/json' -Body $preparation
  $prepared = Invoke-RestMethod "$url/api/workspace"
  if ($prepared.state.companies.Count -ne 1 -or $prepared.state.companyMigrations.Count -ne 1) { throw 'Bundled company preparation failed.' }
  foreach ($lead in $prepared.state.leads) {
    if ($lead.companyId -ne $prepared.state.companies[0].id) { throw 'Bundled preparation lost lead ownership.' }
  }
  if (@($prepared.state.mailboxes | Where-Object { $_.sendingEnabled }).Count -ne 0) { throw 'Preparation failed to pause mailbox sending.' }
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
  $restarted = Invoke-RestMethod "$url/api/workspace"
  if ($restarted.state.companies.Count -ne 0) { throw 'Demo preparation did not reset after restart.' }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stop
  if ($LASTEXITCODE -ne 0) { throw 'Final packaged stop failed.' }
  $started = $false
  [pscustomobject]@{
    archive = $archivePath
    sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    extraction = $appRoot
    allowlistedFiles = $fileCount
    checks = 'startup, release version, health identity, clean workspace, frontend/assets, document hashes, bundled company preview/apply, repeat-start reuse, shutdown, ownership reacquisition, demo reset, private-file allowlist'
  } | ConvertTo-Json
} finally {
  if ($started) { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stop }
}
