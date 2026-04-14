"""Main FastAPI application entry point."""
import logging
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .models import APIResponse
from .routes import auth, games, zone
from .middleware.logging import AuditLoggingMiddleware, setup_logging
from .utils.error_mapping import parse_validation_errors, format_error_response

# Setup logging before creating app
setup_logging()

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    debug=settings.DEBUG,
)

# Add Audit Logging middleware (must be added before CORS for proper request logging)
app.add_middleware(AuditLoggingMiddleware)

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
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle Pydantic validation errors with human-readable messages."""
    # Parse validation errors to get user-friendly messages
    aggregated_message, affected_fields, field_messages = parse_validation_errors(exc.errors())
    
    # Get logger
    logger = logging.getLogger("simhiri.backend")
    logger.warning(
        f"[VALIDATION_ERROR] Path: {request.url.path}, "
        f"Fields: {affected_fields}, Message: {aggregated_message}"
    )
    
    return JSONResponse(
        status_code=422,
        content=format_error_response(
            message=aggregated_message,
            error_type="ValidationError",
            fields=affected_fields,
            details=field_messages,
        ),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTPException tratatu eta APIResponse kontratuarekin itzuli."""
    
    # Determine error type based on status code
    error_type_map = {
        401: "AuthError",
        403: "PermissionError",
        404: "NotFoundError",
        400: "BadRequestError",
        500: "ServerError",
    }
    error_type = error_type_map.get(exc.status_code, "HTTPError")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error_response(
            message=str(exc.detail),
            error_type=error_type,
        ),
    )


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """ValueError tratatu eta mezua APIResponse egitura batean itzuli."""
    logger = logging.getLogger("simhiri.backend")
    logger.warning(f"[VALUE_ERROR] {str(exc)}")
    
    return JSONResponse(
        status_code=400,
        content=format_error_response(
            message=str(exc),
            error_type="BadRequestError",
        ),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler. API erantzun kontratuarekin bat etorrita."""
    logger = logging.getLogger("simhiri.backend")
    logger.error(f"[UNHANDLED_EXCEPTION] {type(exc).__name__}: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content=format_error_response(
            message="Zerbitzarian errore bat gertatu da. Saiatu berriro geroago.",
            error_type="ServerError",
        ),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
