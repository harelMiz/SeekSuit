#!/bin/bash
# SeekSuit dev environment startup script
# Usage:
#   ./dev.sh             — start all services (existing Docker images)
#   ./dev.sh --rebuild   — rebuild Docker images before starting (use after code changes)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/Backend"
FRONTEND_DIR="$SCRIPT_DIR/Frontend"
AI_DIR="$SCRIPT_DIR/AIService/background_removal"

REBUILD=false
if [[ "$1" == "--rebuild" || "$1" == "-r" ]]; then
  REBUILD=true
fi

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()    { echo -e "${GREEN}[SeekSuit]${NC} $1"; }
warn()   { echo -e "${YELLOW}[SeekSuit]${NC} $1"; }
error()  { echo -e "${RED}[SeekSuit]${NC} $1"; }
section(){ echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ─── Docker check ─────────────────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  error "Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# ─── Helper: start or restart a Docker container ──────────────────────────────
start_container() {
  local name=$1
  local image=$2
  local port_mapping=$3
  local env_file=$4
  local build_dir=$5

  if $REBUILD; then
    warn "Rebuilding image: $image"
    docker stop "$name" 2>/dev/null || true
    docker rm   "$name" 2>/dev/null || true
    docker build -t "$image" "$build_dir"
  fi

  # If container exists, restart it; otherwise run fresh
  if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
    log "Restarting container: $name"
    docker restart "$name"
  else
    log "Starting new container: $name"
    if [[ -n "$env_file" ]]; then
      docker run -d --name "$name" $port_mapping --env-file "$env_file" "$image"
    else
      docker run -d --name "$name" $port_mapping "$image"
    fi
  fi
}

# ─── Backend ──────────────────────────────────────────────────────────────────
section "Backend (port 5000)"
start_container \
  "seeksuit-backend" \
  "seeksuit-backend" \
  "-p 5000:5000" \
  "$BACKEND_DIR/.env" \
  "$BACKEND_DIR"
log "Backend running → http://localhost:5000"

# ─── AI Service ───────────────────────────────────────────────────────────────
section "AI Service (port 8001)"
start_container \
  "seeksuit-aiservice" \
  "seeksuit-aiservice" \
  "-p 8001:8000" \
  "" \
  "$AI_DIR"
log "AI Service running → http://localhost:8001"

# ─── Frontend ─────────────────────────────────────────────────────────────────
section "Frontend (port 5173)"
log "Starting Vite dev server..."
log "Press Ctrl+C to stop the frontend (Docker services keep running)"
echo ""
cd "$FRONTEND_DIR"
npm run dev
