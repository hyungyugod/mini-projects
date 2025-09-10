@echo off
setlocal

REM === 경로 설정 ===
set ROOT=%~dp0..
set EXT=%ROOT%\extension
set APP=%ROOT%\app
set PROF=%LOCALAPPDATA%\ClipLoggerProfile
set TOOLS=%~dp0tools
set EXE=%TOOLS%\server.exe
set PORT=54545

REM === Chrome 경로(환경 맞춰 수정 가능) ===
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not exist "%PROF%" mkdir "%PROF%"
if not exist "%TOOLS%" mkdir "%TOOLS%"

REM === 서버 실행: exe가 있으면 exe, 없으면 node
if exist "%EXE%" (
  start "ClipLoggerServer" /D "%TOOLS%" cmd /c server.exe
) else (
  start "ClipLoggerServer" /D "%APP%" cmd /c node server.js
)

REM === 서버 대기 ===
timeout /t 2 >nul

REM === Chrome 실행: 전용 프로필 + 확장 자동 로드 ===
start "ClipLoggerChrome" %CHROME% ^
  --user-data-dir="%PROF%" ^
  --load-extension="%EXT%" ^
  --disable-default-apps ^
  --no-first-run ^
  --new-window ^
  http://127.0.0.1:%PORT%/health

echo.
echo [OK] ClipLogger started.
echo - Server: http://127.0.0.1:%PORT%
echo - Profile: %PROF%
echo - Extension: %EXT%
echo - Mode: %EXE% exists? -> 
if exist "%EXE%" (echo EXE) else (echo NODE)
echo.
pause
