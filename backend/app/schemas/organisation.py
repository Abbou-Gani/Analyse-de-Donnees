from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class OrganisationSortie(BaseModel):
    id: str
    nom: str
    plan_abonnement: str
    cree_le: datetime

    class Config:
        from_attributes = True


class UtilisateurParametres(BaseModel):
    id: str
    email: str
    role: str
    cree_le: datetime

    class Config:
        from_attributes = True


class ParametresSortie(BaseModel):
    utilisateur: UtilisateurParametres
    organisation: OrganisationSortie


class ParametresEntree(BaseModel):
    nom_organisation: str | None = None
    email: EmailStr | None = None
    mot_de_passe_actuel: str | None = None
    nouveau_mot_de_passe: str | None = Field(default=None, min_length=8)


class MembreSortie(BaseModel):
    id: str
    email: str
    role: str
    cree_le: datetime

    class Config:
        from_attributes = True


class MembreInvitationEntree(BaseModel):
    email: EmailStr
    mot_de_passe: str = Field(min_length=8)
    role: str = "utilisateur"


class MembreMajEntree(BaseModel):
    role: str
