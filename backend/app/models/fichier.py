import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.services.stockage import fichier_disponible


class Fichier(Base):
    __tablename__ = "fichiers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organisation_id: Mapped[str] = mapped_column(String(36), ForeignKey("organisations.id"))
    utilisateur_id: Mapped[str] = mapped_column(String(36), ForeignKey("utilisateurs.id"))
    nom_original: Mapped[str] = mapped_column(String(255))
    chemin_stockage: Mapped[str] = mapped_column(String(500))
    type_fichier: Mapped[str] = mapped_column(String(10))
    taille: Mapped[int] = mapped_column(Integer)
    empreinte: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fichier_precedent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("fichiers.id"), nullable=True
    )
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    precedent = relationship("Fichier", remote_side=[id])

    proprietaire = relationship("Utilisateur", back_populates="fichiers")
    taches = relationship("TacheAnalyse", back_populates="fichier", cascade="all, delete-orphan")
    journal = relationship(
        "JournalActivite", back_populates="fichier", cascade="all, delete-orphan"
    )

    @property
    def disponible(self) -> bool:
        return fichier_disponible(self.chemin_stockage)

    @property
    def version(self) -> int:
        """Rang de cette version dans la chaîne de réimports (1 = premier import)."""
        numero, courant = 1, self.precedent
        while courant is not None and numero < 100:
            numero += 1
            courant = courant.precedent
        return numero

# Import tardif : fait connaître JournalActivite au mapper de Fichier
# (résolution du nom de la relationship "journal").
from app.models.journal import JournalActivite  # noqa: E402,F401
