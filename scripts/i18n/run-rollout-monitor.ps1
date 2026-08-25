#Requires -Version 5.1
<#
  Monitor GTX rollout every N minutes until queue empty or max hours.
  Writes logs/i18n/monitor-*.log and tmp/i18n-rollout-monitor.json
#>
param(
  [string]$ProjectRoot = "",
  [int]$IntervalMinutes = 5,
  [int]$MaxHours = 12
)

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot

$logDir = Join-Path $ProjectRoot "logs\i18n"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("monitor-{0}.log" -f (Get-Date -Format "yyyy-MM-dd-HHmmss"))

function Write-Mon([string]$Msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Msg
  Write-Host $line
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

$deadline = (Get-Date).AddHours($MaxHours)
Write-Mon "Monitor started interval=${IntervalMinutes}m root=$ProjectRoot"

while ((Get-Date) -lt $deadline) {
  $nodeCount = @(Get-Process node -ErrorAction SilentlyContinue).Count
  $line = & node --no-warnings scripts/i18n/rollout-monitor.mjs 2>$null | Select-Object -Last 1
  if ($line) {
    try {
      $r = $line | ConvertFrom-Json
      Write-Mon ("ok={0} failCounter={1} remaining={2} locale={3} queued={4} nodes={5} recentFail5m={6} uniqueFailed={7}" -f `
        $r.succeeded, $r.failedCounter, $r.remaining, $(if ($r.currentLocale) { $r.currentLocale } else { "-" }), `
        $r.queued, $nodeCount, $r.recentFailures5m, $r.uniqueFailedArtifacts)
      if ($r.recentFailureSamples -and $r.recentFailureSamples.Count -gt 0) {
        foreach ($s in $r.recentFailureSamples) {
          Write-Mon ("  recent fail: {0}/{1} at {2}" -f $s.contentId, $s.locale, $s.at)
        }
      }
      if ($r.complete) {
        Write-Mon "Queue empty — rollout complete."
        break
      }
      if ($nodeCount -gt 6) {
        Write-Mon "WARN: $nodeCount node processes — possible duplicate rollout instances"
      }
    } catch {
      Write-Mon "WARN: could not parse monitor output"
    }
  } else {
    Write-Mon "WARN: monitor script returned no output"
  }
  Start-Sleep -Seconds ($IntervalMinutes * 60)
}

Write-Mon "Monitor finished. Log: $logFile"
