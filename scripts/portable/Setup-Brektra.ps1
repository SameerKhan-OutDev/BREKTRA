$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Windows.Forms
$script:context = [hashtable]::Synchronized(@{ Root=$PSScriptRoot; Checked=$false; AIReady=$false; AccountReady=$false; SheetsReady=$false; Installing=$false; Cancel=$false; Ollama='http://127.0.0.1:11434'; StartedHere=$false; Finished=$false })
$script:step = 0
$script:operation = $null
$script:async = $null
$script:task = ''
$script:sheetChecked = $false
$script:serviceEmail = ''
# One wizard per installation. Different extracted installations retain separate identities.
$hash = [Security.Cryptography.SHA256]::Create()
try { $id = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($PSScriptRoot.ToLowerInvariant()))).Replace('-','') } finally { $hash.Dispose() }
$mutex = New-Object Threading.Mutex($false, ('Local\BREKTRA-Setup-' + $id))
$locked = $mutex.WaitOne(0)
if (!$locked) { [System.Windows.MessageBox]::Show('Setup is already open for this folder.', 'BREKTRA Setup') | Out-Null; $mutex.Dispose(); exit 0 }
try {
  [xml]$xaml = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Setup.xaml') -Raw -Encoding UTF8
  $script:window = [Windows.Markup.XamlReader]::Load([Xml.XmlNodeReader]::new($xaml))
  $script:ui = @{}
  $manager=[Xml.XmlNamespaceManager]::new($xaml.NameTable)
  $manager.AddNamespace('x','http://schemas.microsoft.com/winfx/2006/xaml')
  foreach ($node in $xaml.SelectNodes('//*[@x:Name]', $manager)) { $ui[$node.GetAttribute('Name','http://schemas.microsoft.com/winfx/2006/xaml')] = $window.FindName($node.GetAttribute('Name','http://schemas.microsoft.com/winfx/2006/xaml')) }
  $ui.Version.Text = 'BREKTRA ' + (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'VERSION.txt') -Raw).Trim() + ' / Windows x64'
  $script:pageNames = @('Welcome','Checks','AI','Account','Google','Review','Complete')
  $script:titles = @('Welcome to your next chapter.','Let us check the essentials.','Bring your local AI to life.','Make it your workspace.','Connect your source of truth.','Ready when you are.','Welcome to BREKTRA.')
  $script:subtitles = @('A guided path from this folder to your first session.','A quick check now makes the next steps smoother.','Private generation, powered by Ollama.','Secure access starts with your BREKTRA account.','Google Sheets keeps your business records in your control.','Review what is ready and what still needs your attention.','Your portable workspace is up and running.')
  $script:labels = @('Welcome','Essentials','Local AI','Your account','Google Sheets','Ready to launch','Complete')
  foreach ($label in $labels[0..5]) {
    $block = [Windows.Controls.TextBlock]::new(); $block.Text = ('{0:00}   {1}' -f ($ui.Steps.Children.Count+1), $label); $block.Margin = '0,0,0,22'; $block.FontSize = 13
    $null = $ui.Steps.Children.Add($block)
  }
  function Status([string]$Text, [bool]$ErrorState=$false) {
    $ui.StatusCard.Visibility = 'Visible'; $ui.StatusText.Text = $Text
    $ui.StatusText.Foreground = if ($ErrorState) { '#ffaaa7' } else { '#a4b9b6' }
  }
  function Render {
    for ($i=0; $i -lt $pageNames.Length; $i++) { $ui[$pageNames[$i]].Visibility = if ($i -eq $step) { 'Visible' } else { 'Collapsed' } }
    for ($i=0; $i -lt $ui.Steps.Children.Count; $i++) { $ui.Steps.Children[$i].Foreground = if ($i -le $step) { '#77e2c3' } else { '#a4b9b6' } }
    $ui.Heading.Text = $titles[$step]; $ui.Subtitle.Text = $subtitles[$step]; $ui.StepLabel.Text = if ($step -eq 6) { 'SETUP COMPLETE' } else { 'STEP ' + ($step+1) + ' / 6' }
    $ui.Back.IsEnabled = ($step -gt 0 -and $step -lt 6 -and !$operation)
    $ui.Next.IsEnabled = !$operation
    $ui.Next.Content = switch ($step) { 0 { "Let's begin  →" }; 1 { if ($context.Checked) {'Next  →'} else {'Check essentials  →'} }; 2 { if ($context.AIReady) {'Next  →'} else {'Install and prepare  →'} }; 3 {'Continue securely  →'}; 4 { if ($context.SheetsReady) {'Next  →'} elseif ($sheetChecked) {'Connect workspace  →'} else {'Check spreadsheet  →'} }; 5 {'Launch BREKTRA  →'}; 6 {'Close setup'} }
    $ui.Scroller.ScrollToTop()
    if ($step -eq 5) {
      $sheet = if ($context.SheetsReady) {'Connected to Google Sheets'} else {'Demo data only - real workspace setup deferred'}
      $ui.ReviewText.Text = "App files and bundled runtime: checked`nLocal AI: $($context.Model), verified installed`nBREKTRA account: signed in`nWorkspace: $sheet`nLinkedIn / Gmail: authorize in Settings if needed"
    }
    if ([Windows.SystemParameters]::ClientAreaAnimation) {
      $fade = [Windows.Media.Animation.DoubleAnimation]::new(0,1,[Windows.Duration]::new([TimeSpan]::FromMilliseconds(230)))
      $ui.Pages.BeginAnimation([Windows.UIElement]::OpacityProperty, $fade)
      $transform = [Windows.Media.TranslateTransform]::new(); $ui.Pages.RenderTransform = $transform
      $slide = [Windows.Media.Animation.DoubleAnimation]::new(16,0,[Windows.Duration]::new([TimeSpan]::FromMilliseconds(230)))
      $slide.EasingFunction = [Windows.Media.Animation.CubicEase]::new()
      $transform.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$slide)
    }
    $null = $ui.Next.Focus()
  }
  function Run([string]$Action, [hashtable]$Data=@{}) {
    if ($operation) { return }
    $context.Done=$false; $context.Success=$false; $context.Error=''; $context.Result=''; $context.Detail='Preparing...'; $context.Percent=-1; $context.Cancel=$false
    $script:task=$Action
    $script:operation = [powershell]::Create()
    $null = $operation.AddScript([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Setup-Tasks.ps1'))).AddArgument($Action).AddArgument($Data).AddArgument($context)
    $script:async = $operation.BeginInvoke()
    $ui.Pages.IsEnabled=$false; $ui.Next.IsEnabled=$false; $ui.Back.IsEnabled=$false
    $ui.CancelDownload.IsEnabled=$true; $ui.CancelDownload.Visibility=if ($Action -eq 'AI') {'Visible'} else {'Collapsed'}
    # Keep the download cancellation button enabled while its page is otherwise locked.
    if ($Action -eq 'AI') { $ui.Pages.IsEnabled=$true; $ui.StandardModel.IsEnabled=$false; $ui.SmallModel.IsEnabled=$false; $ui.OllamaLink.IsEnabled=$false }
    $ui.Progress.Visibility='Visible'; $ui.Progress.IsIndeterminate=$true
    Status 'Preparing...'
  }
  function Enter([int]$Index) {
    $script:step=$Index; $ui.StatusCard.Visibility='Collapsed'; Render
    if ($step -eq 3 -and !$context.Url) { Run 'Start' }
    if ($step -eq 4 -and $context.SheetsReady) { $ui.SheetFields.Visibility='Collapsed'; $ui.GoogleHint.Text='This installation already has a real Sheets workspace. Existing credentials and data are preserved. Use Reconnect & sync inside BREKTRA to check it.'; $ui.SkipGoogle.Visibility='Collapsed' }
  }
  $ui.Next.Add_Click({
    try {
      if ($operation) { return }
      switch ($step) {
        0 { Enter 1 }
        1 { if ($context.Checked) { Enter 2 } else { Run 'Check' } }
        2 { if ($context.AIReady) { Enter 3 } else { Run 'AI' @{Model=$(if ($ui.SmallModel.IsChecked) {'qwen3:1.7b'} else {'qwen3:4b'})} } }
        3 {
          if (!$context.Url) { Run 'Start'; return }
          if (!$ui.OwnerEmail.Text.Trim() -or !$ui.OwnerPassword.Password) { throw 'Enter your email/username and password to continue.' }
          if ($context.Auth.setupRequired -and (!$ui.OwnerName.Text.Trim() -or !$ui.OwnerUsername.Text.Trim() -or $ui.OwnerPassword.Password.Length -lt 12)) { throw 'Enter your name, a username and a password of at least 12 characters.' }
          Run 'Account' @{Name=$ui.OwnerName.Text.Trim(); Username=$ui.OwnerUsername.Text.Trim(); Email=$ui.OwnerEmail.Text.Trim(); Password=$ui.OwnerPassword.Password}
        }
        4 {
          if ($context.SheetsReady) { Enter 5 }
          elseif ($sheetChecked) { Run 'ConnectSheets' }
          else {
            if (!$ui.KeyPath.Text -or !$ui.SheetUrl.Text.Trim()) { throw 'Choose your service-account JSON key and paste the shared spreadsheet URL, or explicitly choose Set up Sheets later.' }
            Run 'CheckSheets' @{Key=$ui.KeyPath.Text; Sheet=$ui.SheetUrl.Text.Trim()}
          }
        }
        5 { Run 'Finish' }
        6 { $window.Close() }
      }
    } catch { Status $_.Exception.Message $true }
  })
  $ui.Back.Add_Click({ if (!$operation -and $step -gt 0) { Enter ($step-1) } })
  $ui.StandardModel.Add_Checked({ if (!$operation) { $context.AIReady=$false; Render } })
  $ui.SmallModel.Add_Checked({ if (!$operation) { $context.AIReady=$false; Render } })
  $ui.CancelDownload.Add_Click({ if (!$context.Installing) { $context.Cancel=$true; $ui.CancelDownload.IsEnabled=$false; Status 'Stopping the download. Please wait for the current network read to finish...' } else { Status 'Installation is finishing. Please wait; an installer cannot be interrupted safely.' } })
  $ui.SkipGoogle.Add_Click({ if (!$operation) { $context.SheetsReady=$false; Enter 5 } })
  $ui.SheetUrl.Add_TextChanged({ $script:sheetChecked=$false; if ($step -eq 4 -and !$operation) { $ui.Next.Content='Check spreadsheet  →' } })
  $ui.ChooseKey.Add_Click({
    try {
      $picker = [Microsoft.Win32.OpenFileDialog]::new(); $picker.Filter='Google service-account JSON (*.json)|*.json'; $picker.Title='Choose your Google service-account key'
      if ($picker.ShowDialog($window)) {
        $file=Get-Item -LiteralPath $picker.FileName
        if ($file.Length -gt 32000) { throw 'Choose a service-account JSON key smaller than 32 KB.' }
        $credential=[IO.File]::ReadAllText($picker.FileName) | ConvertFrom-Json
        if ($credential.type -ne 'service_account' -or !$credential.client_email -or !$credential.private_key) { throw 'Choose a valid Google service-account JSON key.' }
        $ui.KeyPath.Text=$picker.FileName; $script:serviceEmail=[string]$credential.client_email; $ui.ServiceEmail.Text=$serviceEmail
        $script:sheetChecked=$false; Render
      }
    } catch { Status 'Choose a valid Google service-account JSON key smaller than 32 KB. Its private contents are never displayed.' $true }
    finally { $credential=$null }
  })
  $ui.CopyEmail.Add_Click({ if ($serviceEmail) { [Windows.Clipboard]::SetText($serviceEmail); Status 'Service-account email copied. Share your control spreadsheet with this address as Editor.' } })
  $ui.OllamaLink.Add_Click({ Start-Process 'https://ollama.com/download/windows' })
  $ui.SheetsApiLink.Add_Click({ Start-Process 'https://console.cloud.google.com/apis/library/sheets.googleapis.com' })
  $ui.ServiceAccountLink.Add_Click({ Start-Process 'https://console.cloud.google.com/iam-admin/serviceaccounts' })
  $ui.NewSheetLink.Add_Click({ Start-Process 'https://sheets.google.com/create' })
  $script:timer = [Windows.Threading.DispatcherTimer]::new(); $timer.Interval=[TimeSpan]::FromMilliseconds(200)
  $timer.Add_Tick({
    if (!$operation) { return }
    Status $context.Detail
    $ui.Progress.IsIndeterminate=($context.Percent -lt 0)
    if ($context.Percent -ge 0) { $ui.Progress.Value=$context.Percent }
    $ui.CancelDownload.IsEnabled=(!$context.Installing -and !$context.Cancel)
    if (!$async.IsCompleted) { return }
    try { $null=$operation.EndInvoke($async) } catch { $context.Success=$false; $context.Error='Setup could not finish this task. Retry or reopen setup.' }
    $operation.Dispose(); $script:operation=$null; $script:async=$null
    $ui.Pages.IsEnabled=$true; $ui.StandardModel.IsEnabled=$true; $ui.SmallModel.IsEnabled=$true; $ui.OllamaLink.IsEnabled=$true
    $ui.Progress.Visibility='Collapsed'; $ui.CancelDownload.Visibility='Collapsed'
    if ($context.Success) {
      switch ($task) {
        'Start' {
          $ui.NewAccount.Visibility=if ($context.Auth.setupRequired) {'Visible'} else {'Collapsed'}
          $ui.AccountHint.Text=if ($context.Auth.setupRequired) {'Create the owner account for this installation. Registration is saved privately on this PC.'} else {'This installation already has accounts. Sign in with an owner/admin account; existing accounts are preserved.'}
          $ui.EmailLabel.Text=if ($context.Auth.setupRequired) {'Email'} else {'Username or email'}
        }
        'Account' { $ui.OwnerPassword.Clear(); Enter 4 }
        'CheckSheets' { $script:sheetChecked=$true }
        'ConnectSheets' { $script:sheetChecked=$false; Enter 5 }
        'Finish' { $context.Finished=$true; Enter 6 }
      }
      Render; Status $context.Result
    } else {
      if ($task -eq 'ConnectSheets') { $script:sheetChecked=$false }
      Render; Status $context.Error $true
    }
  })
  $window.Add_Closing({ param($sender,$event)
    if ($operation) { $event.Cancel=$true; if (!$context.Installing) { $context.Cancel=$true }; Status 'Please let the current task finish or cancel before closing setup.'; return }
    $timer.Stop()
    $ui.OwnerPassword.Clear()
    if ($context.Session) { $context.Session=$null }
    if ($context.StartedHere -and !$context.Finished) {
      Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $PSScriptRoot 'Stop-Brektra.ps1') + '"')) -WindowStyle Hidden
    }
  })
  $window.Add_ContentRendered({ $null=$ui.Next.Focus() })
  Render; $timer.Start(); $null=$window.ShowDialog()
} catch {
  Write-Output ('BREKTRA Setup: ' + $_.Exception.Message)
  [System.Windows.MessageBox]::Show(('Setup could not open: ' + $_.Exception.Message), 'BREKTRA Setup') | Out-Null
  exit 1
} finally { if ($locked) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
