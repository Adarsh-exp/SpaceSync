from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.database import Base


class OwnerProfile(Base):
    __tablename__ = "owner_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    business_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    bank_account = Column(String, nullable=True)
    upi_id = Column(String, nullable=True)
    payout_frequency = Column(String, default="weekly")
    is_verified = Column(Boolean, default=False)
    notification_email_types = Column(String, default="")
    notification_in_app_types = Column(String, default="booking_request,booking_confirmed,booking_cancelled,new_review,payout_processed")
    quiet_hours_start = Column(String, nullable=True)
    quiet_hours_end = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="owner_profile")
