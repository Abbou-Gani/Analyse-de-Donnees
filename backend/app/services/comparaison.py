"""Comparaison de deux analyses successives d'un même fichier.

Compare les résultats persistés (`resultats_analyse`) entre la version
précédente et la version courante : volume, colonnes, statistiques clés,
anomalies et tendances.
"""

MESURES_A_COMPARER = ("mean", "min", "max", "50%")


def _cle_anomalie(anomalie: dict) -> str:
    colonne = anomalie.get("colonne") or ""
    feuille = anomalie.get("feuille")
    return f"{feuille}.{colonne}" if feuille else colonne


def _cle_tendance(tendance: dict) -> str:
    colonne = tendance.get("colonne") or ""
    feuille = tendance.get("feuille")
    return f"{feuille}.{colonne}" if feuille else colonne


def _entree_manquantes(resume: dict) -> dict:
    manquantes = resume.get("valeurs_manquantes") or {}
    return {"total": int(sum(manquantes.values())), "colonnes": len(manquantes)}


def _entree_doublons(resume: dict) -> dict:
    doublons = resume.get("doublons") or {}
    return {
        "groupes": int(doublons.get("groupes") or 0),
        "lignes_concernees": int(doublons.get("lignes_concernees") or 0),
    }


def _statistiques(avant: dict, apres: dict) -> list[dict]:
    """Écart des indicateurs clés, colonne par colonne."""
    stats_avant = avant.get("statistiques") or {}
    stats_apres = apres.get("statistiques") or {}
    lignes = []
    for colonne in sorted(set(stats_avant) | set(stats_apres)):
        serie_avant = stats_avant.get(colonne) or {}
        serie_apres = stats_apres.get(colonne) or {}
        for mesure in MESURES_A_COMPARER:
            valeur_avant = serie_avant.get(mesure)
            valeur_apres = serie_apres.get(mesure)
            if valeur_avant is None and valeur_apres is None:
                continue
            if valeur_avant is None or valeur_apres is None:
                lignes.append(
                    {
                        "colonne": colonne,
                        "mesure": mesure,
                        "statut": "nouvelle" if valeur_avant is None else "disparue",
                        "avant": valeur_avant,
                        "apres": valeur_apres,
                        "delta": None,
                        "variation_pct": None,
                    }
                )
                continue
            delta = float(valeur_apres) - float(valeur_avant)
            if abs(delta) < 1e-9:
                continue
            variation = (delta / abs(float(valeur_avant)) * 100) if valeur_avant else None
            lignes.append(
                {
                    "colonne": colonne,
                    "mesure": mesure,
                    "statut": "modifiee",
                    "avant": float(valeur_avant),
                    "apres": float(valeur_apres),
                    "delta": round(delta, 4),
                    "variation_pct": round(variation, 2) if variation is not None else None,
                }
            )
    return lignes


def _anomalies(anomalies_avant: list, anomalies_apres: list) -> dict:
    cles_avant = {_cle_anomalie(a): a for a in anomalies_avant}
    cles_apres = {_cle_anomalie(a): a for a in anomalies_apres}
    nouvelles = [cles_apres[c] for c in sorted(set(cles_apres) - set(cles_avant))]
    resolues = [cles_avant[c] for c in sorted(set(cles_avant) - set(cles_apres))]
    aggravées = []
    conservees = set(cles_avant) & set(cles_apres)
    for cle in sorted(conservees):
        avant = int(cles_avant[cle].get("nombre_valeurs_aberrantes") or 0)
        apres = int(cles_apres[cle].get("nombre_valeurs_aberrantes") or 0)
        if apres > avant:
            aggravées.append(
                {
                    "colonne": cles_apres[cle].get("colonne"),
                    "feuille": cles_apres[cle].get("feuille"),
                    "avant": avant,
                    "apres": apres,
                }
            )
    return {
        "total_avant": len(anomalies_avant),
        "total_apres": len(anomalies_apres),
        "nouvelles": nouvelles,
        "resolues": resolues,
        "aggravees": aggravées,
    }


def _tendances(tendances_avant: list, tendances_apres: list) -> list[dict]:
    cles_avant = {_cle_tendance(t): t for t in tendances_avant}
    cles_apres = {_cle_tendance(t): t for t in tendances_apres}
    changements = []
    for cle in sorted(set(cles_avant) | set(cles_apres)):
        avant = cles_avant.get(cle)
        apres = cles_apres.get(cle)
        sens_avant = avant.get("sens") if avant else None
        sens_apres = apres.get("sens") if apres else None
        pct_avant = avant.get("evolution_pourcentage") if avant else None
        pct_apres = apres.get("evolution_pourcentage") if apres else None
        if sens_avant == sens_apres and pct_avant == pct_apres:
            continue
        changements.append(
            {
                "colonne": (apres or avant).get("colonne"),
                "feuille": (apres or avant).get("feuille"),
                "sens_avant": sens_avant,
                "sens_apres": sens_apres,
                "evolution_avant": pct_avant,
                "evolution_apres": pct_apres,
                "inversee": bool(
                    sens_avant and sens_apres and sens_avant != sens_apres and "stable" not in (sens_avant, sens_apres)
                ),
            }
        )
    return changements


def comparer(res_avant: dict, res_apres: dict) -> dict:
    """Compare deux résultats persistés (`resultats_analyse` sérialisés).

    On ne lit que `resume_statistique`, `anomalies`, `tendances` et
    `recommandations`. Les métriques absentes d'un type de fichier
    (Word n'a pas de lignes, Excel pas de paragraphes) sont omises.
    """
    resume_avant = res_avant.get("resume_statistique") or {}
    resume_apres = res_apres.get("resume_statistique") or {}

    colonnes_avant = set(
        (resume_avant.get("colonnes_numeriques") or [])
        + (resume_avant.get("colonnes_texte") or [])
        + (resume_avant.get("colonnes_dates") or [])
    )
    colonnes_apres = set(
        (resume_apres.get("colonnes_numeriques") or [])
        + (resume_apres.get("colonnes_texte") or [])
        + (resume_apres.get("colonnes_dates") or [])
    )

    volume = {
        "manquantes_avant": _entree_manquantes(resume_avant),
        "manquantes_apres": _entree_manquantes(resume_apres),
        "doublons_avant": _entree_doublons(resume_avant),
        "doublons_apres": _entree_doublons(resume_apres),
    }
    for cle, libelle in (
        ("nombre_lignes_total", "lignes"),
        ("nombre_feuilles", "feuilles"),
        ("nombre_paragraphes", "paragraphes"),
        ("nombre_mots", "mots"),
        ("nombre_tableaux", "tableaux"),
    ):
        avant = resume_avant.get(cle)
        apres = resume_apres.get(cle)
        if avant is None and apres is None:
            continue
        volume[f"{libelle}_avant"] = int(avant or 0)
        volume[f"{libelle}_apres"] = int(apres or 0)

    return {
        "volume": volume,
        "colonnes": {
            "ajoutees": sorted(colonnes_apres - colonnes_avant),
            "retirees": sorted(colonnes_avant - colonnes_apres),
        },
        "statistiques": _statistiques(resume_avant, resume_apres),
        "anomalies": _anomalies(
            res_avant.get("anomalies") or [], res_apres.get("anomalies") or []
        ),
        "tendances": _tendances(
            res_avant.get("tendances") or [], res_apres.get("tendances") or []
        ),
        "recommandations_avant": len(res_avant.get("recommandations") or []),
        "recommandations_apres": len(res_apres.get("recommandations") or []),
    }
