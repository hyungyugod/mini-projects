# 0. cliplogger 업그레이드
### 0-1. .bat 파일 (배치파일)
- 배치파일은 window에서 명령 프롬프트 명령들을 순서대로 자동 실행하게 만드는 스크립트이다.
- @echo off : 명령 에코를 끔. 실행되는 각 명령어가 화면에 찍히지 않게 함(출력 깔끔해짐).
- setlocal : 이 파일 안에서 만든/바꾼 환경변수가 현재 배치 파일 범위 내부로만 한정되도록 함(끝나면 자동 복원됨).
```bat
@echo off
setlocal
```
- ROOT 변수에 배치 파일이 있는 폴더의 부모 폴더 경로를 넣음.
- %~dp0는 “이 .bat 파일이 있는 경로”를 의미, 뒤의 ..로 상위 폴더를 가리킴.
- set EXT=%ROOT%\extension : 크롬 확장 프로그램(압축해제 폴더) 경로를 지정함.
- set APP=%ROOT%\app : 서버 소스가 있는 폴더 경로를 지정함.
- set PROF=%LOCALAPPDATA%\ClipLoggerProfile : 크롬을 띄울 때 쓸 전용 사용자 프로필 폴더 경로를 지정함(기존 기본 프로필과 분리됨).
- set TOOLS=%~dp0tools : 이 배치 파일이 있는 폴더 하위의 tools 경로를 지정함(여기에 exe를 둘 계획).
- set EXE=%TOOLS%\server.exe : 단일 실행파일로 빌드된 서버 exe의 예상 경로를 지정함.
- set PORT=54545 : 서버가 바인딩할 포트 번호를 지정함.
```bat
REM === 경로 설정 ===
set ROOT=%~dp0..
set EXT=%ROOT%\extension
set APP=%ROOT%\app
set PROF=%LOCALAPPDATA%\ClipLoggerProfile
set TOOLS=%~dp0tools
set EXE=%TOOLS%\server.exe
set PORT=54545
```
- set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" : 64비트 프로그램 폴더 기준의 Chrome 실행 파일 경로를 우선 지정함.
- if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" : 위 경로에 크롬이 없으면(존재하지 않으면) 32비트 경로로 대체 설정함(환경별 호환).
- if not exist "%PROF%" mkdir "%PROF%" : 전용 크롬 프로필 폴더가 없으면 생성함.
- if not exist "%TOOLS%" mkdir "%TOOLS%" : tools 폴더가 없으면 생성함
```bat
REM === Chrome 경로(환경 맞춰 수정 가능) ===
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not exist "%PROF%" mkdir "%PROF%"
if not exist "%TOOLS%" mkdir "%TOOLS%"
```
- 분기 실행: server.exe가 있으면 그걸 실행, 없으면 node server.js로 실행함.
- start "ClipLoggerServer": 새 콘솔 창을 띄워 백그라운드 느낌으로 실행함(현재 창은 즉시 다음 단계로 진행).
- /D "...": 해당 디렉터리를 작업 폴더로 지정하고 명령을 실행함.
- cmd /c ...: 명령을 실행하고 끝나면 셸을 닫음.
```bat
REM === 서버 실행: exe가 있으면 exe, 없으면 node
if exist "%EXE%" (
  start "ClipLoggerServer" /D "%TOOLS%" cmd /c server.exe
) else (
  start "ClipLoggerServer" /D "%APP%" cmd /c node server.js
)
```
- 서버가 포트를 바인딩할 시간을 벌어 바로 다음 단계(브라우저 오픈) 실패를 예방함.
- 새 콘솔 제목 “ClipLoggerChrome”으로 크롬 실행.
- ^는 줄바꿈 연속 기호(라인 계속): 읽기 좋게 여러 줄로 명령을 나눔.
- --user-data-dir="%PROF%": 위에서 만든 전용 프로필을 사용해 띄움(기본 프로필과 분리).
- --load-extension="%EXT%": 압축해제된 확장 폴더를 자동으로 로드함(개발자 모드 토글 불필요).
- --disable-default-apps: 기본 앱 비활성화.
- -no-first-run: 첫 실행 마법사/가이드 비활성화.
- -new-window: 새 창으로 열기.
- 마지막 인자 http://127.0.0.1:%PORT%/health: 서버 헬스체크 페이지를 바로 띄움(서버 정상 동작 확인).
```bat
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
```
- echo. : 빈 줄 출력. 가독성 확보용.
- echo [OK] ClipLogger started. : 시작 성공 메시지 출력.
- echo - Server: http://127.0.0.1:%PORT% : 서버 접근 URL을 안내 출력함. 나머지 주소도 안내출력함
- pause : “계속하려면 아무 키나 누르십시오 . . .” 대기. 창이 바로 닫히지 않도록 사용자가 출력 내용을 확인할 시간을 줌.
```bat
echo.
echo [OK] ClipLogger started.
echo - Server: http://127.0.0.1:%PORT%
echo - Profile: %PROF%
echo - Extension: %EXT%
echo - Mode: %EXE% exists? -> 
if exist "%EXE%" (echo EXE) else (echo NODE)
echo.
pause
```

### 0-2. 