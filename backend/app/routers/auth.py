from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, PinLogin
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(data: UserCreate, db: Session = Depends(get_db), _admin: User = Depends(require_role("admin"))):
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


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username, User.is_active == True).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return Token(access_token=create_access_token(user.id), user=UserResponse.model_validate(user))


@router.post("/pin-login", response_model=Token)
def pin_login(data: PinLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.pin_code == data.pin_code, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid PIN")
    return Token(access_token=create_access_token(user.id), user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
