from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import obtenir_base
from app.core.deps import obtenir_utilisateur_courant
from app.core.security import hacher_mot_de_passe, verifier_mot_de_passe
from app.models.organisation import Organisation
from app.models.utilisateur import Utilisateur
from app.schemas.organisation import ParametresEntree, ParametresSortie

routeur = APIRouter(prefix="/parametres", tags=["parametres"])

ROLES_VALIDES = ("admin", "utilisateur")
ROLES_ADMIN = ("proprietaire", "admin")


def est_admin(utilisateur: Utilisateur) -> bool:
    return utilisateur.role in ROLES_ADMIN


@routeur.get("", response_model=ParametresSortie)
def lire_parametres(
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    organisation = (
        base.query(Organisation)
        .filter(Organisation.id == utilisateur.organisation_id)
        .first()
    )
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation introuvable")
    return ParametresSortie(utilisateur=utilisateur, organisation=organisation)


@routeur.patch("", response_model=ParametresSortie)
def modifier_parametres(
    donnees: ParametresEntree,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    organisation = (
        base.query(Organisation)
        .filter(Organisation.id == utilisateur.organisation_id)
        .first()
    )
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation introuvable")

    if donnees.nom_organisation is not None:
        nom = donnees.nom_organisation.strip()
        if not nom:
            raise HTTPException(status_code=400, detail="Le nom ne peut pas être vide")
        if not est_admin(utilisateur):
            raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
        organisation.nom = nom

    if donnees.email is not None:
        email = donnees.email.lower()
        if email != utilisateur.email:
            existe = (
                base.query(Utilisateur)
                .filter(Utilisateur.email == email, Utilisateur.id != utilisateur.id)
                .first()
            )
            if existe:
                raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")
            utilisateur.email = email

    if donnees.nouveau_mot_de_passe:
        if not donnees.mot_de_passe_actuel:
            raise HTTPException(
                status_code=400, detail="Mot de passe actuel requis"
            )
        if not verifier_mot_de_passe(
            donnees.mot_de_passe_actuel, utilisateur.mot_de_passe_hache
        ):
            raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
        utilisateur.mot_de_passe_hache = hacher_mot_de_passe(donnees.nouveau_mot_de_passe)

    base.commit()
    base.refresh(utilisateur)
    base.refresh(organisation)
    return ParametresSortie(utilisateur=utilisateur, organisation=organisation)
