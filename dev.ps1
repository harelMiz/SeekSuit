# SeekSuit dev environment startup script (PowerShell)
# Usage:
#   .\dev.ps1                      - start all services (existing Docker images)
#   .\dev.ps1 --rebuild            - rebuild all Docker images first
#   .\dev.ps1 --rebuild-backend    - rebuild backend only
#   .\dev.ps1 --rebuild-ai         - rebuild AI service only

param(
    [switch]$rebuild,
    [switch]$r,
    [switch]$rebuildBackend,
    [switch]$rebuildAi
)

$ScriptDir     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir    = Join-Path $ScriptDir "Backend"
$FrontendDir   = Join-Path $ScriptDir "Frontend"
$AiDir         = Join-Path $ScriptDir "AIService"

$doBackend = $rebuild -or $r -or $rebuildBackend
$doAi      = $rebuild -or $r -or $rebuildAi

# ── Docker check ──────────────────────────────────────────────────────────────
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker is not running. Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# ── Backend ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Backend (port 5000) ===" -ForegroundColor Cyan

if ($doBackend) {
    Write-Host "[SeekSuit] Rebuilding backend image..."
    docker rm -f seeksuit-backend *>$null
    docker build -t seeksuit-backend $BackendDir
    if (-not $?) { Write-Host "[ERROR] Backend build failed." -ForegroundColor Red; exit 1 }
}

$backendExists = docker ps -a --filter "name=^seeksuit-backend$" --format "{{.Names}}" 2>$null
if ($doBackend -or -not $backendExists) {
    Write-Host "[SeekSuit] Starting backend container..."
    docker rm -f seeksuit-backend *>$null
    docker run -d --name seeksuit-backend -p 5000:5000 --env-file "$BackendDir\.env" seeksuit-backend
} else {
    Write-Host "[SeekSuit] Restarting backend container..."
    docker restart seeksuit-backend *>$null
}
Write-Host "[SeekSuit] Backend -> http://localhost:5000" -ForegroundColor Green

# ── AI Service ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== AI Service (port 8001) ===" -ForegroundColor Cyan

if ($doAi) {
    Write-Host "[SeekSuit] Rebuilding AI service image (this may take 10-20 minutes)..."
    docker rm -f seeksuit-aiservice *>$null
    docker build -t seeksuit-aiservice $AiDir
    if (-not $?) { Write-Host "[ERROR] AI service build failed." -ForegroundColor Red; exit 1 }
}

$aiExists = docker ps -a --filter "name=^seeksuit-aiservice$" --format "{{.Names}}" 2>$null
if ($doAi -or -not $aiExists) {
    Write-Host "[SeekSuit] Starting AI service container..."
    docker rm -f seeksuit-aiservice *>$null
    docker run -d --name seeksuit-aiservice -p 8001:8000 --env-file "$BackendDir\.env" -v "${AiDir}\finetuned_models:/app/finetuned_models" seeksuit-aiservice
} else {
    Write-Host "[SeekSuit] Restarting AI service container..."
    docker restart seeksuit-aiservice *>$null
}
Write-Host "[SeekSuit] AI Service -> http://localhost:8001" -ForegroundColor Green

# ── Frontend ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Frontend (port 5173) ===" -ForegroundColor Cyan
Write-Host "[SeekSuit] Starting Vite dev server..."
Write-Host "[SeekSuit] Press Ctrl+C to stop the frontend (Docker services keep running)"
Write-Host ""
Set-Location $FrontendDir
npm run dev
