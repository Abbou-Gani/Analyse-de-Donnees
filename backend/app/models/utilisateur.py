import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organisation_id: Mapped[str] = mapped_column(String(36), ForeignKey("organisations.id"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    mot_de_passe_hache: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="membre")
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation", back_populates="utilisateurs")
    fichiers = relationship("Fichier", back_populates="proprietaire")
