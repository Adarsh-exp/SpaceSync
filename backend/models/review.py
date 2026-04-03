from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    space_id = Column(Integer, ForeignKey("spaces.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    sentiment = Column(String, default="neutral")  # positive / negative / neutral
    is_flagged = Column(Integer, default=0)
    flagged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reviews")
    space = relationship("Space", back_populates="reviews")
    reply = relationship("ReviewReply", back_populates="review", uselist=False)
