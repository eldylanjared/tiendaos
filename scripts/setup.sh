#!/usr/bin/env bash
set -euo pipefail

# TiendaOS — First-time setup script
# Run from repo root: bash scripts/setup.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== TiendaOS Setup ==="
echo "Project root: $ROOT"

# --- .env ---
if [ ! -f "$ROOT/backend/.env" ]; then
    echo ""
    echo "[1/4] Creating backend/.env from template..."
    cp "$ROOT/.env.example" "$ROOT/backend/.env"
    # Generate a random secret key
    SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    sed -i "s|change-this-to-a-random-secret-key-at-least-32-chars|$SECRET|" "$ROOT/backend/.env"
    echo "  Created backend/.env with random SECRET_KEY"
    echo "  Edit backend/.env to set STORE_ID, STORE_NAME, and AI flags"
else
    echo "[1/4] backend/.env already exists, skipping"
fi

# --- Python venv ---
echo ""
echo "[2/4] Setting up Python virtual environment..."
if [ ! -d "$ROOT/backend/.venv" ]; then
    python3 -m venv "$ROOT/backend/.venv"
    echo "  Created .venv"
fi
"$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
echo "  Dependencies installed"

# --- Node ---
echo ""
echo "[3/4] Setting up frontend..."
# Source nvm if available
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
    echo "  Node.js not found. Installing via nvm..."
    if ! command -v nvm &>/dev/null; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        . "$NVM_DIR/nvm.sh"
    fi
    nvm install 20
fi

cd "$ROOT/frontend" && npm install --silent
echo "  Frontend dependencies installed"

# --- Database ---
echo ""
echo "[4/4] Initializing database..."
mkdir -p "$ROOT/backend/data"
cd "$ROOT/backend"
.venv/bin/python -c "
from app.database import init_db
from app.main import seed_initial_data
init_db()
seed_initial_data()
print('  Database created with default admin user')
print('  Login: admin / admin123  |  PIN: 0000')
"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Start the backend:"
echo "  cd $ROOT/backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "Start the frontend (in another terminal):"
echo "  cd $ROOT/frontend && npm run dev"
echo ""
echo "Open http://localhost:3000 in your browser"
echo ""
echo "To enable AI features:"
echo "  1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh"
echo "  2. Pull a model:   ollama pull llama3.1:8b"
echo "  3. Edit backend/.env: set AI_ENABLED=true and enable desired AI_* modules"
