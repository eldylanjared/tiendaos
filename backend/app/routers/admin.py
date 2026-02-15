from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.services.auth import get_current_user, require_role, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    return db.query(User).order_by(User.full_name).all()


@router.post("/users", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.pin_code == data.pin_code).first():
        raise HTTPException(status_code=400, detail="PIN already in use")

    user = User(
        username=data.username,
        full_name=data.full_name,
        pin_code=data.pin_code,
        hashed_password=hash_password(data.password),
        role=data.role,
        store_id=data.store_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = data.model_dump(exclude_unset=True)

    if "pin_code" in updates:
        existing = db.query(User).filter(User.pin_code == updates["pin_code"], User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="PIN already in use")

    if "password" in updates:
        user.hashed_password = hash_password(updates.pop("password"))

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
