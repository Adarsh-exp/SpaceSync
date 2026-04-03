from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models.review import Review
from backend.models.review_reply import ReviewReply
from backend.models.space import Space
from backend.models.user import User
from backend.schemas.booking import ReviewCreate, ReviewOut, ReviewUpdate
from backend.auth.jwt_handler import get_current_user
from backend.ml.sentiment import get_sentiment
from backend.services.owner_support import create_notification

router = APIRouter()


@router.post("", response_model=ReviewOut)
def submit_review(
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = db.query(Space).filter(Space.id == review_data.space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    sentiment = get_sentiment(review_data.comment or "")

    review = Review(
        user_id=current_user.id,
        space_id=review_data.space_id,
        rating=review_data.rating,
        comment=review_data.comment,
        sentiment=sentiment,
    )
    db.add(review)

    # Recalculate space rating
    all_reviews = db.query(Review).filter(Review.space_id == review_data.space_id).all()
    ratings = [r.rating for r in all_reviews] + [review_data.rating]
    space.rating = round(sum(ratings) / len(ratings), 2)

    db.commit()
    db.refresh(review)
    create_notification(
        db,
        space.owner_id,
        "new_review",
        f"New review posted for {space.name} by {current_user.name}.",
    )
    db.commit()
    return ReviewOut(
        id=review.id,
        user_id=review.user_id,
        space_id=review.space_id,
        rating=review.rating,
        comment=review.comment,
        sentiment=review.sentiment,
        is_flagged=bool(review.is_flagged),
        reply_text=review.reply.reply_text if review.reply else None,
        created_at=review.created_at,
    )


@router.get("/space/{space_id}", response_model=List[ReviewOut])
def get_space_reviews(space_id: int, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.space_id == space_id).all()
    return [
        ReviewOut(
            id=review.id,
            user_id=review.user_id,
            space_id=review.space_id,
            rating=review.rating,
            comment=review.comment,
            sentiment=review.sentiment,
            is_flagged=bool(review.is_flagged),
            reply_text=review.reply.reply_text if review.reply else None,
            created_at=review.created_at,
        )
        for review in reviews
    ]


@router.put("/{review_id}", response_model=ReviewOut)
def update_review(
    review_id: int,
    review_data: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can edit only your own review")

    review.rating = review_data.rating
    review.comment = review_data.comment
    review.sentiment = get_sentiment(review_data.comment or "")

    all_reviews = db.query(Review).filter(Review.space_id == review.space_id).all()
    ratings = [item.rating for item in all_reviews]
    review.space.rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    db.commit()
    db.refresh(review)
    return ReviewOut(
        id=review.id,
        user_id=review.user_id,
        space_id=review.space_id,
        rating=review.rating,
        comment=review.comment,
        sentiment=review.sentiment,
        is_flagged=bool(review.is_flagged),
        reply_text=review.reply.reply_text if review.reply else None,
        created_at=review.created_at,
    )


@router.delete("/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can delete only your own review")

    space = review.space
    reply = db.query(ReviewReply).filter(ReviewReply.review_id == review.id).first()
    if reply:
        db.delete(reply)
    db.delete(review)
    db.flush()

    remaining_reviews = db.query(Review).filter(Review.space_id == space.id).all()
    space.rating = round(sum(item.rating for item in remaining_reviews) / len(remaining_reviews), 2) if remaining_reviews else 0.0

    db.commit()
    return {"message": "Review deleted"}
