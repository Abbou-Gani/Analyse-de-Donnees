from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import parametres

contexte_hachage = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    return contexte_hachage.hash(mot_de_passe)


def verifier_mot_de_passe(clair: str, hache: str) -> bool:
    return contexte_hachage.verify(clair, hache)


def creer_jeton_acces(sujet: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(minutes=parametres.DUREE_VIE_JETON_ACCES_MIN)
    charge = {"sub": sujet, "exp": expiration, "type": "acces"}
    return jwt.encode(charge, parametres.CLE_SECRETE, algorithm=parametres.ALGORITHME)


def creer_jeton_rafraichissement(sujet: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(days=parametres.DUREE_VIE_JETON_RERAFRAICHISSEMENT_JOURS)
    charge = {"sub": sujet, "exp": expiration, "type": "rafraichissement"}
    return jwt.encode(charge, parametres.CLE_SECRETE, algorithm=parametres.ALGORITHME)


def decoder_jeton(jeton: str) -> dict | None:
    try:
        return jwt.decode(jeton, parametres.CLE_SECRETE, algorithms=[parametres.ALGORITHME])
    except JWTError:
        return None
