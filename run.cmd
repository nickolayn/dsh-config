@echo off
rem Runs sync/verify/setup without loading .ps1 as a file, so it works even when
rem ExecutionPolicy forbids running scripts (Restricted / corporate GPO).
rem Usage:  run.cmd pull ^| push ^| status ^| verify ^| setup
setlocal
cd /d "%~dp0"

set "CMD=%~1"
if "%CMD%"=="" set "CMD=status"

if /i "%CMD%"=="verify" goto verify
if /i "%CMD%"=="setup" goto setup

powershell -NoProfile -Command "& ([scriptblock]::Create((Get-Content -Raw -LiteralPath '.\\sync.ps1'))) '%CMD%'"
exit /b %ERRORLEVEL%

:verify
powershell -NoProfile -Command "& ([scriptblock]::Create((Get-Content -Raw -LiteralPath '.\\verify.ps1')))"
exit /b %ERRORLEVEL%

:setup
powershell -NoProfile -Command "& ([scriptblock]::Create((Get-Content -Raw -LiteralPath '.\\bootstrap.ps1'))) -CreateProfile"
exit /b %ERRORLEVEL%
