from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import obtenir_base
from app.core.deps import obtenir_utilisateur_courant
from app.models.fichier import Fichier
from app.models.tache_analyse import TacheAnalyse
from app.models.utilisateur import Utilisateur
from app.schemas.fichier import InsightItem, InsightsSortie

routeur = APIRouter(prefix="/insights", tags=["insights"])


@routeur.get("", response_model=InsightsSortie)
def lister_insights(
    utilisateur: Utilisateur = Depends(obtenir_utilisateur_courant),
    base: Session = Depends(obtenir_base),
):
    fichiers = (
        base.query(Fichier)
        .filter(Fichier.organisation_id == utilisateur.organisation_id)
        .order_by(Fichier.cree_le.desc())
        .all()
    )

    insights: list[InsightItem] = []
    total_anomalies = 0
    total_valeurs_aberrantes = 0
    total_tendances = 0
    tendances_hausse = 0
    tendances_baisse = 0
    total_recommandations = 0

    for fichier in fichiers:
        tache = (
            base.query(TacheAnalyse)
            .filter(TacheAnalyse.fichier_id == fichier.id)
            .first()
        )
        if not tache or tache.statut != "termine" or not tache.resultat:
            continue

        resultat = tache.resultat
        anomalies = resultat.anomalies or []
        tendances = resultat.tendances or []
        recommandations = resultat.recommandations or []
        hausses = sum(1 for t in tendances if t.get("sens") == "hausse")
        baisses = sum(1 for t in tendances if t.get("sens") == "baisse")
        valeurs_aberrantes = sum(
            a.get("nombre_valeurs_aberrantes", 0) for a in anomalies
        )

        total_anomalies += len(anomalies)
        total_valeurs_aberrantes += valeurs_aberrantes
        total_tendances += len(tendances)
        tendances_hausse += hausses
        tendances_baisse += baisses
        total_recommandations += len(recommandations)

        insights.append(
            InsightItem(
                fichier_id=fichier.id,
                nom_fichier=fichier.nom_original,
                type_fichier=fichier.type_fichier,
                taille=fichier.taille,
                analyse_le=tache.termine_le,
                insights_ia=resultat.insights_ia,
                modele_utilise=resultat.modele_utilise,
                nombre_anomalies=len(anomalies),
                nombre_valeurs_aberrantes=valeurs_aberrantes,
                nombre_tendances=len(tendances),
                tendances_hausse=hausses,
                tendances_baisse=baisses,
                tendances=tendances,
                recommandations=recommandations,
                resume_statistique=resultat.resume_statistique or {},
            )
        )

    return InsightsSortie(
        total_fichiers=len(fichiers),
        total_analyses=len(insights),
        total_anomalies=total_anomalies,
        total_valeurs_aberrantes=total_valeurs_aberrantes,
        total_tendances=total_tendances,
        tendances_hausse=tendances_hausse,
        tendances_baisse=tendances_baisse,
        total_recommandations=total_recommandations,
        insights=insights,
    )
