# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TiendaOS is a custom POS system for a chain of 5 convenience stores in Mexico (50 employees, packaged goods, ~500-1500 transactions/day). It replaces Odoo with a modular, AI-ready architecture using a hybrid deployment model (local SQLite per store + central cloud PostgreSQL).

## Build & Run Commands

```bash
# First-time setup (creates .env, installs deps, initializes DB)
bash scripts/setup.sh

# Seed sample products and test employees
bash scripts/seed_products.sh

# Start both backend + frontend
bash scripts/start.sh

# Or start individually:
# Backend (from backend/) — requires .venv
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (from frontend/)
cd frontend && npm run dev       # dev server on :3000
cd frontend && npm run build     # production build

# Docker (full stack)
docker compose up --build

# Ollama (AI features, requires GPU)
bash scripts/setup_ollama.sh
# Or manually: ollama serve & ollama pull llama3.1:8b
```

### Default Credentials (created by setup.sh)
- `admin / admin123 / PIN: 0000` (admin)
- After running seed: `carlos / PIN: 5678` (manager), `maria / PIN: 1234` (cashier)

## Configuration

Copy `.env.example` to `.env` before running. Key settings:
- `STORE_ID` / `STORE_NAME` — unique per-store deployment
- `DATABASE_URL` — defaults to SQLite (`sqlite:///./data/tiendaos.db`), switch to PostgreSQL for cloud central
- `TAX_RATE=0.16` — Mexico IVA
- `AI_*` flags — each AI module toggles independently to save resources
- `OLLAMA_URL` / `OLLAMA_MODEL` — local GPU inference (RTX 5070 available)

## Architecture

### Hybrid Offline-First Design
Each store runs a **local FastAPI instance with SQLite** (WAL mode enabled for concurrent reads). Stores sync to a **central cloud server with PostgreSQL** when connected. The POS continues working fully offline.

### Backend (`backend/app/`)
- **FastAPI** with Pydantic v2 schemas and SQLAlchemy 2.0 models (declarative `Mapped` style)
- `config.py` — centralized settings via `pydantic-settings`, loaded from `.env` with `@lru_cache`
- `database.py` — engine setup with SQLite WAL pragmas, `get_db()` dependency
- `models/` — SQLAlchemy models: Product, Category, Sale, SaleItem, User, Store (UUID string PKs)
- `schemas/` — Pydantic request/response schemas (use `model_config = {"from_attributes": True}`)
- `routers/` — API endpoints: products, sales, auth, stores, ai
- `services/` — business logic: auth (bcrypt + JWT), inventory, receipts
- `ai/llm.py` — LLM client: routes between local Ollama and Claude API with automatic fallback
- `ai/orchestrator.py` — module registry, status reporting, toggle management
- `ai/modules/` — four toggleable modules (see AI section below)

### Frontend (`frontend/src/`)
- **React** (Vite + TypeScript) browser-based POS UI for existing store terminals
- `components/POS/` — cashier terminal: cart, payment, receipt
- `components/Products/` — product search, barcode scanning, catalog
- `components/Layout/` — app shell, navigation
- `services/` — API client communicating with backend on `:8000`
- `store/` — client state management
- `hooks/` — shared React hooks (barcode scanner, offline detection)

### AI Orchestration (`backend/app/ai/`)
- `llm.py` routes queries: local Ollama first → Claude API fallback → error if neither available
- `force_cloud=True` parameter bypasses Ollama and goes straight to Claude API
- All modules produce **structured data without AI** (SQL aggregations, rule-based alerts). The LLM adds optional narrative summaries when the module's `AI_*` flag is `true`.

**Modules** (each toggleable via `AI_*` env vars):
| Module | Env Flag | What it does without LLM | What LLM adds |
|--------|----------|-------------------------|---------------|
| `demand_forecast` | `AI_DEMAND_FORECAST` | Sales velocity, days-until-empty, suggested order qty | Prioritized restock narrative |
| `insights` | `AI_INSIGHTS` | N/A (requires LLM) | Natural language Q&A about sales data |
| `smart_alerts` | `AI_SMART_ALERTS` | Low stock, sales anomalies, void rate detection | Executive summary of alerts |
| `customer_insights` | `AI_CUSTOMER_INSIGHTS` | Frequently-bought-together pairs (basket analysis) | Combo/promo suggestions with pricing |

**API endpoints** (all under `/api/ai/`):
- `GET /status` — AI system status (Ollama up? Claude configured? Module toggles)
- `POST /ask` — Natural language business questions (requires `AI_INSIGHTS=true`)
- `GET /forecast?days=14` — Demand forecast with restock suggestions
- `GET /alerts` — Smart alerts (low stock, anomalies, void rate)
- `GET /customers?days=30` — Basket analysis and purchase patterns

### Data Flow
```
POS UI (React :3000) → FastAPI (:8000) → SQLite (local store)
                                              ↕ sync
                                         PostgreSQL (cloud central)
```

## Key Conventions

- **Currency**: All prices in MXN (Mexican Pesos), `Float` type, 16% IVA tax
- **Auth**: JWT tokens for API access + 4-digit PIN for fast cashier POS login
- **IDs**: UUID strings as primary keys across all models
- **Passwords**: hashed via `bcrypt` directly (not passlib — incompatible with bcrypt 5.x); JWT via `python-jose`
- **Receipts**: thermal printer support via `python-escpos`
- **Offline resilience**: SQLite WAL mode + foreign keys enforced via pragmas

## Phased Roadmap

The project is built incrementally. Each phase is a set of features:

1. **Core POS** [DONE] — products, barcode scan, sales, receipts, cash register
2. **Multi-store** — cloud sync (SQLite→PostgreSQL), central admin dashboard, store management
3. **AI Insights** [DONE] — demand forecasting, NL reports, smart alerts, customer insights (Ollama local)
4. **Loyalty & Employees** — customer points, employee performance, shift tracking
5. **Bancomer** — BBVA TPV terminal integration (serial/USB)
6. **Delivery & E-commerce** — online ordering, driver app (PWA), payment gateway (Conekta)
