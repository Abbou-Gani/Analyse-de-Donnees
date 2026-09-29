import io

import pandas as pd


def analyser_excel(contenu: bytes) -> dict:
    fichier_excel = pd.ExcelFile(io.BytesIO(contenu), engine="openpyxl")
    feuilles = {}
    anomalies = []
    tendances = []
    recommandations = []
    conseils_strategiques = []
    stats_par_feuille: dict[str, dict] = {}
    resume_global = {
        "nombre_feuilles": 0,
        "nombre_lignes_total": 0,
        "statistiques": {},
        "valeurs_manquantes": {},
        "colonnes_numeriques": [],
        "colonnes_texte": [],
        "colonnes_dates": [],
        "doublons": {"groupes": 0, "lignes_concernees": 0, "doublons_en_trop": 0},
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
        # Conservé par feuille : deux feuilles peuvent porter « Valeur (M FCFA) ».
        stats_par_feuille[nom_feuille] = resume["statistiques"]
        for col, nb in resume["valeurs_manquantes"].items():
            resume_global["valeurs_manquantes"][f"{nom_feuille}.{col}"] = nb
        doublons = resume.get("doublons") or {}
        for cle_d in resume_global["doublons"]:
            resume_global["doublons"][cle_d] += int(doublons.get(cle_d) or 0)

        anomalies.extend(analyse_feuille["anomalies"])
        tendances.extend(analyse_feuille["tendances"])
        recommandations.extend(analyse_feuille["recommandations"])
        conseils_strategiques.extend(
            _generer_conseils_strategiques(df, nom_feuille)
        )

    resume_global["statistiques"] = _fusionner_statistiques(stats_par_feuille)

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
    resume_strategique = _resume_strategique(conseils_strategiques)
    if resume_strategique:
        resume_texte = f"{resume_texte} {resume_strategique}"

    return {
        "type": "excel",
        "resume": resume_global,
        "resume_texte": resume_texte,
        "feuilles": feuilles,
        "anomalies": anomalies,
        "tendances": tendances,
        "recommandations": conseils_strategiques + recommandations,
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
    doublons = resume.get("doublons") or {}
    if doublons.get("lignes_concernees"):
        parties.append(
            f"{doublons['lignes_concernees']} ligne(s) en doublon "
            f"({doublons.get('groupes') or '?'} groupe(s)) : à vérifier avant "
            "toute agrégation."
        )
    return " ".join(parties)


def _fusionner_statistiques(stats_par_feuille: dict[str, dict]) -> dict:
    """Fusionne les stats feuille par feuille, en préfixant si les noms collisent.

    Sans ça, « Valeur (M FCFA) » d'Exportations écrase celle d'Importations et
    une feuille disparaît silencieusement des statistiques globales.
    """
    if not stats_par_feuille:
        return {}
    noms = {}
    for stats in stats_par_feuille.values():
        for colonne in stats:
            noms[colonne] = noms.get(colonne, 0) + 1
    fusion = {}
    for nom_feuille, stats in stats_par_feuille.items():
        for colonne, serie in stats.items():
            cle = (
                f"{nom_feuille}.{colonne}"
                if noms[colonne] > 1
                else colonne
            )
            fusion[cle] = serie
    return fusion


def _detecter_doublons(df: pd.DataFrame) -> dict:
    """Compte les lignes strictement identiques (détail côté client via /donnees)."""
    vide = {"groupes": 0, "lignes_concernees": 0, "doublons_en_trop": 0}
    if df.empty or len(df) < 2:
        return vide
    masque = df.duplicated(keep=False)
    concernees = int(masque.sum())
    if not concernees:
        return vide
    try:
        groupes = int(df.loc[masque].groupby(list(df.columns), dropna=False).ngroups)
    except Exception:
        groupes = 0
    return {
        "groupes": groupes,
        "lignes_concernees": concernees,
        "doublons_en_trop": int(df.duplicated().sum()),
    }


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
        "doublons": _detecter_doublons(df),
    }

    if not colonnes_numeriques.empty:
        stats = colonnes_numeriques.describe().to_dict()
        resume["statistiques"] = {
            col: {k: (float(v) if pd.notna(v) else None) for k, v in valeurs.items()}
            for col, valeurs in stats.items()
        }

    anomalies = _detecter_anomalies(df, colonnes_numeriques, nom_feuille)
    # Date synthétique Année+Mois : indispensable pour les fichiers mensuels.
    serie_date, libelle_date = (None, None)
    if colonnes_dates.empty:
        serie_date, libelle_date = _date_indice(df)
    tendances = _detecter_tendances(
        df,
        colonnes_dates,
        colonnes_numeriques,
        nom_feuille,
        serie_date=serie_date,
        libelle_date=libelle_date,
    )
    recommandations = _generer_recommandations(
        resume, anomalies, tendances, colonnes_texte, colonnes_dates, nom_feuille
    )

    return {
        "resume": resume,
        "anomalies": anomalies,
        "tendances": tendances,
        "recommandations": recommandations,
    }


def _serialiser_cellule(valeur):
    """Rend une cellule pandas JSON-sérialisable (numpy, Timestamp, NaT…)."""
    try:
        if pd.isna(valeur):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(valeur, pd.Timestamp):
        return valeur.isoformat()
    if hasattr(valeur, "item"):
        try:
            valeur = valeur.item()
        except Exception:
            pass
    if isinstance(valeur, (int, float, str, bool)):
        return valeur
    return str(valeur)


def _detecter_anomalies(
    df: pd.DataFrame,
    colonnes_numeriques: pd.DataFrame,
    nom_feuille: str | None = None,
    limite_lignes: int = 20,
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
                "lignes": _extraire_lignes(
                    df, col, borne_basse, borne_haute, limite_lignes
                ),
            }
            if nom_feuille:
                anomalie["feuille"] = nom_feuille
            anomalies.append(anomalie)
    return anomalies


def _extraire_lignes(
    df: pd.DataFrame,
    colonne: str,
    borne_basse: float,
    borne_haute: float,
    limite: int,
) -> list[dict]:
    """Renvoie les lignes du fichier contenant la valeur aberrante (drill-down)."""
    colonnes = list(df.columns)
    index_colonnes = {c: i for i, c in enumerate(colonnes)}
    positions = [
        i
        for i, valeur in enumerate(df[colonne].tolist())
        if pd.notna(valeur) and (valeur < borne_basse or valeur > borne_haute)
    ]
    lignes = []
    for position in positions[:limite]:
        ligne = {"ligne": position + 2}
        for c in colonnes:
            ligne[c] = _serialiser_cellule(df.iat[position, index_colonnes[c]])
        lignes.append(ligne)
    return lignes


MOTS_MOYENNE = ("taux", "moyen", "moyenne", "indice", "prix", "%", "ratio", "marge")


def _agregation_periode(colonne: str):
    """Somme pour les montants/volumes, moyenne pour les ratios et taux."""
    bas = str(colonne).lower()
    if any(m in bas for m in MOTS_MOYENNE):
        return "mean"
    return "sum"


def _detecter_tendances(
    df,
    colonnes_dates,
    colonnes_numeriques,
    nom_feuille: str | None = None,
    serie_date=None,
    libelle_date: str | None = None,
) -> list[dict]:
    tendances = []
    if colonnes_numeriques.empty:
        return tendances
    if colonnes_dates.empty and serie_date is None:
        return tendances

    if serie_date is not None:
        colonne_date = serie_date
        nom_date = libelle_date or "Date (Année + Mois)"
    else:
        # Série de valeurs, pas le nom de colonne : un nom en scalaire
        # serait broadcast sur toutes les lignes (1 seule date détectée).
        nom_colonne = colonnes_dates.columns[0]
        colonne_date = df[nom_colonne]
        nom_date = str(nom_colonne)
    for col in colonnes_numeriques.columns:
        # Une tendance « Année » ou « N° Mois » n'a aucun sens : c'est l'axe.
        if any(m in str(col).strip().lower() for m in MOTS_TEMPS):
            continue
        paires = pd.DataFrame({"_d": colonne_date, "_v": df[col]}).dropna()
        paires = paires.sort_values("_d")
        if len(paires) < 3:
            continue
        # Panel (plusieurs lignes par période) : agréger avant de comparer.
        # 36 lignes par mois en fichier brut donnent 1ʳᵉ vs dernière ligne,
        # ce qui raconte n'importe quoi (-92 % pour une série stable).
        if paires["_d"].duplicated().any():
            agregation = _agregation_periode(str(col))
            paires = paires.groupby("_d", sort=True)["_v"].agg(agregation).reset_index()
            if len(paires) < 3:
                continue
        serie = paires["_v"]
        premiere, derniere = serie.iloc[0], serie.iloc[-1]
        if premiere == 0:
            continue
        evolution = ((derniere - premiere) / abs(premiere)) * 100
        tendance = {
            "colonne": col,
            "colonne_date": nom_date,
            "valeur_premiere": float(premiere),
            "valeur_derniere": float(derniere),
            "evolution_pourcentage": round(float(evolution), 2),
            "sens": "hausse" if evolution > 0 else "baisse" if evolution < 0 else "stable",
            "valeur_min": float(serie.min()),
            "valeur_max": float(serie.max()),
            "valeur_moyenne": float(serie.mean()),
            "nombre_points": int(len(paires)),
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



MOTS_MESURE_PONDS = (
    # (mot-clé, poids) : un « Ventes » vaut plus qu'un « Prix unitaire »
    ("vente", 10), ("chiffre", 10), ("revenu", 9), ("revenue", 9),
    ("sales", 9), ("marge", 8), ("benefice", 8), ("ca", 7), ("amount", 7),
    ("total", 6), ("montant", 6), ("salaire", 5), ("budget", 5),
    ("valeur", 4), ("prix", 3),
)
MOTS_SEGMENT = (
    "region", "zone", "segment", "produit", "product", "categorie", "canal",
    "service", "ville", "client", "pays", "marche", "famille", "type",
)

# Colonnes à dimension temporelle : jamais des « segments » à segmenter.
MOTS_TEMPS = (
    "mois", "annee", "année", "trimestre", "semestre", "semaine", "jour",
    "date", "periode", "période", "n°", "recurrent", "récurrent",
)

# Colonnes qui signalent un fichier commercial (partagé avec services/marche.py)
MOTS_COMMERCE = (
    "vente", "chiffre", "revenu", "revenue", "sales", "marge", "prix",
    "quantite", "quantité", "commande", "client", "produit", "panier",
)

MOIS_FR = {
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4,
    "mai": 5, "juin": 6, "juillet": 7, "aout": 8, "août": 8,
    "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12,
    "décembre": 12,
}


def detection_commerciale(noms) -> bool:
    """Vrai si l'une des colonnes évoque du commerce (Ventes, Marge, Client…)."""
    for nom in noms:
        bas = str(nom).lower()
        if any(m in bas for m in MOTS_COMMERCE):
            return True
    return False


def est_commercial_df(df) -> bool:
    """Aligné sur services/marche.py : on regarde les colonnes chiffrées.

    Une colonne texte « Nature produit » ne doit pas basculer un fichier de
    finances publiques en domaine commercial.
    """
    return detection_commerciale(str(c) for c in df.select_dtypes(include="number").columns)


def _date_indice(df):
    """Reconstruit une date Année + Mois quand aucune colonne datetime n'existe.

    Beaucoup de fichiers mensuels (budget, RH, trésorerie…) stockent « Année »
    et « N° Mois » en nombres : sans ce pont, plus aucune tendance n'est détectée.
    Retourne (série datetime avec NaT hors périmètre, libellé) ou (None, None).
    """
    def colonne(*cibles):
        for c in df.columns:
            if str(c).strip().lower() in cibles:
                return c
        return None

    col_annee = colonne("année", "annee", "year")
    if col_annee is None:
        return None, None
    col_mois = colonne("n° mois", "n mois", "no mois", "num mois", "n° de mois", "mois num")
    col_nom = colonne("mois")

    annee = pd.to_numeric(df[col_annee], errors="coerce")
    if col_mois is not None:
        mois = pd.to_numeric(df[col_mois], errors="coerce")
        libelle_mois = str(col_mois)
    elif col_nom is not None:
        mois = df[col_nom].astype(str).str.strip().str.lower().map(MOIS_FR)
        libelle_mois = str(col_nom)
    else:
        return None, None

    valide = annee.notna() & mois.notna() & (mois >= 1) & (mois <= 12)
    if not valide.any():
        return None, None

    serie = pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns]")
    serie[valide] = pd.to_datetime(
        {
            "year": annee[valide].astype(int),
            "month": mois[valide].astype(int),
            "day": 1,
        }
    )
    return serie, f"{col_annee} + {libelle_mois}"


def _choisir_colonne_mesure(df) -> str | None:
    numeriques = df.select_dtypes(include="number")
    if numeriques.empty:
        return None
    meilleur_col, meilleur_poids = None, 0
    for col in numeriques.columns:
        nom = str(col).lower()
        poids = sum(p for m, p in MOTS_MESURE_PONDS if m in nom)
        if poids > meilleur_poids:
            meilleur_col, meilleur_poids = str(col), poids
    if meilleur_col:
        return meilleur_col
    sommes = numeriques.sum().abs()
    if not sommes.empty:
        return str(sommes.idxmax())
    return None


def _choisir_colonnes_segment(df, max_segment: int = 2) -> list[str]:
    candidates = []
    for col in df.columns:
        if col in df.select_dtypes(include="number").columns:
            continue
        # Mois, Trimestre, Semestre… : dimension temporelle, pas un segment.
        nom_bas = str(col).strip().lower()
        if any(m in nom_bas for m in MOTS_TEMPS):
            continue
        serie = df[col]
        n = int(serie.nunique(dropna=True))
        if n < 2 or n > 25:
            continue
        if n > max(len(df) * 0.6, 3):
            continue
        poids = 0 if any(m in str(col).lower() for m in MOTS_SEGMENT) else 1
        candidates.append((poids, str(col)))
    candidates.sort(key=lambda x: x[0])
    return [c for _, c in candidates[:max_segment]]


def _evolution_par_segment(df, col_segment: str, col_mesure: str, col_date) -> dict:
    sous = df[[col_segment, col_mesure, col_date]].dropna(
        subset=[col_mesure, col_date]
    )
    if len(sous) < 6:
        return {}
    try:
        sous = sous.sort_values(col_date)
        med = sous[col_date].median()
        premier = sous[sous[col_date] <= med].groupby(col_segment)[col_mesure].sum()
        second = sous[sous[col_date] > med].groupby(col_segment)[col_mesure].sum()
    except Exception:
        return {}
    evolutions = {}
    for seg in set(premier.index) | set(second.index):
        a = float(premier.get(seg, 0) or 0)
        b = float(second.get(seg, 0) or 0)
        if a > 0:
            evolutions[str(seg)] = round((b - a) / a * 100, 1)
    return evolutions


def _vocabulaire(commercial: bool) -> dict:
    """Tournures de phrase selon le domaine (commerce vs générique)."""
    if commercial:
        return {
            "titre_renforcer": "Renforcez l'investissement sur",
            "action_oriente": (
                "Orientez budget, stock et effort commercial vers ce segment "
                "en priorité, puis croisez ce classement avec les données de "
                "marché externes (concurrence, demande) avant d'engager les fonds."
            ),
            "risque_concentration": (
                "Investir massivement sur une tête de liste qui fond "
                "serait risqué : comprenez d'abord la baisse."
            ),
            "detail_leader": "C'est le segment qui contribue le plus selon vos propres chiffres.",
            "action_opportunite": (
                "Investissez ici pendant que la courbe monte : anticipez les "
                "stocks et testez des actions commerciales ciblées."
            ),
            "titre_opportunite": "Opportunité à saisir",
            "action_moteur": (
                "Gardez ce moteur, mais développez un second segment "
                "pour ne pas dépendre d'une seule source de revenus."
            ),
            "titre_concentration": "Attention à la concentration",
            "titre_fragmente": "Répartition fragmentée : aucun segment dominant",
            "action_reduire": (
                "Réduisez ou réallouez les moyens engagés sur ce segment, "
                "sauf explication temporaire (saison, rupture)."
            ),
        }
    return {
        "titre_renforcer": "Concentrez vos moyens sur",
        "action_oriente": (
            "Orientez prioritairement vos moyens vers ce segment, puis comparez-le "
            "aux autres pour arbitrer — et confrontez-le au reste du fichier avant "
            "de déplacer des ressources."
        ),
        "risque_concentration": (
            "Concentrer les moyens sur une tête de liste qui fond "
            "serait risqué : comprenez d'abord la baisse."
        ),
        "detail_leader": "C'est la ligne qui pèse le plus selon vos propres chiffres.",
        "action_opportunite": (
            "Agissez ici pendant que la courbe monte : vérifiez que la hausse "
            "tient sur toute la période et pas sur un seul point."
        ),
        "titre_opportunite": "Dynamique à confirmer",
        "action_moteur": (
            "Conservez ce segment, mais développez-en un second "
            "pour ne pas dépendre d'une seule source."
        ),
        "titre_concentration": "Risque de concentration",
        "titre_fragmente": "Répartition dispersée : aucun segment dominant",
        "action_reduire": (
            "Réduisez ou réallouez les moyens engagés sur ce segment, "
            "sauf explication temporaire (saison, rupture)."
        ),
    }


def _generer_conseils_strategiques(
    df, nom_feuille: str | None = None, commercial: bool | None = None
) -> list[dict]:
    """Conseils d'allocation : quels segments renforcer / surveiller, selon les chiffres.

    `commercial` adapte le vocabulaire : un fichier de budget ou de paie n'a
    « ni investissement, ni stock, ni marché » à orienter.
    """
    conseils: list[dict] = []
    if df is None or df.empty:
        return conseils
    if commercial is None:
        commercial = est_commercial_df(df)
    V = _vocabulaire(commercial)
    col_mesure = _choisir_colonne_mesure(df)
    if col_mesure is None:
        return conseils
    colonnes_segment = _choisir_colonnes_segment(df)
    if not colonnes_segment:
        return conseils

    dates = df.select_dtypes(include=["datetime", "datetimetz"])
    col_date = dates.columns[0] if not dates.empty else None
    contexte = _libelle_contexte(nom_feuille)
    total_general = float(df[col_mesure].sum() or 0)

    for i, col_segment in enumerate(colonnes_segment):
        if len(conseils) >= 5:
            break
        classement = (
            df.groupby(col_segment, dropna=True)[col_mesure]
            .sum()
            .sort_values(ascending=False)
        )
        classement = classement[classement != 0]
        if classement.empty:
            continue
        evolution = (
            _evolution_par_segment(df, col_segment, col_mesure, col_date)
            if col_date is not None
            else {}
        )
        entrees = []
        for seg, total in classement.head(8).items():
            part = (
                round(float(total) / total_general * 100, 1)
                if total_general
                else None
            )
            entrees.append(
                {
                    "segment": str(seg),
                    "total": round(float(total), 2),
                    "part": part,
                    "evolution": evolution.get(str(seg)),
                }
            )
        metrique = {
            "dimension": str(col_segment),
            "mesure": str(col_mesure),
            "classement": entrees,
        }

        top_seg, top_total = classement.index[0], float(classement.iloc[0])
        part_top = (
            round(top_total / total_general * 100, 1) if total_general else None
        )
        deuxieme = (
            round(float(classement.iloc[1]) / total_general * 100, 1)
            if len(classement) > 1 and total_general
            else None
        )
        evo_top = evolution.get(str(top_seg))
        en_baisse = evo_top is not None and evo_top < -5

        if i == 0:
            ecart_txt = (
                f", loin devant « {classement.index[1]} » ({deuxieme} %)"
                if deuxieme is not None and part_top
                and (part_top - deuxieme) > 10
                else ""
            )
            if en_baisse:
                evo_txt = (
                    f" mais recule de {abs(evo_top):.1f} % entre les deux moitiés "
                    "de la période"
                )
                conseils.append(
                    {
                        "titre": (
                            f"« {top_seg} » domine mais décroît (colonne {col_segment})"
                        ),
                        "detail": (
                            f"« {top_seg} » reste en tête de « {col_segment} » avec "
                            f"{_format_nombre(top_total)} de « {col_mesure} » "
                            f"({part_top} % du total{contexte})"
                            f"{ecart_txt}{evo_txt}. "
                            + V["risque_concentration"]
                        ),
                        "action": (
                            "Enquêtez sur la cause du recul (saison, concurrence, "
                            "rupture) avant tout nouvel investissement, tout en "
                            "maintenant l'effort commercial actuel."
                        ),
                        "priorite": "haute",
                        "categorie": "strategique",
                        "metrique": metrique,
                    }
                )
            else:
                evo_txt = (
                    f" et progresse de {evo_top:+.1f} % entre les deux moitiés "
                    "de la période"
                    if evo_top is not None
                    else ""
                )
                conseils.append(
                    {
                        "titre": (
                            f"{V['titre_renforcer']} « {top_seg} » "
                            f"(colonne {col_segment})"
                        ),
                        "detail": (
                            f"« {top_seg} » arrive en tête de « {col_segment} » avec "
                            f"{_format_nombre(top_total)} de « {col_mesure} » "
                            f"({part_top} % du total{contexte})"
                            f"{ecart_txt}{evo_txt}. "
                            + V["detail_leader"]
                        ),
                        "action": (
                            V["action_oriente"]
                        ),
                        "priorite": "haute",
                        "categorie": "strategique",
                        "metrique": metrique,
                    }
                )
        elif i == 1 and len(conseils) < 5:
            conseils.append(
                {
                    "titre": f"Repérez le potentiel par « {col_segment} »",
                    "detail": (
                        f"« {top_seg} » pèse {part_top} % de « {col_mesure} »"
                        f"{contexte}. "
                        "Comparez les segments entre eux pour voir où la marge de "
                        "progression est la plus forte."
                    ),
                    "action": (
                        "Utilisez le classement ci-dessous pour arbitrer : "
                        "renforcez les têtes de liste, testez les segments porteurs."
                    ),
                    "priorite": "moyenne",
                    "categorie": "strategique",
                    "metrique": metrique,
                }
            )

        if len(conseils) >= 5:
            break

        hausses = [
            (s, e) for s, e in evolution.items() if e > 10
        ]
        baisses = [(s, e) for s, e in evolution.items() if e < -10]
        if hausses and len(conseils) < 5:
            seg_h, evo_h = max(hausses, key=lambda x: x[1])
            total_h = float(classement.get(seg_h, 0) or 0)
            conseils.append(
                {
                    "titre": f"{V['titre_opportunite']} : « {seg_h} » accélère",
                    "detail": (
                        f"Sur « {col_segment} », « {seg_h} » gagne {evo_h:+.1f} % "
                        f"entre les deux moitiés de la période{contexte}, pour "
                        f"{_format_nombre(total_h)} de « {col_mesure} ». "
                        "La demande de ce segment monte dans vos données."
                    ),
                    "action": (
                        V["action_opportunite"]
                    ),
                    "priorite": "haute",
                    "categorie": "strategique",
                    "metrique": metrique,
                }
            )
        baisses = [(s_, e) for s_, e in baisses if not (i == 0 and s_ == top_seg)]
        if baisses and len(conseils) < 5:
            seg_b, evo_b = min(baisses, key=lambda x: x[1])
            total_b = float(classement.get(seg_b, 0) or 0)
            conseils.append(
                {
                    "titre": f"Vigilance : « {seg_b} » recule",
                    "detail": (
                        f"« {seg_b} » perd {evo_b:+.1f} % entre les deux moitiés "
                        f"de la période{contexte} ({_format_nombre(total_b)} de "
                        f"« {col_mesure} »). En rester là exposerait à investir "
                        "dans un segment qui s'effondre."
                    ),
                    "action": (
                        "Réduisez ou réallouez les moyens engagés sur ce segment, "
                        "à moins d'avoir une explication temporaire (saison, rupture)."
                    ),
                    "priorite": "moyenne",
                    "categorie": "strategique",
                    "metrique": metrique,
                }
            )

    if conseils and len(conseils) < 5:
        met = conseils[0].get("metrique") or {}
        classement = met.get("classement") or []
        if classement:
            part_top = classement[0].get("part")
            if part_top is not None and part_top >= 55 and len(classement) >= 2:
                autres = ", ".join(
                    f"« {e['segment']} » ({e['part']} %)"
                    for e in classement[1:4]
                )
                conseils.append(
                    {
                        "titre": V["titre_concentration"],
                        "detail": (
                            f"« {classement[0]['segment']} » concentre {part_top} % "
                            f"de « {met.get('mesure') } » sur la dimension "
                            f"« {met.get('dimension') } ». Tous les œufs dans le même "
                            f"panier : le reste pèse peu ({autres})."
                        ),
                        "action": (
                            V["action_moteur"]
                        ),
                        "priorite": "moyenne",
                        "categorie": "strategique",
                    }
                )
            elif (
                part_top is not None
                and part_top <= 35
                and len(classement) >= 3
            ):
                conseils.append(
                    {
                        "titre": V["titre_fragmente"],
                        "detail": (
                            f"Le leader « {classement[0]['segment']} » ne pèse que "
                            f"{part_top} % de « {met.get('mesure') } » "
                            f"(dimension « {met.get('dimension') } »). "
                            "Les parts sont éclatées entre plusieurs segments."
                        ),
                        "action": (
                            "Concentrez vos moyens sur 1 ou 2 segments plutôt que "
                            "de vous disperser sur tous à la fois."
                        ),
                        "priorite": "moyenne",
                        "categorie": "strategique",
                    }
                )

    return conseils[:5]


def _resume_strategique(conseils: list[dict]) -> str:
    for conseil in conseils:
        if conseil.get("categorie") != "strategique":
            continue
        met = conseil.get("metrique") or {}
        classement = met.get("classement") or []
        if classement:
            premier = classement[0]
            evolution = premier.get("evolution")
            evo_txt = (
                f" ({evolution:+.1f} % sur la période)" if evolution is not None else ""
            )
            evo = premier.get("evolution")
            if evo is not None and evo < -5:
                return (
                    f"Stratégie : sur « {met.get('dimension')} », « {premier['segment']} » "
                    f"reste leader ({premier.get('part')} % de « {met.get('mesure') } ») "
                    f"mais recule de {abs(evo):.1f} % — à comprendre avant d'investir."
                )
            return (
                f"Stratégie : sur « {met.get('dimension')} », « {premier['segment']} » "
                f"pèse {premier.get('part')} % de « {met.get('mesure') } »{evo_txt} — "
                "segment à renforcer en priorité."
            )
    return ""


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
