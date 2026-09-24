import shutil
import uuid
from pathlib import Path

DOSSIER_STOCKAGE = Path(__file__).resolve().parent.parent.parent / "stockage"
DOSSIER_STOCKAGE.mkdir(exist_ok=True)


def enregistrer_fichier(contenu: bytes, nom_original: str) -> str:
    extension = Path(nom_original).suffix.lower()
    nom_stocke = f"{uuid.uuid4()}{extension}"
    chemin = DOSSIER_STOCKAGE / nom_stocke
    chemin.write_bytes(contenu)
    return nom_stocke


def lire_fichier(chemin_stockage: str) -> bytes:
    return (DOSSIER_STOCKAGE / chemin_stockage).read_bytes()


def supprimer_fichier(chemin_stockage: str) -> None:
    chemin = DOSSIER_STOCKAGE / chemin_stockage
    if chemin.exists():
        chemin.unlink()
