# TiendaOS

A lightweight, offline-first POS system built for convenience stores in Mexico.

**Live**: [dylanlopez.com](https://dylanlopez.com) | **Staging**: [staging.dylanlopez.com](https://staging.dylanlopez.com)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy + SQLite |
| Frontend | React 19 + TypeScript + Vite |
| AI | Ollama (local GPU) + Claude API (fallback) |
| Server | nginx reverse proxy on Ubuntu VPS |
| Auth | JWT + bcrypt, role-based (admin/manager/cashier) |

## Features

### Core POS (`/terminal`)
- Barcode scanning + manual product search
- Shopping cart with quantity editing and line-item discounts
- Cash and card payments with change calculation
- Receipt generation (thermal printer support)
- Auto stock decrement on sale

### Products
- 2,068+ products imported from Odoo CSV
- Hierarchical categories
- Multi-pack barcodes (e.g. 6-pack UPC → 6 units)
- Volume promos ("buy 3 for $25")
- Sell-by-weight items (kg entry with live price)
- Product image upload

### Admin Panel (`/admin`)
- **Dashboard** — today's sales, profit, hourly breakdown, top 10 products, payment method split
- **Reports** — sales summary (daily/weekly/monthly), product profitability, category performance, cashier performance with void rate, CSV export
- **Inventory** — stock levels, below-minimum alerts, reorder suggestions, adjustment audit trail
- **Employees** — CRUD, role assignment, PIN management
- **Sales History** — transaction list, void/refund

### Finance Tracker (`/finanzas`)
- Manual income/expense entry
- Receipt photo upload with OCR (Tesseract)
- Auto-categorization that learns vendor-to-category mappings
- Summary with balance and category breakdown

### Chat Assistant (`/chat`)
- Natural language commands (price changes, stock adjustments, expense entry)
- Confirmation flow before executing actions
- Receipt photo processing

### Price Checker Kiosk (`/precios`)
- Public endpoint (no login required)
- Barcode scan → displays product name, price, image
- Auto-clear after 15 seconds

### AI Modules (optional, toggle independently)
| Module | What it does |
|--------|-------------|
| Demand Forecast | Sales velocity, days-until-empty, restock recommendations |
| Insights | Natural language Q&A about sales data |
| Smart Alerts | Low stock, sales anomalies, void rate detection |
| Customer Insights | Basket analysis, frequently-bought-together pairs |

## Project Structure

```
tiendaos/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI app entry point
│       ├── config.py            # Settings from .env
│       ├── database.py          # SQLAlchemy engine + session
│       ├── models/              # ORM models (Product, Sale, User, Store, Finance)
│       ├── schemas/             # Pydantic request/response schemas
│       ├── routers/             # API endpoints (10 routers)
│       │   ├── auth.py          # Login, register, token refresh
│       │   ├── products.py      # CRUD, barcode lookup, import/export
│       │   ├── sales.py         # Create sale, void, daily summary
│       │   ├── reports.py       # Dashboard, profitability, CSV export
│       │   ├── admin.py         # User management
│       │   ├── finance.py       # Income/expense, receipt OCR
│       │   ├── chat.py          # Natural language commands
│       │   ├── pricechecker.py  # Public barcode lookup
│       │   ├── stores.py        # Store CRUD
│       │   └── ai.py            # AI module endpoints
│       ├── services/            # Auth (JWT + bcrypt), receipt parser
│       └── ai/                  # LLM client, orchestrator, 4 modules
├── frontend/
│   └── src/
│       ├── App.tsx              # Root component + path-based routing
│       ├── components/
│       │   ├── POS/             # Terminal, Cart, PaymentModal, Receipt
│       │   ├── Admin/           # AdminPanel, Dashboard, Reports, Inventory
│       │   ├── PriceChecker/    # Kiosk mode
│       │   ├── Finance/         # Finance tracker
│       │   ├── Chat/            # Chat assistant
│       │   └── Layout/          # Header, Login
│       ├── hooks/               # useCart, useBarcode, useKeepAlive
│       ├── services/api.ts      # Centralized API client
│       └── types/index.ts       # TypeScript interfaces
├── scripts/                     # Setup, seed, import, categorize
├── nginx/                       # Server config
├── docker-compose.yml
└── .env.example
```

## Database Schema

```
users ──────────── stores
  │                  │
  ├── sales ─────── sale_items
  │                  │
  ├── finance_entries│
  │                  │
  └── stock_adjustments
                     │
products ───── categories (hierarchical)
  ├── product_barcodes (multi-pack)
  └── volume_promos

vendor_mappings (learned OCR categories)
```

All primary keys are UUID strings. Timestamps use UTC.

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/eldylanjared/tiendaos.git
cd tiendaos
bash scripts/setup.sh        # creates .env, installs deps, inits DB

# 2. Seed test data
bash scripts/seed_products.sh

# 3. Run
bash scripts/start.sh        # starts backend (:8000) + frontend (:3000)

# Or with Docker
docker compose up --build
```

### Default Credentials
| User | Password | PIN | Role |
|------|----------|-----|------|
| admin | admin123 | 0000 | admin |
| carlos | — | 5678 | manager |
| maria | — | 1234 | cashier |

## Configuration

Copy `.env.example` to `.env`. Key settings:

```env
DATABASE_URL=sqlite:///./data/tiendaos.db
STORE_ID=store-1
STORE_NAME=Tienda Centro
TAX_RATE=0.0                    # IVA removed
CURRENCY=MXN

# AI (optional)
AI_ENABLED=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
ANTHROPIC_API_KEY=sk-...        # fallback
AI_DEMAND_FORECAST=false
AI_INSIGHTS=false
AI_SMART_ALERTS=false
AI_CUSTOMER_INSIGHTS=false
```

## Deployment

### Production (dylanlopez.com)
- Code: `/opt/tiendaos/`
- Backend: systemd service `tiendaos` → uvicorn on port 8000
- Frontend: pre-built static files served by nginx
- DB: `backend/data/tiendaos.db`

### Staging (staging.dylanlopez.com)
- Code: `/opt/tiendaos-staging/`
- Backend: port 8001, separate database
- Purpose: test changes before promoting to production

### Workflow
```
local dev → git push → deploy to staging → verify → promote to production
```

## API Overview

All endpoints under `/api/`:

| Route | Auth | Description |
|-------|------|-------------|
| `POST /auth/login` | No | Username/password login |
| `POST /auth/pin-login` | No | PIN-based fast login |
| `GET /products` | Yes | Search products |
| `GET /products/barcode/{code}` | Yes | Barcode lookup |
| `POST /sales` | Yes | Create sale |
| `GET /reports/dashboard` | Manager+ | Today's KPIs |
| `GET /reports/sales-summary` | Manager+ | Sales by period |
| `GET /reports/product-profitability` | Manager+ | Profit margins |
| `POST /finance` | Yes | Add income/expense |
| `POST /finance/scan-receipt` | Yes | OCR receipt image |
| `POST /chat` | Yes | Natural language command |
| `GET /price-check/{barcode}` | No | Public price lookup |
| `GET /ai/forecast` | Yes | Demand forecast |

## Roadmap

- [x] Core POS (barcode, cart, payments, receipts)
- [x] Admin panel (products, employees, inventory)
- [x] Dashboard and reports
- [x] Finance tracker with receipt OCR
- [x] Chat assistant
- [x] AI modules (forecast, insights, alerts, basket analysis)
- [ ] Separate subdomains (pos, precios, admin)
- [ ] Multi-store cloud sync (SQLite → PostgreSQL)
- [ ] Loyalty program (customer points)
- [ ] BBVA TPV payment terminal integration
- [ ] E-commerce + delivery

## License

Private — Dylan Lopez
