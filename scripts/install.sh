#!/bin/bash
# TiendaOS — Instalador para computadoras de tienda (Ubuntu/Debian)
# Uso: bash install.sh
set -e

REPO_URL="https://github.com/eldylanjared/tiendaos.git"
INSTALL_DIR="/opt/tiendaos"
SERVICE_NAME="tiendaos"

echo "======================================"
echo "  TiendaOS — Instalador de tienda"
echo "======================================"
echo ""

# Check dependencies
echo "--- Verificando dependencias ---"
for cmd in git python3 node npm; do
  if ! command -v $cmd &>/dev/null; then
    echo "Instalando $cmd..."
    apt-get install -y $cmd 2>/dev/null || { echo "ERROR: No se pudo instalar $cmd. Instala manualmente."; exit 1; }
  else
    echo "  $cmd: OK"
  fi
done

# Clone or update repo
if [ -d "$INSTALL_DIR/.git" ]; then
  echo ""
  echo "--- Actualizando codigo existente ---"
  cd "$INSTALL_DIR" && git pull origin master
else
  echo ""
  echo "--- Clonando repositorio ---"
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Backend setup
echo ""
echo "--- Configurando backend ---"
cd "$INSTALL_DIR/backend"
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -q

# Create .env if it doesn't exist
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/backend/.env"
  echo ""
  echo "IMPORTANTE: Edita $INSTALL_DIR/backend/.env con los datos de tu tienda:"
  echo "  IS_LOCAL_INSTANCE=true"
  echo "  STORE_ID=tienda-1"
  echo "  STORE_NAME=Sucursal Centro"
  echo "  CLOUD_API_URL=https://dylanlopez.com/api"
  echo "  CLOUD_SYNC_USER=admin"
  echo "  CLOUD_SYNC_PASSWORD=tu_password"
fi

# Frontend build
echo ""
echo "--- Construyendo frontend ---"
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build

# Systemd service
echo ""
echo "--- Configurando servicio systemd ---"
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=TiendaOS POS
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME

echo ""
echo "======================================"
echo "  Instalacion completa!"
echo "======================================"
echo ""
echo "  Servicio: systemctl status $SERVICE_NAME"
echo "  Abrir POS: http://localhost:8000"
echo ""
echo "  Para actualizar en el futuro:"
echo "    bash $INSTALL_DIR/scripts/update.sh && systemctl restart $SERVICE_NAME"
echo ""
