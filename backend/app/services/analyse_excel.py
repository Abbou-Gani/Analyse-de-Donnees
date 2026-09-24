import io

import pandas as pd


def analyser_excel(contenu: bytes) -> dict:
    fichier_excel = pd.ExcelFile(io.BytesIO(contenu), engine="openpyxl")
    feuilles = {}
    anomalies = []
    tendances = []
    recommandations = []
    resume_global = {
        "nombre_feuilles": 0,
        "nombre_lignes_total": 0,
        "statistiques": {},
        "valeurs_manquantes": {},
        "colonnes_numeriques": [],
        "colonnes_texte": [],
        "colonnes_dates": [],
    }

    for nom_feuille in fichier_excel.sheet_names:
        df = fichier_excel.parse(nom_feuille)
        if df.empty:
            continue
        analyse_feuille = _analyser_tableau(df, nom_feuille)
        feuilles[nom_feuille] = analyse_feuille

        resume = analyse_feuille["resume"]
        resume_global["nombre_feuilles"] += 1
        resume_global["nombre_lignes_total"] += resume["nombre_lignes"]
        resume_global["colonnes_numeriques"].extend(resume["colonnes_numeriques"])
        resume_global["colonnes_texte"].extend(resume["colonnes_texte"])
        resume_global["colonnes_dates"].extend(resume["colonnes_dates"])
        resume_global["statistiques"].update(resume["statistiques"])
        for col, nb in resume["valeurs_manquantes"].items():
            resume_global["valeurs_manquantes"][f"{nom_feuille}.{col}"] = nb

        anomalies.extend(analyse_feuille["anomalies"])
        tendances.extend(analyse_feuille["tendances"])
        recommandations.extend(analyse_feuille["recommandations"])

    recommandations = _dedupliquer_recommandations(recommandations)
    if not recommandations:
        recommandations.append(
            {
                "titre": "Données propres",
                "detail": (
                    f"Les {resume_global['nombre_lignes_total']} ligne(s) et "
                    f"{resume_global['nombre_feuilles']} feuille(s) analysées ne "
                    "présentent ni valeur manquante, ni anomalie marquée."
                ),
                "action": (
                    "Vous pouvez utiliser ces chiffres tels quels pour vos "
                    "tableaux de bord et rapports."
                ),
                "priorite": "info",
            }
        )
    else:
        recommandations = _completer_recommandations_globales(
            recommandations, resume_global, anomalies, tendances
        )

    resume_texte = _generer_resume_texte(resume_global, anomalies, tendances)

    return {
        "type": "excel",
        "resume": resume_global,
        "resume_texte": resume_texte,
        "feuilles": feuilles,
        "anomalies": anomalies,
        "tendances": tendances,
        "recommandations": recommandations,
    }


def _generer_resume_texte(resume: dict, anomalies: list, tendances: list) -> str:
    parties = [
        f"Classeur de {resume['nombre_feuilles']} feuille(s) et "
        f"{resume['nombre_lignes_total']} ligne(s) au total, avec "
        f"{len(resume.get('colonnes_numeriques') or [])} colonne(s) chiffrée(s) exploitables."
    ]
    stats = resume.get("statistiques") or {}
    if stats:
        noms = ", ".join(f"« {c} »" for c in list(stats.keys())[:4])
        if len(stats) > 4:
            noms += f"… ({len(stats)} au total)"
        parties.append(f"Indicateurs suivis : {noms}.")
    if anomalies:
        total_aberrantes = sum(a["nombre_valeurs_aberrantes"] for a in anomalies)
        colonnes = ", ".join(a["colonne"] for a in anomalies[:3])
        parties.append(
            f"{len(anomalies)} colonne(s) présentent des valeurs aberrantes "
            f"({total_aberrantes} en tout), dont {colonnes} — à vérifier avant diffusion."
        )
    else:
        parties.append("Aucune valeur aberrante détectée.")
    if tendances:
        hausses = [t for t in tendances if t["sens"] == "hausse"]
        baisses = [t for t in tendances if t["sens"] == "baisse"]
        if hausses:
            t = hausses[0]
            parties.append(
                f"Tendance de hausse sur « {t['colonne']} » "
                f"({t['evolution_pourcentage']:+.1f}%), "
                f"de {t['valeur_premiere']} à {t['valeur_derniere']}."
            )
        if baisses:
            t = baisses[0]
            parties.append(
                f"Tendance de baisse sur « {t['colonne']} » "
                f"({t['evolution_pourcentage']:+.1f}%), "
                f"de {t['valeur_premiere']} à {t['valeur_derniere']} — priorité à investiguer."
            )
        if not hausses and not baisses:
            parties.append("Évolutions stables entre les périodes.")
    manquantes = resume.get("valeurs_manquantes") or {}
    if manquantes:
        total = sum(manquantes.values())
        cols = ", ".join(list(manquantes.keys())[:3])
        parties.append(
            f"{total} valeur(s) manquante(s) à traiter ({cols}) avant analyse approfondie."
        )
    else:
        parties.append("Aucune donnée manquante.")
    return " ".join(parties)


def _analyser_tableau(df: pd.DataFrame, nom_feuille: str | None = None) -> dict:
    colonnes_numeriques = df.select_dtypes(include="number")
    colonnes_texte = df.select_dtypes(exclude="number")
    colonnes_dates = df.select_dtypes(include=["datetime", "datetimetz"])

    resume = {
        "nombre_lignes": int(len(df)),
        "nombre_colonnes": int(len(df.columns)),
        "colonnes_numeriques": list(colonnes_numeriques.columns),
        "colonnes_texte": list(colonnes_texte.columns),
        "colonnes_dates": list(colonnes_dates.columns),
        "valeurs_manquantes": {c: int(df[c].isna().sum()) for c in df.columns if df[c].isna().any()},
        "statistiques": {},
    }

    if not colonnes_numeriques.empty:
        stats = colonnes_numeriques.describe().to_dict()
        resume["statistiques"] = {
            col: {k: (float(v) if pd.notna(v) else None) for k, v in valeurs.items()}
            for col, valeurs in stats.items()
        }

    anomalies = _detecter_anomalies(colonnes_numeriques, nom_feuille)
    tendances = _detecter_tendances(df, colonnes_dates, colonnes_numeriques, nom_feuille)
    recommandations = _generer_recommandations(
        resume, anomalies, tendances, colonnes_texte, colonnes_dates, nom_feuille
    )

    return {
        "resume": resume,
        "anomalies": anomalies,
        "tendances": tendances,
        "recommandations": recommandations,
    }


def _detecter_anomalies(
    colonnes_numeriques: pd.DataFrame, nom_feuille: str | None = None
) -> list[dict]:
    anomalies = []
    for col in colonnes_numeriques.columns:
        serie = colonnes_numeriques[col].dropna()
        if len(serie) < 4:
            continue
        q1, q3 = serie.quantile(0.25), serie.quantile(0.75)
        iqr = q3 - q1
        borne_basse, borne_haute = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        valeurs_aberrantes = serie[(serie < borne_basse) | (serie > borne_haute)]
        if not valeurs_aberrantes.empty:
            anomalie = {
                "colonne": col,
                "nombre_valeurs_aberrantes": int(len(valeurs_aberrantes)),
                "valeurs": [float(v) for v in valeurs_aberrantes.head(10)],
                "borne_basse": float(borne_basse),
                "borne_haute": float(borne_haute),
                "pourcentage": round(float(len(valeurs_aberrantes) / len(serie) * 100), 2),
                "moyenne": float(serie.mean()) if len(serie) else None,
                "mediane": float(serie.median()) if len(serie) else None,
            }
            if nom_feuille:
                anomalie["feuille"] = nom_feuille
            anomalies.append(anomalie)
    return anomalies


def _detecter_tendances(
    df,
    colonnes_dates,
    colonnes_numeriques,
    nom_feuille: str | None = None,
) -> list[dict]:
    tendances = []
    if colonnes_dates.empty or colonnes_numeriques.empty:
        return tendances

    colonne_date = colonnes_dates.columns[0]
    for col in colonnes_numeriques.columns:
        donnees = df[[colonne_date, col]].dropna().sort_values(colonne_date)
        if len(donnees) < 3:
            continue
        premiere, derniere = donnees[col].iloc[0], donnees[col].iloc[-1]
        if premiere == 0:
            continue
        evolution = ((derniere - premiere) / abs(premiere)) * 100
        tendance = {
            "colonne": col,
            "colonne_date": str(colonne_date),
            "valeur_premiere": float(premiere),
            "valeur_derniere": float(derniere),
            "evolution_pourcentage": round(float(evolution), 2),
            "sens": "hausse" if evolution > 0 else "baisse" if evolution < 0 else "stable",
            "valeur_min": float(donnees[col].min()),
            "valeur_max": float(donnees[col].max()),
            "valeur_moyenne": float(donnees[col].mean()),
            "nombre_points": int(len(donnees)),
        }
        if nom_feuille:
            tendance["feuille"] = nom_feuille
        tendances.append(tendance)
    return tendances


def _format_nombre(valeur) -> str:
    if valeur is None or (isinstance(valeur, float) and pd.isna(valeur)):
        return "—"
    try:
        n = float(valeur)
    except (TypeError, ValueError):
        return str(valeur)
    if float(n).is_integer():
        return f"{int(n):,}".replace(",", " ")
    return f"{n:,.2f}".replace(",", " ")


def _libelle_contexte(nom_feuille: str | None) -> str:
    if nom_feuille:
        return f" (feuille « {nom_feuille} »)"
    return ""


def _dedupliquer_recommandations(recommandations: list) -> list:
    vus = set()
    uniques = []
    for reco in recommandations:
        if isinstance(reco, dict):
            cle = (reco.get("titre"), reco.get("detail"))
        else:
            cle = reco
        if cle in vus:
            continue
        vus.add(cle)
        uniques.append(reco)
    return uniques


def _generer_recommandations(
    resume: dict,
    anomalies: list,
    tendances: list,
    colonnes_texte,
    colonnes_dates,
    nom_feuille: str | None = None,
) -> list[dict]:
    recommandations = []
    contexte = _libelle_contexte(nom_feuille)
    nb_lignes = resume.get("nombre_lignes") or 0
    nb_colonnes = resume.get("nombre_colonnes") or 0

    manquantes = resume.get("valeurs_manquantes") or {}
    if manquantes:
        total = sum(manquantes.values())
        total_cellules = max(nb_lignes * nb_colonnes, 1)
        pourcentage = round(total / total_cellules * 100, 2)
        details_cols = ", ".join(
            f"« {col} » : {n} cellule(s) vide(s)" for col, n in list(manquantes.items())[:5]
        )
        if len(manquantes) > 5:
            details_cols += f"… et {len(manquantes) - 5} autre(s) colonne(s)"
        recommandations.append(
            {
                "titre": "Compléter les données manquantes",
                "detail": (
                    f"{total} valeur(s) manquante(s) sur {total_cellules} cellules "
                    f"({pourcentage} %){contexte} — {details_cols}. "
                    "Sans ces valeurs, les moyennes et les totaux peuvent être faussés."
                ),
                "action": (
                    "Ouvrez le fichier, filtrez les colonnes concernées et renseignez "
                    "les cellules vides (ou excluez-en les lignes) avant de conclure."
                ),
                "priorite": "haute",
            }
        )

    for anomalie in anomalies:
        ctx = _libelle_contexte(anomalie.get("feuille"))
        valeurs_ex = ", ".join(_format_nombre(v) for v in anomalie["valeurs"][:3])
        moyenne = _format_nombre(anomalie.get("moyenne"))
        recommandations.append(
            {
                "titre": f"Vérifier les valeurs atypiques de « {anomalie['colonne']} »",
                "detail": (
                    f"{anomalie['nombre_valeurs_aberrantes']} valeur(s) sortent de la "
                    f"fourchette habituelle ({_format_nombre(anomalie['borne_basse'])} à "
                    f"{_format_nombre(anomalie['borne_haute'])})"
                    f"{ctx}, soit {anomalie.get('pourcentage', 0)} % de la colonne. "
                    f"Exemples : {valeurs_ex}. "
                    f"La moyenne de la colonne est {moyenne}."
                ),
                "action": (
                    "Comparez ces valeurs avec la source d'origine : saisie incorrecte, "
                    "unité différente ou cas réel exceptionnel à isoler."
                ),
                "priorite": "haute",
            }
        )

    for tendance in tendances:
        ctx = _libelle_contexte(tendance.get("feuille"))
        sens = tendance["sens"]
        if sens == "hausse":
            lecture = "en hausse"
            conseil = (
                "Si cette hausse est souhaitée, identifiez ce qui a marché et "
                "pérennisez-le. Sinon, investiguez la période du retournement."
            )
        elif sens == "baisse":
            lecture = "en baisse"
            conseil = (
                "Priorisez cette baisse : croisez-la avec les autres colonnes "
                "et les commentaires métier pour trouver la cause."
            )
        else:
            lecture = "stable"
            conseil = (
                "Pas d'urgence particulière : surveillez-la aux prochains imports "
                "pour confirmer la stabilité."
            )
        recommandations.append(
            {
                "titre": f"Suivre l'évolution de « {tendance['colonne']} »",
                "detail": (
                    f"Valeur {lecture} de "
                    f"{_format_nombre(tendance['valeur_premiere'])} à "
                    f"{_format_nombre(tendance['valeur_derniere'])} "
                    f"({tendance['evolution_pourcentage']:+.1f} %) entre "
                    f"{tendance['colonne_date']} les extrêmes de la série{ctx}. "
                    f"Minimum {_format_nombre(tendance.get('valeur_min'))}, "
                    f"maximum {_format_nombre(tendance.get('valeur_max'))}, "
                    f"moyenne {_format_nombre(tendance.get('valeur_moyenne'))} "
                    f"sur {tendance.get('nombre_points', '?')} point(s)."
                ),
                "action": conseil,
                "priorite": "haute" if sens == "baisse" else "moyenne",
            }
        )

    noms_texte = list(dict.fromkeys(colonnes_texte.columns)) if hasattr(colonnes_texte, "columns") else list(colonnes_texte)
    if noms_texte:
        liste = ", ".join(f"« {c} »" for c in noms_texte[:6])
        if len(noms_texte) > 6:
            liste += f"… ({len(noms_texte)} au total)"
        nb_uniques = {c: int(colonnes_texte[c].nunique()) for c in noms_texte[:6]} if hasattr(colonnes_texte, "columns") else {}
        detail_uniques = ""
        if nb_uniques:
            detail_uniques = " Cardinalité : " + ", ".join(
                f"{c} → {n} valeur(s) distincte(s)" for c, n in nb_uniques.items()
            ) + "."
        recommandations.append(
            {
                "titre": "Croiser les résultats par catégorie",
                "detail": (
                    f"Colonnes textuelles détectées : {liste}.{detail_uniques}{contexte} "
                    "Un regroupement par catégorie fait souvent ressortir les vrais "
                    "moteurs (meilleur segment, zone, produit…)."
                ),
                "action": (
                    "Filtrez ou totalisez vos indicateurs clés selon ces colonnes "
                    "(tableau croisé / pivot dans Excel) avant de décider."
                ),
                "priorite": "moyenne",
            }
        )

    if list(colonnes_dates.columns) if hasattr(colonnes_dates, "columns") else list(colonnes_dates):
        cols_d = list(colonnes_dates.columns) if hasattr(colonnes_dates, "columns") else list(colonnes_dates)
        if cols_d:
            recommandations.append(
                {
                    "titre": "Structurer une analyse dans le temps",
                    "detail": (
                        f"Colonne(s) de date détectée(s) : "
                        f"{', '.join(f'« {c} »' for c in cols_d[:3])}{contexte}. "
                        "Les indicateurs chiffrés peuvent être suivis mois par mois "
                        "ou période par période pour isoler les ruptures."
                    ),
                    "action": (
                        "Ajoutez une colonne Période (mois/trim.) et comparez "
                        "moyennes et totaux d'une période à l'autre."
                    ),
                    "priorite": "info",
                }
            )

    stats = resume.get("statistiques") or {}
    if stats:
        plus_disperse = None
        ecart_max = None
        for col, s in stats.items():
            ecart = s.get("std")
            if ecart is None:
                continue
            if ecart_max is None or ecart > ecart_max:
                ecart_max = ecart
                plus_disperse = col
        if plus_disperse and ecart_max is not None:
            s = stats[plus_disperse]
            recommandations.append(
                {
                    "titre": f"Approfondir la colonne la plus volatile « {plus_disperse} »",
                    "detail": (
                        f"Écart-type de {_format_nombre(ecart_max)} — la plus forte "
                        f"dispersion du fichier{contexte}. "
                        f"Min {_format_nombre(s.get('min'))}, max {_format_nombre(s.get('max'))}, "
                        f"médiane {_format_nombre(s.get('50%'))} sur "
                        f"{_format_nombre(s.get('count'))} valeur(s)."
                    ),
                    "action": (
                        "Découpez-la par catégorie ou par période pour comprendre "
                        "ce qui crée ces écarts."
                    ),
                    "priorite": "moyenne",
                }
            )

    if nb_lignes and nb_lignes < 5:
        recommandations.append(
            {
                "titre": "Échantillon très court",
                "detail": (
                    f"Seulement {nb_lignes} ligne(s){contexte} : les moyennes et "
                    "pourcentages ont peu de signification statistique."
                ),
                "action": (
                    "Complétez le jeu de données avant d'en tirer des conclusions "
                    "ou présentez les chiffres à titre indicatif."
                ),
                "priorite": "haute",
            }
        )

    if not recommandations:
        recommandations.append(
            {
                "titre": "Aucune action prioritaire",
                "detail": (
                    f"{nb_lignes} ligne(s) et {nb_colonnes} colonne(s){contexte} "
                    "sans anomalie marquée ni valeur manquante."
                ),
                "action": (
                    "Utilisez les statistiques du résumé pour alimenter vos "
                    "reportings en toute confiance."
                ),
                "priorite": "info",
            }
        )

    return recommandations


def _completer_recommandations_globales(
    recommandations: list,
    resume: dict,
    anomalies: list,
    tendances: list,
) -> list:
    """Ajoute un conseil de synthèse si le classeur est riche."""
    if resume.get("nombre_feuilles", 0) > 1:
        recommandations.append(
            {
                "titre": "Harmoniser les feuilles du classeur",
                "detail": (
                    f"{resume['nombre_feuilles']} feuilles et "
                    f"{resume['nombre_lignes_total']} ligne(s) au total. "
                    f"{len(anomalies)} anomalie(s) et {len(tendances)} tendance(s) "
                    "détectée(s) dans l'ensemble du fichier."
                ),
                "action": (
                    "Vérifiez que les colonnes portent le même nom et la même unité "
                    "d'une feuille à l'autre avant de consolider."
                ),
                "priorite": "info",
            }
        )
    if anomalies and tendances:
        noms_a = ", ".join(sorted({a["colonne"] for a in anomalies})[:3])
        noms_t = ", ".join(sorted({t["colonne"] for t in tendances})[:3])
        recommandations.append(
            {
                "titre": "Prioriser le nettoyage avant l'interprétation",
                "detail": (
                    f"Anomalies sur {noms_a} et évolutions notables sur {noms_t}. "
                    "Traiter d'abord les valeurs douteuses évite de communiquer "
                    "une tendance faussée."
                ),
                "action": (
                    "Corrigez ou excluez les points aberrants, puis relancez "
                    "l'analyse pour confirmer les tendances."
                ),
                "priorite": "moyenne",
            }
        )
    return _dedupliquer_recommandations(recommandations)
