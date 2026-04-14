"""AI zerbitzuaren integrazioa - Groq/GitHub Models LLM hornitzaileekin komunikazioa.

Fitxategi honek AI mikrozerbitzuarekin komunikazioa kudeatzen du, SPECS.md § 12.4 jarraituz.
AI zerbitzua dei egiten du jokalariaren eta AIaren hiriaren egoera bidaliz,
eta AIaren erabakiak (zonak, eraikinak, aurrekontua, etab.) jasotzen ditu.
"""
import httpx
import os
import json
import re
from typing import Dict, Any, List
from ..models import AITurnResponse


AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai-service:8000")
AI_REQUEST_TIMEOUT = int(os.getenv("AI_REQUEST_TIMEOUT", "30"))
AI_MAX_RETRIES = int(os.getenv("AI_MAX_RETRIES", "3"))


def _filter_state_for_ai(game_state: Dict[str, Any]) -> Dict[str, Any]:
    """AIari bidaliko zaion egoera iragazi.

    AIak bere hiriaren xehetasun osoak jasotzen ditu, baina jokalariaren
    informazio mugatua soilik (biztanleria, puntuazioa, zona kopurua).
    """
    player_city = game_state.get("player_city", {})
    ai_city = game_state.get("ai_city", {})
    treasury = player_city.get("treasury", 0)

    if treasury < 0:
        treasury_range = "baxua"
    elif treasury < 10000:
        treasury_range = "ertaina"
    else:
        treasury_range = "altua"

    return {
        "current_date": game_state.get("current_date", {"year": 1900, "month": 1}),
        "ai_city": ai_city,
        "player_info": {
            "population": player_city.get("population", 0),
            "composite_score": player_city.get("metrics", {}).get("composite_score", 0),
            "zone_count": len(player_city.get("zones", [])),
            "treasury_range": treasury_range,
        },
        "ai_personality": game_state.get("ai_personality", "balanced"),
        "difficulty": game_state.get("difficulty", "medium"),
    }


def _extract_json_from_response(text: str) -> Dict:
    """LLM erantzunetik JSONa atera (halluzinazioak kudeatzeko)."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Regex bidez JSONa bilatu
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {"actions": [{"type": "pass"}], "reasoning": "JSON parse errorea"}


async def get_ai_turn(game_state: Dict[str, Any]) -> AITurnResponse:
    """AI zerbitzura deia egin eta erantzuna itzuli.

    SPECS.md § 12.4 jarraituz:
    1. Egoera iragazi (jokalariaren info mugatua)
    2. AI zerbitzura HTTP POST deia
    3. Erantzuna parseatu eta balidatu
    4. Ekintzak itzuli

    Fallback: AI zerbitzua erortzen bada, ekintza lehenetsiak itzuli.
    """
    filtered_state = _filter_state_for_ai(game_state)

    # Available actions determine
    ai_city = game_state.get("ai_city", {})
    current_year = game_state.get("current_date", {}).get("year", 1900)
    treasury = ai_city.get("treasury", 0)

    can_zone = ["residential_light", "residential_dense", "commercial_light",
                "commercial_dense", "industrial_light", "industrial_dense"]
    can_build = ["school", "college", "library", "museum", "hospital",
                 "police_station", "fire_station"]
    
    # Power plants available by year
    if current_year >= 1900:
        can_build.extend(["coal_power", "oil_power"])
    if current_year >= 1950:
        can_build.append("gas_power")
    if current_year >= 1955:
        can_build.append("nuclear_power")
    if current_year >= 1980:
        can_build.append("wind_power")
    if current_year >= 1990:
        can_build.append("solar_power")
    if current_year >= 2020:
        can_build.append("microwave_power")
    if current_year >= 2050:
        can_build.append("fusion_power")

    can_build_infra = ["road", "power_line", "water_pipe"]
    can_enact = ["sales_tax", "income_tax", "legalized_gambling", "parking_fines",
                 "free_clinics", "junior_sports", "pro_reading", "anti_drug",
                 "pollution_controls", "tourist_promotion", "nuclear_free",
                 "neighborhood_watch"]

    available_actions = {
        "can_zone": can_zone,
        "can_build": can_build,
        "can_build_infra": can_build_infra,
        "can_enact_ordinances": can_enact,
        "can_attack": treasury >= 5000,
        "attack_options": ["fire", "flood", "tornado", "earthquake"],
    }

    payload = {
        "game_state": {
            **filtered_state,
            "available_actions": available_actions,
        },
        "personality": filtered_state.get("ai_personality", "balanced"),
        "difficulty": filtered_state.get("difficulty", "medium"),
    }

    try:
        async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{AI_SERVICE_URL}/api/ai/",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

            actions = result.get("actions", [{"type": "pass"}])
            reasoning = result.get("reasoning", "AI ez du arrazoimenik eman")

            return AITurnResponse(
                actions=actions,
                reasoning=reasoning,
            )

    except (httpx.TimeoutException, httpx.ConnectionError, httpx.HTTPStatusError) as e:
        print(f"AI zerbitzua errorea: {e}")
        return AITurnResponse(
            actions=[{"type": "pass"}],
            reasoning=f"AI zerbitzua ez dago eskuragarri: {str(e)}",
        )
    except Exception as e:
        print(f"AI deia unexpected errorea: {e}")
        return AITurnResponse(
            actions=[{"type": "pass"}],
            reasoning="AI deia unexpected errorea",
        )
