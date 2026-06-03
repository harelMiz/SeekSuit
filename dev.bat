@echo off
REM SeekSuit dev environment startup script
REM Usage:
REM   dev.bat                   - start all services (existing Docker images)
REM   dev.bat --rebuild         - rebuild all Docker images
REM   dev.bat --rebuild-backend - rebuild backend only
REM   dev.bat --rebuild-ai      - rebuild AI service only

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%Backend
set FRONTEND_DIR=%SCRIPT_DIR%Frontend
set AI_DIR=%SCRIPT_DIR%AIService

set REBUILD_BACKEND=false
set REBUILD_AI=false

if "%1"=="--rebuild" (
    set REBUILD_BACKEND=true
    set REBUILD_AI=true
)
if "%1"=="-r" (
    set REBUILD_BACKEND=true
    set REBUILD_AI=true
)
if "%1"=="--rebuild-backend" set REBUILD_BACKEND=true
if "%1"=="--rebuild-ai"      set REBUILD_AI=true

REM ─── Docker check ────────────────────────────────────────────────────────────
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

REM ─── Backend ─────────────────────────────────────────────────────────────────
echo.
echo === Backend ^(port 5000^) ===

if "%REBUILD_BACKEND%"=="true" (
    echo [SeekSuit] Rebuilding backend image...
    docker rm -f seeksuit-backend >nul 2>&1
    docker build -t seeksuit-backend "%BACKEND_DIR%"
    if errorlevel 1 ( echo [ERROR] Backend build failed. & exit /b 1 )
)

REM After a rebuild the old container still points to the previous image.
REM Always recreate (rm + run) when we rebuilt; restart-only when image is unchanged.
if "%REBUILD_BACKEND%"=="true" (
    echo [SeekSuit] Recreating backend container from new image...
    docker rm -f seeksuit-backend >nul 2>&1
    docker run -d --name seeksuit-backend -p 5000:5000 --env-file "%BACKEND_DIR%\.env" seeksuit-backend
) else (
    set BACKEND_EXISTS=
    for /f %%i in ('docker ps -a --filter "name=^seeksuit-backend$" --format "{{.Names}}" 2^>nul') do set BACKEND_EXISTS=%%i
    if "!BACKEND_EXISTS!"=="" (
        echo [SeekSuit] Starting new backend container...
        docker run -d --name seeksuit-backend -p 5000:5000 --env-file "%BACKEND_DIR%\.env" seeksuit-backend
    ) else (
        echo [SeekSuit] Restarting backend container...
        docker restart seeksuit-backend
    )
)
echo [SeekSuit] Backend running ^-^> http://localhost:5000

REM ─── AI Service ──────────────────────────────────────────────────────────────
echo.
echo === AI Service ^(port 8001^) ===

if "%REBUILD_AI%"=="true" (
    echo [SeekSuit] Rebuilding AI service image ^(this may take 10-20 minutes^)...
    docker rm -f seeksuit-aiservice >nul 2>&1
    docker build -t seeksuit-aiservice "%AI_DIR%"
    if errorlevel 1 ( echo [ERROR] AI service build failed. & exit /b 1 )
)

if "%REBUILD_AI%"=="true" (
    echo [SeekSuit] Recreating AI service container from new image...
    docker rm -f seeksuit-aiservice >nul 2>&1
    docker run -d --name seeksuit-aiservice -p 8001:8000 --env-file "%BACKEND_DIR%\.env" -v "%AI_DIR%\finetuned_models:/app/finetuned_models" seeksuit-aiservice
) else (
    set AI_EXISTS=
    for /f %%i in ('docker ps -a --filter "name=^seeksuit-aiservice$" --format "{{.Names}}" 2^>nul') do set AI_EXISTS=%%i
    if "!AI_EXISTS!"=="" (
        echo [SeekSuit] Starting new AI service container...
        docker run -d --name seeksuit-aiservice -p 8001:8000 --env-file "%BACKEND_DIR%\.env" -v "%AI_DIR%\finetuned_models:/app/finetuned_models" seeksuit-aiservice
    ) else (
        echo [SeekSuit] Restarting AI service container...
        docker restart seeksuit-aiservice
    )
)
echo [SeekSuit] AI Service running ^-^> http://localhost:8001

REM ─── Frontend ────────────────────────────────────────────────────────────────
echo.
echo === Frontend ^(port 5173^) ===
echo [SeekSuit] Starting Vite dev server...
echo [SeekSuit] Press Ctrl+C to stop the frontend ^(Docker services keep running^)
echo.
cd "%FRONTEND_DIR%"
npm run dev
