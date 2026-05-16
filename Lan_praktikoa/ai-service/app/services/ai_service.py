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
        Returns actions in BOTH Basque (ekintzak) and English (actions) for frontend compatibility.
        """
        # 1. Prompt-ak sortu ContentGenerator erabiliz
        system_prompt = self.content_generator.generate_system_prompt()
        user_prompt = self.content_generator.generate_user_prompt(game_state, historia)
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        response_json = None
        erroreak = []

        # 2. Saiatu GroqProvider-ekin
        try:
            logger.info("🔵 GroqProvider erabiliz erantzuna eskatzen...")
            logger.info(f"📝 Model: {self.groq_provider.model}")
            logger.info(f"📝 Prompt length: {len(full_prompt)} chars")
            response_json = await self.groq_provider.generate_response(full_prompt)
            logger.info(f"✅ GroqProvider erantzuna jaso da ({len(response_json)} chars)")
            logger.debug(f"📄 Raw response: {response_json[:500]}...")
        except Exception as e:
            import traceback
            logger.error(f"❌ GroqProvider huts egin du: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            logger.warning("GitHubModels-era pasatzen... (Failover)")

            # 3. Saiatu GitHubProvider-ekin
            try:
                logger.info("🔵 GitHubProvider erabiliz erantzuna eskatzen...")
                response_json = await self.github_provider.generate_response(full_prompt)
                logger.info(f"✅ GitHubProvider erantzuna jaso da ({len(response_json)} chars)")
            except Exception as e2:
                logger.error(f"❌ GitHubProvider huts egin du: {e2}")
                logger.error(f"📋 Traceback: {traceback.format_exc()}")
                erroreak.append("AI zerbitzu guztiak huts egin dute.")
                return self._get_static_fallback_response(erroreak)

        # 4. JSON dekodetu (parseo sendoa markdown blokeak kentzeko)
        parsed = None
        try:
            logger.info("🔍 JSON parsing...")
            logger.info(f"📄 Raw response length: {len(response_json)} chars")

            # Aggressively strip markdown code blocks
            cleaned = response_json.strip()
            
            # Remove ALL markdown variations
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)  # Opening ```json
            cleaned = re.sub(r'\s*```$', '', cleaned)  # Closing ```
            cleaned = re.sub(r'^`\s*', '', cleaned)  # Opening `
            cleaned = re.sub(r'\s*`$', '', cleaned)  # Closing `
            cleaned = cleaned.strip()
            
            logger.info(f"✅ Cleaned response ({len(cleaned)} chars): {cleaned[:300]}...")

            # Try direct parse first
            try:
                parsed = json.loads(cleaned)
                logger.info("✅ Direct JSON parse successful")
            except json.JSONDecodeError as e:
                import traceback
                logger.warning(f"⚠️ Direct parse failed: {e}")
                logger.warning(f"📋 Traceback: {traceback.format_exc()}")
                logger.info("🔍 Trying regex JSON extraction...")
                
                # Fallback: extract JSON with regex
                match = re.search(r"\{[\s\S]*\}", cleaned)
                if match:
                    json_str = match.group(0)
                    logger.info(f"📄 Extracted JSON: {json_str[:200]}...")
                    parsed = json.loads(json_str)
                    logger.info("✅ Regex JSON extraction successful")
                else:
                    logger.error("❌ No JSON object found in response")
                    logger.error(f"📄 Full cleaned text: {cleaned}")
                    erroreak.append("AI erantzuna ez da baliozko JSON formatua.")
                    return self._get_static_fallback_response(erroreak)

        except Exception as e:
            import traceback
            logger.error(f"❌ JSON dekodetzean errorea: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            logger.error(f"📄 Raw response was: {response_json[:500]}")
            erroreak.append(f"AI erantzuna ez da baliozko JSON formatua: {e}")
            return self._get_static_fallback_response(erroreak)

        # 5. Ekintzak balioztatu (Ez gastatu ez daukagun dirua)
        # Support both Basque (ekintzak) and English (actions) keys
        ekintzak = parsed.get("actions", parsed.get("ekintzak", []))
        logger.info(f"📊 Raw actions count: {len(ekintzak)}")
        logger.info(f"📊 Actions: {ekintzak}")

        # CRITICAL: If no actions but AI has treasury, force at least one action
        ai_treasury = game_state.get("ai_city", {}).get("treasury", 0)
        if len(ekintzak) == 0 and ai_treasury > 1000:
            logger.warning(f"⚠️ AI has §{ai_treasury} but returned 0 actions. Forcing residential zone placement.")
            # Force a simple residential zone action
            ekintzak = [{
                "type": "placeZone",
                "mota": "placeZone",
                "zone_type": "residential_light",
                "zona_mota": "residential_light",
                "size": {"w": 2, "h": 2},
                "tamaina": {"w": 2, "h": 2},
                "posizioa": {"x": 10, "y": 10},
                "position": {"x": 10, "y": 10}
            }]
            logger.info("✅ Forced action added")

        # Normalize actions to standard format matching Pydantic Action model: {"mota": "...", "parametroak": {...}}
        # Hybrid format: include flat properties for Frontend rendering
        normalized_actions = []
        for action in ekintzak:
            action_type = action.get("type", action.get("mota", "pass"))
            
            params = {
                "position": action.get("position", action.get("posizioa", {})),
                "building_type": action.get("building_type", action.get("eraikin_mota")),
                "zone_type": action.get("zone_type", action.get("zona_mota")),
                "infrastructure_type": action.get("infrastructure_type", action.get("azpiegitura_mota")),
                "target": action.get("target", "ai"),
                "disaster_type": action.get("disaster_type", action.get("hondamendi_mota")),
                "size": action.get("size", action.get("tamaina", {"w": 1, "h": 1})),
                "start_position": action.get("start_position"),
                "end_position": action.get("end_position")
            }
            # Remove None values for parametroak
            clean_params = {k: v for k, v in params.items() if v is not None and v != ""}
            
            # Create hybrid object: mota/parametroak (Backend) + flat properties (Frontend)
            normalized = {
                "mota": action_type,
                "parametroak": clean_params,
                # Flat properties for Frontend
                "type": action_type,
                "position": params["position"],
                "building_type": params["building_type"],
                "zone_type": params["zone_type"],
                "infrastructure_type": params["infrastructure_type"],
                "size": params["size"],
                "start_position": params["start_position"],
                "end_position": params["end_position"]
            }
            # Remove None values from root too
            normalized = {k: v for k, v in normalized.items() if v is not None and v != ""}
            normalized_actions.append(normalized)
        
        logger.info(f"📊 Normalized actions: {normalized_actions}")

        baliozkoa, balioztapen_erroreak = self.validator.validate_actions(game_state, normalized_actions)
        if balioztapen_erroreak:
            logger.warning(f"⚠️ Validation errors: {balioztapen_erroreak}")
        erroreak.extend(balioztapen_erroreak)

        # 6. AIResponse objektua sortu
        reasoning_data = parsed.get("reasoning", {})
        testuingurua = reasoning_data.get("testuingurua", "Testuingurua falta da") if isinstance(reasoning_data, dict) else "N/A"
        analisia = reasoning_data.get("analisia", reasoning_data.get("analysis", "Analisia falta da")) if isinstance(reasoning_data, dict) else "N/A"

        logger.info(f"✅ AIResponse created: {len(normalized_actions)} actions, success={baliozkoa and len(erroreak) == 0}")
        
        try:
            return AIResponse(
                ekintzak=normalized_actions,
                reasoning={"testuingurua": testuingurua, "analisia": analisia},
                success=baliozkoa and len(erroreak) == 0,
                erroreak=erroreak if erroreak else None
            )
        except Exception as e:
            logger.error(f"❌ Error creating AIResponse (Pydantic validation failed): {e}")
            erroreak.append(f"Validation error: {e}")
            return self._get_static_fallback_response(erroreak)

    def _get_static_fallback_response(self, erroreak=None) -> AIResponse:
        """
        Hornitzaile guztiak huts eginez gero, fallback estatiko bat sortu jokoak jarraitu dezan.
        Returns MOCK actions (3-5 simulated actions) for frontend replay compatibility.
        """
        logger.warning("Fallback estatikoa aktibatuta. AI txanda huts egin du.")
        
        # MOCK DATA: Simulated AI actions in HYBRID format (Backend: mota/parametroak, Frontend: flat properties)
        mock_actions = [
            {
                "mota": "placeZone",
                "parametroak": {"zone_type": "residential_light", "size": {"w": 2, "h": 2}, "position": {"x": 8, "y": 8}},
                "type": "placeZone",
                "zone_type": "residential_light",
                "size": {"w": 2, "h": 2},
                "position": {"x": 8, "y": 8}
            },
            {
                "mota": "placeZone",
                "parametroak": {"zone_type": "commercial_light", "size": {"w": 2, "h": 2}, "position": {"x": 12, "y": 8}},
                "type": "placeZone",
                "zone_type": "commercial_light",
                "size": {"w": 2, "h": 2},
                "position": {"x": 12, "y": 8}
            },
            {
                "mota": "placeInfrastructure",
                "parametroak": {"infrastructure_type": "road", "start_position": {"x": 8, "y": 10}, "end_position": {"x": 14, "y": 10}},
                "type": "placeInfrastructure",
                "infrastructure_type": "road",
                "start_position": {"x": 8, "y": 10},
                "end_position": {"x": 14, "y": 10}
            },
            {
                "mota": "buildStructure",
                "parametroak": {"building_type": "school", "position": {"x": 10, "y": 12}},
                "type": "buildStructure",
                "building_type": "school",
                "position": {"x": 10, "y": 12}
            },
            {
                "mota": "placeZone",
                "parametroak": {"zone_type": "industrial_light", "size": {"w": 3, "h": 2}, "position": {"x": 15, "y": 15}},
                "type": "placeZone",
                "zone_type": "industrial_light",
                "size": {"w": 3, "h": 2},
                "position": {"x": 15, "y": 15}
            }
        ]
        
        logger.info(f"📊 Mock actions generated: {len(mock_actions)} actions for replay")
        
        return AIResponse(
            ekintzak=mock_actions,
            reasoning={
                "testuingurua": "AI zerbitzua ez dago erabilgarri. Mock datuak erabiltzen.",
                "analisia": "AA hiriak hazten jarraitzen du: eremu erresidentzialak, komertzialak eta industrialak gehitu dira, baita errepideak eta eskola bat ere."
            },
            success=True,
            erroreak=erroreak
        )