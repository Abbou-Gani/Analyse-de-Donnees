import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Fichier(Base):
    __tablename__ = "fichiers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organisation_id: Mapped[str] = mapped_column(String(36), ForeignKey("organisations.id"))
    utilisateur_id: Mapped[str] = mapped_column(String(36), ForeignKey("utilisateurs.id"))
    nom_original: Mapped[str] = mapped_column(String(255))
    chemin_stockage: Mapped[str] = mapped_column(String(500))
    type_fichier: Mapped[str] = mapped_column(String(10))
    taille: Mapped[int] = mapped_column(Integer)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    proprietaire = relationship("Utilisateur", back_populates="fichiers")
    taches = relationship("TacheAnalyse", back_populates="fichier")
