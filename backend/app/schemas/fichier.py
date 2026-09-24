from datetime import datetime

from pydantic import BaseModel


class FichierSortie(BaseModel):
    id: str
    nom_original: str
    type_fichier: str
    taille: int
    cree_le: datetime

    class Config:
        from_attributes = True


class TacheSortie(BaseModel):
    id: str
    fichier_id: str
    statut: str
    tentatives: int

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
