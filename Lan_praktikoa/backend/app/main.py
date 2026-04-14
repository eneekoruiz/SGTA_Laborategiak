"""Main FastAPI application entry point."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .models import APIResponse
from .routes import auth, games, zone

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    debug=settings.DEBUG,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)


# Root endpoint
@app.get("/", response_model=APIResponse, tags=["Root"])
async def read_root():
    """API egoera itzuli."""
    return APIResponse(
        success=True,
        message="SimHiri Backend API martxan dago",
        data={"version": settings.API_VERSION, "status": "running"},
    )


# Health check endpoint
@app.get("/health", response_model=APIResponse, tags=["Health"])
async def health_check():
    """Osasun egoera itzuli."""
    return APIResponse(
        success=True,
        message="Osasun egoera ona da",
        data={"status": "healthy", "version": settings.API_VERSION},
    )


# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(games.router, prefix="/api/games", tags=["Games"])
app.include_router(zone.router, prefix="/api/games", tags=["City Actions"])


# Initialize database indexes on startup
from .db.database import init_db

@app.on_event("startup")
async def startup_db():
    await init_db()


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTPException tratatu eta APIResponse kontratuarekin itzuli."""
    return JSONResponse(
        status_code=exc.status_code,
        content=APIResponse(
            success=False,
            message=str(exc.detail),
            data=None,
        ).model_dump(),
    )


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """ValueError tratatu eta mezua APIResponse egitura batean itzuli."""
    return JSONResponse(
        status_code=400,
        content=APIResponse(
            success=False,
            message=str(exc),
            data=None,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler. API erantzun kontratuarekin bat etorrita."""
    return JSONResponse(
        status_code=500,
        content=APIResponse(
            success=False,
            message=str(exc),
            data=None,
        ).model_dump(),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
