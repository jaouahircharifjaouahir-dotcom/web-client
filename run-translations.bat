@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =============================================================================
REM  11tik autonomous GTX translation runner (Windows)
REM  Double-click or: run-translations.bat
REM  Safe check only: run-translations.bat --check
REM  Does NOT use Cursor. Does NOT commit/push/deploy.
REM =============================================================================

set "EXITCODE=0"
set "MAX_PROCESS_RESTARTS=5"
set "MODE=rollout"

if /I "%~1"=="--check" set "MODE=check"
if /I "%~1"=="/check" set "MODE=check"
if /I "%~1"=="check" set "MODE=check"
if /I "%~1"=="--help" goto :help
if /I "%~1"=="/?" goto :help

REM --- 1) Detect project root (directory of this .bat) ---
cd /d "%~dp0" || (
  echo [ERROR] Cannot cd to project root: %~dp0
  exit /b 2
)
set "PROJECT_ROOT=%CD%"

echo.
echo ============================================================
echo  11tik GTX Translation Runner
echo  Root: %PROJECT_ROOT%
echo  Mode: %MODE%
echo  Started: %DATE% %TIME%
echo ============================================================
echo.

REM --- 2) Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found on PATH.
  echo Install Node.js LTS from https://nodejs.org/ then re-run.
  exit /b 2
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo [OK] Node.js %NODE_VER%

REM --- 3) npm ---
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found on PATH.
  exit /b 2
)
echo [OK] npm available

REM --- 4) Required paths ---
if not exist "%PROJECT_ROOT%\package.json" (
  echo [ERROR] package.json missing — wrong directory?
  exit /b 2
)
if not exist "%PROJECT_ROOT%\translator\extension\manifest.json" (
  echo [ERROR] translator\extension missing — Google Translate extension required.
  exit /b 2
)
echo [OK] translator\extension

if not exist "%PROJECT_ROOT%\config\target-languages.json" (
  echo [ERROR] config\target-languages.json missing.
  exit /b 2
)
echo [OK] config\target-languages.json

if not exist "%PROJECT_ROOT%\scripts\i18n\full-rollout.mjs" (
  echo [ERROR] scripts\i18n\full-rollout.mjs missing.
  exit /b 2
)
echo [OK] scripts\i18n\full-rollout.mjs

if not exist "%PROJECT_ROOT%\scripts\i18n\translate-pipeline.mjs" (
  echo [ERROR] scripts\i18n\translate-pipeline.mjs missing.
  exit /b 2
)
echo [OK] translation pipeline

if not exist "%PROJECT_ROOT%\scripts\i18n\provider-chrome-gtx.mjs" (
  echo [ERROR] provider-chrome-gtx.mjs missing.
  exit /b 2
)
echo [OK] chrome_gtx provider

REM --- 5) Dependencies ---
if not exist "%PROJECT_ROOT%\node_modules\" (
  echo [WARN] node_modules\ missing.
  echo Running: npm install
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 2
  )
)
if not exist "%PROJECT_ROOT%\node_modules\jsdom\" (
  echo [WARN] Expected packages look incomplete. Running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 2
  )
)
echo [OK] node_modules

REM --- 6) Logs ---
if not exist "%PROJECT_ROOT%\logs\i18n\" mkdir "%PROJECT_ROOT%\logs\i18n"
if not exist "%PROJECT_ROOT%\tmp\" mkdir "%PROJECT_ROOT%\tmp"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmmss"') do set "TS=%%i"
set "RUN_LOG=%PROJECT_ROOT%\logs\i18n\run-%TS%.log"
set "CONSOLE_LOG=%PROJECT_ROOT%\tmp\i18n-full-rollout-console.log"

echo [OK] Log file: %RUN_LOG%
echo.

REM --- 7) Environment (no secrets printed) ---
set "TRANSLATE_ENABLED=1"
set "TRANSLATION_PROVIDER=chrome_gtx"
if not defined TRANSLATE_CONCURRENCY set "TRANSLATE_CONCURRENCY=4"
if not defined TRANSLATE_GTX_CONCURRENCY set "TRANSLATE_GTX_CONCURRENCY=8"
if not defined TRANSLATE_RATE_LIMIT_MS set "TRANSLATE_RATE_LIMIT_MS=80"
if not defined TRANSLATE_ROLLOUT_MODE set "TRANSLATE_ROLLOUT_MODE=locale-first"

echo [ENV] TRANSLATE_ENABLED=1
echo [ENV] TRANSLATION_PROVIDER=chrome_gtx
echo [ENV] TRANSLATE_CONCURRENCY=%TRANSLATE_CONCURRENCY%
echo [ENV] TRANSLATE_GTX_CONCURRENCY=%TRANSLATE_GTX_CONCURRENCY%
echo [ENV] TRANSLATE_RATE_LIMIT_MS=%TRANSLATE_RATE_LIMIT_MS%
echo [ENV] TRANSLATE_ROLLOUT_MODE=%TRANSLATE_ROLLOUT_MODE%
echo [NOTE] Chrome browser is NOT required — GTX uses HTTP API via translator\extension.
echo.

REM --- 8) Preflight via PowerShell ---
echo [STEP] Preflight inspect...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\i18n\run-local-rollout.ps1" -Mode preflight -ProjectRoot "%PROJECT_ROOT%" -RunLog "%RUN_LOG%"
if errorlevel 1 (
  echo [ERROR] Preflight failed. See %RUN_LOG%
  exit /b 2
)

if /I "%MODE%"=="check" (
  echo.
  echo [CHECK] Environment OK. Full rollout NOT started.
  echo [CHECK] To run the full workload later, double-click run-translations.bat
  echo.
  exit /b 0
)

REM --- 9) Full rollout via PowerShell wrapper (restart + progress) ---
echo.
echo [STEP] Starting full GTX rollout ^(TARGET_LANGUAGES only^)...
echo [STEP] Safe to stop with Ctrl+C — resume by running this .bat again.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\i18n\run-local-rollout.ps1" -Mode rollout -ProjectRoot "%PROJECT_ROOT%" -RunLog "%RUN_LOG%" -ConsoleLog "%CONSOLE_LOG%" -MaxRestarts %MAX_PROCESS_RESTARTS%
set "EXITCODE=!ERRORLEVEL!"

echo.
echo ============================================================
echo  Finished: %DATE% %TIME%
echo  Exit code: !EXITCODE!
echo  Log: %RUN_LOG%
echo  Stats: %PROJECT_ROOT%\tmp\i18n-rollout-stats.json
echo  Audit: %PROJECT_ROOT%\tmp\i18n-full-rollout-audit.json
echo ============================================================
echo.

if "!EXITCODE!"=="0" (
  echo [OK] Rollout completed successfully.
) else (
  echo [FAIL] Rollout ended with errors. Artifacts and checkpoints preserved.
  echo        Re-run this .bat to resume remaining jobs.
)

exit /b !EXITCODE!

:help
echo.
echo Usage:
echo   run-translations.bat           Run full TARGET_LANGUAGES GTX rollout
echo   run-translations.bat --check   Validate environment only ^(no translation^)
echo.
echo Exit codes:
echo   0 = success
echo   1 = translation failures remain
echo   2 = environment / dependency error
echo   3 = unrecoverable runtime error
echo   4 = build / generation failure
echo.
echo Does NOT require Cursor. Does NOT commit/push/deploy.
echo.
exit /b 0
