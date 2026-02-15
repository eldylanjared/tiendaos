#!/usr/bin/env bash
set -euo pipefail

# TiendaOS — Seed sample products for development/testing
# Requires: backend running on localhost:8000
# Usage: bash scripts/seed_products.sh

API="http://localhost:8000/api"

echo "=== Seeding TiendaOS with sample products ==="

# Login
TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
AUTH="Authorization: Bearer $TOKEN"
echo "Logged in as admin"

# Categories
echo "Creating categories..."
for cat in \
  '{"name":"Bebidas","color":"#EF4444"}' \
  '{"name":"Botanas","color":"#F59E0B"}' \
  '{"name":"Panadería","color":"#A855F7"}' \
  '{"name":"Lácteos","color":"#3B82F6"}' \
  '{"name":"Limpieza","color":"#10B981"}' \
  '{"name":"Dulces","color":"#EC4899"}'; do
  curl -sf -X POST "$API/products/categories" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "$cat" > /dev/null 2>&1 && echo "  + $(echo "$cat" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")" || true
done

# Products — common Mexican convenience store items
echo "Creating products..."
PRODUCTS=(
  # Bebidas
  '{"barcode":"7501055303182","name":"Coca-Cola 600ml","price":18.50,"cost":12.00,"stock":120,"min_stock":20}'
  '{"barcode":"7501055363070","name":"Coca-Cola 2L","price":35.00,"cost":24.00,"stock":40,"min_stock":10}'
  '{"barcode":"7501031311309","name":"Agua Ciel 600ml","price":12.00,"cost":6.50,"stock":200,"min_stock":30}'
  '{"barcode":"7501086801305","name":"Pepsi 600ml","price":17.50,"cost":11.50,"stock":80,"min_stock":15}'
  '{"barcode":"7501055326105","name":"Fanta Naranja 600ml","price":17.00,"cost":11.00,"stock":60,"min_stock":10}'
  '{"barcode":"7501073803008","name":"Jumex Mango 335ml","price":14.00,"cost":8.50,"stock":48,"min_stock":12}'
  '{"barcode":"75033828","name":"Red Bull 250ml","price":35.00,"cost":25.00,"stock":24,"min_stock":6}'
  '{"barcode":"7501055304103","name":"Sprite 600ml","price":17.00,"cost":11.00,"stock":50,"min_stock":10}'

  # Botanas
  '{"barcode":"7501011115040","name":"Sabritas Original 45g","price":22.00,"cost":15.00,"stock":60,"min_stock":15}'
  '{"barcode":"7501011153400","name":"Doritos Nacho 62g","price":25.00,"cost":17.00,"stock":45,"min_stock":10}'
  '{"barcode":"7501011129627","name":"Cheetos Flamin Hot 56g","price":23.00,"cost":16.00,"stock":40,"min_stock":10}'
  '{"barcode":"7506306414044","name":"Maruchan Pollo","price":9.50,"cost":5.00,"stock":100,"min_stock":20}'
  '{"barcode":"7501011167407","name":"Ruffles Queso 50g","price":22.00,"cost":15.00,"stock":35,"min_stock":10}'

  # Panadería
  '{"barcode":"7501000611072","name":"Bimbo Pan Blanco Grande","price":62.00,"cost":45.00,"stock":20,"min_stock":5}'
  '{"barcode":"7501000612130","name":"Bimbo Pan Integral","price":68.00,"cost":50.00,"stock":15,"min_stock":5}'
  '{"barcode":"7501000613052","name":"Bimbo Conchas 6pz","price":55.00,"cost":38.00,"stock":12,"min_stock":4}'
  '{"barcode":"7501030460060","name":"Marinela Gansito","price":18.00,"cost":11.00,"stock":50,"min_stock":10}'

  # Lácteos
  '{"barcode":"7501025101014","name":"Leche Lala Entera 1L","price":28.00,"cost":20.00,"stock":30,"min_stock":8}'
  '{"barcode":"7501040032012","name":"Yoghurt Yoplait Fresa","price":16.00,"cost":10.50,"stock":24,"min_stock":6}'

  # Limpieza
  '{"barcode":"7501035910119","name":"Papel Higiénico Regio 4pz","price":42.00,"cost":30.00,"stock":25,"min_stock":5}'
  '{"barcode":"7501199419107","name":"Jabón Zote 200g","price":18.00,"cost":11.00,"stock":30,"min_stock":8}'

  # Dulces
  '{"barcode":"7501008042069","name":"Mazapán De la Rosa","price":5.00,"cost":2.50,"stock":100,"min_stock":20}'
  '{"barcode":"7501000109142","name":"Chicles Trident Menta","price":16.00,"cost":10.00,"stock":40,"min_stock":10}'
)

COUNT=0
for prod in "${PRODUCTS[@]}"; do
  NAME=$(echo "$prod" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
  if curl -sf -X POST "$API/products" -H "$AUTH" -H "Content-Type: application/json" -d "$prod" > /dev/null 2>&1; then
    echo "  + $NAME"
    COUNT=$((COUNT + 1))
  else
    echo "  ~ $NAME (already exists)"
  fi
done

# Create a couple of test employees
echo "Creating test employees..."
for user in \
  '{"username":"maria","full_name":"María García","pin_code":"1234","password":"maria123","role":"cashier","store_id":"store-1"}' \
  '{"username":"carlos","full_name":"Carlos López","pin_code":"5678","password":"carlos123","role":"manager","store_id":"store-1"}'; do
  NAME=$(echo "$user" | python3 -c "import sys,json; print(json.load(sys.stdin)['full_name'])")
  if curl -sf -X POST "$API/auth/register" -H "$AUTH" -H "Content-Type: application/json" -d "$user" > /dev/null 2>&1; then
    echo "  + $NAME"
  else
    echo "  ~ $NAME (already exists)"
  fi
done

echo ""
echo "=== Seed complete: $COUNT products added ==="
echo ""
echo "Test accounts:"
echo "  admin   / admin123   / PIN: 0000  (admin)"
echo "  carlos  / carlos123  / PIN: 5678  (manager)"
echo "  maria   / maria123   / PIN: 1234  (cashier)"
