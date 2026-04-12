import json
import logging
import re
from typing import Dict, Any, List

from app.providers.groq_provider import GroqProvider
from app.providers.github_provider import GitHubProvider
from app.services.action_validator import ActionValidator
from app.services.content_generator import ContentGenerator
from app.models.ai_response import AIResponse

logger = logging.getLogger("ai_service")

class AIService:
    """
    AI zerbitzuaren klasea. Failover eta ekintza balidazioa barne.
    """
    def __init__(self):
        self.groq_provider = GroqProvider()
        self.github_provider = GitHubProvider()
        self.validator = ActionValidator()
        self.content_generator = ContentGenerator()

    async def get_ai_response(self, game_state: Dict[str, Any], historia: List[Any]) -> AIResponse:
        """
        AI erantzuna lortu failover eta balidazioarekin.
        """
        # 1. Prompt-ak sortu ContentGenerator erabiliz
        system_prompt = self.content_generator.generate_system_prompt()
        user_prompt = self.content_generator.generate_user_prompt(game_state, historia)
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        response_json = None
        erroreak = []

        # 2. Saiatu GroqProvider-ekin
        try:
            logger.info("GroqProvider erabiliz erantzuna eskatzen...")
            response_json = await self.groq_provider.generate_response(full_prompt)
        except Exception as e:
            logger.warning(f"GroqProvider huts egin du: {e}. GitHubModels-era pasatzen... (Failover)")
            
            # 3. Saiatu GitHubProvider-ekin
            try:
                logger.info("GitHubProvider erabiliz erantzuna eskatzen...")
                response_json = await self.github_provider.generate_response(full_prompt)
            except Exception as e2:
                logger.error(f"GitHubProvider huts egin du: {e2}")
                erroreak.append("AI zerbitzu guztiak huts egin dute.")
                return self._get_static_fallback_response(erroreak)

        # 4. JSON dekodetu (parseo sendoa regex bidez aluzinazioak ekiditeko)
        parsed = None
        try:
            match = re.search(r"\{[\s\S]*\}", response_json)
            if match:
                json_str = match.group(0)
            else:
                json_str = response_json
            parsed = json.loads(json_str)
        except Exception as e:
            logger.error(f"AI erantzuna JSON gisa deskodetzean errorea: {e}")
            erroreak.append("AI erantzuna ez da baliozko JSON formatua.")
            return self._get_static_fallback_response(erroreak)

        # 5. Ekintzak balioztatu (Ez gastatu ez daukagun dirua)
        ekintzak = parsed.get("actions", parsed.get("ekintzak", []))
        baliozkoa, balioztapen_erroreak = self.validator.validate_actions(game_state, ekintzak)
        erroreak.extend(balioztapen_erroreak)

        # 6. AIResponse objektua sortu
        reasoning_data = parsed.get("reasoning", {})
        testuingurua = reasoning_data.get("testuingurua", "Testuingurua falta da") if isinstance(reasoning_data, dict) else "N/A"
        analisia = reasoning_data.get("analisia", reasoning_data.get("analysis", "Analisia falta da")) if isinstance(reasoning_data, dict) else "N/A"

        return AIResponse(
            ekintzak=ekintzak,
            reasoning={"testuingurua": testuingurua, "analisia": analisia},
            success=baliozkoa and len(erroreak) == 0,
            erroreak=erroreak if erroreak else None
        )

    def _get_static_fallback_response(self, erroreak=None) -> AIResponse:
        """
        Hornitzaile guztiak huts eginez gero, fallback estatiko bat sortu jokoak jarraitu dezan.
        """
        logger.warning("Fallback estatikoa aktibatuta. AI txanda huts egin du.")
        return AIResponse(
            ekintzak=[{"mota": "pass", "parametroak": {}}],
            reasoning={"testuingurua": "AI zerbitzua ez dago erabilgarri.", "analisia": "Ekintza neutroa."},
            success=False,
            erroreak=erroreak if erroreak else ["Zerbitzuak huts egin du."]
        )