from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import obtenir_base
from app.core.deps import obtenir_utilisateur_courant
from app.core.security import (
    creer_jeton_acces,
    creer_jeton_rafraichissement,
    decoder_jeton,
    hacher_mot_de_passe,
    verifier_mot_de_passe,
)
from app.models.organisation import Organisation
from app.models.utilisateur import Utilisateur
from app.schemas.auth import (
    ConnexionEntree,
    InscriptionEntree,
    JetonSortie,
    RafraichissementEntree,
    UtilisateurSortie,
)

routeur = APIRouter(prefix="/auth", tags=["authentification"])


@routeur.post("/inscription", response_model=UtilisateurSortie, status_code=status.HTTP_201_CREATED)
def inscrire(donnees: InscriptionEntree, base: Session = Depends(obtenir_base)):
    if base.query(Utilisateur).filter(Utilisateur.email == donnees.email).first():
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")

    organisation = Organisation(nom=donnees.nom_organisation)
    base.add(organisation)
    base.flush()

    utilisateur = Utilisateur(
        organisation_id=organisation.id,
        email=donnees.email,
        mot_de_passe_hache=hacher_mot_de_passe(donnees.mot_de_passe),
        role="proprietaire",
    )
    base.add(utilisateur)
    base.commit()
    base.refresh(utilisateur)
    return utilisateur


@routeur.post("/connexion", response_model=JetonSortie)
def connecter(donnees: ConnexionEntree, base: Session = Depends(obtenir_base)):
    utilisateur = base.query(Utilisateur).filter(Utilisateur.email == donnees.email).first()
    if not utilisateur or not verifier_mot_de_passe(donnees.mot_de_passe, utilisateur.mot_de_passe_hache):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    return JetonSortie(
        jeton_acces=creer_jeton_acces(utilisateur.id),
        jeton_rafraichissement=creer_jeton_rafraichissement(utilisateur.id),
    )


@routeur.post("/rafraichir", response_model=JetonSortie)
def rafraichir(donnees: RafraichissementEntree, base: Session = Depends(obtenir_base)):
    charge = decoder_jeton(donnees.jeton_rafraichissement)
    if not charge or charge.get("type") != "rafraichissement":
        raise HTTPException(status_code=401, detail="Jeton de rafraîchissement invalide")
    utilisateur = base.query(Utilisateur).filter(Utilisateur.id == charge.get("sub")).first()
    if not utilisateur:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return JetonSortie(
        jeton_acces=creer_jeton_acces(utilisateur.id),
        jeton_rafraichissement=creer_jeton_rafraichissement(utilisateur.id),
    )


@routeur.get("/moi", response_model=UtilisateurSortie)
def mon_compte(utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant)):
    return utilisateur
