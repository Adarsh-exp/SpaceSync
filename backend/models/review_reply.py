from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from backend.database import Base


class ReviewReply(Base):
    __tablename__ = "review_replies"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False, unique=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reply_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("Review", back_populates="reply")
    owner = relationship("User", back_populates="review_replies")
