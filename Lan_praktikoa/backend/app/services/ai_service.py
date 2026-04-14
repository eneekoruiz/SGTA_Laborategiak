from typing import Dict, Any
from ..models import AITurnResponse


def _summarize_state_for_llm(game_state: Dict[str, Any]) -> Dict[str, Any]:
    """Jokoaren egoera LLMarentzako laburtu.

    Metadatarik gabeko objektua itzultzen du: tesoreria, eraikinen konta, osasun/heziketa batezbestekoa eta azken hondamendiak.
    """
    player_city = game_state.get("player_city", {})
    budget = player_city.get("budget", {})
    buildings = player_city.get("buildings", [])

    building_counts: Dict[str, int] = {}
    for building in buildings:
        btype = building.get("type", "unknown")
        building_counts[btype] = building_counts.get(btype, 0) + 1

    health_pct = budget.get("funding", {}).get("health", 0)
    education_pct = budget.get("funding", {}).get("education", 0)
    average_health_education = (health_pct + education_pct) / 2 if (health_pct is not None and education_pct is not None) else 0

    return {
        "treasury_balance": player_city.get("treasury", 0),
        "building_counts": building_counts,
        "health_funding_pct": health_pct,
        "education_funding_pct": education_pct,
        "average_health_education_pct": average_health_education,
        "recent_disasters": game_state.get("recent_disasters", []),
    }


async def get_ai_turn(game_state: Dict[str, Any]) -> AITurnResponse:
    """AI zerbitzuaren funtzio maketoa 5. fasearentzat.

    Beti itzultzen du ekintza zerrenda maketo bat eta ai_city arin eguneratua.
    Hau da AI mikrozerbitzu errealarentzako leku-marka (SPECS § 12.4).
    """
    ai_city = game_state.get("ai_city", {})

    # AI logika maketoa: aldaketarik ez, baina AIak 'jokatu' duela adierazten du.
    return AITurnResponse(
        actions=[
            {
                "action": "wait",
                "description": "Ez dago AI ekintza nabarmenik modu maketoan.",
            }
        ],
        reasoning="AI txanda maketoa exekutatu da (leku-marka).",
    )
