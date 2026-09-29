from datetime import datetime

from pydantic import BaseModel


class FichierSortie(BaseModel):
    id: str
    nom_original: str
    type_fichier: str
    taille: int
    cree_le: datetime
    disponible: bool = True
    version: int = 1

    class Config:
        from_attributes = True


class TacheSortie(BaseModel):
    id: str
    fichier_id: str
    statut: str
    tentatives: int
    fichier_disponible: bool | None = None

    class Config:
        from_attributes = True


class EntreeJournal(BaseModel):
    id: str
    action: str
    details: str | None
    cree_le: datetime
    fichier_id: str | None

    class Config:
        from_attributes = True


class ResultatSortie(BaseModel):
    id: str
    tache_id: str
    resume_statistique: dict
    anomalies: list
    tendances: list
    recommandations: list
    insights_ia: str | None
    modele_utilise: str | None

    class Config:
        from_attributes = True


class VersionAnalyse(BaseModel):
    id: str
    nom_original: str
    taille: int
    version: int
    cree_le: datetime
    disponible: bool = True


class ComparaisonSortie(BaseModel):
    """Écarts entre cette version du fichier et la précédente."""

    precedent: VersionAnalyse
    courant: VersionAnalyse
    diff: dict


class RepereMarche(BaseModel):
    """Un indicateur du fichier confronté à la référence externe."""

    id: str
    libelle: str
    unite: str
    valeur_fichier: float
    valeur_reference: float
    ecart: float
    position: str  # dessus | dessous | aligne
    favorable: bool


class MarcheSortie(BaseModel):
    """Croisement avec le référentiel externe (données de marché)."""

    disponible: bool
    raison: str | None = None
    secteur: str | None = None
    domaine: str | None = None  # commercial | generique
    note: str | None = None
    source: dict | None = None
    reperes: list[RepereMarche] = []
    lectures: list[str] = []
    colonne_mesure: str | None = None
    avertissement: str | None = None


class InsightItem(BaseModel):
    fichier_id: str
    nom_fichier: str
    type_fichier: str
    taille: int
    analyse_le: datetime | None
    insights_ia: str | None
    modele_utilise: str | None
    nombre_anomalies: int
    nombre_valeurs_aberrantes: int
    nombre_tendances: int
    tendances_hausse: int
    tendances_baisse: int
    tendances: list
    recommandations: list
    resume_statistique: dict

    class Config:
        from_attributes = True


class InsightsSortie(BaseModel):
    total_fichiers: int
    total_analyses: int
    total_anomalies: int
    total_valeurs_aberrantes: int
    total_tendances: int
    tendances_hausse: int
    tendances_baisse: int
    total_recommandations: int
    insights: list[InsightItem]
