from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.ticket import Ticket
from app.models.user import User
from app.services.auth import get_current_user

settings = get_settings()
router = APIRouter(prefix="/api/tickets", tags=["tickets"])

STATUSES = ["nuevo", "en_progreso", "completado", "cerrado"]
PRIORITIES = ["baja", "normal", "alta", "urgente"]


def _user_name_map(db: Session) -> dict[str, str]:
    users = db.query(User.id, User.full_name).all()
    return {u.id: u.full_name for u in users}


def _ticket_to_dict(t: Ticket, names: dict[str, str]) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "created_by": t.created_by,
        "created_by_name": names.get(t.created_by, ""),
        "assigned_to": t.assigned_to,
        "assigned_to_name": names.get(t.assigned_to, "") if t.assigned_to else "",
        "due_date": t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
        "sort_order": t.sort_order,
        "created_at": t.created_at.isoformat() if t.created_at else "",
        "updated_at": t.updated_at.isoformat() if t.updated_at else "",
    }


class TicketCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "normal"
    assigned_to: str | None = None
    due_date: str | None = None  # YYYY-MM-DD


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    assigned_to: str | None = None
    due_date: str | None = None
    sort_order: int | None = None


@router.get("")
def list_tickets(
    status: str | None = Query(None),
    assigned_to: str | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Ticket).filter(Ticket.store_id == settings.store_id)
    if status:
        q = q.filter(Ticket.status == status)
    if assigned_to:
        q = q.filter(Ticket.assigned_to == assigned_to)
    tickets = q.order_by(Ticket.sort_order, Ticket.created_at.desc()).all()
    names = _user_name_map(db)
    return [_ticket_to_dict(t, names) for t in tickets]


@router.post("")
def create_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Priority must be one of: {PRIORITIES}")

    due = None
    if data.due_date:
        try:
            due = datetime.strptime(data.due_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")

    if data.assigned_to:
        emp = db.query(User).filter(User.id == data.assigned_to).first()
        if not emp:
            raise HTTPException(status_code=400, detail="Assigned user not found")

    ticket = Ticket(
        store_id=settings.store_id,
        title=data.title.strip(),
        description=data.description.strip(),
        status="nuevo",
        priority=data.priority,
        created_by=current_user.id,
        assigned_to=data.assigned_to or None,
        due_date=due,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    names = _user_name_map(db)
    return _ticket_to_dict(ticket, names)


@router.patch("/{ticket_id}")
def update_ticket(
    ticket_id: str,
    data: TicketUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if data.title is not None:
        ticket.title = data.title.strip()
    if data.description is not None:
        ticket.description = data.description.strip()
    if data.status is not None:
        if data.status not in STATUSES:
            raise HTTPException(status_code=400, detail=f"Status must be one of: {STATUSES}")
        ticket.status = data.status
    if data.priority is not None:
        if data.priority not in PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Priority must be one of: {PRIORITIES}")
        ticket.priority = data.priority
    if data.assigned_to is not None:
        ticket.assigned_to = data.assigned_to or None
    if data.due_date is not None:
        if data.due_date:
            try:
                ticket.due_date = datetime.strptime(data.due_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format")
        else:
            ticket.due_date = None
    if data.sort_order is not None:
        ticket.sort_order = data.sort_order

    db.commit()
    db.refresh(ticket)
    names = _user_name_map(db)
    return _ticket_to_dict(ticket, names)


@router.delete("/{ticket_id}")
def delete_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Only admin/manager or the creator can delete
    is_admin = current_user.role in ("admin", "manager")
    if not is_admin and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso")

    db.delete(ticket)
    db.commit()
    return {"ok": True}


@router.get("/employees")
def get_employees(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    users = db.query(User).filter(User.is_active == True).order_by(User.full_name).all()
    return [{"id": u.id, "full_name": u.full_name, "role": u.role} for u in users]
