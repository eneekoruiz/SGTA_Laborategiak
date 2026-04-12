from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import ai

app = FastAPI(
    title="AA Zerbitzua",
    description="SimHiri proiekturako AA zerbitzu adimenduna. Dokumentazioa eta erroreak euskara teknikoan.",
    version="1.0.0"
)

# CORS konfigurazioa (beharrezkoa bada)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Aldatu behar izanez gero
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bideak erregistratu
app.include_router(ai.router, prefix="/api/ai", tags=["AA"])

# Osasun egiaztapena
@app.get("/ping", tags=["Osasuna"])
def ping():
    """
    Zerbitzuaren osasun egiaztapena.
    """
    return {"mezua": "AA zerbitzua martxan dago"}