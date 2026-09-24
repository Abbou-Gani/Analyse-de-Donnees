import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ResultatAnalyse(Base):
    __tablename__ = "resultats_analyse"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tache_id: Mapped[str] = mapped_column(String(36), ForeignKey("taches_analyse.id"), unique=True)
    resume_statistique: Mapped[dict] = mapped_column(JSON, default=dict)
    anomalies: Mapped[list] = mapped_column(JSON, default=list)
    tendances: Mapped[list] = mapped_column(JSON, default=list)
    recommandations: Mapped[list] = mapped_column(JSON, default=list)
    insights_ia: Mapped[str | None] = mapped_column(Text, nullable=True)
    modele_utilise: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tache = relationship("TacheAnalyse", back_populates="resultat")
