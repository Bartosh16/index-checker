@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === Index Checker - start ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not available in PATH.
  echo Run install.bat after installing Node.js 22.13 or newer.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not installed or not available in PATH.
  pause
  exit /b 1
)

if not exist node_modules (
  echo node_modules was not found. Running install.bat first...
  call install.bat
  if errorlevel 1 exit /b 1
)

if not exist .env (
  if exist .env.example (
    echo Creating .env from .env.example
    copy .env.example .env >nul
  )
)

if "%PORT%"=="" set PORT=3001
if "%HOST%"=="" set HOST=127.0.0.1
if "%AUTO_OPEN_BROWSER%"=="" set AUTO_OPEN_BROWSER=1
if "%USE_DATABASE%"=="" set USE_DATABASE=0
set "APP_URL=http://%HOST%:%PORT%"

if /I "%USE_DATABASE%"=="1" (
  echo.
  echo Optional database schema sync...
  call npm run db:push
  if errorlevel 1 (
    echo.
    echo WARNING: Database schema sync failed. The app will still start.
    echo.
  )
)

echo Starting Next.js on %APP_URL%
echo Press Ctrl+C to stop.
echo.

if /I "%AUTO_OPEN_BROWSER%"=="1" (
  start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%APP_URL%'; for ($i = 0; $i -lt 120; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($response.StatusCode -ge 200) { Start-Process $url; exit 0 } } catch {} Start-Sleep -Milliseconds 500 }"
)

if exist ".\node_modules\.bin\next.cmd" (
  call ".\node_modules\.bin\next.cmd" dev -H %HOST% -p %PORT%
) else (
  call npm run dev -- -H %HOST% -p %PORT%
)
