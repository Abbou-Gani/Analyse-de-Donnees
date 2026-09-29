"""Croisement des résultats d'analyse avec une référence externe.

Le référentiel est embarqué (valeurs indicatives datées) et volontairement
séparé du calcul : brancher une source réelle (INSEE, Eurostat…) revient à
remplacer `REFERENTIELS` par un appel réseau. Le reste du service — calcul
des repères depuis l'analyse, verdict, lectures — ne change pas.
"""

REFERENTIELS = {
    "detail": {
        "libelle": "Négoce de détail non spécialisé",
        "source": "INSEE",
        "publication": "12/09/2026",
        "perimetre": "France · détail",
        "frequence": "Mensuelle",
        "indicateurs": {
            "croissance": 2.1,
            "manquants": 4.1,
            "aberrants": 3.5,
            "marge": 24.0,
        },
    },
    "en_ligne": {
        "libelle": "Commerce en ligne",
        "source": "INSEE",
        "publication": "12/09/2026",
        "perimetre": "France · vente en ligne",
        "frequence": "Mensuelle",
        "indicateurs": {
            "croissance": 4.8,
            "manquants": 3.2,
            "aberrants": 2.9,
            "marge": 21.0,
        },
    },
    "tous": {
        "libelle": "Tous secteurs",
        "source": "INSEE",
        "publication": "12/09/2026",
        "perimetre": "France · ensemble",
        "frequence": "Mensuelle",
        "indicateurs": {
            "croissance": 2.6,
            "manquants": 5.0,
            "aberrants": 4.0,
            "marge": 22.5,
        },
    },
}

# Seuil sous lequel l'écart est jugé non significatif (points de pourcentage)
SEUIL_ALIGNE = 0.8

# Un repère est « favorable » quand la valeur haute est bonne (True)
NATURE_FAVORABLE = {
    "croissance": True,
    "marge": True,
    "manquants": False,
    "aberrants": False,
}

LIBELLES_REPERES = {
    "croissance": "Croissance des ventes",
    "marge": "Marge moyenne",
    "manquants": "Valeurs manquantes",
    "aberrants": "Valeurs aberrantes",
}

MOTS_MESURE = ("vente", "chiffre", "revenu", "sales", "ca", "montant", "total", "amount")

# Colonnes qui signalent un fichier à dominante commerciale.
# Sans elles, comparer une série à la croissance du négoce serait trompeur :
# les repères croissance/marge sont alors masqués (la qualité, elle, vaut partout).
MOTS_COMMERCE = (
    "vente", "chiffre", "revenu", "revenue", "sales", "marge", "prix",
    "quantite", "commande", "client", "produit", "panier",
)


def _est_commercial(resume: dict, tendances: list) -> bool:
    noms = list((resume.get("statistiques") or {}).keys())
    noms += resume.get("colonnes_numeriques") or []
    noms += [t.get("colonne") for t in tendances]
    noms += [t.get("colonne_date") for t in tendances]
    for nom in noms:
        bas = str(nom).lower()
        if any(m in bas for m in MOTS_COMMERCE):
            return True
    return False


def _tendance_principale(tendances: list) -> dict | None:
    """Préfère la tendance sur une colonne de type « mesure » (Ventes, CA…)."""
    if not tendances:
        return None
    pour_mesure = [
        t for t in tendances
        if any(m in str(t.get("colonne", "")).lower() for m in MOTS_MESURE)
    ]
    candidats = pour_mesure or list(tendances)
    return max(candidats, key=lambda t: abs(t.get("evolution_pourcentage") or 0))


def _taux_manquants(resume: dict) -> float | None:
    # Hors tableau (Word) : aucune structure cellules -> aucun repère.
    if not resume.get("nombre_lignes_total"):
        return None
    colonnes = set()
    for cle in (
        "colonnes_numeriques",
        "colonnes_texte",
        "colonnes_dates",
    ):
        colonnes.update(resume.get(cle) or [])
    if not colonnes:
        return None
    manquantes = resume.get("valeurs_manquantes") or {}
    total = sum(manquantes.values())
    cellules = resume["nombre_lignes_total"] * len(colonnes)
    return round(total / cellules * 100, 2)


def _taux_aberrants(resume: dict, anomalies: list) -> float | None:
    lignes = resume.get("nombre_lignes_total") or 0
    if not lignes:
        return None
    total = sum(int(a.get("nombre_valeurs_aberrantes") or 0) for a in anomalies)
    return round(total / lignes * 100, 2)


def _marge_moyenne(resume: dict) -> float | None:
    """Colonne « marge » détectée dans les statistiques, en pourcentage."""
    stats = resume.get("statistiques") or {}
    for colonne, serie in stats.items():
        if "marge" not in str(colonne).lower():
            continue
        moyenne = serie.get("mean")
        if moyenne is None:
            continue
        valeur = float(moyenne)
        if 0 < valeur <= 1:  # ratio 0–1 stocké en fraction
            valeur *= 100
        return round(valeur, 2)
    return None


def _repere(cle: str, valeur: float | None, reference: float | None) -> dict | None:
    if valeur is None or reference is None:
        return None
    ecart = round(valeur - reference, 2)
    favorable_haut = NATURE_FAVORABLE[cle]
    if abs(ecart) <= SEUIL_ALIGNE:
        position, favorable = "aligne", True
    else:
        au_dessus = ecart > 0
        position = "dessus" if au_dessus else "dessous"
        favorable = au_dessus == favorable_haut
    return {
        "id": cle,
        "libelle": LIBELLES_REPERES[cle],
        "unite": "%",
        "valeur_fichier": valeur,
        "valeur_reference": float(reference),
        "ecart": ecart,
        "position": position,
        "favorable": favorable,
    }


def _lecture_croissance(repere: dict | None) -> str | None:
    if not repere:
        return None
    ecart = abs(repere["ecart"])
    sens = "au-dessus" if repere["ecart"] > 0 else "en-dessous"
    if repere["position"] == "aligne":
        return (
            f"Ta croissance ({repere['valeur_fichier']:+.1f} %) est alignée avec la "
            f"référence secteur — l'ordre de grandeur est cohérent, creuse tes segments "
            "pour trouver ce qui fait la différence."
        )
    if repere["favorable"]:
        return (
            f"Ta croissance ({repere['valeur_fichier']:+.1f} %) est {ecart:.1f} points "
            f"{sens} de la référence : le sujet n'est pas de « remonter la moyenne », "
            "mais de comprendre ce qui marche et de le répliquer."
        )
    return (
        f"Ta croissance ({repere['valeur_fichier']:+.1f} %) est {ecart:.1f} points "
        f"{sens} de la référence : regarde d'abord les colonnes en baisse et les "
        "valeurs atypiques avant d'annoncer un trimestre."
    )


def _lecture_qualite(manquants: dict | None, aberrants: dict | None) -> str | None:
    details = []
    limite = False
    for repere in (manquants, aberrants):
        if not repere or repere["position"] == "aligne":
            continue
        if repere["favorable"]:
            details.append(
                f"ta colonne « {repere['libelle'].lower()} » est meilleure que la normale "
                f"({repere['valeur_fichier']:.1f} % vs {repere['valeur_reference']:.1f} %)"
            )
        else:
            limite = True
            details.append(
                f"{repere['libelle'].lower()} à {repere['valeur_fichier']:.1f} % "
                f"(référence {repere['valeur_reference']:.1f} %)"
            )
    if not details:
        return None
    texte = "Qualité des données : " + "; ".join(details) + "."
    if limite:
        texte += (
            " Tant que ces trous sont comblés, la comparaison avec le secteur reste "
            "indicative."
        )
    return texte


def _lecture_marge(repere: dict | None) -> str | None:
    if not repere or repere["position"] == "aligne":
        return None
    if repere["favorable"]:
        return (
            f"Ta marge ({repere['valeur_fichier']:.1f} %) dépasse la référence "
            f"({repere['valeur_reference']:.1f} %) : vérifie qu'elle tient sur tous les "
            "segments et pas seulement sur le leader."
        )
    return (
        f"Ta marge ({repere['valeur_fichier']:.1f} %) est sous la référence "
        f"({repere['valeur_reference']:.1f} %) : vérifie remises et coûts d'achat avant "
        "de conclure sur la performance."
    )


def confronter_marche(resultat: dict, secteur: str = "detail") -> dict:
    """Repères du fichier confrontés au référentiel choisi."""
    reference = REFERENTIELS.get(secteur)
    if reference is None:
        return {"disponible": False, "raison": "referentiel_inconnu"}

    resume = resultat.get("resume_statistique") or {}
    anomalies = resultat.get("anomalies") or []
    tendances = resultat.get("tendances") or []

    commercial = _est_commercial(resume, tendances)
    tendance = _tendance_principale(tendances) if commercial else None

    # Qualité (manquants/aberrants) : valable pour tous les domaines.
    # Croissance/marge : uniquement sur un fichier commercial.
    candidats = []
    if commercial:
        candidats.append(
            _repere(
                "croissance",
                round(tendance["evolution_pourcentage"], 2) if tendance else None,
                reference["indicateurs"].get("croissance"),
            )
        )
        candidats.append(
            _repere(
                "marge",
                _marge_moyenne(resume),
                reference["indicateurs"].get("marge"),
            )
        )
    candidats.append(
        _repere(
            "manquants",
            _taux_manquants(resume),
            reference["indicateurs"].get("manquants"),
        )
    )
    candidats.append(
        _repere(
            "aberrants",
            _taux_aberrants(resume, anomalies),
            reference["indicateurs"].get("aberrants"),
        )
    )
    reperes = [r for r in candidats if r is not None]

    if not reperes:
        return {"disponible": False, "raison": "aucun_reperage"}

    par_id = {r["id"]: r for r in reperes}
    lectures = [
        t
        for t in (
            _lecture_croissance(par_id.get("croissance")),
            _lecture_marge(par_id.get("marge")),
            _lecture_qualite(par_id.get("manquants"), par_id.get("aberrants")),
        )
        if t
    ]

    colonne = tendance.get("colonne") if tendance else None
    note = (
        None
        if commercial
        else (
            "Fichier sans indicateur commercial détecté : les repères croissance et "
            "marge sont masqués — comparer une série de ce type à la croissance du "
            "négoce serait trompeur. Les repères de qualité restent valables, "
            "quel que soit le domaine (finance, RH, industrie…)."
        )
    )

    return {
        "disponible": True,
        "secteur": secteur,
        "domaine": "commercial" if commercial else "generique",
        "note": note,
        "source": {
            "libelle": reference["libelle"],
            "source": reference["source"],
            "publication": reference["publication"],
            "perimetre": reference["perimetre"],
            "frequence": reference["frequence"],
        },
        "reperes": reperes,
        "lectures": lectures,
        "colonne_mesure": colonne,
        "avertissement": (
            "La référence est un agrégat public, pas ta concurrence directe. "
            "Croise toujours cette lecture avec ta donnée interne et le contexte "
            "de marché avant de décider."
        ),
    }
