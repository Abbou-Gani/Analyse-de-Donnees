from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import obtenir_base
from app.core.security import decoder_jeton
from app.models.utilisateur import Utilisateur

schema_oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/connexion")


def obtenir_utilisateur_courant(
    jeton: str = Depends(schema_oauth2),
    base: Session = Depends(obtenir_base),
) -> Utilisateur:
    charge = decoder_jeton(jeton)
    if not charge or charge.get("type") != "acces":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Jeton invalide")
    utilisateur = base.query(Utilisateur).filter(Utilisateur.id == charge.get("sub")).first()
    if not utilisateur:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")
    return utilisateur
