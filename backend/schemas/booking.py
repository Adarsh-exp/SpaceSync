from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class BookingCreate(BaseModel):
    space_id: int
    slot_date: date
    slot_time: str  # morning / afternoon / evening / night
    duration_hours: int = 1
    payment_id: Optional[str] = None


class BookingOut(BaseModel):
    id: int
    user_id: int
    space_id: int
    slot_date: date
    slot_time: str
    duration_hours: int
    price_paid: float
    status: str
    payment_id: Optional[str]
    request_expires_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewCreate(BaseModel):
    space_id: int
    rating: int
    comment: Optional[str] = None


class ReviewUpdate(BaseModel):
    rating: int
    comment: Optional[str] = None


class ReviewOut(BaseModel):
    id: int
    user_id: int
    space_id: int
    rating: int
    comment: Optional[str]
    sentiment: str
    is_flagged: bool = False
    reply_text: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
