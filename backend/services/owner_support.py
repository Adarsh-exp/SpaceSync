from datetime import datetime
import time as time_module
from typing import Iterable, Set

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.booking import Booking
from backend.models.notification import Notification
from backend.models.owner_profile import OwnerProfile

SLOT_BUCKETS = ("morning", "afternoon", "evening", "night")


def derive_slot_bucket(slot_time: str) -> str:
    if not slot_time:
        return "evening"
    if slot_time in SLOT_BUCKETS:
        return slot_time

    start = slot_time.split("-", 1)[0]
    hour = int(start.split(":", 1)[0])
    if hour < 12:
        return "morning"
    if hour < 17:
        return "afternoon"
    if hour < 21:
        return "evening"
    return "night"


def csv_pref_set(value: str | None) -> Set[str]:
    if not value:
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


def pref_csv(values: Iterable[str]) -> str:
    return ",".join(sorted({value.strip() for value in values if value and value.strip()}))


def get_or_create_owner_profile(db: Session, user_id: int) -> OwnerProfile:
    profile = db.query(OwnerProfile).filter(OwnerProfile.user_id == user_id).first()
    if profile:
        return profile
    profile = OwnerProfile(user_id=user_id)
    db.add(profile)
    db.flush()
    return profile


def create_notification(db: Session, user_id: int, notification_type: str, message: str) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        message=message,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    return notification


def auto_reject_booking_after_deadline(booking_id: int, wait_seconds: float):
    if wait_seconds > 0:
        time_module.sleep(wait_seconds)

    db = SessionLocal()
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking or booking.status != "pending":
            return
        if booking.request_expires_at and booking.request_expires_at > datetime.utcnow():
            return

        booking.status = "auto_rejected"
        booking.reviewed_at = datetime.utcnow()
        booking.rejection_reason = "Request timed out"
        create_notification(
            db,
            booking.user_id,
            "booking_auto_rejected",
            "Your booking request expired without owner approval.",
        )
        db.commit()
    finally:
        db.close()
