from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    space_id = Column(Integer, ForeignKey("spaces.id"), nullable=False)
    slot_date = Column(Date, nullable=False)
    slot_time = Column(String, nullable=False)  # morning / afternoon / evening / night
    duration_hours = Column(Integer, default=1)
    price_paid = Column(Float, nullable=False)
    status = Column(String, default="confirmed")  # pending / confirmed / rejected / cancelled / completed / auto_rejected
    payment_id = Column(String, nullable=True)
    request_expires_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    space = relationship("Space", back_populates="bookings")
