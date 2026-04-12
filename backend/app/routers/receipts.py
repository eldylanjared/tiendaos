from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List

from app.config import get_settings
from app.services.auth import get_current_user
from app.models.user import User

settings = get_settings()
router = APIRouter(prefix="/api/receipts", tags=["receipts"])


class PrintItem(BaseModel):
    product_name: str
    quantity: float
    unit_price: float
    line_total: float


class PrintRequest(BaseModel):
    store_name: str
    items: List[PrintItem]
    subtotal: float
    tax: float
    total: float
    payment_method: str
    cash_received: float
    change_given: float
    sale_id: str
    created_at: str


@router.post("/print")
def print_receipt(
    data: PrintRequest,
    _user: User = Depends(get_current_user),
):
    if not settings.printer_port:
        raise HTTPException(status_code=503, detail="No printer configured")

    try:
        from app.services.receipt_printer import print_receipt as do_print
        do_print(
            store_name=data.store_name,
            items=[item.model_dump() for item in data.items],
            subtotal=data.subtotal,
            tax=data.tax,
            total=data.total,
            payment_method=data.payment_method,
            cash_received=data.cash_received,
            change_given=data.change_given,
            sale_id=data.sale_id,
            created_at=data.created_at,
        )
        return {"ok": True}
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=f"Printer not found at {settings.printer_port}. Check USB connection.",
        )
    except PermissionError:
        raise HTTPException(
            status_code=503,
            detail=f"Permission denied on {settings.printer_port}. Run: sudo chmod 666 {settings.printer_port}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Print error: {str(e)}")


@router.get("/status")
def printer_status(_user: User = Depends(get_current_user)):
    port = settings.printer_port
    if not port:
        return {"configured": False, "port": None, "accessible": False}

    import os
    accessible = os.access(port, os.W_OK) if port.startswith("/") else True
    return {"configured": True, "port": port, "accessible": accessible}
