import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Organisation(Base):
    __tablename__ = "organisations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nom: Mapped[str] = mapped_column(String(255))
    plan_abonnement: Mapped[str] = mapped_column(String(50), default="gratuit")
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    utilisateurs = relationship("Utilisateur", back_populates="organisation")
