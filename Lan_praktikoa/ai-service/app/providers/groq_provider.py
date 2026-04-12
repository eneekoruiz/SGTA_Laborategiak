import httpx
import logging
from app.config.settings import settings
from app.providers.base import BaseProvider

logger = logging.getLogger("groq_provider")

class GroqProvider(BaseProvider):
    """
    GroQ API hornitzailea. Promptak GroQ-ra bidaltzen ditu eta erantzunak jasotzen ditu.
    """

    def __init__(self, settings=settings):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.GROQ_MODEL_PRIMARY
        self.max_tokens = settings.GROQ_MAX_TOKENS
        self.temperature = settings.GROQ_TEMPERATURE
        self.timeout = settings.AI_REQUEST_TIMEOUT
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"

    def is_available(self) -> bool:
        return True

    async def generate_response(self, prompt: str, max_tokens: int = None) -> str:
        """
        Prompt bat GroQ APIra bidali eta erantzuna jaso.
        """
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": self.temperature,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.api_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                logger.info("GroQ erantzuna ondo jaso da.")
                return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.error("GroQ: Tasa-muga gaindituta (429).")
                raise Exception("GroQ: Tasa-muga gaindituta (429).")
            logger.error(f"GroQ: API errorea: {e.response.status_code}")
            raise Exception(f"GroQ: API errorea: {e.response.status_code}")
        except httpx.TimeoutException:
            logger.error("GroQ: Denbora-muga gaindituta.")
            raise Exception("GroQ: Denbora-muga gaindituta.")
        except Exception as e:
            logger.error(f"GroQ: Errore ezezaguna: {str(e)}")
            raise Exception("GroQ: Errore ezezaguna.")