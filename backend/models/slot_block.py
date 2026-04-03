from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.database import Base


class SlotBlock(Base):
    __tablename__ = "slot_blocks"

    id = Column(Integer, primary_key=True, index=True)
    space_id = Column(Integer, ForeignKey("spaces.id"), nullable=False)
    blocked_date = Column(Date, nullable=False)
    slot_time = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    blocked_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    space = relationship("Space", back_populates="slot_blocks")
    blocked_by_user = relationship("User", back_populates="slot_blocks")
