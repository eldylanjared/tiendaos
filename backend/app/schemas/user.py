from datetime import datetime
from pydantic import BaseModel


class UserBase(BaseModel):
    username: str
    full_name: str
    role: str = "cashier"
    store_id: str | None = None


class UserCreate(UserBase):
    password: str
    pin_code: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    pin_code: str | None = None
    password: str | None = None
    is_active: bool | None = None
    store_id: str | None = None


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PinLogin(BaseModel):
    pin_code: str
