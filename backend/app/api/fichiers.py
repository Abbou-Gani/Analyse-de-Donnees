from pathlib import Path
import hashlib
import io
import re

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import parametres
from app.core.database import obtenir_base
from app.core.deps import obtenir_utilisateur_courant
from app.models.fichier import Fichier
from app.models.journal import JournalActivite
from app.models.tache_analyse import TacheAnalyse
from app.models.utilisateur import Utilisateur
from app.schemas.fichier import (
    ComparaisonSortie,
    EntreeJournal,
    MarcheSortie,
    FichierSortie,
    ResultatSortie,
    TacheSortie,
    VersionAnalyse,
)
from app.services.comparaison import comparer
from app.services.export_pdf import construire_pdf, nom_sortie_pdf
from app.services.export_xlsx import construire_export
from app.services.analyse_excel import _serialiser_cellule
from app.services.journal import consigner
from app.services.marche import REFERENTIELS, confronter_marche
from app.services.stockage import (
    FichierPhysiqueIntrouvable,
    enregistrer_fichier,
    fichier_disponible,
    lire_fichier,
    supprimer_fichier,
)
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
    empreinte = hashlib.sha256(contenu).hexdigest()

    precedent = (
        base.query(Fichier)
        .filter(
            Fichier.organisation_id == utilisateur.organisation_id,
            Fichier.nom_original == nom,
        )
        .order_by(Fichier.cree_le.desc())
        .first()
    )

    nouveau_fichier = Fichier(
        organisation_id=utilisateur.organisation_id,
        utilisateur_id=utilisateur.id,
        nom_original=nom,
        chemin_stockage=chemin_stockage,
        type_fichier=extension.lstrip("."),
        taille=len(contenu),
        empreinte=empreinte,
        fichier_precedent_id=precedent.id if precedent else None,
    )
    base.add(nouveau_fichier)
    base.flush()

    tache = TacheAnalyse(fichier_id=nouveau_fichier.id)
    base.add(tache)
    consigner(
        base,
        "televersement",
        f"{nom} ({len(contenu)} octets)",
        fichier_id=nouveau_fichier.id,
        utilisateur_id=utilisateur.id,
    )
    if precedent:
        version = precedent.version + 1
        details = f"{nom} — version {version} (précédente du {precedent.cree_le:%d/%m/%Y %H:%M})"
        if empreinte == precedent.empreinte:
            details += ", contenu identique"
        consigner(
            base,
            "nouvelle_version",
            details,
            fichier_id=nouveau_fichier.id,
            utilisateur_id=utilisateur.id,
        )
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


@routeur.get("/referentiels")
def referentiels_marche():
    """Référentiels externes utilisables pour croiser un fichier."""
    return [
        {"id": identifiant, "libelle": ref["libelle"], "source": ref["source"]}
        for identifiant, ref in REFERENTIELS.items()
    ]


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
    sortie = TacheSortie.model_validate(tache)
    sortie.fichier_disponible = fichier_disponible(fichier.chemin_stockage)
    return sortie


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


@routeur.get("/{fichier_id}/export")
def exporter_resultat(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    tache = base.query(TacheAnalyse).filter(TacheAnalyse.fichier_id == fichier.id).first()
    if not tache:
        raise HTTPException(status_code=404, detail="Aucune tâche trouvée")
    resultat = tache.resultat
    if not resultat:
        raise HTTPException(status_code=409, detail="Aucun résultat à exporter")

    contenu = construire_export(
        nom_fichier=fichier.nom_original,
        resume=resultat.resume_statistique or {},
        anomalies=resultat.anomalies or [],
        tendances=resultat.tendances or [],
        recommandations=resultat.recommandations or [],
        insights=resultat.insights_ia,
    )

    base_nom = re.sub(r"[^\w\-. ]+", "", Path(fichier.nom_original).stem).strip() or "analyse"
    nom_sortie = f"{base_nom}_analyse.xlsx"
    consigner(
        base,
        "export_xlsx",
        nom_sortie,
        fichier_id=fichier.id,
        utilisateur_id=utilisateur.id,
    )
    base.commit()
    return Response(
        content=contenu,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nom_sortie}"'},
    )


@routeur.get("/{fichier_id}/export/pdf")
def exporter_pdf(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    tache = base.query(TacheAnalyse).filter(TacheAnalyse.fichier_id == fichier.id).first()
    if not tache:
        raise HTTPException(status_code=404, detail="Aucune tâche trouvée")
    resultat = tache.resultat
    if not resultat:
        raise HTTPException(status_code=409, detail="Aucun résultat à exporter")

    contenu = construire_pdf(
        nom_fichier=fichier.nom_original,
        resume=resultat.resume_statistique or {},
        anomalies=resultat.anomalies or [],
        tendances=resultat.tendances or [],
        recommandations=resultat.recommandations or [],
        insights=resultat.insights_ia,
    )
    nom_sortie = nom_sortie_pdf(fichier.nom_original)
    consigner(
        base,
        "export_pdf",
        nom_sortie,
        fichier_id=fichier.id,
        utilisateur_id=utilisateur.id,
    )
    base.commit()
    return Response(
        content=contenu,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom_sortie}"'},
    )


@routeur.get("/{fichier_id}/journal", response_model=list[EntreeJournal])
def journal_fichier(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    _obtenir_fichier(fichier_id, utilisateur, base)
    return (
        base.query(JournalActivite)
        .filter(JournalActivite.fichier_id == fichier_id)
        .order_by(JournalActivite.cree_le.desc())
        .all()
    )


@routeur.get("/{fichier_id}/comparaison", response_model=ComparaisonSortie)
def comparaison_fichier(
    fichier_id: str,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    """Écarts entre cette version du fichier et l'import précédent du même nom."""
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    if not fichier.fichier_precedent_id:
        raise HTTPException(
            status_code=404,
            detail="Aucune version précédente : premier import de ce fichier",
        )
    precedent = (
        base.query(Fichier).filter(Fichier.id == fichier.fichier_precedent_id).first()
    )
    if not precedent or precedent.organisation_id != utilisateur.organisation_id:
        raise HTTPException(status_code=404, detail="Version précédente introuvable")

    resultat_precedent = _resultat_analyse(precedent, base)
    resultat_courant = _resultat_analyse(fichier, base)
    if not resultat_precedent or not resultat_courant:
        raise HTTPException(
            status_code=409, detail="Analyse manquante — lancez une nouvelle analyse"
        )

    return {
        "precedent": _description_version(precedent),
        "courant": _description_version(fichier),
        "diff": comparer(
            ResultatSortie.model_validate(resultat_precedent).model_dump(),
            ResultatSortie.model_validate(resultat_courant).model_dump(),
        ),
    }


@routeur.get("/{fichier_id}/marche", response_model=MarcheSortie)
def marche_fichier(
    fichier_id: str,
    secteur: str = "detail",
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    """Croise les résultats d'analyse avec une référence externe (données de marché)."""
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    resultat = _resultat_analyse(fichier, base)
    if not resultat:
        raise HTTPException(
            status_code=409, detail="Analyse manquante — lancez une nouvelle analyse"
        )
    return confronter_marche(
        ResultatSortie.model_validate(resultat).model_dump(), secteur
    )


@routeur.get("/{fichier_id}/donnees")
def donnees_fichier(
    fichier_id: str,
    feuille: str | None = None,
    limite: int = 2000,
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    """Lignes brutes du fichier pour alimenter le dashboard côté client."""
    fichier = _obtenir_fichier(fichier_id, utilisateur, base)
    if fichier.type_fichier not in ("xlsx", "xls", "csv"):
        raise HTTPException(
            status_code=409,
            detail="Le dashboard est réservé aux fichiers tabulaires (Excel).",
        )
    limite = max(100, min(limite, 5000))

    try:
        contenu = lire_fichier(fichier.chemin_stockage)
    except FichierPhysiqueIntrouvable:
        raise HTTPException(
            status_code=410,
            detail=(
                "Le fichier n'existe plus sur le serveur. "
                "Réimportez-le depuis « Importer » pour réactiver le dashboard."
            ),
        )

    try:
        classeur = pd.ExcelFile(io.BytesIO(contenu))
        feuilles = list(classeur.sheet_names)
        nom = feuille if feuille in feuilles else feuilles[0]
        df = classeur.parse(nom)
    except Exception as err:
        raise HTTPException(status_code=422, detail=f"Lecture du fichier impossible : {err}")

    colonnes = []
    for c in df.columns:
        serie = df[c]
        if pd.api.types.is_numeric_dtype(serie):
            type_col = "numerique"
        elif pd.api.types.is_datetime64_any_dtype(serie):
            type_col = "date"
        else:
            type_col = "texte"
        colonnes.append({"nom": str(c), "type": type_col})

    lignes = [
        {str(c): _serialiser_cellule(v) for c, v in zip(df.columns, valeurs)}
        for valeurs in df.head(limite).itertuples(index=False, name=None)
    ]

    return {
        "feuilles": feuilles,
        "feuille": nom,
        "colonnes": colonnes,
        "lignes": lignes,
        "nombre_lignes": int(len(df)),
        "tronque": bool(len(df) > limite),
    }


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
    consigner(
        base,
        "relance_analyse",
        "Analyse relancée manuellement",
        fichier_id=fichier.id,
        utilisateur_id=utilisateur.id,
    )
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
    nom = fichier.nom_original
    supprimer_fichier(fichier.chemin_stockage)
    consigner(
        base,
        "suppression",
        f"{nom} supprimé du serveur",
        utilisateur_id=utilisateur.id,
    )
    base.delete(fichier)
    base.commit()


def _obtenir_fichier(fichier_id: str, utilisateur: Utilisateur, base: Session) -> Fichier:
    fichier = base.query(Fichier).filter(Fichier.id == fichier_id).first()
    if not fichier:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    if fichier.organisation_id != utilisateur.organisation_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return fichier


def _resultat_analyse(fichier: Fichier, base: Session):
    tache = base.query(TacheAnalyse).filter(TacheAnalyse.fichier_id == fichier.id).first()
    return tache.resultat if tache else None


def _description_version(fichier: Fichier) -> dict:
    return VersionAnalyse(
        id=fichier.id,
        nom_original=fichier.nom_original,
        taille=fichier.taille,
        version=fichier.version,
        cree_le=fichier.cree_le,
        disponible=fichier.disponible,
    ).model_dump()
