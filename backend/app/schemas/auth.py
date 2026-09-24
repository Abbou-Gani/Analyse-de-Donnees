from pydantic import BaseModel, EmailStr


class InscriptionEntree(BaseModel):
    email: EmailStr
    mot_de_passe: str
    nom_organisation: str = "Mon organisation"


class ConnexionEntree(BaseModel):
    email: EmailStr
    mot_de_passe: str


class JetonSortie(BaseModel):
    type_jeton: str = "bearer"
    jeton_acces: str
    jeton_rafraichissement: str


class UtilisateurSortie(BaseModel):
    id: str
    email: str
    role: str
    organisation_id: str

    class Config:
        from_attributes = True


class RafraichissementEntree(BaseModel):
    jeton_rafraichissement: str
