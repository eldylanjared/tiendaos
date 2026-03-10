import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.finance import FinanceEntry
from app.models.user import User
from app.services.auth import get_current_user, require_role

settings = get_settings()
router = APIRouter(prefix="/api/finance", tags=["finance"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

EXPENSE_CATEGORIES = [
    "proveedores", "renta", "servicios", "nomina", "transporte",
    "mantenimiento", "impuestos", "publicidad", "varios",
]
INCOME_CATEGORIES = [
    "ventas_efectivo", "ventas_tarjeta", "otros_ingresos", "prestamo", "devolucion",
]


def _user_name_map(db: Session) -> dict[str, str]:
    """Build a {user_id: full_name} lookup."""
    users = db.query(User.id, User.full_name).all()
    return {u.id: u.full_name for u in users}


@router.post("")
async def create_entry(
    entry_type: str = Form(...),
    category: str = Form(...),
    amount: float = Form(...),
    description: str = Form(""),
    date: str = Form(""),  # YYYY-MM-DD, defaults to today
    assigned_to: str = Form(""),  # employee id to assign this entry to
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if entry_type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="entry_type must be 'income' or 'expense'")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be positive")

    entry_date = datetime.utcnow()
    if date:
        try:
            entry_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    # Only admin/manager can assign entries to other employees
    resolved_assigned_to = None
    if assigned_to:
        if current_user.role in ("admin", "manager"):
            # Verify the employee exists
            emp = db.query(User).filter(User.id == assigned_to).first()
            if not emp:
                raise HTTPException(status_code=400, detail="Employee not found")
            resolved_assigned_to = assigned_to
        else:
            # Cashiers can only assign to themselves
            resolved_assigned_to = current_user.id

    image_path = ""
    if image and image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".heic"):
            raise HTTPException(status_code=400, detail="Image must be jpg, png, webp, or heic")
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        content = await image.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
        with open(filepath, "wb") as f:
            f.write(content)
        image_path = filename

    entry = FinanceEntry(
        store_id=settings.store_id,
        user_id=current_user.id,
        assigned_to=resolved_assigned_to,
        entry_type=entry_type,
        category=category,
        amount=amount,
        description=description,
        image_path=image_path,
        date=entry_date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    names = _user_name_map(db)
    return _entry_to_dict(entry, names)


def _apply_user_filter(q, current_user: User, user_id: str | None):
    """Filter finance entries based on role and requested user_id."""
    if current_user.role in ("admin", "manager"):
        # Admin/manager: show all by default, or filter by specific employee
        if user_id:
            q = q.filter(
                or_(FinanceEntry.assigned_to == user_id, FinanceEntry.user_id == user_id)
            )
    else:
        # Cashier: only see entries they created or assigned to them
        q = q.filter(
            or_(FinanceEntry.user_id == current_user.id, FinanceEntry.assigned_to == current_user.id)
        )
    return q


@router.get("")
def list_entries(
    start: str | None = Query(None),
    end: str | None = Query(None),
    entry_type: str | None = Query(None),
    user_id: str | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(FinanceEntry).filter(FinanceEntry.store_id == settings.store_id)

    if entry_type:
        q = q.filter(FinanceEntry.entry_type == entry_type)
    if start:
        q = q.filter(FinanceEntry.date >= datetime.strptime(start, "%Y-%m-%d"))
    if end:
        end_dt = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)
        q = q.filter(FinanceEntry.date < end_dt)

    q = _apply_user_filter(q, current_user, user_id)

    entries = q.order_by(FinanceEntry.date.desc()).offset(offset).limit(limit).all()
    names = _user_name_map(db)
    return [_entry_to_dict(e, names) for e in entries]


@router.get("/summary")
def finance_summary(
    start: str | None = Query(None),
    end: str | None = Query(None),
    user_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(FinanceEntry).filter(FinanceEntry.store_id == settings.store_id)

    if start:
        q = q.filter(FinanceEntry.date >= datetime.strptime(start, "%Y-%m-%d"))
    if end:
        end_dt = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)
        q = q.filter(FinanceEntry.date < end_dt)

    q = _apply_user_filter(q, current_user, user_id)

    entries = q.all()

    total_income = sum(e.amount for e in entries if e.entry_type == "income")
    total_expenses = sum(e.amount for e in entries if e.entry_type == "expense")

    # Group by category
    by_category: dict[str, float] = {}
    for e in entries:
        key = f"{e.entry_type}:{e.category}"
        by_category[key] = by_category.get(key, 0) + e.amount

    expense_categories = []
    income_categories = []
    for key, amount in sorted(by_category.items(), key=lambda x: -x[1]):
        etype, cat = key.split(":", 1)
        item = {"category": cat, "amount": round(amount, 2)}
        if etype == "expense":
            expense_categories.append(item)
        else:
            income_categories.append(item)

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "balance": round(total_income - total_expenses, 2),
        "entry_count": len(entries),
        "expense_categories": expense_categories,
        "income_categories": income_categories,
    }


@router.get("/employees")
def get_employees(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    """List employees for the assign-to dropdown."""
    users = (
        db.query(User)
        .filter(User.is_active == True)
        .order_by(User.full_name)
        .all()
    )
    return [
        {"id": u.id, "full_name": u.full_name, "role": u.role}
        for u in users
    ]


@router.post("/scan-receipt")
async def scan_receipt(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Process a receipt image with Tesseract OCR and extract structured data."""
    from app.services.receipt_parser import parse_receipt

    content = await image.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    try:
        result = parse_receipt(content, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"No se pudo procesar la imagen: {str(e)}")


@router.post("/learn-vendor")
def learn_vendor_mapping(
    vendor: str = Form(...),
    category: str = Form(...),
    entry_type: str = Form("expense"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Teach the system: this vendor belongs to this category."""
    from app.services.receipt_parser import learn_vendor
    learn_vendor(db, vendor, category, entry_type)
    return {"ok": True}


@router.get("/categories")
def get_categories(_user: User = Depends(get_current_user)):
    return {
        "expense": EXPENSE_CATEGORIES,
        "income": INCOME_CATEGORIES,
    }


@router.get("/image/{filename}")
def get_image(filename: str, _user: User = Depends(get_current_user)):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    entry = db.query(FinanceEntry).filter(FinanceEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Delete image file if exists
    if entry.image_path:
        filepath = os.path.join(UPLOAD_DIR, entry.image_path)
        if os.path.exists(filepath):
            os.remove(filepath)

    db.delete(entry)
    db.commit()
    return {"ok": True}


def _entry_to_dict(entry: FinanceEntry, names: dict[str, str] | None = None) -> dict:
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "assigned_to": entry.assigned_to,
        "user_name": names.get(entry.user_id, "") if names else "",
        "assigned_name": names.get(entry.assigned_to, "") if names and entry.assigned_to else "",
        "entry_type": entry.entry_type,
        "category": entry.category,
        "amount": entry.amount,
        "description": entry.description,
        "image_path": entry.image_path,
        "date": entry.date.strftime("%Y-%m-%d") if entry.date else "",
        "created_at": entry.created_at.isoformat() if entry.created_at else "",
    }
