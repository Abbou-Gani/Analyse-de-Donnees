from pydantic_settings import BaseSettings


class Parametres(BaseSettings):
    URL_BASE_DONNEES: str = "postgresql+psycopg2://postgres:Sa67654005@localhost:5433/analyse_donnees"
    CLE_SECRETE: str = "changez-moi-en-production"
    ALGORITHME: str = "HS256"
    DUREE_VIE_JETON_ACCES_MIN: int = 30
    DUREE_VIE_JETON_RERAFRAICHISSEMENT_JOURS: int = 7

    URL_REDIS: str = "redis://localhost:6379/0"
    URL_S3: str | None = None
    CLE_S3_ACCES: str | None = None
    CLE_S3_SECRETE: str | None = None
    SEAU_S3: str = "fichiers"

    TAILLE_MAX_FICHIER: int = 10 * 1024 * 1024
    EXTENSIONS_AUTORISEES: set[str] = {".xlsx", ".docx"}

    ADMIN_LOGIN: str = "Admin"
    ADMIN_MOT_DE_PASSE: str = "admin123"

    class Config:
        env_file = ".env"


parametres = Parametres()
