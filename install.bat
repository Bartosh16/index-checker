@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === Index Checker - install ===
echo.

if exist requirements.txt (
  echo Requirements:
  type requirements.txt
  echo.
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not available in PATH.
  echo Install Node.js 22.13 or newer, then run install.bat again.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not installed or not available in PATH.
  exit /b 1
)

echo Node:
node --version
echo npm:
npm --version
echo.

if not exist package.json (
  echo ERROR: package.json was not found. Run this script from the project folder.
  exit /b 1
)

if not exist .env (
  if exist .env.example (
    echo Creating .env from .env.example
    copy .env.example .env >nul
  )
)

if exist package-lock.json (
  echo Installing npm packages from package-lock.json...
  call npm ci
) else (
  echo Installing npm packages from package.json...
  call npm install
)

if errorlevel 1 (
  echo ERROR: npm dependency installation failed.
  exit /b 1
)

echo.
echo Generating Prisma Client...
call npm run db:generate
if errorlevel 1 (
  echo ERROR: Prisma Client generation failed.
  exit /b 1
)

echo.
choice /C YN /N /M "Start local PostgreSQL with Docker Compose now? [Y/N] "
if errorlevel 2 goto skip_docker

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker CLI was not found. Skipping Docker Compose.
  goto skip_docker
)

docker compose up -d
if errorlevel 1 (
  echo Docker Compose did not start. Open Docker Desktop and run: docker compose up -d
  goto skip_docker
)

:skip_docker
echo.
choice /C YN /N /M "Apply Prisma schema to the database now? Requires working DATABASE_URL. [Y/N] "
if errorlevel 2 goto skip_db_push

call npm run db:push
if errorlevel 1 (
  echo Database schema push failed. Check DATABASE_URL in .env and run: npm run db:push
  goto done
)

:skip_db_push

:done
echo.
echo Install finished.
echo You can configure API keys later from the in-app Settings panel.
echo UI-managed secrets are written to .env.local.
echo Database is optional for the current MVP.
echo Start the app with start.bat
echo.
pause
exit /b 0
