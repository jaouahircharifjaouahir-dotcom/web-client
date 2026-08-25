#Requires -Version 5.1
<#
.SYNOPSIS
  Local GTX translation runner for 11tik (TARGET_LANGUAGES only).
  Invoked by run-translations.bat - does not require Cursor.

.PARAMETER Mode
  preflight | rollout

.PARAMETER MaxRestarts
  Max automatic process restarts after unexpected Node crash (default 5).
#>
param(
  [ValidateSet("preflight", "rollout")]
  [string]$Mode = "preflight",

  [string]$ProjectRoot = "",

  [string]$RunLog = "",

  [string]$ConsoleLog = "",

  [int]$MaxRestarts = 5
)

$ErrorActionPreference = "Stop"

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
  Write-Host $line
  if ($RunLog) {
    Add-Content -Path $RunLog -Value $line -Encoding UTF8
  }
}

function Get-JsonFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  try {
    return Get-Content -Path $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Get-RemainingCount {
  param($Stats, $Checkpoint, $QueueSnap, $PlanSummary)

  if ($Stats -and $null -ne $Stats.PSObject.Properties["remaining"] -and $null -ne $Stats.remaining) {
    return [int]$Stats.remaining
  }
  if ($Checkpoint -and $null -ne $Checkpoint.remaining) {
    return [int]$Checkpoint.remaining
  }
  if ($QueueSnap -and $null -ne $QueueSnap.queued) {
    return [int]$QueueSnap.queued
  }
  if ($PlanSummary -and $null -ne $PlanSummary.queued) {
    return [int]$PlanSummary.queued
  }
  return "?"
}

function Show-Progress {
  param($Stats, $PlanSummary, [datetime]$StartedAt)

  $succeeded = 0 + $Stats.succeeded
  $failed = 0 + $Stats.failed
  $skipped = 0 + $Stats.skippedReady
  $apiCalls = 0 + $Stats.apiCalls
  $ckpt = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-translate-checkpoint.json")
  $queueSnap = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-rollout-queue.json")
  $remaining = Get-RemainingCount -Stats $Stats -Checkpoint $ckpt -QueueSnap $queueSnap -PlanSummary $PlanSummary
  $elapsedSec = [math]::Max(1, ((Get-Date) - $StartedAt).TotalSeconds)
  $done = $succeeded + $failed + $skipped
  $throughput = [math]::Round($apiCalls / $elapsedSec, 3)

  $eta = "n/a"
  if ($throughput -gt 0 -and $remaining -is [int] -and $remaining -gt 0) {
    $etaMin = [math]::Round(($remaining / [math]::Max($throughput, 0.001)) / 60, 1)
    $eta = "${etaMin} min"
  }

  $last = $null
  $currentLocale = $null
  if ($ckpt -and $ckpt.last) {
    $last = "{0}/{1}" -f $ckpt.last.contentId, $ckpt.last.locale
  }
  if ($Stats -and $Stats.currentLocale) { $currentLocale = $Stats.currentLocale }
  elseif ($ckpt -and $ckpt.currentLocale) { $currentLocale = $ckpt.currentLocale }
  elseif ($QueueSnap -and $QueueSnap.currentLocale) { $currentLocale = $QueueSnap.currentLocale }

  Write-Host ("--- progress: done~{0} ok={1} fail={2} skip={3} remaining={4} locale={5} rate={6} job/s ETA~{7} current={8}" -f `
    $done, $succeeded, $failed, $skipped, $remaining, $(if ($currentLocale) { $currentLocale } else { "-" }), $throughput, $eta, $(if ($last) { $last } else { "-" }))
}

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot

if (-not $RunLog) {
  $logDir = Join-Path $ProjectRoot "logs\i18n"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $RunLog = Join-Path $logDir ("run-{0}.log" -f (Get-Date -Format "yyyy-MM-dd-HHmmss"))
}
if (-not $ConsoleLog) {
  $ConsoleLog = Join-Path $ProjectRoot "tmp\i18n-full-rollout-console.log"
}

New-Item -ItemType Directory -Force -Path (Split-Path $RunLog) | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot "tmp") | Out-Null

$env:TRANSLATE_ENABLED = "1"
$env:TRANSLATION_PROVIDER = "chrome_gtx"
if (-not $env:TRANSLATE_CONCURRENCY) { $env:TRANSLATE_CONCURRENCY = "4" }
if (-not $env:TRANSLATE_GTX_CONCURRENCY) { $env:TRANSLATE_GTX_CONCURRENCY = "8" }
if (-not $env:TRANSLATE_RATE_LIMIT_MS) { $env:TRANSLATE_RATE_LIMIT_MS = "80" }
if (-not $env:TRANSLATE_ROLLOUT_MODE) { $env:TRANSLATE_ROLLOUT_MODE = "locale-first" }

# ---------- PREFLIGHT ----------
Write-Log "Preflight starting in $ProjectRoot"

$required = @(
  "package.json",
  "config\target-languages.json",
  "translator\extension\manifest.json",
  "scripts\i18n\full-rollout.mjs",
  "scripts\i18n\translate-pipeline.mjs",
  "scripts\i18n\provider-chrome-gtx.mjs",
  "scripts\i18n\target-languages.mjs",
  "node_modules"
)

foreach ($rel in $required) {
  $p = Join-Path $ProjectRoot $rel
  if (-not (Test-Path $p)) {
    Write-Log "Missing required path: $rel" "ERROR"
    exit 2
  }
  Write-Log "Found $rel"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Log "Node.js not on PATH" "ERROR"
  exit 2
}
Write-Log ("Node.js {0}" -f (& node -v))

# Inspect target languages + plan via existing ESM modules
$preflightJsonPath = Join-Path $ProjectRoot "tmp\i18n-runner-preflight.json"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$preflightExit = 0
try {
  cmd /c "node scripts\i18n\runner-preflight.mjs > tmp\i18n-runner-preflight.stdout 2> tmp\i18n-runner-preflight.stderr"
  $preflightExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $prevEap
}

if ($RunLog) {
  Add-Content -Path $RunLog -Value ("preflight exit={0}" -f $preflightExit) -Encoding UTF8
  if (Test-Path (Join-Path $ProjectRoot "tmp\i18n-runner-preflight.stderr")) {
    Get-Content (Join-Path $ProjectRoot "tmp\i18n-runner-preflight.stderr") -ErrorAction SilentlyContinue |
      Add-Content -Path $RunLog -Encoding UTF8
  }
}

if ($preflightExit -ne 0) {
  Write-Log "Preflight node script failed with exit $preflightExit" "ERROR"
  exit 2
}
if (-not (Test-Path $preflightJsonPath)) {
  Write-Log "Preflight did not write tmp/i18n-runner-preflight.json" "ERROR"
  exit 2
}

try {
  $preflight = Get-Content -Path $preflightJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  Write-Log ("Preflight JSON parse error: {0}" -f $_.Exception.Message) "ERROR"
  exit 2
}

if (-not $preflight.extensionPresent) {
  Write-Log "translator/extension not present" "ERROR"
  exit 2
}
if ($preflight.provider.provider -ne "chrome_gtx") {
  Write-Log "Provider must be chrome_gtx" "ERROR"
  exit 2
}

Write-Log ("TARGET_LANGUAGES={0} (tier1={1} tier2={2})" -f $preflight.targetLanguages, $preflight.tier1, $preflight.tier2)
Write-Log ("Content items={0} theoretical jobs={1}" -f $preflight.contentItems, $preflight.theoreticalJobs)
Write-Log ("Plan: ready={0} queued={1} missing={2} stale={3} failed={4} mode={5} locale={6}" -f `
  $preflight.ready, $preflight.queued, $preflight.missing, $preflight.stale, $preflight.failed, $preflight.rolloutMode, $(if ($preflight.currentLocale) { $preflight.currentLocale } else { "-" }))
Write-Log "Chrome browser NOT required (GTX HTTP API)"
Write-Log "Preflight OK"

if ($Mode -eq "preflight") {
  exit 0
}

# ---------- ROLLOUT ----------
$lockPath = Join-Path $ProjectRoot "tmp\i18n-rollout.lock"
if (Test-Path $lockPath) {
  $lockRaw = Get-Content $lockPath -Raw -ErrorAction SilentlyContinue
  $lockPid = 0
  [void][int]::TryParse(($lockRaw -replace '\s', ''), [ref]$lockPid)
  if ($lockPid -gt 0 -and (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
    Write-Log "Another rollout is already running (PID $lockPid). Exiting." "ERROR"
    exit 2
  }
  Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}
Set-Content -Path $lockPath -Value $PID -Encoding ASCII

Write-Log "Starting rollout: npm run i18n:rollout -- --skip-tests"
Write-Log "Resume-safe: ready+current sourceHash jobs are skipped automatically"
$startedAt = Get-Date
$attempt = 0
$finalExit = 3

try {
while ($attempt -le $MaxRestarts) {
  $attempt++
  Write-Log ("Rollout process attempt {0}/{1}" -f $attempt, ($MaxRestarts + 1))

  $argLine = "npm run i18n:rollout -- --skip-tests"
  $stderrLog = Join-Path $ProjectRoot "tmp\i18n-full-rollout-stderr.log"
  $proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/c", $argLine) `
    -WorkingDirectory $ProjectRoot `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput $ConsoleLog `
    -RedirectStandardError $stderrLog

  # Progress poll while npm runs
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 10
    $stats = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-rollout-stats.json")
    $planFile = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-runner-preflight.json")
    # Live remaining from current queue (also writes tmp/i18n-rollout-queue.json)
    try {
      $snapLine = & node --no-warnings scripts/i18n/runner-queue-snapshot.mjs 2>$null | Select-Object -Last 1
      if ($snapLine) {
        $live = $snapLine | ConvertFrom-Json
        if ($live) { $planFile = $live }
      }
    } catch { }
    if ($stats) {
      Show-Progress -Stats $stats -PlanSummary $planFile -StartedAt $startedAt
    }
  }

  $code = $proc.ExitCode
  Write-Log ("npm rollout exited with code {0}" -f $code)

  # Append console log into run log (tail)
  if (Test-Path $ConsoleLog) {
    Add-Content -Path $RunLog -Value "`n----- console tail -----`n" -Encoding UTF8
    Get-Content $ConsoleLog -Tail 80 -ErrorAction SilentlyContinue | Add-Content -Path $RunLog -Encoding UTF8
  }

  $stats = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-rollout-stats.json")
  $audit = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-full-rollout-audit.json")

  # Re-check remaining queue
  $remaining = $null
  try {
    $snapLine = & node --no-warnings scripts/i18n/runner-queue-snapshot.mjs 2>$null | Select-Object -Last 1
    if ($snapLine) {
      $remaining = ([int](($snapLine | ConvertFrom-Json).queued))
    }
  } catch {
    $remaining = $null
  }

  if ($code -eq 0 -and ($remaining -eq 0 -or $null -eq $remaining)) {
    $finalExit = 0
    break
  }

  if ($code -eq 0 -and $remaining -gt 0) {
    Write-Log ("Rollout exited 0 but {0} jobs remain - will retry" -f $remaining) "WARN"
    if ($attempt -gt $MaxRestarts) {
      $finalExit = 1
      break
    }
    Start-Sleep -Seconds 5
    continue
  }

  # Non-zero exit: translation failures vs crash
  if ($stats -and (0 + $stats.failed) -gt 0 -and $remaining -eq 0) {
    Write-Log ("Completed with {0} failed translation(s)" -f $stats.failed) "ERROR"
    $finalExit = 1
    break
  }

  if ($attempt -gt $MaxRestarts) {
    Write-Log "Max process restarts reached" "ERROR"
    $finalExit = 3
    break
  }

  Write-Log "Unexpected exit - restarting after 10s (checkpoints preserved)" "WARN"
  Start-Sleep -Seconds 10
}

} finally {
  if (Test-Path $lockPath) { Remove-Item $lockPath -Force -ErrorAction SilentlyContinue }
}

$finishedAt = Get-Date
$elapsed = $finishedAt - $startedAt

# Final human-readable report
$stats = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-rollout-stats.json")
$audit = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-full-rollout-audit.json")
$preflight = Get-JsonFile (Join-Path $ProjectRoot "tmp\i18n-runner-preflight.json")

$reportPath = Join-Path $ProjectRoot ("logs\i18n\final-report-{0}.txt" -f (Get-Date -Format "yyyy-MM-dd-HHmmss"))
$report = @"
11tik GTX local rollout - final report
======================================
Started:            $($startedAt.ToString("o"))
Finished:           $($finishedAt.ToString("o"))
Elapsed:            $([math]::Round($elapsed.TotalMinutes, 1)) minutes
Exit code:          $finalExit

Target languages:   $($preflight.targetLanguages)
Content items:      $($preflight.contentItems)
Theoretical jobs:   $($preflight.theoreticalJobs)

Stats (tmp/i18n-rollout-stats.json):
  apiCalls:         $($stats.apiCalls)
  succeeded:        $($stats.succeeded)
  failed:           $($stats.failed)
  skippedReady:     $($stats.skippedReady)
  newlyTranslated:  $($stats.newlyTranslated)
  retries:          $($stats.retries)
  sourceCharacters: $($stats.sourceCharacters)

Audit (tmp/i18n-full-rollout-audit.json):
  finalStatus:      $($audit.finalStatus)
  ready after:      $($audit.after.ready)
  missing after:    $($audit.after.missing)
  failed after:     $($audit.after.failed)
  sitemap locs:     $($audit.sitemap.localizedLocs)
  generated files:  $($audit.generated.present)
  hreflang links:   $($audit.hreflang.linkCount)
  rtl pages:        $($audit.rtl.pages)

Build/generation:   included in full-rollout.mjs (skip-tests)
Provider:           chrome_gtx
Browser required:   false
Cursor required:    false

Logs:
  $RunLog
  $ConsoleLog
  $reportPath
"@

Set-Content -Path $reportPath -Value $report -Encoding UTF8
Write-Host $report
Write-Log ("Final report written: {0}" -f $reportPath)

# Map generation failure if audit says incomplete with no queue clarity
if ($finalExit -eq 0 -and $audit -and $audit.finalStatus -and ($audit.finalStatus -notmatch "COMPLETE")) {
  # Still success if queue empty - status string may lag
  Write-Log ("Audit finalStatus={0}" -f $audit.finalStatus) "WARN"
}

exit $finalExit
