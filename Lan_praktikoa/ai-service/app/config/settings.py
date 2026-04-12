from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str
    GITHUB_TOKEN: str = "" # Opcional si solo usas uno por ahora
    
    # Modelos
    GROQ_MODEL_PRIMARY: str = "llama3-70b-8192"
    GROQ_MODEL_FALLBACK: str = "mixtral-8x7b-32768"
    GITHUB_MODEL_PRIMARY: str = "gpt-4o"
    GITHUB_MODEL_FALLBACK: str = "gpt-4-turbo"

    # Configuraciones de generación
    GROQ_MAX_TOKENS: int = 1000
    GROQ_TEMPERATURE: float = 0.7
    GITHUB_MAX_TOKENS: int = 1000
    GITHUB_TEMPERATURE: float = 0.7
    
    # Tiempo máximo de espera (Timeout)
    AI_REQUEST_TIMEOUT: int = 30

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()