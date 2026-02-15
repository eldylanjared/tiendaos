#!/usr/bin/env bash
set -euo pipefail

# TiendaOS — Start both backend and frontend
# Usage: bash scripts/start.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Source nvm
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "=== Starting TiendaOS ==="

# Start backend
echo "Starting backend on :8000..."
cd "$ROOT/backend"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 15); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "  Backend ready"
        break
    fi
    sleep 1
done

# Start frontend
echo "Starting frontend on :3000..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== TiendaOS Running ==="
echo "  POS:     http://localhost:3000"
echo "  API:     http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"

# Trap Ctrl+C to kill both
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
