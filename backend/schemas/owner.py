from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class CalendarDateStatus(BaseModel):
    date: date
    status: str
    confirmed_count: int
    pending_count: int
    blocked_count: int


class SlotBreakdownItem(BaseModel):
    slot_time: str
    status: str
    booking_id: Optional[int] = None
    booked_by_name: Optional[str] = None
    booked_by_email: Optional[str] = None
    price: Optional[float] = None
    reason: Optional[str] = None
    booking_status: Optional[str] = None


class MonthlyCalendarResponse(BaseModel):
    month: str
    days: List[CalendarDateStatus]


class SlotBreakdownResponse(BaseModel):
    date: date
    slots: List[SlotBreakdownItem]


class SlotBlockCreate(BaseModel):
    blocked_date: date
    slot_time: str
    reason: Optional[str] = None


class SlotBlockDelete(BaseModel):
    blocked_date: date
    slot_time: str


class OwnerBookingSummary(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    space_id: int
    space_name: str
    space_type: str
    slot_date: date
    slot_time: str
    duration_hours: int
    price_paid: float
    status: str
    payment_id: Optional[str] = None
    request_expires_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class BookingDecision(BaseModel):
    reason: Optional[str] = None


class EarningsSummary(BaseModel):
    this_week: float
    this_month: float
    all_time: float
    pending_payout: float


class RevenueChartPoint(BaseModel):
    date: str
    revenue: float


class BookingTypePoint(BaseModel):
    type: str
    count: int


class PeakHourPoint(BaseModel):
    weekday: int
    hour: int
    count: int


class OccupancyPoint(BaseModel):
    space_id: int
    space_name: str
    occupancy_rate: float


class SpaceAnalyticsCard(BaseModel):
    space_id: int
    space_name: str
    space_type: str
    total_bookings: int
    revenue: float
    avg_rating: float
    occupancy_rate: float
    most_booked_slot: str


class ReviewReplyInput(BaseModel):
    reply_text: str


class OwnerReviewItem(BaseModel):
    review_id: int
    space_id: int
    space_name: str
    user_id: int
    user_name: str
    rating: int
    comment: Optional[str]
    sentiment: str
    is_flagged: bool
    reply_text: Optional[str]
    created_at: datetime


class NotificationItem(BaseModel):
    id: int
    type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationSettings(BaseModel):
    email_types: List[str]
    in_app_types: List[str]
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class NotificationSettingsUpdate(BaseModel):
    email_types: List[str]
    in_app_types: List[str]
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class OwnerProfileResponse(BaseModel):
    business_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    gst_number: Optional[str] = None
    bank_account: Optional[str] = None
    upi_id: Optional[str] = None
    payout_frequency: str
    is_verified: bool
    total_earned: float


class OwnerProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    gst_number: Optional[str] = None
    bank_account: Optional[str] = None
    upi_id: Optional[str] = None
    payout_frequency: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None


class PayoutItem(BaseModel):
    id: int
    amount: float
    period_start: date
    period_end: date
    status: str
    processed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PendingPayoutResponse(BaseModel):
    pending_amount: float
