import shutil
import uuid
from pathlib import Path

DOSSIER_STOCKAGE = Path(__file__).resolve().parent.parent.parent / "stockage"
DOSSIER_STOCKAGE.mkdir(exist_ok=True)


class FichierPhysiqueIntrouvable(Exception):
    """La référence existe en base mais le fichier a disparu du disque."""


def enregistrer_fichier(contenu: bytes, nom_original: str) -> str:
    extension = Path(nom_original).suffix.lower()
    nom_stocke = f"{uuid.uuid4()}{extension}"
    chemin = DOSSIER_STOCKAGE / nom_stocke
    chemin.write_bytes(contenu)
    return nom_stocke


def lire_fichier(chemin_stockage: str) -> bytes:
    chemin = DOSSIER_STOCKAGE / chemin_stockage
    if not chemin.is_file():
        raise FichierPhysiqueIntrouvable(
            f"Le fichier « {chemin_stockage} » n'existe plus dans le stockage du serveur."
        )
    return chemin.read_bytes()


def supprimer_fichier(chemin_stockage: str) -> None:
    chemin = DOSSIER_STOCKAGE / chemin_stockage
    if chemin.exists():
        chemin.unlink()


def fichier_disponible(chemin_stockage: str) -> bool:
    """Vrai si la copie physique existe encore sur le disque."""
    try:
        return (DOSSIER_STOCKAGE / chemin_stockage).is_file()
    except OSError:
        return False
