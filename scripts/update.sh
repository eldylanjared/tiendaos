#!/bin/bash
# Manual update script — run this on any TiendaOS installation to pull latest code and rebuild.
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== TiendaOS Update ==="
echo "Directorio: $REPO_DIR"
cd "$REPO_DIR"

echo ""
echo "--- Git pull ---"
git pull origin master

echo ""
echo "--- Dependencias backend ---"
cd "$REPO_DIR/backend"
.venv/bin/pip install -r requirements.txt -q && echo "OK"

echo ""
echo "--- Build frontend ---"
cd "$REPO_DIR/frontend"
npm install --silent
npm run build

echo ""
echo "=== Listo. Reinicia el servicio para aplicar cambios del backend ==="
echo "  sudo systemctl restart tiendaos"
