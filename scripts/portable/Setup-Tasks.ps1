param([string]$Action, [hashtable]$Data, [hashtable]$Context)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = $Context.Root
function Progress([string]$Text, [double]$Percent = -1) { $Context.Detail = $Text; $Context.Percent = $Percent }
function Request([string]$Path, [string]$Method = 'GET', $Body = $null) {
  $options = @{ Uri = ($Context.Url + '/api/' + $Path); Method = $Method; TimeoutSec = 60; WebSession = $Context.Session }
  if ($null -ne $Body) { $options.ContentType = 'application/json'; $options.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 12 -Compress)) }
  try { Invoke-RestMethod @options } catch {
    # Show only the server's public error, never a request body/key/password.
    $message = 'The request failed. Check the connection and try again.'
    try {
      $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
      if ($errorBody.error -is [string]) { $message = $errorBody.error }
    } catch {}
    throw $message
  }
}
function Find-Ollama {
  $directories = @((Join-Path $env:LOCALAPPDATA 'Programs\Ollama'), (Join-Path $env:ProgramFiles 'Ollama')) + @($env:PATH.Split(';'))
  foreach ($directory in $directories) {
    $directory = $directory.Trim().Trim('"')
    if ([IO.Path]::IsPathRooted($directory)) {
      $candidate = Join-Path $directory 'ollama.exe'
      if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
  }
}
function Ollama-Tags {
  try { return Invoke-RestMethod ($Context.Ollama + '/api/tags') -TimeoutSec 3 } catch { return $null }
}
try {
  switch ($Action) {
    'Check' {
      Progress 'Checking Windows, bundled runtime and release files...'
      # .NET Framework OSVersion is compatibility-shimmed for an unmanifested host.
      # The Windows build registry value reflects Windows 10/11 accurately.
      $windows = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
      $windowsBuild = 0
      if (![int]::TryParse([string]$windows.CurrentBuildNumber, [ref]$windowsBuild)) { throw 'Windows build could not be detected. Check that Windows system information is accessible, then retry.' }
      if (![Environment]::Is64BitOperatingSystem -or $windowsBuild -lt 19045) { throw "Windows 10 22H2 or newer (64-bit) is required. Detected Windows build: $windowsBuild." }
      foreach ($file in @('runtime\node.exe','server.mjs','dist\index.html','Run-Brektra.ps1','Stop-Brektra.ps1','VERSION.txt')) {
        if (!(Test-Path -LiteralPath (Join-Path $root $file))) { throw "Missing $file. Extract the complete ZIP into a normal folder, then reopen setup." }
      }
      $probe = Join-Path $root ('.setup-write-' + [guid]::NewGuid().ToString('N'))
      try { [IO.File]::WriteAllText($probe, 'test') } finally { if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe } }
      $nodeVersion = & (Join-Path $root 'runtime\node.exe') --version
      if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw 'The bundled Node runtime failed its check. Extract a fresh release.' }
      $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($env:LOCALAPPDATA))
      if ($drive.AvailableFreeSpace -lt 8GB) { throw 'Free at least 8 GB on your Windows user drive for Ollama and a model, then retry.' }
      $ollama = if ($env:OLLAMA_URL) { $env:OLLAMA_URL } else { 'http://127.0.0.1:11434' }
      $environment = Join-Path $root '.env'
      if (Test-Path -LiteralPath $environment) {
        foreach ($line in Get-Content -LiteralPath $environment) {
          if ($line -match '^\s*OLLAMA_URL\s*=\s*(.*?)\s*$') { $ollama = $Matches[1].Trim().Trim('"').Trim("'") }
        }
      }
      $origin = [uri]$ollama
      if ($origin.Scheme -ne 'http' -or $origin.Host -notin @('localhost','127.0.0.1','[::1]') -or $origin.UserInfo) { throw 'OLLAMA_URL must be a local HTTP address. Correct your installation configuration and retry.' }
      $Context.Ollama = $origin.GetLeftPart([UriPartial]::Authority)
      $Context.Checked = $true
      $Context.Result = "Windows build $windowsBuild and portable files checked. Node $nodeVersion is included. $([math]::Round($drive.AvailableFreeSpace / 1GB)) GB free on the user drive."
    }
    'AI' {
      if ($Data.Model -notin @('qwen3:4b','qwen3:1.7b')) { throw 'Choose a supported model.' }
      $tags = Ollama-Tags
      if (!$tags) {
        $executable = Find-Ollama
        if (!$executable) {
          Progress 'Downloading the official Ollama installer. This may take several minutes...'
          $folder = Join-Path ([IO.Path]::GetTempPath()) ('BREKTRA-Setup-' + [guid]::NewGuid().ToString('N'))
          New-Item -ItemType Directory -Path $folder | Out-Null
          $installer = Join-Path $folder 'OllamaSetup.exe'
          try {
            # Only the official HTTPS download; never accept executable URLs from UI input.
            $client = [Net.WebClient]::new()
            try {
              $transfer = $client.DownloadFileTaskAsync([uri]'https://ollama.com/download/OllamaSetup.exe', $installer)
              $deadline = [DateTime]::UtcNow.AddMinutes(30)
              while (!$transfer.IsCompleted) {
                if ($Context.Cancel -or [DateTime]::UtcNow -gt $deadline) { $client.CancelAsync(); throw 'Download stopped. Use Next to retry when ready.' }
                if (Test-Path -LiteralPath $installer) { Progress ("Downloading Ollama: {0:N0} MB received..." -f ((Get-Item -LiteralPath $installer).Length / 1MB)) }
                Start-Sleep -Milliseconds 300
              }
              $transfer.GetAwaiter().GetResult()
            } finally { $client.Dispose() }
            Progress 'Verifying the installer publisher...'
            $signature = Get-AuthenticodeSignature -LiteralPath $installer
            if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(?i)(?:^|,\s*)O=\s*"?Ollama(?:,? Inc\.?)?"?(?:,|$)') {
              throw 'The Ollama publisher signature could not be verified. Use the official download button to install it yourself, then retry. No unverified installer was run.'
            }
            if ($Context.Cancel) { throw 'Download stopped. Use Next to retry when ready.' }
            $Context.Installing = $true
            Progress 'Installing Ollama for your Windows user. Please wait for installation to finish...'
            try {
              $installerProcess = Start-Process -FilePath $installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-') -WindowStyle Hidden -PassThru
              $installerProcess.WaitForExit()
              if ($installerProcess.ExitCode -notin @(0,3010)) { throw 'Ollama installation did not complete. Use the official download button, finish installation, then retry.' }
            } finally { $Context.Installing = $false }
          } finally {
            # This directory is generated locally and contains only this attempt's installer.
            if (Test-Path -LiteralPath $installer) { Remove-Item -LiteralPath $installer -Force }
            if (Test-Path -LiteralPath $folder) { Remove-Item -LiteralPath $folder }
          }
          $executable = Find-Ollama
        }
        if (!$executable) { throw 'Ollama was not found. Finish installing it using the official download button, then retry.' }
        Progress 'Starting the local AI service...'
        if (!(Ollama-Tags)) {
          $oldHost = $env:OLLAMA_HOST
          try {
            $env:OLLAMA_HOST = ([uri]$Context.Ollama).Authority
            Start-Process -FilePath $executable -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
          } finally { $env:OLLAMA_HOST = $oldHost }
        }
        for ($i = 0; $i -lt 80; $i++) { $tags = Ollama-Tags; if ($tags) { break }; Start-Sleep -Milliseconds 500 }
        if (!$tags) { throw 'Ollama did not respond. Open Ollama from the Start menu, then retry.' }
      }
      $model = $Data.Model
      if ($model -notin @($tags.models | ForEach-Object { $_.name })) {
        Progress "Downloading $model. You can cancel and resume by choosing Next again."
        $request = [Net.HttpWebRequest]::Create($Context.Ollama + '/api/pull')
        $request.Method = 'POST'; $request.ContentType = 'application/json'; $request.Timeout = 30000; $request.ReadWriteTimeout = 30000
        $bytes = [Text.Encoding]::UTF8.GetBytes((@{ model=$model; stream=$true } | ConvertTo-Json -Compress))
        $request.ContentLength = $bytes.Length
        $stream = $request.GetRequestStream()
        try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
        $response = $request.GetResponse()
        $reader = [IO.StreamReader]::new($response.GetResponseStream())
        $success = $false
        $deadline = [DateTime]::UtcNow.AddHours(2)
        try {
          while (!$reader.EndOfStream) {
            if ($Context.Cancel -or [DateTime]::UtcNow -gt $deadline) { $request.Abort(); throw 'Model download stopped. Use Next to resume.' }
            $event = $reader.ReadLine() | ConvertFrom-Json
            if ($event.error) { throw 'Ollama could not download the model. Check internet access and disk space, then retry.' }
            $percent = -1
            if ($event.total -gt 0) { $percent = [math]::Min(100, (100.0 * $event.completed / $event.total)) }
            Progress ("{0}: {1}" -f $model, $event.status) $percent
            if ($event.status -eq 'success') { $success = $true }
          }
        } finally { $reader.Dispose(); $response.Dispose(); $request.Abort() }
        if (!$success) { throw 'Ollama did not confirm a complete download. Use Next to retry.' }
      }
      if ($model -notin @((Ollama-Tags).models | ForEach-Object { $_.name })) { throw 'The model is not listed as installed. Retry the download.' }
      $Context.Model = $model
      $Context.AIReady = $true
      $Context.Result = "$model is installed and Ollama is responding. Model performance depends on your PC."
    }
    'Start' {
      Progress 'Starting this BREKTRA installation in the background...'
      $previousPid = 0
      $instanceFile = Join-Path $root '.runtime\instance.json'
      if (Test-Path -LiteralPath $instanceFile) {
        try {
          $previous = Get-Content -LiteralPath $instanceFile -Raw | ConvertFrom-Json
          $priorHealth = Invoke-RestMethod "http://127.0.0.1:$($previous.port)/api/health" -TimeoutSec 2
          if ($priorHealth.app -eq 'BREKTRA' -and $priorHealth.workspaceId -eq $previous.workspaceId) { $previousPid = $priorHealth.pid }
        } catch {}
      }
      $runtimeState = Join-Path $root '.runtime'
      $null = New-Item -ItemType Directory -Path $runtimeState -Force
      $launcher = Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $root 'Run-Brektra.ps1') + '"'),'-NoBrowser') -WindowStyle Hidden -PassThru
      if (!$launcher.WaitForExit(60000)) { $launcher.Kill(); throw 'BREKTRA startup timed out. Check this installation with START BREKTRA, then retry.' }
      $launcher.Refresh()
      if ($null -ne $launcher.ExitCode -and $launcher.ExitCode -ne 0) { throw 'BREKTRA could not start. Stop any older BREKTRA installation first and check that the configured port is free. START BREKTRA can show startup details.' }
      Progress 'Verifying the local BREKTRA session...'
      $instance = Get-Content -LiteralPath (Join-Path $root '.runtime\instance.json') -Raw | ConvertFrom-Json
      $Context.Url = "http://127.0.0.1:$($instance.port)"
      $Context.Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
      Progress 'Checking the running app identity...'
      $health = Request 'health'
      if ($health.app -ne 'BREKTRA' -or $health.workspaceId -ne $instance.workspaceId) { throw 'The running installation could not be verified.' }
      if ($previousPid -ne $health.pid) { $Context.StartedHere = $true }
      Progress 'Checking account setup status...'
      $Context.Auth = Request 'auth/status'
      $Context.Result = 'This installation is ready for your account.'
    }
    'Account' {
      Progress 'Securing your local setup session...'
      $status = Request 'auth/status'
      if ($status.setupRequired) {
        $null = Request 'auth/register' 'POST' @{ name=$Data.Name; email=$Data.Email; username=$Data.Username; password=$Data.Password }
      }
      $null = Request 'auth/login' 'POST' @{ identifier=$Data.Email; password=$Data.Password }
      $setup = Request 'setup'
      if (!$setup.local) { throw 'This installation is operator-managed. Complete its configuration with your administrator.' }
      if ($Context.AIReady) {
        Progress 'Saving your verified model selection...'
        $null = Request 'setup/ollama/model' 'POST' @{ model=$Context.Model }
      }
      $Context.SheetsReady = $setup.connected
      $Context.AccountReady = $true
      $Context.Result = 'Signed in. Your model selection is saved privately in this installation.'
    }
    'CheckSheets' {
      Progress 'Reading the selected spreadsheet and checking permissions...'
      $keyFile = Get-Item -LiteralPath $Data.Key
      if ($keyFile.Length -gt 32000) { throw 'Choose a Google service-account JSON key smaller than 32 KB.' }
      $key = [IO.File]::ReadAllText($keyFile.FullName)
      $Context.Check = Request 'setup/sheets/check' 'POST' @{ spreadsheet=$Data.Sheet; credentialFile=$key }
      $Context.Result = "Access verified. $($Context.Check.missingTabs) control tabs will be prepared; existing records are retained. Click Next to connect this workspace. Demo data will not be copied. Campaigns and mailbox sending will be paused."
    }
    'ConnectSheets' {
      Progress 'Preparing control tabs and saving the encrypted connection...'
      $null = Request 'setup/sheets/connect' 'POST' @{ checkId=$Context.Check.checkId; confirmed=$true }
      $Context.SheetsReady = (Request 'setup').connected
      if (!$Context.SheetsReady) { throw 'The workspace did not report a saved connection. Check it again.' }
      $Context.Result = 'Google Sheets is connected. Your credentials stay encrypted on this PC.'
    }
    'Finish' {
      Progress 'Checking BREKTRA before opening your workspace...'
      $health = Request 'health'
      if ($health.app -ne 'BREKTRA') { throw 'BREKTRA is not responding. Go Back and retry setup.' }
      if ($Context.AIReady) {
        if ($Context.Model -notin @((Ollama-Tags).models | ForEach-Object { $_.name })) { throw 'Your AI service/model is no longer available. Go Back to Local AI and retry.' }
      }
      if ($Context.AccountReady) {
        $setup = Request 'setup'
        if ($Context.AIReady -and $setup.ai.model -ne $Context.Model) { throw 'The selected AI model changed. Go Back and sign in again to save your selection.' }
        if ($Context.SheetsReady -and !$setup.connected) { throw 'The workspace connection is no longer active. Go Back and reconnect.' }
      }
      Start-Process ($Context.Url + '/#settings')
      $Context.Result = 'BREKTRA is open in your browser. Sign in using your account. Keep this PC awake while it runs.'
    }
    default { throw 'Unknown setup task.' }
  }
  $Context.Success = $true
} catch {
  $Context.Success = $false
  $Context.Error = $_.Exception.Message
} finally { $Context.Done = $true }
