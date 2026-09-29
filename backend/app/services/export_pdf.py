from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ACCENT = colors.HexColor("#C15F3C")
EN_TETE = colors.HexColor("#F5F5F4")
GRIS = colors.HexColor("#57534E")

_styles = getSampleStyleSheet()
TITRE = ParagraphStyle(
    "TitreRapport",
    parent=_styles["Title"],
    fontSize=18,
    textColor=colors.HexColor("#1C1917"),
    spaceAfter=4,
)
SOUS_TITRE = ParagraphStyle(
    "SousTitreRapport",
    parent=_styles["Normal"],
    fontSize=9,
    textColor=GRIS,
    spaceAfter=14,
)
TITRE_SECTION = ParagraphStyle(
    "TitreSection",
    parent=_styles["Heading2"],
    fontSize=12,
    textColor=ACCENT,
    spaceBefore=14,
    spaceAfter=6,
)
CORPS = ParagraphStyle(
    "CorpsRapport",
    parent=_styles["Normal"],
    fontSize=9.5,
    leading=13,
    textColor=colors.HexColor("#292524"),
)
CELLULE = ParagraphStyle(
    "CelluleRapport",
    parent=_styles["Normal"],
    fontSize=8,
    leading=10,
    textColor=colors.HexColor("#292524"),
)


def _tableau(entetes: list, lignes: list) -> Table | None:
    if not lignes:
        return None
    donnees = [[Paragraph(str(e), CELLULE) for e in entetes]]
    donnees += [[Paragraph(str(c), CELLULE) for c in ligne] for ligne in lignes]
    table = Table(donnees, repeatRows=1, colWidths=None, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, EN_TETE]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E7E5E4")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _nombre(v) -> str:
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:,.2f}".replace(",", " ")
    return str(v)


def construire_pdf(
    nom_fichier: str,
    resume: dict,
    anomalies: list,
    tendances: list,
    recommandations: list,
    insights: str | None = None,
    resume_texte: str | None = None,
) -> bytes:
    tampon = BytesIO()
    doc = SimpleDocTemplate(
        tampon,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"Rapport d'analyse — {nom_fichier}",
    )
    histoire = []

    histoire.append(Paragraph("Rapport d'analyse", TITRE))
    histoire.append(
        Paragraph(f"Fichier : {nom_fichier} — généré automatiquement", SOUS_TITRE)
    )

    texte_resume = resume_texte
    if not texte_resume:
        parties = []
        if resume.get("nombre_feuilles"):
            parties.append(
                f"Classeur de {resume.get('nombre_feuilles', 0)} feuille(s) et "
                f"{resume.get('nombre_lignes_total', 0)} ligne(s)."
            )
        if resume.get("nombre_paragraphes"):
            parties.append(
                f"Document de {resume.get('nombre_paragraphes', 0)} paragraphe(s) "
                f"et {resume.get('nombre_mots', 0)} mot(s)."
            )
        if anomalies:
            parties.append(f"{len(anomalies)} colonne(s) présentent des valeurs aberrantes.")
        if resume.get("valeurs_manquantes"):
            total = sum(resume["valeurs_manquantes"].values())
            parties.append(f"{total} valeur(s) manquante(s) à traiter.")
        if not parties:
            parties.append("Aucune anomalie marquée ni valeur manquante détectée.")
        texte_resume = " ".join(parties)

    histoire.append(Paragraph("Résumé", TITRE_SECTION))
    histoire.append(Paragraph(texte_resume, CORPS))

    stats = resume.get("statistiques") or {}
    if stats:
        lignes = []
        for colonne, valeurs in stats.items():
            lignes.append(
                [
                    colonne,
                    _nombre(valeurs.get("count")),
                    _nombre(valeurs.get("mean")),
                    _nombre(valeurs.get("min")),
                    _nombre(valeurs.get("max")),
                ]
            )
        table = _tableau(
            ["Colonne", "Effectif", "Moyenne", "Minimum", "Maximum"], lignes
        )
        if table:
            histoire.append(Paragraph("Statistiques", TITRE_SECTION))
            histoire.append(table)

    if anomalies:
        lignes = []
        for a in anomalies:
            lignes.append(
                [
                    a.get("feuille") or "—",
                    a.get("colonne"),
                    _nombre(a.get("nombre_valeurs_aberrantes")),
                    f"{_nombre(a.get('borne_basse'))} … {_nombre(a.get('borne_haute'))}",
                    _nombre(a.get("pourcentage")),
                ]
            )
        table = _tableau(
            ["Feuille", "Colonne", "Valeurs", "Bornes", "%"], lignes
        )
        if table:
            histoire.append(Paragraph("Anomalies (valeurs aberrantes)", TITRE_SECTION))
            histoire.append(table)

    if tendances:
        lignes = []
        for t in tendances:
            lignes.append(
                [
                    t.get("feuille") or "—",
                    t.get("colonne"),
                    _nombre(t.get("valeur_premiere")),
                    _nombre(t.get("valeur_derniere")),
                    _nombre(t.get("evolution_pourcentage")),
                ]
            )
        table = _tableau(
            ["Feuille", "Colonne", "Début", "Fin", "Évolution (%)"], lignes
        )
        if table:
            histoire.append(Paragraph("Tendances", TITRE_SECTION))
            histoire.append(table)

    doublons = resume.get("doublons") or {}
    if doublons.get("lignes_concernees"):
        histoire.append(Paragraph("Qualité des données", TITRE_SECTION))
        histoire.append(
            Paragraph(
                f"{doublons.get('lignes_concernees')} ligne(s) en doublon "
                f"({doublons.get('groupes')} groupe(s)) — à vérifier avant agrégation.",
                CORPS,
            )
        )

    if recommandations:
        histoire.append(Paragraph("Recommandations", TITRE_SECTION))
        for i, r in enumerate(recommandations, start=1):
            titre = r.get("titre") or r.get("action") or ""
            priorite = (r.get("priorite") or "").upper()
            detail = r.get("detail") or ""
            action = r.get("action") or ""
            contenu = f"<b>{i}. {titre}</b>"
            if priorite:
                contenu += f" <font color='#C15F3C'>({priorite})</font>"
            histoire.append(Paragraph(contenu, CORPS))
            if detail:
                histoire.append(Paragraph(detail, CORPS))
            if action:
                histoire.append(Paragraph(f"→ {action}", CORPS))
            histoire.append(Spacer(1, 5))

    if insights:
        histoire.append(Paragraph("Insights IA", TITRE_SECTION))
        for paragraphe in str(insights).split("\n"):
            if paragraphe.strip():
                histoire.append(Paragraph(paragraphe.strip(), CORPS))

    doc.build(histoire)
    return tampon.getvalue()


def nom_sortie_pdf(nom_fichier: str) -> str:
    base = Path(nom_fichier).stem
    base = "".join(c for c in base if c.isalnum() or c in "-_ ").strip() or "analyse"
    return f"{base}_analyse.pdf"
