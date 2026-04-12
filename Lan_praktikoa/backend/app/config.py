"""Configuration module for SimHiri backend."""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    """Application settings."""

    # API
    API_TITLE: str = "SimHiri Backend API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Backend API for SimHiri city-building strategy game"

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 5000))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: list = ["*"]
    CORS_HEADERS: list = ["*"]

    # Database
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB: str = os.getenv("MONGODB_DB", "simhiri")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Game
    MAP_WIDTH: int = 100
    MAP_HEIGHT: int = 100
    STARTING_FUNDS_EASY: int = 20000
    STARTING_FUNDS_MEDIUM: int = 10000
    STARTING_FUNDS_HARD: int = 5000

    # AI
    AI_REQUEST_TIMEOUT: int = int(os.getenv("AI_REQUEST_TIMEOUT", "30"))
    AI_SERVICE_URL: str = os.getenv("AI_SERVICE_URL", "http://localhost:5001")

    # Game Balance
    MAX_BONDS: int = 10
    MAX_BOND_AMOUNT: int = 10000
    BOND_ANNUAL_INTEREST_RATE: float = 0.20  # 20%
    BOND_MONTHS: int = 240  # 20 years
    MONTHS_BANKRUPT_LIMIT: int = 12


settings = Settings()
