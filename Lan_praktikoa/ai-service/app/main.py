from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.routes import ai
from app.middleware import AuditLoggingMiddleware, setup_logging

# Setup logging before creating app
setup_logging()

app = FastAPI(
    title="AA Zerbitzua",
    description="SimHiri proiekturako AA zerbitzu adimenduna. Dokumentazioa eta erroreak euskara teknikoan.",
    version="1.0.0"
)

# Add Audit Logging middleware (must be added before CORS for proper request logging)
app.add_middleware(AuditLoggingMiddleware)

# CORS konfigurazioa: Permitir backend eta localhost para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://backend:8000", "http://localhost:5000", "http://localhost:5001", "http://localhost:3001"],
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