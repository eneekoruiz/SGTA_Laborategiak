"""Kontsulta bideak - gainjarriak eta estatistikak."""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, List

from ..models import APIResponse
from ..services.game_service import GameService
from ..auth.dependencies import get_current_user_id

router = APIRouter()


def get_game_service(games_collection=None) -> GameService:
    """Game service lortu (dependency injection)."""
    from ..db.database import get_games_collection
    if games_collection is None:
        # Fallback for when not using dependency injection
        from motor.motor_asyncio import AsyncIOMotorClient
        from ..config import settings
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        games_collection = client[settings.MONGODB_DB].games
    return GameService(games_collection)


@router.get("/{game_id}/overlay/{overlay_type}", response_model=APIResponse, tags=["Queries"])
async def get_overlay(
    game_id: str,
    overlay_type: str,
    user_id: str = Depends(get_current_user_id),
):
    """Datu gainjarria lortu mapa gainean erakusteko.

    Gainjarri motak:
    - crime: Krimena maila (0-100)
    - pollution_air: Aire kutsadura (0-100)
    - pollution_water: Ur kutsadura (0-100)
    - land_value: Lur balioa (0-255)
    - traffic: Trafikoa (0-100)
    - power: Energia estaldura (0-100)
    - water: Ur estaldura (0-100)
    - fire_coverage: Suhiltzaile estaldura (0-100)
    - police_coverage: Polizia estaldura (0-100)
    - health: Osasun estaldura (0-100)
    - education: Hezkuntza estaldura (0-100)
    """
    valid_overlays = {
        "crime", "pollution_air", "pollution_water", "land_value",
        "traffic", "power", "water", "fire_coverage", "police_coverage",
        "health", "education"
    }

    if overlay_type not in valid_overlays:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gainjarri mota baliogabea. Baliozkoak: {', '.join(valid_overlays)}"
        )

    # TODO: Implement actual overlay calculation
    # For now, return empty data structure
    game_service = get_game_service()
    game = await game_service.get_game(game_id, user_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    map_size = game.get("map", {}).get("size", {"width": 100, "height": 100})
    width, height = map_size.get("width", 100), map_size.get("height", 100)

    # Placeholder data - in production, calculate actual values
    overlay_data = [[0 for _ in range(width)] for _ in range(height)]

    return APIResponse(
        success=True,
        message=f"{overlay_type} gainjarria ongi lortu da",
        data={
            "overlay_type": overlay_type,
            "data": overlay_data,
            "min_value": 0,
            "max_value": 100,
        }
    )


@router.get("/{game_id}/stats", response_model=APIResponse, tags=["Queries"])
async def get_game_stats(
    game_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Jokoaren estatistika osoak lortu (jokalaria vs AI)."""
    game_service = get_game_service()
    game = await game_service.get_game(game_id, user_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    player_city = game.get("player_city", {})
    ai_city = game.get("ai_city", {})
    player_metrics = player_city.get("metrics", {})
    ai_metrics = ai_city.get("metrics", {})

    stats = {
        "player": {
            "population": player_city.get("population", 0),
            "treasury": player_city.get("treasury", 0),
            "composite_score": player_metrics.get("composite_score", 0),
            "eq": player_metrics.get("eq", 50),
            "hq": player_metrics.get("hq", 50),
            "crime_rate": player_metrics.get("crime_rate", 50),
            "pollution_air": player_metrics.get("pollution_air", 50),
            "pollution_water": player_metrics.get("pollution_water", 50),
            "land_value_avg": player_metrics.get("land_value_avg", 50),
            "approval": player_metrics.get("approval", 50),
            "unemployment": player_metrics.get("unemployment", 5),
            "traffic_avg": player_metrics.get("traffic_avg", 50),
            "rci_demand": player_metrics.get("rci_demand", {"r": 0, "c": 0, "i": 0}),
            "power_coverage": player_city.get("power_grid", {}).get("coverage_pct", 0),
            "water_coverage": player_city.get("water_system", {}).get("coverage_pct", 0),
            "zones": len(player_city.get("zones", [])),
            "buildings": len(player_city.get("buildings", [])),
            "education": player_metrics.get("education", {}),
            "health": player_metrics.get("health", {}),
        },
        "ai": {
            "population": ai_city.get("population", 0),
            "treasury": ai_city.get("treasury", 0),
            "composite_score": ai_metrics.get("composite_score", 0),
            "eq": ai_metrics.get("eq", 50),
            "hq": ai_metrics.get("hq", 50),
            "crime_rate": ai_metrics.get("crime_rate", 50),
            "pollution_air": ai_metrics.get("pollution_air", 50),
            "pollution_water": ai_metrics.get("pollution_water", 50),
            "land_value_avg": ai_metrics.get("land_value_avg", 50),
            "approval": ai_metrics.get("approval", 50),
            "unemployment": ai_metrics.get("unemployment", 5),
            "traffic_avg": ai_metrics.get("traffic_avg", 50),
            "rci_demand": ai_metrics.get("rci_demand", {"r": 0, "c": 0, "i": 0}),
            "power_coverage": ai_city.get("power_grid", {}).get("coverage_pct", 0),
            "water_coverage": ai_city.get("water_system", {}).get("coverage_pct", 0),
            "zones": len(ai_city.get("zones", [])),
            "buildings": len(ai_city.get("buildings", [])),
        },
        "comparison": {
            "population_diff": player_city.get("population", 0) - ai_city.get("population", 0),
            "score_diff": player_metrics.get("composite_score", 0) - ai_metrics.get("composite_score", 0),
            "treasury_diff": player_city.get("treasury", 0) - ai_city.get("treasury", 0),
            "eq_diff": player_metrics.get("eq", 50) - ai_metrics.get("eq", 50),
            "hq_diff": player_metrics.get("hq", 50) - ai_metrics.get("hq", 50),
        },
        "game_info": {
            "current_date": game.get("current_date", {"year": 1900, "month": 1}),
            "difficulty": game.get("difficulty", "medium"),
            "ai_personality": game.get("ai_personality", "balanced"),
            "victory_status": game.get("victory_status", "ongoing"),
        },
    }

    return APIResponse(
        success=True,
        message="Jokoaren estatistikak ongi lortu dira",
        data=stats
    )
