from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import parametres

moteur = create_engine(parametres.URL_BASE_DONNEES, pool_pre_ping=True)
SessionLocale = sessionmaker(bind=moteur, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def obtenir_base():
    session = SessionLocale()
    try:
        yield session
    finally:
        session.close()
