@echo off
setlocal

set ROOT=%~dp0..
set APP=%ROOT%\app
set PID_FILE=%APP%\cliplogger.pid
set PORT=54545

echo Stopping Chrome(our profile) and Server...

REM === 서버 종료 요청 ===
curl -s -X POST http://127.0.0.1:%PORT%/__shutdown >nul 2>&1

REM === PID 강제종료(백업) ===
if exist "%PID_FILE%" (
  for /f "usebackq tokens=*" %%p in ("%PID_FILE%") do set S_PID=%%p
  if defined S_PID (
    taskkill /PID %S_PID% /T /F >nul 2>&1
    del "%PID_FILE%" >nul 2>&1
  )
)

REM === 전용 프로필 Chrome만 종료 ===
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -match 'ClipLoggerProfile' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo Done.
pause
