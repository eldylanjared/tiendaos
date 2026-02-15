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
