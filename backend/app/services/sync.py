"""
Sync service for local ↔ cloud data synchronization.

- Pull: cloud → local  (products, categories)
- Push: local → cloud  (sales, finance entries)

Runs as a background task every SYNC_INTERVAL_SECONDS when online.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models.sync import SyncMeta
from app.models.sale import Sale, SaleItem
from app.models.product import Product, Category, ProductBarcode, VolumePromo
from app.models.finance import FinanceEntry

logger = logging.getLogger("sync")
settings = get_settings()

_cloud_token: str | None = None


async def _get_cloud_token() -> str | None:
    global _cloud_token
    if _cloud_token:
        return _cloud_token
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{settings.cloud_api_url}/auth/login",
                json={"username": settings.cloud_sync_user, "password": settings.cloud_sync_password},
            )
            if r.status_code == 200:
                _cloud_token = r.json().get("access_token")
                return _cloud_token
    except Exception as e:
        logger.warning(f"Cloud login failed: {e}")
    return None


def _get_meta(db: Session, key: str) -> SyncMeta:
    meta = db.query(SyncMeta).filter(SyncMeta.id == key).first()
    if not meta:
        meta = SyncMeta(id=key)
        db.add(meta)
        db.commit()
        db.refresh(meta)
    return meta


def _set_meta(db: Session, key: str, result: str):
    meta = _get_meta(db, key)
    meta.last_synced_at = datetime.now(timezone.utc)
    meta.last_result = result
    db.commit()


async def pull_products(db: Session) -> str:
    """Pull products and categories from cloud → local."""
    token = await _get_cloud_token()
    if not token:
        return "no_token"

    meta = _get_meta(db, "pull_products")
    since = meta.last_synced_at.isoformat() if meta.last_synced_at else ""
    params = {"limit": 5000}
    if since:
        params["updated_since"] = since

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Pull categories first
            r = await client.get(f"{settings.cloud_api_url}/products/categories", headers=headers)
            if r.status_code == 200:
                for cat_data in r.json():
                    cat = db.query(Category).filter(Category.id == cat_data["id"]).first()
                    if cat:
                        cat.name = cat_data["name"]
                        cat.color = cat_data.get("color", "#3B82F6")
                    else:
                        db.add(Category(
                            id=cat_data["id"],
                            name=cat_data["name"],
                            color=cat_data.get("color", "#3B82F6"),
                        ))
                db.commit()

            # Pull products
            r = await client.get(f"{settings.cloud_api_url}/products", headers=headers, params=params)
            if r.status_code != 200:
                return f"error_{r.status_code}"

            products_data = r.json()
            updated = 0
            created = 0

            for p_data in products_data:
                product = db.query(Product).filter(Product.id == p_data["id"]).first()
                if product:
                    for field in ["name", "barcode", "description", "category_id", "supplier_id",
                                  "price", "cost", "min_stock", "image_url", "is_active",
                                  "is_favorite", "sell_by_weight"]:
                        setattr(product, field, p_data.get(field, getattr(product, field)))
                    updated += 1
                else:
                    db.add(Product(
                        id=p_data["id"],
                        barcode=p_data["barcode"],
                        name=p_data["name"],
                        description=p_data.get("description", ""),
                        category_id=p_data.get("category_id"),
                        supplier_id=p_data.get("supplier_id"),
                        price=p_data["price"],
                        cost=p_data.get("cost", 0),
                        stock=p_data.get("stock", 0),
                        min_stock=p_data.get("min_stock", 5),
                        image_url=p_data.get("image_url", ""),
                        is_active=p_data.get("is_active", True),
                        is_favorite=p_data.get("is_favorite", False),
                        sell_by_weight=p_data.get("sell_by_weight", False),
                    ))
                    created += 1

            db.commit()
            result = f"ok: {created} nuevos, {updated} actualizados"
            _set_meta(db, "pull_products", result)
            return result

    except Exception as e:
        logger.error(f"pull_products error: {e}")
        return f"error: {e}"


async def push_sales(db: Session) -> str:
    """Push unsynced local sales → cloud."""
    token = await _get_cloud_token()
    if not token:
        return "no_token"

    unsynced = db.query(Sale).filter(Sale.synced_at == None).all()  # noqa
    if not unsynced:
        return "ok: nothing to sync"

    headers = {"Authorization": f"Bearer {token}"}
    pushed = 0
    errors = 0

    async with httpx.AsyncClient(timeout=30) as client:
        for sale in unsynced:
            payload = {
                "id": sale.id,
                "store_id": sale.store_id,
                "subtotal": sale.subtotal,
                "tax": sale.tax,
                "total": sale.total,
                "payment_method": sale.payment_method,
                "cash_received": sale.cash_received,
                "change_given": sale.change_given,
                "status": sale.status,
                "created_at": sale.created_at.isoformat(),
                "items": [
                    {
                        "product_id": item.product_id,
                        "product_name": item.product_name,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "discount_percent": item.discount_percent,
                        "line_total": item.line_total,
                        "pack_units": item.pack_units,
                    }
                    for item in sale.items
                ],
            }
            try:
                r = await client.post(
                    f"{settings.cloud_api_url}/sales/sync-import",
                    json=payload,
                    headers=headers,
                )
                if r.status_code in (200, 201, 409):  # 409 = already exists, that's ok
                    sale.synced_at = datetime.now(timezone.utc)
                    pushed += 1
                else:
                    errors += 1
                    logger.warning(f"push sale {sale.id} failed: {r.status_code}")
            except Exception as e:
                errors += 1
                logger.error(f"push sale {sale.id} error: {e}")

    db.commit()
    result = f"ok: {pushed} pushed, {errors} errors"
    _set_meta(db, "push_sales", result)
    return result


async def run_sync() -> dict:
    """Run a full sync cycle. Returns results per direction."""
    if not settings.cloud_api_url or not settings.is_local_instance:
        return {"skipped": "not a local instance or no cloud_api_url configured"}

    db = SessionLocal()
    results = {}
    try:
        results["pull_products"] = await pull_products(db)
        results["push_sales"] = await push_sales(db)
    except Exception as e:
        results["error"] = str(e)
    finally:
        db.close()

    logger.info(f"Sync complete: {results}")
    return results


async def sync_loop():
    """Background loop — syncs every SYNC_INTERVAL_SECONDS."""
    await asyncio.sleep(10)  # wait for app startup
    while True:
        try:
            await run_sync()
        except Exception as e:
            logger.error(f"sync_loop error: {e}")
        await asyncio.sleep(settings.sync_interval_seconds)


def get_sync_status() -> dict:
    """Return current sync status from DB."""
    db = SessionLocal()
    try:
        keys = ["pull_products", "push_sales"]
        status = {}
        for key in keys:
            meta = db.query(SyncMeta).filter(SyncMeta.id == key).first()
            status[key] = {
                "last_synced_at": meta.last_synced_at.isoformat() if meta and meta.last_synced_at else None,
                "last_result": meta.last_result if meta else "",
            }
        unsynced = db.query(Sale).filter(Sale.synced_at == None).count()  # noqa
        status["pending_sales"] = unsynced
        return status
    finally:
        db.close()
