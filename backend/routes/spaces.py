from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from backend.database import get_db
from backend.models.space import Space
from backend.models.user import User
from backend.schemas.space import SpaceCreate, SpaceUpdate, SpaceOut, SpaceEnquiryCreate
from backend.auth.jwt_handler import get_current_user, require_owner
from backend.services.owner_support import create_notification
from backend.services.storage import upload_space_image

router = APIRouter()


def normalize_service_hours(opening_time: Optional[str], closing_time: Optional[str]):
    if not opening_time and not closing_time:
        return None, None
    if not opening_time or not closing_time:
        raise HTTPException(status_code=422, detail="Opening and closing time must be provided together")

    try:
        opening = datetime.strptime(opening_time, "%H:%M").strftime("%H:%M")
        closing = datetime.strptime(closing_time, "%H:%M").strftime("%H:%M")
    except ValueError:
        raise HTTPException(status_code=422, detail="Opening and closing time must be in HH:MM format")

    if opening >= closing:
        raise HTTPException(status_code=422, detail="Closing time must be later than opening time")

    return opening, closing


@router.get("", response_model=List[SpaceOut])
def list_spaces(
    name: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    budget_min: Optional[float] = Query(None),
    budget_max: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Space)
    if name:
        query = query.filter(Space.name.ilike(f"%{name}%"))
    if type:
        query = query.filter(Space.type == type)
    if city:
        query = query.filter(Space.city.ilike(f"%{city}%"))
    if budget_min is not None:
        query = query.filter(Space.base_price >= budget_min)
    if budget_max is not None:
        query = query.filter(Space.base_price <= budget_max)
    # Show latest listings first so newly added owner spaces are visible immediately.
    return query.order_by(Space.created_at.desc(), Space.id.desc()).all()


@router.get("/{space_id}", response_model=SpaceOut)
def get_space(space_id: int, db: Session = Depends(get_db)):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    return space


@router.post("", response_model=SpaceOut)
def create_space(
    space_data: SpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    payload = space_data.dict()
    payload["opening_time"], payload["closing_time"] = normalize_service_hours(
        payload.get("opening_time"),
        payload.get("closing_time"),
    )
    space = Space(**payload, owner_id=current_user.id)
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


@router.put("/{space_id}", response_model=SpaceOut)
def update_space(
    space_id: int,
    space_data: SpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    if space.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your space")

    updates = space_data.dict(exclude_unset=True)
    if "opening_time" in updates or "closing_time" in updates:
        updates["opening_time"], updates["closing_time"] = normalize_service_hours(
            updates.get("opening_time", space.opening_time),
            updates.get("closing_time", space.closing_time),
        )

    for field, value in updates.items():
        setattr(space, field, value)
    db.commit()
    db.refresh(space)
    return space


@router.delete("/{space_id}")
def delete_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    if space.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your space")

    db.delete(space)
    db.commit()
    return {"message": "Space deleted"}


@router.post("/{space_id}/images")
async def upload_image(
    space_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    if space.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your space")
    space.image_url = await upload_space_image(space_id, file)
    db.commit()
    return {"image_url": space.image_url}


@router.post("/{space_id}/enquiry")
def send_space_enquiry(
    space_id: int,
    payload: SpaceEnquiryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    create_notification(
        db,
        space.owner_id,
        "space_enquiry",
        f"New enquiry from {current_user.name} ({current_user.email}) for {space.name}: {message}",
    )
    db.commit()
    return {"message": "Enquiry sent successfully"}
