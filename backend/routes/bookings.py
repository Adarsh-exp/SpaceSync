from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models.booking import Booking
from backend.models.slot_block import SlotBlock
from backend.models.space import Space
from backend.models.user import User
from backend.schemas.booking import BookingCreate, BookingOut
from backend.auth.jwt_handler import get_current_user
from backend.services.owner_support import auto_reject_booking_after_deadline, create_notification, derive_slot_bucket

router = APIRouter()


def send_booking_notification(user_name: str, space_name: str, slot_date: date):
    """Background task: In production, send email/SMS here."""
    print(f"[NOTIFICATION] {user_name} booked {space_name} on {slot_date}")


def extract_booking_window(slot_time: str):
    try:
        start_raw, end_raw = [part.strip() for part in slot_time.split("-", 1)]
        start_dt = datetime.strptime(start_raw, "%H:%M")
        end_dt = datetime.strptime(end_raw, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=422, detail="Booking time must be in HH:MM-HH:MM format")

    if end_dt <= start_dt:
        raise HTTPException(status_code=422, detail="Booking end time must be later than start time")

    return start_dt, end_dt


def ensure_booking_within_service_hours(space: Space, slot_time: str):
    if not space.opening_time or not space.closing_time:
        return

    booking_start, booking_end = extract_booking_window(slot_time)
    opening = datetime.strptime(space.opening_time, "%H:%M")
    closing = datetime.strptime(space.closing_time, "%H:%M")

    if booking_start < opening or booking_end > closing:
        raise HTTPException(
            status_code=409,
            detail=f"This space accepts bookings only between {space.opening_time} and {space.closing_time}",
        )


@router.post("", response_model=BookingOut)
def create_booking(
    booking_data: BookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = db.query(Space).filter(Space.id == booking_data.space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    ensure_booking_within_service_hours(space, booking_data.slot_time)

    slot_bucket = derive_slot_bucket(booking_data.slot_time)

    blocked = db.query(SlotBlock).filter(
        SlotBlock.space_id == booking_data.space_id,
        SlotBlock.blocked_date == booking_data.slot_date,
        SlotBlock.slot_time == slot_bucket,
    ).first()
    if blocked:
        raise HTTPException(status_code=409, detail="Selected slot is blocked by the owner")

    # Check for slot conflict
    conflicts = db.query(Booking).filter(
        Booking.space_id == booking_data.space_id,
        Booking.slot_date == booking_data.slot_date,
        Booking.status.in_(("pending", "confirmed", "completed")),
    ).all()
    if any(derive_slot_bucket(item.slot_time) == slot_bucket for item in conflicts):
        raise HTTPException(status_code=409, detail="Slot already booked")

    # Calculate price (basic: base_price * duration)
    price = space.base_price * booking_data.duration_hours
    status = "pending" if space.booking_mode == "request" else "confirmed"
    request_expires_at = datetime.utcnow() + timedelta(hours=2) if status == "pending" else None

    booking = Booking(
        user_id=current_user.id,
        space_id=space.id,
        slot_date=booking_data.slot_date,
        slot_time=booking_data.slot_time,
        duration_hours=booking_data.duration_hours,
        price_paid=price,
        payment_id=booking_data.payment_id,
        status=status,
        request_expires_at=request_expires_at,
    )
    db.add(booking)

    # Update space stats
    if status == "confirmed":
        space.total_bookings = (space.total_bookings or 0) + 1

    if status == "pending":
        create_notification(
            db,
            space.owner_id,
            "booking_request",
            f"New booking request for {space.name} on {booking_data.slot_date} ({booking_data.slot_time}).",
        )
    else:
        create_notification(
            db,
            space.owner_id,
            "booking_confirmed",
            f"Booking confirmed for {space.name} on {booking_data.slot_date} ({booking_data.slot_time}).",
        )
    db.commit()
    db.refresh(booking)

    # Background notification
    background_tasks.add_task(
        send_booking_notification,
        current_user.name,
        space.name,
        booking_data.slot_date,
    )
    if status == "pending" and request_expires_at:
        wait_seconds = max((request_expires_at - datetime.utcnow()).total_seconds(), 0)
        background_tasks.add_task(auto_reject_booking_after_deadline, booking.id, wait_seconds)

    return booking


@router.get("/my", response_model=List[BookingOut])
def my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Booking).filter(Booking.user_id == current_user.id).all()


@router.get("/owner", response_model=List[BookingOut])
def owner_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner_space_ids = [s.id for s in db.query(Space).filter(Space.owner_id == current_user.id).all()]
    return db.query(Booking).filter(Booking.space_id.in_(owner_space_ids)).all()


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return booking


@router.put("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Already cancelled")

    booking.status = "cancelled"
    create_notification(
        db,
        booking.space.owner_id,
        "booking_cancelled",
        f"{current_user.name} cancelled booking for {booking.space.name} on {booking.slot_date}.",
    )
    db.commit()
    db.refresh(booking)
    return booking
