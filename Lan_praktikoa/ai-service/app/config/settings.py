from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str
    GITHUB_TOKEN: str = "" # Opcional si solo usas uno por ahora

    # Modelos - Using current valid Groq models (2024)
    GROQ_MODEL_PRIMARY: str = "llama-3.1-8b-instant"
    GROQ_MODEL_FALLBACK: str = "llama-3.2-11b-vision-preview"
    GITHUB_MODEL_PRIMARY: str = "gpt-4o-mini"
    GITHUB_MODEL_FALLBACK: str = "gpt-4-turbo"

    # Configuraciones de generación
    GROQ_MAX_TOKENS: int = 2000  # Increased for full JSON responses
    GROQ_TEMPERATURE: float = 0.7
    GITHUB_MAX_TOKENS: int = 2000
    GITHUB_TEMPERATURE: float = 0.7

    # Tiempo máximo de espera (Timeout)
    AI_REQUEST_TIMEOUT: int = 30

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()