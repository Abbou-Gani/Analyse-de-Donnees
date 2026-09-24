from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.fichier import Fichier
from app.models.resultat_analyse import ResultatAnalyse
from app.models.tache_analyse import TacheAnalyse
from app.services.analyse import analyser_fichier
from app.services.stockage import lire_fichier


def traiter_tache(tache_id: str, forcer: bool = False) -> None:
    from app.core.database import SessionLocale

    base = SessionLocale()
    try:
        tache = base.query(TacheAnalyse).filter(TacheAnalyse.id == tache_id).first()
        if not tache:
            return

        if tache.statut == "termine" and not forcer:
            resultat = tache.resultat
            if resultat and (resultat.resume_statistique or resultat.anomalies or resultat.recommandations):
                return
            # terminé mais résultat vide → on reprend

        if tache.statut == "echoue" and not forcer:
            return

        if tache.statut == "en_cours" and not forcer:
            return

        tache.statut = "en_cours"
        if forcer:
            tache.tentatives = 0
        tache.tentatives += 1
        base.commit()

        fichier = base.query(Fichier).filter(Fichier.id == tache.fichier_id).first()
        if not fichier:
            tache.statut = "echoue"
            base.commit()
            return

        try:
            contenu = lire_fichier(fichier.chemin_stockage)
            resultat = analyser_fichier(contenu, fichier.type_fichier)

            resume = resultat.get("resume") or {}
            anomalies = resultat.get("anomalies") or []
            tendances = resultat.get("tendances") or []
            recommandations = resultat.get("recommandations") or []
            insights = resultat.get("resume_texte")

            if not resume and not anomalies and not tendances and not recommandations and not insights:
                raise ValueError("Analyse vide")

            existant = (
                base.query(ResultatAnalyse)
                .filter(ResultatAnalyse.tache_id == tache.id)
                .first()
            )
            if existant:
                existant.resume_statistique = resume
                existant.anomalies = anomalies
                existant.tendances = tendances
                existant.recommandations = recommandations
                existant.insights_ia = insights
                existant.modele_utilise = "analyse_locale"
            else:
                base.add(
                    ResultatAnalyse(
                        tache_id=tache.id,
                        resume_statistique=resume,
                        anomalies=anomalies,
                        tendances=tendances,
                        recommandations=recommandations,
                        insights_ia=insights,
                        modele_utilise="analyse_locale",
                    )
                )

            tache.statut = "termine"
            tache.termine_le = datetime.now(timezone.utc)
            base.commit()
        except Exception:
            base.rollback()
            tache.statut = "echoue" if tache.tentatives >= 3 else "en_attente"
            base.commit()
    finally:
        base.close()


def relancer_taches_bloquees() -> int:
    """Reprend les tâches bloquées ou les résultats vides au démarrage."""
    from app.core.database import SessionLocale
    from concurrent.futures import ThreadPoolExecutor

    base = SessionLocale()
    try:
        taches = (
            base.query(TacheAnalyse)
            .filter(TacheAnalyse.statut.in_(["en_attente", "en_cours", "echoue"]))
            .all()
        )
        vides = (
            base.query(TacheAnalyse)
            .join(ResultatAnalyse, ResultatAnalyse.tache_id == TacheAnalyse.id)
            .filter(TacheAnalyse.statut == "termine")
            .all()
        )
        ids = {t.id for t in taches}
        for t in vides:
            r = t.resultat
            if not r or not (
                r.resume_statistique or r.anomalies or r.tendances or r.recommandations
            ):
                ids.add(t.id)
    finally:
        base.close()

    if not ids:
        return 0

    with ThreadPoolExecutor(max_workers=3) as pool:
        for tid in ids:
            pool.submit(traiter_tache, tid, True)
    return len(ids)
