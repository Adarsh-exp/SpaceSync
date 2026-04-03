from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    city = Column(String, nullable=True)
    budget_min = Column(Integer, default=0)
    budget_max = Column(Integer, default=10000)
    role = Column(String, default="user")  # user / owner / admin
    created_at = Column(DateTime, default=datetime.utcnow)

    bookings = relationship("Booking", back_populates="user")
    reviews = relationship("Review", back_populates="user")
    spaces = relationship("Space", back_populates="owner")
    slot_blocks = relationship("SlotBlock", back_populates="blocked_by_user")
    notifications = relationship("Notification", back_populates="user")
    review_replies = relationship("ReviewReply", back_populates="owner")
    payouts = relationship("Payout", back_populates="owner")
    owner_profile = relationship("OwnerProfile", back_populates="user", uselist=False)

    @property
    def business_phone(self):
        return self.owner_profile.phone if self.owner_profile else None

    @property
    def business_name(self):
        return self.owner_profile.business_name if self.owner_profile else None
