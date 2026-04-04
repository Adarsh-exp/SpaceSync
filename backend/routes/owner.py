from collections import defaultdict
from datetime import date, datetime, timedelta
from io import StringIO
import csv
from calendar import monthrange
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from passlib.context import CryptContext
from sqlalchemy.orm import Session, joinedload

from backend.auth.jwt_handler import get_current_user
from backend.database import get_db
from backend.models.booking import Booking
from backend.models.notification import Notification
from backend.models.payout import Payout
from backend.models.review import Review
from backend.models.review_reply import ReviewReply
from backend.models.slot_block import SlotBlock
from backend.models.space import Space
from backend.models.user import User
from backend.schemas.owner import (
    BookingDecision,
    BookingTypePoint,
    EarningsSummary,
    MonthlyCalendarResponse,
    NotificationItem,
    NotificationSettings,
    NotificationSettingsUpdate,
    OccupancyPoint,
    OwnerBookingSummary,
    OwnerProfileResponse,
    OwnerProfileUpdate,
    OwnerReviewItem,
    PeakHourPoint,
    PendingPayoutResponse,
    PayoutItem,
    RevenueChartPoint,
    ReviewReplyInput,
    SlotBlockCreate,
    SlotBlockDelete,
    SlotBreakdownItem,
    SlotBreakdownResponse,
    SpaceAnalyticsCard,
)
from backend.services.owner_support import (
    SLOT_BUCKETS,
    create_notification,
    csv_pref_set,
    derive_slot_bucket,
    get_or_create_owner_profile,
    pref_csv,
)

router = APIRouter()
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def require_owner_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return current_user


def get_owner_space_or_404(db: Session, owner_id: int, space_id: int) -> Space:
    space = db.query(Space).filter(Space.id == space_id, Space.owner_id == owner_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    return space


def active_booking_statuses() -> tuple[str, ...]:
    return ("pending", "confirmed", "completed")


def earning_booking_statuses() -> tuple[str, ...]:
    return ("confirmed", "completed")


def owner_space_ids(db: Session, owner_id: int) -> List[int]:
    return [space.id for space in db.query(Space.id).filter(Space.owner_id == owner_id).all()]


def booking_to_owner_summary(booking: Booking) -> OwnerBookingSummary:
    return OwnerBookingSummary(
        id=booking.id,
        user_id=booking.user.id,
        user_name=booking.user.name,
        user_email=booking.user.email,
        space_id=booking.space.id,
        space_name=booking.space.name,
        space_type=booking.space.type,
        slot_date=booking.slot_date,
        slot_time=booking.slot_time,
        duration_hours=booking.duration_hours,
        price_paid=booking.price_paid,
        status=booking.status,
        payment_id=booking.payment_id,
        request_expires_at=booking.request_expires_at,
        reviewed_at=booking.reviewed_at,
        created_at=booking.created_at,
    )


def base_owner_booking_query(db: Session, owner_id: int):
    return (
        db.query(Booking)
        .join(Space, Booking.space_id == Space.id)
        .join(User, Booking.user_id == User.id)
        .options(joinedload(Booking.space), joinedload(Booking.user))
        .filter(Space.owner_id == owner_id)
    )


@router.get("/slots/{space_id}/calendar", response_model=MonthlyCalendarResponse)
def get_monthly_slot_calendar(
    space_id: int,
    month: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    get_owner_space_or_404(db, current_user.id, space_id)
    year, month_num = [int(part) for part in month.split("-")]
    start_date = date(year, month_num, 1)
    end_date = date(year, month_num, monthrange(year, month_num)[1])

    bookings = (
        db.query(Booking)
        .filter(
            Booking.space_id == space_id,
            Booking.slot_date >= start_date,
            Booking.slot_date <= end_date,
            Booking.status.in_(active_booking_statuses()),
        )
        .all()
    )
    blocks = (
        db.query(SlotBlock)
        .filter(
            SlotBlock.space_id == space_id,
            SlotBlock.blocked_date >= start_date,
            SlotBlock.blocked_date <= end_date,
        )
        .all()
    )

    per_day = {day: {"booked": set(), "blocked": set(), "pending": 0} for day in range(1, end_date.day + 1)}
    for booking in bookings:
        bucket = derive_slot_bucket(booking.slot_time)
        per_day[booking.slot_date.day]["booked"].add(bucket)
        if booking.status == "pending":
            per_day[booking.slot_date.day]["pending"] += 1
    for block in blocks:
        per_day[block.blocked_date.day]["blocked"].add(block.slot_time)

    days = []
    for day_num in range(1, end_date.day + 1):
        entry = per_day[day_num]
        occupied = set(entry["booked"]) | set(entry["blocked"])
        if len(occupied) >= len(SLOT_BUCKETS):
            status = "fully_booked"
        elif occupied:
            status = "partially_booked"
        else:
            status = "fully_available"
        days.append(
            {
                "date": date(year, month_num, day_num),
                "status": status,
                "confirmed_count": len(entry["booked"]),
                "pending_count": entry["pending"],
                "blocked_count": len(entry["blocked"]),
            }
        )
    return {"month": month, "days": days}


@router.get("/slots/{space_id}/{target_date}", response_model=SlotBreakdownResponse)
def get_slot_breakdown(
    space_id: int,
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    get_owner_space_or_404(db, current_user.id, space_id)

    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.user))
        .filter(
            Booking.space_id == space_id,
            Booking.slot_date == target_date,
            Booking.status.in_(active_booking_statuses()),
        )
        .all()
    )
    blocks = db.query(SlotBlock).filter(SlotBlock.space_id == space_id, SlotBlock.blocked_date == target_date).all()

    booking_map: Dict[str, Booking] = {}
    for booking in bookings:
        booking_map[derive_slot_bucket(booking.slot_time)] = booking
    block_map = {block.slot_time: block for block in blocks}

    slots: List[SlotBreakdownItem] = []
    for slot_name in SLOT_BUCKETS:
        if slot_name in block_map:
            block = block_map[slot_name]
            slots.append(
                SlotBreakdownItem(
                    slot_time=slot_name,
                    status="blocked",
                    reason=block.reason,
                )
            )
            continue
        if slot_name in booking_map:
            booking = booking_map[slot_name]
            slots.append(
                SlotBreakdownItem(
                    slot_time=slot_name,
                    status="booked" if booking.status != "pending" else "pending",
                    booking_id=booking.id,
                    booked_by_name=booking.user.name,
                    booked_by_email=booking.user.email,
                    price=booking.price_paid,
                    booking_status=booking.status,
                )
            )
            continue
        slots.append(SlotBreakdownItem(slot_time=slot_name, status="available"))

    return {"date": target_date, "slots": slots}


@router.post("/slots/{space_id}/block")
def block_slot(
    space_id: int,
    payload: SlotBlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    get_owner_space_or_404(db, current_user.id, space_id)
    if payload.slot_time not in SLOT_BUCKETS:
        raise HTTPException(status_code=400, detail="slot_time must be morning, afternoon, evening, or night")

    existing_block = db.query(SlotBlock).filter(
        SlotBlock.space_id == space_id,
        SlotBlock.blocked_date == payload.blocked_date,
        SlotBlock.slot_time == payload.slot_time,
    ).first()
    if existing_block:
        raise HTTPException(status_code=409, detail="Slot already blocked")

    conflict_booking = db.query(Booking).filter(
        Booking.space_id == space_id,
        Booking.slot_date == payload.blocked_date,
        Booking.status.in_(active_booking_statuses()),
    ).all()
    for booking in conflict_booking:
        if derive_slot_bucket(booking.slot_time) == payload.slot_time:
            raise HTTPException(status_code=409, detail="Cannot block a slot that already has a booking")

    block = SlotBlock(
        space_id=space_id,
        blocked_date=payload.blocked_date,
        slot_time=payload.slot_time,
        reason=payload.reason,
        blocked_by=current_user.id,
    )
    db.add(block)
    db.commit()
    return {"message": "Slot blocked"}


@router.delete("/slots/{space_id}/unblock")
def unblock_slot(
    space_id: int,
    payload: SlotBlockDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    get_owner_space_or_404(db, current_user.id, space_id)
    block = db.query(SlotBlock).filter(
        SlotBlock.space_id == space_id,
        SlotBlock.blocked_date == payload.blocked_date,
        SlotBlock.slot_time == payload.slot_time,
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="Blocked slot not found")
    db.delete(block)
    db.commit()
    return {"message": "Slot unblocked"}


@router.post("/slots/{space_id}/unblock")
def unblock_slot_post(
    space_id: int,
    payload: SlotBlockDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    return unblock_slot(space_id, payload, db, current_user)


@router.get("/bookings/pending", response_model=List[OwnerBookingSummary])
def get_pending_booking_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    bookings = (
        base_owner_booking_query(db, current_user.id)
        .filter(Booking.status == "pending")
        .order_by(Booking.request_expires_at.asc().nullslast(), Booking.created_at.desc())
        .all()
    )
    return [booking_to_owner_summary(item) for item in bookings]


@router.patch("/bookings/{booking_id}/approve", response_model=OwnerBookingSummary)
def approve_booking_request(
    booking_id: int,
    payload: BookingDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    booking = (
        base_owner_booking_query(db, current_user.id)
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending bookings can be approved")
    if booking.request_expires_at and booking.request_expires_at < datetime.utcnow():
        booking.status = "auto_rejected"
        booking.reviewed_at = datetime.utcnow()
        booking.rejection_reason = "Request timed out"
        db.commit()
        raise HTTPException(status_code=410, detail="Booking request already expired")

    booking.status = "confirmed"
    booking.reviewed_at = datetime.utcnow()
    booking.rejection_reason = payload.reason
    create_notification(db, booking.user_id, "booking_approved", f"Your booking for {booking.space.name} was approved.")
    create_notification(db, current_user.id, "booking_confirmed", f"Booking confirmed for {booking.space.name} on {booking.slot_date}.")
    db.commit()
    db.refresh(booking)
    return booking_to_owner_summary(booking)


@router.patch("/bookings/{booking_id}/reject", response_model=OwnerBookingSummary)
def reject_booking_request(
    booking_id: int,
    payload: BookingDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    booking = (
        base_owner_booking_query(db, current_user.id)
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending bookings can be rejected")

    booking.status = "rejected"
    booking.reviewed_at = datetime.utcnow()
    booking.rejection_reason = payload.reason or "Rejected by owner"
    create_notification(db, booking.user_id, "booking_rejected", f"Your booking for {booking.space.name} was rejected.")
    db.commit()
    db.refresh(booking)
    return booking_to_owner_summary(booking)


@router.get("/bookings/all", response_model=List[OwnerBookingSummary])
def get_owner_bookings(
    space_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    query = base_owner_booking_query(db, current_user.id)
    if space_id is not None:
        query = query.filter(Booking.space_id == space_id)
    if status:
        query = query.filter(Booking.status == status)
    if from_date:
        query = query.filter(Booking.slot_date >= from_date)
    if to_date:
        query = query.filter(Booking.slot_date <= to_date)
    bookings = query.order_by(Booking.slot_date.desc(), Booking.created_at.desc()).all()
    return [booking_to_owner_summary(item) for item in bookings]


@router.get("/bookings/export")
def export_owner_bookings_csv(
    space_id: Optional[int] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    query = base_owner_booking_query(db, current_user.id)
    if space_id is not None:
        query = query.filter(Booking.space_id == space_id)
    if from_date:
        query = query.filter(Booking.slot_date >= from_date)
    if to_date:
        query = query.filter(Booking.slot_date <= to_date)
    bookings = query.order_by(Booking.slot_date.desc()).all()

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["booking_id", "user_name", "slot_date", "slot_time", "duration", "price_paid", "status"])
    for booking in bookings:
        writer.writerow([
            booking.id,
            booking.user.name,
            booking.slot_date.isoformat(),
            booking.slot_time,
            booking.duration_hours,
            booking.price_paid,
            booking.status,
        ])
    buffer.seek(0)
    filename = "owner_bookings.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _bookings_for_analytics(db: Session, owner_id: int) -> List[Booking]:
    return (
        base_owner_booking_query(db, owner_id)
        .filter(Booking.status.in_(earning_booking_statuses()))
        .all()
    )


def _processed_payout_total(db: Session, owner_id: int) -> float:
    payouts = db.query(Payout).filter(Payout.owner_id == owner_id, Payout.status == "processed").all()
    return round(sum(item.amount for item in payouts), 2)


@router.get("/earnings/summary", response_model=EarningsSummary)
def get_earnings_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    bookings = _bookings_for_analytics(db, current_user.id)
    now = datetime.utcnow()
    week_start = (now - timedelta(days=now.weekday())).date()
    month_start = date(now.year, now.month, 1)

    this_week = sum(item.price_paid for item in bookings if item.slot_date >= week_start)
    this_month = sum(item.price_paid for item in bookings if item.slot_date >= month_start)
    all_time = sum(item.price_paid for item in bookings)
    pending_payout = all_time - _processed_payout_total(db, current_user.id)
    return {
        "this_week": round(this_week, 2),
        "this_month": round(this_month, 2),
        "all_time": round(all_time, 2),
        "pending_payout": round(max(pending_payout, 0.0), 2),
    }


@router.get("/earnings/chart", response_model=List[RevenueChartPoint])
def get_earnings_chart(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    bookings = _bookings_for_analytics(db, current_user.id)
    start_day = datetime.utcnow().date() - timedelta(days=days - 1)
    per_day = defaultdict(float)
    for booking in bookings:
        if booking.slot_date >= start_day:
            per_day[booking.slot_date.isoformat()] += booking.price_paid
    return [
        {"date": (start_day + timedelta(days=offset)).isoformat(), "revenue": round(per_day[(start_day + timedelta(days=offset)).isoformat()], 2)}
        for offset in range(days)
    ]


@router.get("/analytics/by-type", response_model=List[BookingTypePoint])
def get_bookings_by_type(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    bookings = _bookings_for_analytics(db, current_user.id)
    counter = defaultdict(int)
    for booking in bookings:
        counter[booking.space.type] += 1
    return [{"type": key, "count": value} for key, value in counter.items()]


@router.get("/analytics/peak-hours", response_model=List[PeakHourPoint])
def get_peak_hours(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    bookings = _bookings_for_analytics(db, current_user.id)
    counter = defaultdict(int)
    for booking in bookings:
        bucket = derive_slot_bucket(booking.slot_time)
        if ":" in booking.slot_time:
            hour = int(booking.slot_time.split("-", 1)[0].split(":", 1)[0])
        else:
            hour = {"morning": 9, "afternoon": 14, "evening": 18, "night": 21}[bucket]
        counter[(booking.slot_date.weekday(), hour)] += 1
    return [{"weekday": key[0], "hour": key[1], "count": value} for key, value in sorted(counter.items())]


@router.get("/analytics/occupancy", response_model=List[OccupancyPoint])
def get_occupancy_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    spaces = db.query(Space).filter(Space.owner_id == current_user.id).all()
    bookings = _bookings_for_analytics(db, current_user.id)
    last_30_days = datetime.utcnow().date() - timedelta(days=29)
    result = []
    for space in spaces:
        space_bookings = [item for item in bookings if item.space_id == space.id and item.slot_date >= last_30_days]
        occupancy = (len(space_bookings) / (30 * len(SLOT_BUCKETS))) * 100 if space_bookings else 0.0
        result.append({"space_id": space.id, "space_name": space.name, "occupancy_rate": round(occupancy, 2)})
    return result


@router.get("/analytics/per-space", response_model=List[SpaceAnalyticsCard])
def get_per_space_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    spaces = db.query(Space).filter(Space.owner_id == current_user.id).all()
    bookings = _bookings_for_analytics(db, current_user.id)
    cards = []
    for space in spaces:
        space_bookings = [item for item in bookings if item.space_id == space.id]
        slot_counter = defaultdict(int)
        for booking in space_bookings:
            slot_counter[derive_slot_bucket(booking.slot_time)] += 1
        most_booked_slot = max(slot_counter, key=slot_counter.get) if slot_counter else "n/a"
        occupancy = (len([item for item in space_bookings if item.slot_date >= datetime.utcnow().date() - timedelta(days=29)]) / (30 * len(SLOT_BUCKETS))) * 100 if space_bookings else 0.0
        cards.append(
            {
                "space_id": space.id,
                "space_name": space.name,
                "space_type": space.type,
                "total_bookings": len(space_bookings),
                "revenue": round(sum(item.price_paid for item in space_bookings), 2),
                "avg_rating": round(space.rating or 0.0, 2),
                "occupancy_rate": round(occupancy, 2),
                "most_booked_slot": most_booked_slot,
            }
        )
    return cards


@router.get("/reviews", response_model=List[OwnerReviewItem])
def get_owner_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    reviews = (
        db.query(Review)
        .join(Space, Review.space_id == Space.id)
        .join(User, Review.user_id == User.id)
        .options(joinedload(Review.space), joinedload(Review.user), joinedload(Review.reply))
        .filter(Space.owner_id == current_user.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [
        {
            "review_id": review.id,
            "space_id": review.space_id,
            "space_name": review.space.name,
            "user_id": review.user_id,
            "user_name": review.user.name,
            "rating": review.rating,
            "comment": review.comment,
            "sentiment": review.sentiment,
            "is_flagged": bool(review.is_flagged),
            "reply_text": review.reply.reply_text if review.reply else None,
            "created_at": review.created_at,
        }
        for review in reviews
    ]


@router.post("/reviews/{review_id}/reply")
def reply_to_review(
    review_id: int,
    payload: ReviewReplyInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    review = (
        db.query(Review)
        .join(Space, Review.space_id == Space.id)
        .options(joinedload(Review.space), joinedload(Review.reply))
        .filter(Review.id == review_id, Space.owner_id == current_user.id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    reply_text = payload.reply_text.strip()
    if not reply_text:
        raise HTTPException(status_code=400, detail="reply_text is required")

    if review.reply:
        review.reply.reply_text = reply_text
        review.reply.created_at = datetime.utcnow()
    else:
        db.add(ReviewReply(review_id=review.id, owner_id=current_user.id, reply_text=reply_text))
    db.commit()
    return {"message": "Reply saved"}


@router.post("/reviews/{review_id}/flag")
def flag_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    review = (
        db.query(Review)
        .join(Space, Review.space_id == Space.id)
        .filter(Review.id == review_id, Space.owner_id == current_user.id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_flagged = 1
    review.flagged_at = datetime.utcnow()
    db.commit()
    return {"message": "Review flagged for admin review"}


@router.get("/notifications", response_model=List[NotificationItem])
def get_owner_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return notifications


@router.patch("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update(  # noqa: E712
        {"is_read": True},
        synchronize_session=False,
    )
    db.commit()
    return {"message": "All notifications marked as read"}


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}


@router.get("/notifications/settings", response_model=NotificationSettings)
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    profile = get_or_create_owner_profile(db, current_user.id)
    db.commit()
    return {
        "email_types": sorted(csv_pref_set(profile.notification_email_types)),
        "in_app_types": sorted(csv_pref_set(profile.notification_in_app_types)),
        "quiet_hours_start": profile.quiet_hours_start,
        "quiet_hours_end": profile.quiet_hours_end,
    }


@router.patch("/notifications/settings", response_model=NotificationSettings)
def update_notification_settings(
    payload: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    profile = get_or_create_owner_profile(db, current_user.id)
    profile.notification_email_types = pref_csv(payload.email_types)
    profile.notification_in_app_types = pref_csv(payload.in_app_types)
    profile.quiet_hours_start = payload.quiet_hours_start
    profile.quiet_hours_end = payload.quiet_hours_end
    db.commit()
    return {
        "email_types": sorted(csv_pref_set(profile.notification_email_types)),
        "in_app_types": sorted(csv_pref_set(profile.notification_in_app_types)),
        "quiet_hours_start": profile.quiet_hours_start,
        "quiet_hours_end": profile.quiet_hours_end,
    }


@router.get("/profile", response_model=OwnerProfileResponse)
def get_owner_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    profile = get_or_create_owner_profile(db, current_user.id)
    total_earned = round(sum(item.price_paid for item in _bookings_for_analytics(db, current_user.id)), 2)
    db.commit()
    return {
        "business_name": profile.business_name,
        "phone": profile.phone,
        "city": profile.city or current_user.city,
        "gst_number": profile.gst_number,
        "bank_account": profile.bank_account,
        "upi_id": profile.upi_id,
        "payout_frequency": profile.payout_frequency,
        "is_verified": profile.is_verified,
        "total_earned": total_earned,
    }


@router.put("/profile", response_model=OwnerProfileResponse)
def update_owner_profile(
    payload: OwnerProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    profile = get_or_create_owner_profile(db, current_user.id)
    if payload.phone is not None:
        phone_digits = "".join(ch for ch in payload.phone if ch.isdigit())
        if payload.phone.strip() and len(phone_digits) < 10:
            raise HTTPException(status_code=400, detail="Phone number must have at least 10 digits")
    for field in ("business_name", "phone", "city", "gst_number", "bank_account", "upi_id", "payout_frequency"):
        value = getattr(payload, field)
        if value is not None:
            setattr(profile, field, value)

    if payload.city is not None:
        current_user.city = payload.city

    if payload.new_password or payload.confirm_password or payload.old_password:
        if not (payload.old_password and payload.new_password and payload.confirm_password):
            raise HTTPException(status_code=400, detail="old_password, new_password, and confirm_password are required together")
        if payload.new_password != payload.confirm_password:
            raise HTTPException(status_code=400, detail="New password and confirm password must match")
        if not pwd_context.verify(payload.old_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Old password is incorrect")
        current_user.password_hash = pwd_context.hash(payload.new_password)

    db.commit()
    return get_owner_profile(db, current_user)


@router.get("/payouts", response_model=List[PayoutItem])
def get_owner_payouts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    return (
        db.query(Payout)
        .filter(Payout.owner_id == current_user.id)
        .order_by(Payout.created_at.desc())
        .all()
    )


@router.get("/payouts/pending", response_model=PendingPayoutResponse)
def get_pending_payout(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    all_time = sum(item.price_paid for item in _bookings_for_analytics(db, current_user.id))
    pending_amount = round(max(all_time - _processed_payout_total(db, current_user.id), 0.0), 2)
    return {"pending_amount": pending_amount}
