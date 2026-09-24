from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import routeur as routeur_auth
from app.api.equipe import routeur as routeur_equipe
from app.api.fichiers import routeur as routeur_fichiers
from app.api.insights import routeur as routeur_insights
from app.api.parametres import routeur as routeur_parametres
from app.workers.traitement import relancer_taches_bloquees


@asynccontextmanager
async def cycle_vie(app: FastAPI):
    relancer_taches_bloquees()
    yield


app = FastAPI(
    title="API — Analyse de données",
    description="SaaS d'analyse de fichiers Excel/Word",
    version="0.1.0",
    lifespan=cycle_vie,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routeur_auth)
app.include_router(routeur_fichiers)
app.include_router(routeur_insights)
app.include_router(routeur_parametres)
app.include_router(routeur_equipe)


@app.get("/", tags=["sante"])
def racine():
    return {"statut": "ok", "service": "API Analyse de données"}
