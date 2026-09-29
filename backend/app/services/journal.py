from sqlalchemy.orm import Session

from app.models.journal import JournalActivite


def consigner(
    base: Session,
    action: str,
    details: str | None = None,
    fichier_id: str | None = None,
    utilisateur_id: str | None = None,
) -> None:
    """Ajoute une entrée au journal d'activité (appelé dans une transaction)."""
    base.add(
        JournalActivite(
            fichier_id=fichier_id,
            utilisateur_id=utilisateur_id,
            action=action,
            details=details,
        )
    )
