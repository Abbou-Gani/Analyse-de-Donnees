from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import obtenir_base
from app.core.deps import obtenir_utilisateur_courant
from app.core.security import hacher_mot_de_passe
from app.models.utilisateur import Utilisateur
from app.schemas.organisation import (
    MembreInvitationEntree,
    MembreMajEntree,
    MembreSortie,
)
from app.api.parametres import ROLES_ADMIN, ROLES_VALIDES, est_admin

routeur = APIRouter(prefix="/equipe", tags=["equipe"])


@routeur.get("", response_model=list[MembreSortie])
def lister_membres(
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    return (
        base.query(Utilisateur)
        .filter(Utilisateur.organisation_id == utilisateur.organisation_id)
        .order_by(Utilisateur.cree_le.asc())
        .all()
    )


@routeur.post("", response_model=MembreSortie, status_code=status.HTTP_201_CREATED)
def inviter_membre(
    donnees: MembreInvitationEntree,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    if not est_admin(utilisateur):
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")

    role = donnees.role if donnees.role in ROLES_VALIDES else "utilisateur"
    email = donnees.email.lower()
    if base.query(Utilisateur).filter(Utilisateur.email == email).first():
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")

    membre = Utilisateur(
        organisation_id=utilisateur.organisation_id,
        email=email,
        mot_de_passe_hache=hacher_mot_de_passe(donnees.mot_de_passe),
        role=role,
    )
    base.add(membre)
    base.commit()
    base.refresh(membre)
    return membre


@routeur.patch("/{membre_id}", response_model=MembreSortie)
def modifier_role(
    membre_id: str,
    donnees: MembreMajEntree,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    if not est_admin(utilisateur):
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    if donnees.role not in ROLES_VALIDES:
        raise HTTPException(status_code=400, detail="Rôle invalide")

    membre = _obtenir_membre(membre_id, utilisateur, base)
    if membre.id == utilisateur.id:
        raise HTTPException(status_code=400, detail="Impossible de changer son propre rôle")
    if membre.role in ROLES_ADMIN and donnees.role not in ROLES_ADMIN:
        admins = [
            u
            for u in base.query(Utilisateur)
            .filter(Utilisateur.organisation_id == utilisateur.organisation_id)
            .all()
            if u.role in ROLES_ADMIN
        ]
        if len(admins) <= 1:
            raise HTTPException(
                status_code=400, detail="Impossible de retirer le dernier administrateur"
            )

    membre.role = donnees.role
    base.commit()
    base.refresh(membre)
    return membre


@routeur.delete("/{membre_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_membre(
    membre_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    if not est_admin(utilisateur):
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")

    membre = _obtenir_membre(membre_id, utilisateur, base)
    if membre.id == utilisateur.id:
        raise HTTPException(status_code=400, detail="Impossible de se supprimer soi-même")
    if membre.role in ROLES_ADMIN:
        admins = [
            u
            for u in base.query(Utilisateur)
            .filter(Utilisateur.organisation_id == utilisateur.organisation_id)
            .all()
            if u.role in ROLES_ADMIN
        ]
        if len(admins) <= 1:
            raise HTTPException(
                status_code=400, detail="Impossible de retirer le dernier administrateur"
            )

    base.delete(membre)
    base.commit()


def _obtenir_membre(membre_id: str, utilisateur: Utilisateur, base: Session) -> Utilisateur:
    membre = base.query(Utilisateur).filter(Utilisateur.id == membre_id).first()
    if not membre:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if membre.organisation_id != utilisateur.organisation_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return membre
