import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TacheAnalyse(Base):
    __tablename__ = "taches_analyse"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fichier_id: Mapped[str] = mapped_column(String(36), ForeignKey("fichiers.id"))
    statut: Mapped[str] = mapped_column(String(20), default="en_attente")
    tentatives: Mapped[int] = mapped_column(Integer, default=0)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    termine_le: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    fichier = relationship("Fichier", back_populates="taches")
    resultat = relationship("ResultatAnalyse", back_populates="tache", uselist=False)
