from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, get_db, SessionLocal
from app.models import Store, User  # noqa: F401 — registers all models with Base
from app.routers import auth, products, sales, stores, ai
from app.services.auth import hash_password

settings = get_settings()


def seed_initial_data():
    """Create default store and admin user if the database is empty."""
    db = SessionLocal()
    try:
        if db.query(Store).count() == 0:
            store = Store(id=settings.store_id, name=settings.store_name)
            db.add(store)
            db.flush()

            admin = User(
                username="admin",
                full_name="Administrador",
                pin_code="0000",
                hashed_password=hash_password("admin123"),
                role="admin",
                store_id=store.id,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    seed_initial_data()
    yield


app = FastAPI(
    title="TiendaOS",
    description="POS system for convenience stores",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(stores.router)
app.include_router(ai.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "store_id": settings.store_id, "store_name": settings.store_name}
