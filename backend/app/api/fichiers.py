from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import parametres
from app.core.database import obtenir_base
from app.core.deps import obtenir_utilisateur_courant
from app.models.fichier import Fichier
from app.models.tache_analyse import TacheAnalyse
from app.models.utilisateur import Utilisateur
from app.schemas.fichier import FichierSortie, ResultatSortie, TacheSortie
from app.services.stockage import enregistrer_fichier, supprimer_fichier
from app.workers.traitement import traiter_tache

routeur = APIRouter(prefix="/fichiers", tags=["fichiers"])


@routeur.post("", response_model=FichierSortie, status_code=status.HTTP_201_CREATED)
async def uploader_fichier(
    fichier: UploadFile,
    background: BackgroundTasks,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    nom = fichier.filename or "sans_nom"
    extension = Path(nom).suffix.lower()
    if extension not in parametres.EXTENSIONS_AUTORISEES:
        raise HTTPException(status_code=400, detail=f"Extension non autorisée : {extension}")

    contenu = await fichier.read()
    if len(contenu) > parametres.TAILLE_MAX_FICHIER:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")
    if not contenu:
        raise HTTPException(status_code=400, detail="Fichier vide")

    chemin_stockage = enregistrer_fichier(contenu, nom)

    nouveau_fichier = Fichier(
        organisation_id=utilisateur.organisation_id,
        utilisateur_id=utilisateur.id,
        nom_original=nom,
        chemin_stockage=chemin_stockage,
        type_fichier=extension.lstrip("."),
        taille=len(contenu),
    )
    base.add(nouveau_fichier)
    base.flush()

    tache = TacheAnalyse(fichier_id=nouveau_fichier.id)
    base.add(tache)
    base.commit()
    base.refresh(nouveau_fichier)
    base.refresh(tache)

    background.add_task(traiter_tache, tache.id)

    return nouveau_fichier


@routeur.get("", response_model=list[FichierSortie])
def lister_fichiers(
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    return (
        base.query(Fichier)
        .filter(Fichier.organisation_id == utilisateur.organisation_id)
        .order_by(Fichier.cree_le.desc())
        .all()
    )


@routeur.get("/{fichier_id}", response_model=FichierSortie)
def details_fichier(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    return _obtenir_fichier(fichier_id, utilisateur, base)


@routeur.get("/{fichier_id}/statut", response_model=TacheSortie)
def statut_fichier(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    tache = base.query(TacheAnalyse).filter(TacheAnalyse.fichier_id == fichier.id).first()
    if not tache:
        raise HTTPException(status_code=404, detail="Aucune tâche trouvée")
    return tache


@routeur.get("/{fichier_id}/resultat", response_model=ResultatSortie)
def resultat_fichier(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    tache = base.query(TacheAnalyse).filter(TacheAnalyse.fichier_id == fichier.id).first()
    if not tache:
        raise HTTPException(status_code=404, detail="Aucune tâche trouvée")
    if tache.statut != "termine":
        raise HTTPException(status_code=409, detail=f"Analyse en cours (statut : {tache.statut})")
    resultat = tache.resultat
    if not resultat or not (
        resultat.resume_statistique
        or resultat.anomalies
        or resultat.tendances
        or resultat.recommandations
    ):
        raise HTTPException(
            status_code=409,
            detail="Résultat vide — lancez une nouvelle analyse",
        )
    return resultat


@routeur.post("/{fichier_id}/relancer", response_model=TacheSortie)
def relancer_analyse(
    fichier_id: str,
    background: BackgroundTasks,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    tache = base.query(TacheAnalyse).filter(TacheAnalyse.fichier_id == fichier.id).first()
    if not tache:
        raise HTTPException(status_code=404, detail="Aucune tâche trouvée")

    tache.statut = "en_attente"
    tache.tentatives = 0
    tache.termine_le = None
    base.commit()
    base.refresh(tache)

    background.add_task(traiter_tache, tache.id, True)
    return tache


@routeur.delete("/{fichier_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    supprimer_fichier(fichier.chemin_stockage)
    base.delete(fichier)
    base.commit()


def _obtenir_fichier(fichier_id: str, utilisateur: Utilisateur, base: Session) -> Fichier:
    fichier = base.query(Fichier).filter(Fichier.id == fichier_id).first()
    if not fichier:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    if fichier.organisation_id != utilisateur.organisation_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return fichier
