#Requires -Version 5.1
<#
  Watchdog: every N minutes — monitor progress, auto-fix stale failures, ensure rollout runs until complete.
  Logs: logs/i18n/watchdog-*.log
#>
param(
  [string]$ProjectRoot = "",
  [int]$IntervalMinutes = 5,
  [int]$MaxHours = 24
)

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot

$logDir = Join-Path $ProjectRoot "logs\i18n"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("watchdog-{0}.log" -f (Get-Date -Format "yyyy-MM-dd-HHmmss"))
$lockPath = Join-Path $ProjectRoot "tmp\i18n-watchdog.lock"
$rolloutLock = Join-Path $ProjectRoot "tmp\i18n-rollout.lock"

function Write-Wd([string]$Msg, [string]$Level = "INFO") {
  $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Msg
  Write-Host $line
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

function Test-RolloutRunning {
  if (Test-Path $rolloutLock) {
    $lockPid = 0
    [void][int]::TryParse((Get-Content $rolloutLock -Raw -ErrorAction SilentlyContinue).Trim(), [ref]$lockPid)
    if ($lockPid -gt 0 -and (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
      return $true
    }
  }
  $nodes = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "full-rollout\.mjs" }
  return ($null -ne $nodes -and @($nodes).Count -gt 0)
}

function Start-RolloutIfNeeded {
  if (Test-RolloutRunning) {
    Write-Wd "Rollout already running - skip start"
    return $false
  }
  Write-Wd "Queue not empty but rollout stopped - starting run-translations.bat" "WARN"
  $bat = Join-Path $ProjectRoot "run-translations.bat"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/c", "`"$bat`"") `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Minimized | Out-Null
  Start-Sleep -Seconds 8
  return $true
}

# Single watchdog instance
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot "tmp") | Out-Null
if (Test-Path $lockPath) {
  $wdPid = 0
  [void][int]::TryParse((Get-Content $lockPath -Raw -ErrorAction SilentlyContinue).Trim(), [ref]$wdPid)
  if ($wdPid -gt 0 -and $wdPid -ne $PID -and (Get-Process -Id $wdPid -ErrorAction SilentlyContinue)) {
    Write-Wd "Another watchdog is running (PID $wdPid). Exiting." "ERROR"
    exit 2
  }
  Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}
Set-Content -Path $lockPath -Value $PID -Encoding ASCII

try {
  $deadline = (Get-Date).AddHours($MaxHours)
  Write-Wd "Watchdog started interval=${IntervalMinutes}m maxHours=$MaxHours root=$ProjectRoot"

  while ((Get-Date) -lt $deadline) {
    # 1) Auto-fix stale failed artifacts (known fixed validation rules)
    $fixLine = & node --no-warnings scripts/i18n/rollout-auto-fix.mjs 2>$null | Select-Object -Last 1
    if ($fixLine) {
      try {
        $fix = $fixLine | ConvertFrom-Json
        if ($fix.resetCount -gt 0) {
          Write-Wd ("Auto-fix reset {0} failed artifact(s)" -f $fix.resetCount) "WARN"
        }
        if ($fix.unknownRecentCount -gt 0) {
          Write-Wd ("NEW unfixable failures in last 5m: {0}" -f $fix.unknownRecentCount) "ERROR"
          foreach ($u in $fix.unknownRecent) {
            Write-Wd ("  {0}/{1} errors={2}" -f $u.contentId, $u.locale, ($u.errors -join ";"))
          }
        }
      } catch {
        Write-Wd "Auto-fix output parse failed" "WARN"
      }
    }

    # 2) Monitor snapshot
    $nodeCount = @(Get-Process node -ErrorAction SilentlyContinue).Count
    $line = & node --no-warnings scripts/i18n/rollout-monitor.mjs 2>$null | Select-Object -Last 1
    if ($line) {
      try {
        $r = $line | ConvertFrom-Json
        Write-Wd ("ok={0} remaining={1} locale={2} queued={3} nodes={4} recentFail5m={5} uniqueFailed={6} complete={7}" -f `
          $r.succeeded, $r.remaining, $(if ($r.currentLocale) { $r.currentLocale } else { "-" }), `
          $r.queued, $nodeCount, $r.recentFailures5m, $r.uniqueFailedArtifacts, $r.complete)

        if ($r.recentFailureSamples -and $r.recentFailureSamples.Count -gt 0) {
          foreach ($s in $r.recentFailureSamples) {
            Write-Wd ("  recent fail: {0}/{1} at {2}" -f $s.contentId, $s.locale, $s.at)
          }
        }

        if ($nodeCount -gt 8) {
          Write-Wd "WARN: $nodeCount node processes - possible duplicate rollout instances"
        }

        if ($r.complete) {
          if ($r.uniqueFailedArtifacts -gt 0) {
            Write-Wd ("Queue empty but {0} failed artifacts remain - auto-fix + one more rollout pass" -f $r.uniqueFailedArtifacts) "WARN"
            $fixLine2 = & node --no-warnings scripts/i18n/rollout-auto-fix.mjs 2>$null | Select-Object -Last 1
            if ($fixLine2) {
              $fix2 = $fixLine2 | ConvertFrom-Json
              if ($fix2.resetCount -gt 0) {
                Start-RolloutIfNeeded | Out-Null
                Start-Sleep -Seconds ($IntervalMinutes * 60)
                continue
              }
            }
            Write-Wd "Failed artifacts not auto-fixable - manual review needed" "ERROR"
          } else {
            Write-Wd "Rollout complete - all jobs succeeded."
          }
          break
        }

        if ($r.queued -gt 0 -and -not (Test-RolloutRunning)) {
          Start-RolloutIfNeeded | Out-Null
        }
      } catch {
        Write-Wd "Monitor output parse failed" "WARN"
      }
    } else {
      Write-Wd "Monitor returned no output" "WARN"
    }

    Start-Sleep -Seconds ($IntervalMinutes * 60)
  }

  Write-Wd "Watchdog finished. Log: $logFile"
} finally {
  if (Test-Path $lockPath) { Remove-Item $lockPath -Force -ErrorAction SilentlyContinue }
}
