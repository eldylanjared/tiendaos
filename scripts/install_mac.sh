#!/bin/bash
# TiendaOS — Instalador para Mac
# Uso: bash install_mac.sh
set -e

REPO_URL="https://github.com/eldylanjared/tiendaos.git"
INSTALL_DIR="$HOME/tiendaos"
PLIST="$HOME/Library/LaunchAgents/com.tiendaos.plist"

echo "======================================"
echo "  TiendaOS — Instalador Mac"
echo "======================================"
echo ""

# Homebrew
if ! command -v brew &>/dev/null; then
  echo "--- Instalando Homebrew ---"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo "Homebrew: OK"
fi

# Dependencies
echo "--- Instalando dependencias ---"
for pkg in python3 node git; do
  if ! command -v $pkg &>/dev/null; then
    brew install $pkg
  else
    echo "  $pkg: OK"
  fi
done

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo ""
  echo "--- Actualizando codigo ---"
  cd "$INSTALL_DIR" && git pull origin master
else
  echo ""
  echo "--- Clonando repositorio ---"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Backend
echo ""
echo "--- Configurando backend ---"
cd "$INSTALL_DIR/backend"
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -q

if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/backend/.env"
  echo ""
  echo "IMPORTANTE: Edita $INSTALL_DIR/backend/.env con los datos de tu tienda."
fi

# Frontend build
echo ""
echo "--- Construyendo frontend ---"
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build

# LaunchAgent (auto-start on login)
echo ""
echo "--- Configurando inicio automatico ---"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.tiendaos</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_DIR/backend/.venv/bin/uvicorn</string>
    <string>app.main:app</string>
    <string>--host</string>
    <string>0.0.0.0</string>
    <string>--port</string>
    <string>8000</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$INSTALL_DIR/backend</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$HOME/Library/Logs/tiendaos.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/Library/Logs/tiendaos.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "======================================"
echo "  Instalacion completa!"
echo "======================================"
echo ""
echo "  Abrir POS: http://localhost:8000"
echo "  Logs:      tail -f ~/Library/Logs/tiendaos.log"
echo ""
echo "  Para actualizar:"
echo "    bash $INSTALL_DIR/scripts/install_mac.sh"
echo ""
