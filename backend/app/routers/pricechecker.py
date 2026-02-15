from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product, ProductBarcode
from app.schemas.product import ProductResponse, PackInfo

router = APIRouter(prefix="/api/price-check", tags=["price-checker"])


@router.get("/{barcode}")
def price_check(barcode: str, db: Session = Depends(get_db)):
    """Public endpoint — no auth required. Returns product info for price checker kiosks."""
    # Check pack barcodes first
    pack = db.query(ProductBarcode).filter(ProductBarcode.barcode == barcode).first()
    if pack:
        product = db.query(Product).filter(Product.id == pack.product_id, Product.is_active == True).first()
        if product:
            return {
                "name": product.name,
                "price": pack.pack_price,
                "unit_price": product.price,
                "image_url": product.image_url,
                "sell_by_weight": product.sell_by_weight,
                "pack": {
                    "barcode": pack.barcode,
                    "units": pack.units,
                    "pack_price": pack.pack_price,
                },
            }

    # Then check main product barcode
    product = db.query(Product).filter(Product.barcode == barcode, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return {
        "name": product.name,
        "price": product.price,
        "unit_price": product.price,
        "image_url": product.image_url,
        "sell_by_weight": product.sell_by_weight,
        "pack": None,
    }
