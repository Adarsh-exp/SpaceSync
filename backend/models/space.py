from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class Space(Base):
    __tablename__ = "spaces"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # cricket / party_hall / parking
    city = Column(String, nullable=False)
    area = Column(String, nullable=True)
    base_price = Column(Float, nullable=False)
    amenities = Column(String, default="")  # comma-separated
    rating = Column(Float, default=0.0)
    total_bookings = Column(Integer, default=0)
    image_url = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    booking_mode = Column(String, default="instant")  # instant / request
    opening_time = Column(String, nullable=True, default="09:00")
    closing_time = Column(String, nullable=True, default="22:00")
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="spaces")
    bookings = relationship("Booking", back_populates="space")
    reviews = relationship("Review", back_populates="space")
    slot_blocks = relationship("SlotBlock", back_populates="space")
