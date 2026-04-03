from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    city: Optional[str] = None
    budget_min: Optional[int] = 0
    budget_max: Optional[int] = 10000
    role: Optional[str] = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    city: Optional[str]
    budget_min: int
    budget_max: int
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None
