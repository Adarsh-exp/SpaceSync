from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime
import joblib
import numpy as np
import os

from backend.database import get_db
from backend.models.space import Space
from backend.models.booking import Booking
from backend.models.user import User
from backend.auth.jwt_handler import get_current_user

router = APIRouter()

MODELS_DIR = os.path.join(os.path.dirname(__file__), "../ml/models")

SLOT_TIME_MAP = {"morning": 0, "afternoon": 1, "evening": 2, "night": 3}
SPACE_TYPE_MAP = {"cricket": 0, "party_hall": 1, "parking": 2}


def load_model(name: str):
    path = os.path.join(MODELS_DIR, name)
    if not os.path.exists(path):
        raise HTTPException(status_code=503, detail=f"ML model '{name}' not trained yet. Run training scripts.")
    return joblib.load(path)


@router.get("/surge-price/{space_id}")
def get_surge_price(
    space_id: int,
    slot_date: date = Query(...),
    slot_time: str = Query(...),
    db: Session = Depends(get_db),
):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    model = load_model("surge_model.joblib")

    is_weekend = 1 if datetime.strptime(str(slot_date), "%Y-%m-%d").weekday() >= 5 else 0
    slot_encoded = SLOT_TIME_MAP.get(slot_time, 1)
    space_type_encoded = SPACE_TYPE_MAP.get(space.type, 0)

    # Count bookings this week
    bookings_this_week = db.query(Booking).filter(
        Booking.space_id == space_id,
        Booking.status == "confirmed",
    ).count()

    advance_days = max((datetime.strptime(str(slot_date), "%Y-%m-%d") - datetime.utcnow()).days, 0)

    features = np.array([[is_weekend, slot_encoded, bookings_this_week, space_type_encoded, advance_days]])
    surge = float(model.predict(features)[0])
    surge = max(1.0, min(2.5, surge))

    return {
        "space_id": space_id,
        "base_price": space.base_price,
        "surge_multiplier": round(surge, 2),
        "dynamic_price": round(space.base_price * surge, 2),
        "slot_time": slot_time,
        "slot_date": str(slot_date),
    }


@router.get("/availability/{space_id}")
def get_availability(
    space_id: int,
    slot_date: date = Query(...),
    slot_time: str = Query(...),
    db: Session = Depends(get_db),
):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    model = load_model("availability_model.joblib")

    is_weekend = 1 if datetime.strptime(str(slot_date), "%Y-%m-%d").weekday() >= 5 else 0
    slot_encoded = SLOT_TIME_MAP.get(slot_time, 1)
    space_type_encoded = SPACE_TYPE_MAP.get(space.type, 0)
    advance_days = max((datetime.strptime(str(slot_date), "%Y-%m-%d") - datetime.utcnow()).days, 0)

    features = np.array([[space_type_encoded, slot_encoded, is_weekend, advance_days,
                          space.rating or 3.0, space.total_bookings or 0]])
    prob = float(model.predict_proba(features)[0][1])

    return {
        "space_id": space_id,
        "slot_date": str(slot_date),
        "slot_time": slot_time,
        "fill_probability": round(prob * 100, 1),
        "message": "High demand — book soon!" if prob > 0.7 else "Good availability",
    }


@router.get("/recommend")
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = load_model("recommender.joblib")
    matrix = data["matrix"]
    scaler = data["scaler"]
    space_ids = data["space_ids"]

    # Build user preference vector
    type_pref = 0  # default cricket
    city_pref = 0
    budget = (current_user.budget_min + current_user.budget_max) / 2 if current_user.budget_max else 1000
    rating_pref = 4.0
    amenities_pref = 5

    user_vector = scaler.transform([[type_pref, city_pref, budget, rating_pref, amenities_pref]])

    from sklearn.metrics.pairwise import cosine_similarity
    scores = cosine_similarity(user_vector, matrix)[0]
    top_indices = scores.argsort()[::-1][:5]
    top_space_ids = [space_ids[i] for i in top_indices]

    spaces = db.query(Space).filter(Space.id.in_(top_space_ids)).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "type": s.type,
            "city": s.city,
            "base_price": s.base_price,
            "rating": s.rating,
            "image_url": s.image_url,
        }
        for s in spaces
    ]
