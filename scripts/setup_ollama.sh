#!/usr/bin/env bash
set -euo pipefail

# TiendaOS — Install and configure Ollama for local AI
# Requires: NVIDIA GPU with drivers installed (RTX 5070 recommended)
# Usage: bash scripts/setup_ollama.sh

echo "=== Ollama Setup for TiendaOS ==="

# Check NVIDIA GPU
if command -v nvidia-smi &>/dev/null; then
    echo "GPU detected:"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "WARNING: nvidia-smi not found. Ollama will run on CPU (much slower)."
    echo "Install NVIDIA drivers first for GPU acceleration."
fi

# Install Ollama
if command -v ollama &>/dev/null; then
    echo "Ollama already installed: $(ollama --version)"
else
    echo "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Start Ollama service
echo "Starting Ollama..."
ollama serve &>/dev/null &
sleep 3

# Pull recommended model
MODEL="llama3.1:8b"
echo "Pulling $MODEL (this may take a few minutes on first run)..."
ollama pull "$MODEL"

# Verify
echo ""
echo "Testing model..."
RESPONSE=$(ollama run "$MODEL" "Responde en una línea: ¿Cuál es la capital de México?" 2>/dev/null)
echo "  Model response: $RESPONSE"

echo ""
echo "=== Ollama Ready ==="
echo ""
echo "To enable AI in TiendaOS, edit backend/.env:"
echo "  AI_ENABLED=true"
echo "  AI_DEMAND_FORECAST=true"
echo "  AI_INSIGHTS=true"
echo "  AI_SMART_ALERTS=true"
echo "  AI_CUSTOMER_INSIGHTS=true"
echo ""
echo "Then restart the backend."
