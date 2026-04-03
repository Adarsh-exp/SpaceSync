from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SpaceOwnerContact(BaseModel):
    id: int
    name: str
    email: str
    city: Optional[str] = None
    role: str
    business_name: Optional[str] = None
    business_phone: Optional[str] = None

    class Config:
        from_attributes = True


class SpaceCreate(BaseModel):
    name: str
    type: str
    city: str
    area: Optional[str] = None
    base_price: float
    amenities: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    booking_mode: Optional[str] = "instant"
    opening_time: Optional[str] = "09:00"
    closing_time: Optional[str] = "22:00"


class SpaceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    base_price: Optional[float] = None
    amenities: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    booking_mode: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None


class SpaceOut(BaseModel):
    id: int
    owner_id: int
    name: str
    type: str
    city: str
    area: Optional[str]
    base_price: float
    amenities: str
    rating: float
    total_bookings: int
    image_url: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    booking_mode: str
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    owner: Optional[SpaceOwnerContact] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SpaceEnquiryCreate(BaseModel):
    message: str
