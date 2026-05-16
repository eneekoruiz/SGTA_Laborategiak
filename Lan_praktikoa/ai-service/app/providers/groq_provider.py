import httpx
import logging
import re
from app.config.settings import settings
from app.providers.base import BaseProvider

logger = logging.getLogger("groq_provider")

class GroqProvider(BaseProvider):
    """
    GroQ API hornitzailea. Promptak GroQ-ra bidaltzen ditu eta erantzunak jasotzen ditu.
    Uses llama-3.3-70b-versatile model for fast, reliable JSON generation.
    """

    def __init__(self, settings=settings):
        self.api_key = settings.GROQ_API_KEY
        # Use reliable, fast Groq model for JSON generation
        self.model = "llama-3.3-70b-versatile"
        self.max_tokens = settings.GROQ_MAX_TOKENS
        self.temperature = settings.GROQ_TEMPERATURE
        self.timeout = settings.AI_REQUEST_TIMEOUT
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate_response(self, prompt: str, max_tokens: int = None) -> str:
        """
        Prompt bat GroQ APIra bidali eta erantzuna jaso.
        Strips markdown formatting from response for clean JSON parsing.
        """
        if not self.api_key:
            logger.error("GroQ: API key falta da.")
            raise Exception("GroQ: API key konfiguratu gabe.")

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a JSON API. Return ONLY valid JSON. No markdown, no explanations, no text outside JSON."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": self.temperature,
            "response_format": {"type": "json_object"}  # Force JSON mode
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
                raw_content = data["choices"][0]["message"]["content"]
                
                # Log raw response for debugging
                logger.info(f"📄 RAW LLM RESPONSE: {raw_content[:500]}...")
                
                # Strip markdown formatting (common LLM issue)
                cleaned = self._strip_markdown(raw_content)
                logger.info(f"✅ Cleaned response: {cleaned[:200]}...")
                
                return cleaned
        except httpx.HTTPStatusError as e:
            logger.error(f"GroQ: HTTP errorea {e.response.status_code}: {e.response.text[:200]}")
            if e.response.status_code == 401:
                logger.error("GroQ: API key baliogabea (401).")
                raise Exception("GroQ: API key baliogabea (401).")
            if e.response.status_code == 429:
                logger.error("GroQ: Tasa-muga gaindituta (429).")
                raise Exception("GroQ: Tasa-muga gaindituta (429).")
            raise Exception(f"GroQ: API errorea: {e.response.status_code}")
        except httpx.TimeoutException:
            logger.error("GroQ: Denbora-muga gaindituta.")
            raise Exception("GroQ: Denbora-muga gaindituta.")
        except Exception as e:
            logger.error(f"GroQ: Errore ezezaguna: {str(e)}")
            raise Exception(f"GroQ: Errore ezezaguna: {str(e)}")
    
    def _strip_markdown(self, text: str) -> str:
        """
        Strip markdown code blocks from LLM response.
        Handles: ```json, ```, `, leading/trailing whitespace
        """
        cleaned = text.strip()
        
        # Remove opening markdown blocks
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        # Remove closing markdown blocks
        cleaned = re.sub(r'\s*```$', '', cleaned)
        # Remove any stray backticks
        cleaned = cleaned.replace('`', '')
        
        return cleaned.strip()