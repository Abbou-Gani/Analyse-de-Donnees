import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class JournalActivite(Base):
    __tablename__ = "journal_activite"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fichier_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("fichiers.id", ondelete="CASCADE"), nullable=True
    )
    utilisateur_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(50))
    details: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    fichier = relationship("Fichier", back_populates="journal")
    utilisateur = relationship("Utilisateur", back_populates="journal")
