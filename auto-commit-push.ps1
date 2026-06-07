$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$ignoreDirs  = @(".git", ".githooks", ".vscode")
$ignoreFiles = @("auto-commit-push.ps1")

function ShouldIgnorePath {
  param([string]$fullPath)
  foreach ($dir in $ignoreDirs) {
    if ($fullPath -like "*\\$dir\\*") { return $true }
  }
  foreach ($file in $ignoreFiles) {
    if ($fullPath -like "*\\$file") { return $true }
  }
  return $false
}

function ExecuteAutoCommitPush {
  Write-Host ""
  Write-Host "Checking repo status and pushing changes..." -ForegroundColor Cyan
  try {
    git add -A
    $status = git status --porcelain
    if (-not [string]::IsNullOrWhiteSpace($status)) {
      $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
      git commit -m "Auto commit: $timestamp"
      git push origin HEAD
      Write-Host "Auto commit and push completed." -ForegroundColor Green
    } else {
      Write-Host "No unstaged changes found." -ForegroundColor DarkYellow
    }
  } catch {
      Write-Warning "Auto commit/push failed: $_"
  }
}

Add-Type -AssemblyName System.Timers
$script:commitTimer = $null
$timerLock = New-Object Object

function ResetCommitTimer {
  lock ($timerLock) {
    if ($script:commitTimer) {
      $script:commitTimer.Stop()
      $script:commitTimer.Dispose()
    }
    $script:commitTimer = New-Object System.Timers.Timer 1500
    $script:commitTimer.AutoReset = $false
    $script:commitTimer.add_Elapsed({
      $script:commitTimer.Stop()
      $script:commitTimer.Dispose()
      $script:commitTimer = $null
      ExecuteAutoCommitPush
    })
    $script:commitTimer.Start()
  }
}

$watcher = New-Object System.IO.FileSystemWatcher $repoRoot, '*'
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName,DirectoryName,LastWrite,Size'

$onChange = {
  $path = $Event.SourceEventArgs.FullPath
  if (ShouldIgnorePath $path) { return }
  ResetCommitTimer
}

Register-ObjectEvent $watcher Changed -SourceIdentifier AutoCommitPushChanged -Action $onChange | Out-Null
Register-ObjectEvent $watcher Created -SourceIdentifier AutoCommitPushCreated -Action $onChange | Out-Null
Register-ObjectEvent $watcher Deleted -SourceIdentifier AutoCommitPushDeleted -Action $onChange | Out-Null
Register-ObjectEvent $watcher Renamed -SourceIdentifier AutoCommitPushRenamed -Action $onChange | Out-Null

$watcher.EnableRaisingEvents = $true

Write-Host "Auto commit and push watcher is running."
Write-Host "Watching repository changes in: $repoRoot"
Write-Host "Press Enter to stop."
[void][System.Console]::ReadLine()