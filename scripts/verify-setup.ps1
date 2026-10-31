param([string]$AppRoot, [string]$Ollama)
$ErrorActionPreference='Stop'
$worker=Join-Path $AppRoot 'Setup-Tasks.ps1'
$context=[hashtable]::Synchronized(@{Root=$AppRoot; Ollama=$Ollama; Cancel=$false; Checked=$false; AIReady=$false; AccountReady=$false; SheetsReady=$false})
function Task([string]$Action,[hashtable]$Data=@{},[bool]$Expected=$true) {
  Write-Output "Verifying setup task: $Action"
  $context.Success=$false; $context.Error=''; $context.Done=$false
  # Use the same async runspace boundary as the UI, including its shared session object.
  $operation=[powershell]::Create()
  try {
    $null=$operation.AddScript([IO.File]::ReadAllText($worker)).AddArgument($Action).AddArgument($Data).AddArgument($context)
    $async=$operation.BeginInvoke()
    $deadline=[DateTime]::UtcNow.AddSeconds(90)
    $lastDetail=''
    while (!$async.IsCompleted) {
      if ($context.Detail -ne $lastDetail) { $lastDetail=$context.Detail; Write-Output $lastDetail }
      if ([DateTime]::UtcNow -gt $deadline) { throw "$Action timed out: $($context.Detail)" }
      Start-Sleep -Milliseconds 100
    }
    $null=$operation.EndInvoke($async)
    if (!$context.Done -or $context.Success -ne $Expected) { throw "$Action unexpected result: $($context.Error) $($operation.Streams.Error)" }
  } finally { $operation.Dispose() }
}
$env:OLLAMA_URL=$Ollama
$env:STORAGE_MODE='demo'; $env:BREKTRA_USE_ENV='0'; $env:BREKTRA_HOSTED='0'; $env:BREKTRA_AUTH='1'; $env:BREKTRA_LAN='0'
try {
  Task 'Check'
  if (!$context.Checked -or $context.Ollama -ne $Ollama) { throw 'Preflight did not preserve the local Ollama endpoint.' }
  $null=Invoke-RestMethod ($Ollama+'/test/reset') -Method Post
  Task 'AI' @{Model='qwen3:1.7b'}
  if (!$context.AIReady -or $context.Model -ne 'qwen3:1.7b') { throw 'Model readiness was not verified.' }
  Task 'AI' @{Model='qwen3:1.7b'}
  if ((Invoke-RestMethod ($Ollama+'/test/status')).pulls -ne 1) { throw 'Installed model was downloaded again.' }
  Task 'AI' @{Model='untrusted-model'} $false
  $null=Invoke-RestMethod ($Ollama+'/test/fail') -Method Post
  Task 'AI' @{Model='qwen3:4b'} $false
  $context.Cancel=$true
  $null=Invoke-RestMethod ($Ollama+'/test/reset') -Method Post
  Task 'AI' @{Model='qwen3:4b'} $false
  $context.Cancel=$false
  Task 'AI' @{Model='qwen3:1.7b'}
  Task 'Start'
  if (!$context.Auth.setupRequired -or !$context.StartedHere) { throw 'Fresh installation owner setup unavailable.' }
  Task 'Account' @{Name='Setup verifier'; Username='setup.verifier'; Email='setup@example.invalid'; Password='Wizard-Verification-Only-2026'}
  if (!$context.AccountReady -or $context.SheetsReady) { throw 'Account/demo readiness wrong.' }
  $setup=Invoke-RestMethod ($context.Url+'/api/setup') -WebSession $context.Session
  if ($setup.ai.model -ne 'qwen3:1.7b') { throw 'Verified model selection was not persisted.' }
  # Existing account path + failed auth cannot grant setup access.
  Task 'Account' @{Email='setup@example.invalid'; Password='Incorrect-Password-2026'} $false
  Task 'Account' @{Email='SETUP.VERIFIER'; Password='Wizard-Verification-Only-2026'}
  $invalid=Join-Path $AppRoot 'invalid-test-key.json'
  '{}' | Set-Content -LiteralPath $invalid
  Task 'CheckSheets' @{Key=$invalid; Sheet='dedicated-test-sheet'} $false
  Remove-Item -LiteralPath $invalid
  $context.Check=@{checkId=('a'*48)}
  Task 'ConnectSheets' @{} $false
  $health=Invoke-RestMethod ($context.Url+'/api/health')
  Task 'Start'
  if ((Invoke-RestMethod ($context.Url+'/api/health')).pid -ne $health.pid) { throw 'Repeated wizard startup failed to reuse its server.' }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppRoot 'Stop-Brektra.ps1')
  Task 'Start'
  if ($context.Auth.setupRequired) { throw 'Wizard owner registration did not persist.' }
  Task 'Account' @{Email='setup.verifier'; Password='Wizard-Verification-Only-2026'}
  $setup=Invoke-RestMethod ($context.Url+'/api/setup') -WebSession $context.Session
  if ($setup.ai.model -ne 'qwen3:1.7b') { throw 'Model selection did not persist after restart.' }
  'Setup worker verification passed: async runspaces, preflight, mock model pull/reuse/failure/cancel/retry, real packaged server startup, owner registration/login, management session, encrypted model persistence, bad-key rejection, stale connection rejection, repeat reuse and restart.'
} finally { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppRoot 'Stop-Brektra.ps1') }
