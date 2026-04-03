from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from backend.database import get_db
from backend.models.booking import Booking
from backend.models.space import Space
from backend.models.user import User
from backend.schemas.user import UserOut
from backend.schemas.space import SpaceOut
from backend.auth.jwt_handler import require_admin

router = APIRouter()


@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    total_bookings = db.query(Booking).filter(Booking.status == "confirmed").count()
    total_revenue = db.query(func.sum(Booking.price_paid)).filter(
        Booking.status == "confirmed"
    ).scalar() or 0.0

    # Bookings by space type
    type_breakdown = (
        db.query(Space.type, func.count(Booking.id))
        .join(Booking, Booking.space_id == Space.id)
        .filter(Booking.status == "confirmed")
        .group_by(Space.type)
        .all()
    )

    # Revenue by day (last 7)
    revenue_by_day = (
        db.query(
            func.date(Booking.created_at).label("day"),
            func.sum(Booking.price_paid).label("revenue"),
        )
        .filter(Booking.status == "confirmed")
        .group_by(func.date(Booking.created_at))
        .order_by(func.date(Booking.created_at).desc())
        .limit(7)
        .all()
    )

    # Peak hours (slot_time breakdown)
    peak_hours = (
        db.query(Booking.slot_time, func.count(Booking.id))
        .filter(Booking.status == "confirmed")
        .group_by(Booking.slot_time)
        .all()
    )

    # Recent bookings
    recent = (
        db.query(Booking)
        .filter(Booking.status == "confirmed")
        .order_by(Booking.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_bookings": total_bookings,
        "total_revenue": round(float(total_revenue), 2),
        "bookings_by_type": {t: c for t, c in type_breakdown},
        "revenue_by_day": [{"day": str(d), "revenue": round(float(r), 2)} for d, r in revenue_by_day],
        "peak_hours": {s: c for s, c in peak_hours},
        "recent_bookings": [
            {
                "id": b.id,
                "user_id": b.user_id,
                "space_id": b.space_id,
                "slot_date": str(b.slot_date),
                "slot_time": b.slot_time,
                "price_paid": b.price_paid,
                "status": b.status,
                "created_at": str(b.created_at),
            }
            for b in recent
        ],
    }


@router.get("/users", response_model=List[UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).all()


@router.get("/spaces", response_model=List[SpaceOut])
def get_all_spaces(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(Space).all()
