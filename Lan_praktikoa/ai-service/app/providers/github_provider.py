import httpx
import logging
from app.config.settings import settings
from app.providers.base import BaseProvider

logger = logging.getLogger("github_provider")

class GitHubProvider(BaseProvider):
    """
    GitHub Models API hornitzailea. Promptak GitHub-era bidaltzen ditu eta erantzunak jasotzen ditu.
    """

    def __init__(self, settings=settings):
        self.api_key = settings.GITHUB_TOKEN
        self.model = settings.GITHUB_MODEL_PRIMARY
        self.max_tokens = settings.GROQ_MAX_TOKENS
        self.timeout = settings.AI_REQUEST_TIMEOUT
        self.api_url = "https://models.inference.ai.azure.com/chat/completions"

    def is_available(self) -> bool:
        return True

    async def generate_response(self, prompt: str, max_tokens: int = None) -> str:
        """
        Prompt bat GitHub Models APIra bidali eta erantzuna jaso.
        """
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens or self.max_tokens,
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
                logger.info("GitHub Models erantzuna ondo jaso da.")
                return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.error("GitHub Models: Tasa-muga gaindituta (429).")
                raise Exception("GitHub Models: Tasa-muga gaindituta (429).")
            logger.error(f"GitHub Models: API errorea: {e.response.status_code}")
            raise Exception(f"GitHub Models: API errorea: {e.response.status_code}")
        except httpx.TimeoutException:
            logger.error("GitHub Models: Denbora-muga gaindituta.")
            raise Exception("GitHub Models: Denbora-muga gaindituta.")
        except Exception as e:
            logger.error(f"GitHub Models: Errore ezezaguna: {str(e)}")
            raise Exception("GitHub Models: Errore ezezaguna.")