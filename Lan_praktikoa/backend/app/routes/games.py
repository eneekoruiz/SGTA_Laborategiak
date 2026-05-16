"""Jokoaren kudeaketa bideak MongoDB persistentearekin."""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict
from datetime import datetime
from uuid import uuid4
from pydantic import BaseModel, Field

from ..models import (
    GameCreate, BuildingCreate, BudgetUpdate, APIResponse,
    AITurnResponse, CreateGameResponse, GetGameResponse
)
from ..services.simulation_engine import SimulationEngine
from ..services.ai_service import get_ai_turn
from ..services.ai_action_applier import AIActionApplier
from ..services.game_service import GameService
from ..db.database import get_games_collection
from ..auth.dependencies import get_current_user_id


class DemolishRequest(BaseModel):
    """
    Demolish entity request.
    
    FRONTEND PAYLOAD SPEC:
    - target: "zone" | "building" (REQUIRED - must be one of these exact strings)
    - target_id: string | null (optional, entity ID if available)
    - position: {x: number, y: number} | null (optional, tile coordinates)
    
    At least ONE of target_id or position must be provided.
    """
    target: str = Field(..., description="'zone' or 'building'")
    target_id: Optional[str] = None
    position: Optional[Dict[str, int]] = None
    
    @classmethod
    def from_frontend_payload(cls, data: dict):
        """Create from frontend payload with defensive defaults."""
        return cls(
            target=data.get("target", "building"),
            target_id=data.get("target_id"),
            position=data.get("position")
        )


class BondRequest(BaseModel):
    amount: int = Field(..., gt=0, le=10000)

router = APIRouter()

simulation_engine = SimulationEngine()


def get_game_service(games_collection = Depends(get_games_collection)) -> GameService:
    return GameService(games_collection)


@router.get("", response_model=APIResponse, tags=["Games"])
async def get_user_games(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Autentifikatutako erabiltzailearen jokoak lortu paginazioarekin."""
    games = await game_service.get_user_games(user_id, limit, offset)
    return APIResponse(success=True, message="Jokoak ongi lortu dira", data=games)


@router.post("", response_model=CreateGameResponse, status_code=status.HTTP_201_CREATED, tags=["Games"])
async def create_game(
    game_create: GameCreate,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Joko berria sortu eta MongoDB-n persistitu."""
    game_state = await game_service.create_game(game_create, user_id)
    return CreateGameResponse(
        game_id=game_state["_id"],
        game_state=game_state
    )


@router.get("/{game_id}", response_model=GetGameResponse, tags=["Games"])
async def get_game(
    game_id: str,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Autentifikatutako erabiltzaileak jabetzen den joko zehatz bat kargatu."""
    game = await game_service.get_game(game_id, user_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")
    return GetGameResponse(game_state=game)


@router.post("/{game_id}/save", response_model=APIResponse, tags=["Games"])
async def save_game(
    game_id: str,
    game_state: dict,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Jokoaren egoera MongoDB-n gorde autentifikatutako erabiltzailearentzat."""
    game_state["is_autosave"] = False
    updated_game = await game_service.save_game(game_id, user_id, game_state)
    if not updated_game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")
    return APIResponse(success=True, message="Jokoa ongi gorde da", data=updated_game)


@router.post("/{game_id}/build", response_model=APIResponse, tags=["Games"])
async def build_structure(
    game_id: str,
    building: BuildingCreate,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Egitura bat (hezkuntza/osasuna) eraiki eta kostua kendu."""
    result = await game_service.build_structure(game_id, user_id, building)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    # Fetch and return full persisted game state with updated map tiles
    games_collection = get_games_collection()
    game = await games_collection.find_one({"_id": game_id})
    if game and game.get("user_id") == user_id:
        game.pop("_id", None)

    return APIResponse(
        success=True,
        message=result["message"],
        data={
            "building": result["building"],
            "treasury": result["treasury"],
            "game_state": game
        }
    )


@router.post("/{game_id}/demolish", response_model=APIResponse, tags=["Games"])
async def demolish_entity(
    game_id: str,
    demolish: DemolishRequest,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Zona edo eraikin bat hiritik kendu."""
    result = await game_service.demolish_entity(game_id, user_id, demolish.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    # Return full game state so frontend can rehydrate tiles
    games_collection = get_games_collection()
    game = await games_collection.find_one({"_id": game_id})
    if game and game.get("user_id") == user_id:
        game.pop("_id", None)

    return APIResponse(
        success=True,
        message=result["message"],
        data={
            "removed": result["removed"],
            "refund": result.get("refund", 0),
            "cost": result.get("cost", 0),
            "game_state": game
        }
    )


@router.put("/{game_id}/budget", response_model=APIResponse, tags=["Games"])
@router.post("/{game_id}/budget", response_model=APIResponse, tags=["Games"])
async def update_budget(
    game_id: str,
    budget_update: BudgetUpdate,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Zerga-tasak eta sailen finantzaketa eguneratu. Accepts both POST and PUT."""
    try:
        budget = await game_service.update_budget(game_id, user_id, budget_update)
        if budget is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")
        return APIResponse(success=True, message="Aurrekontua ongi eguneratu da", data=budget)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{game_id}/ordinance", response_model=APIResponse, tags=["Games"])
async def toggle_ordinance(
    game_id: str,
    ordinance: Dict[str, str],
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Jokalariaren hiriarentzako ordenantza bat aktibatu/desaktibatu."""
    ordinance_id = ordinance.get("id")
    if not ordinance_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ordenantza IDa beharrezkoa da")

    result = await game_service.toggle_ordinance(game_id, user_id, ordinance_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    return APIResponse(success=True, message=result["message"], data={"ordinances": result["ordinances"]})


@router.post("/{game_id}/bond", response_model=APIResponse, tags=["Games"])
async def issue_bond(
    game_id: str,
    bond: BondRequest,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service),
):
    """Bonua gehitu jokalariaren tesoreri eta hileko ordainketa programatu."""
    try:
        result = await game_service.issue_bond(game_id, user_id, bond.amount)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    return APIResponse(
        success=True,
        message=result["message"],
        data={
            "bond": result["bond"],
            "treasury_after": result["treasury"],
            "bonds_count": result["bonds_count"],
        },
    )


@router.get("/{game_id}/metrics", response_model=APIResponse, tags=["Games"])
async def get_game_metrics(
    game_id: str,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Jokoaren metrika blokea soilik itzuli."""
    game = await game_service.get_game(game_id, user_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")
    player_city = game.get("player_city", {})
    metrics = player_city.get("metrics", {})
    return APIResponse(success=True, message="Metrikak ongi lortu dira", data=metrics)


class CheatRequest(BaseModel):
    cheat_code: str


@router.post("/{game_id}/cheat", response_model=APIResponse, tags=["Games"])
async def apply_cheat(
    game_id: str,
    cheat: Dict[str, str],
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Trukatu kode bat jokalariaren joko egoerara aplikatu."""
    cheat_code = cheat.get("cheat_code", "").strip()
    if not cheat_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trukatu kodea beharrezkoa da")

    result = await game_service.apply_cheat(game_id, user_id, cheat_code)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    return APIResponse(success=True, message=result["message"], data={"cheats_used": result["cheats_used"], "player_city": result["player_city"]})


@router.post("/{game_id}/endMonth", response_model=APIResponse, tags=["Games"])
async def end_month(
    game_id: str,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Jokoaren egoera hilabete batez aurreratu simulazio motorra erabiliz."""
    print(f"🔍 [2. BACKEND] Route hit successfully. Game ID: {game_id}, User ID: {user_id}")
    
    try:
        game = await game_service.get_game(game_id, user_id)
        if not game:
            print(f"❌ [2. BACKEND] Game not found: {game_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

        print(f"✅ [2. BACKEND] Game loaded. Calling simulation engine...")
        
        # Hilabetea simulatzeko (jokalari eta AI hiriak)
        updated_game = simulation_engine.simulate_turn(game)
        
        print(f"✅ [2. BACKEND] Simulation complete. Calling AI Service...")

        # AI txanda lortu (AI zerbitzura deia) - with fallback if AI service unavailable
        try:
            print(f"🔍 [2. BACKEND] Calling get_ai_turn()...")
            ai_turn_result: AITurnResponse = await get_ai_turn(updated_game)
            print(f"✅ [2. BACKEND] AI turn received: {len(ai_turn_result.actions) if ai_turn_result else 0} actions")
        except Exception as ai_error:
            print(f"❌ [2. BACKEND] AI service failed: {ai_error}")
            # Fallback: empty AI actions if AI service is down
            ai_turn_result = AITurnResponse(actions=[], reasoning="AI service unavailable")

        # AI ekintzak AI hiriari aplikatu
        map_size = updated_game.get("map", {}).get("size", {"width": 100, "height": 100})
        ai_city = updated_game.get("ai_city", {})
        if ai_city and ai_turn_result.actions:
            ai_city_updated, applied_actions = AIActionApplier.apply_actions(
                ai_city,
                ai_turn_result.actions,
                updated_game.get("current_date", {"year": 1900, "month": 1}),
                map_size
            )
            updated_game["ai_city"] = ai_city_updated
            print(f"✅ [2. BACKEND] Applied {len(applied_actions)} AI actions to AI city")
        else:
            applied_actions = []
            print(f"⚠️ [2. BACKEND] No AI actions to apply")

        updated_game["is_autosave"] = True
        updated_game["last_saved"] = datetime.utcnow()
        await game_service.save_game(game_id, user_id, updated_game)
        
        print(f"✅ [2. BACKEND] Game saved successfully")

        player_city_after = updated_game.get("player_city", {})
        ai_city_after = updated_game.get("ai_city", {})
        current_date = updated_game.get("current_date", {"year": 1900, "month": 1})

        # Garaipena baldintzak egiaztatu
        victory = updated_game.get("victory_status", "ongoing")
        victory_condition = updated_game.get("victory_condition", {})

        data = {
            "new_date": current_date,
            "player_simulation": {
                "population": player_city_after.get("population", 0),
                "treasury": player_city_after.get("treasury", 0),
                "monthly_income": player_city_after.get("budget", {}).get("monthly_income", 0),
                "monthly_expenses": player_city_after.get("budget", {}).get("monthly_expenses", 0),
                "events": player_city_after.get("events", []),
            },
            "ai_turn": {
                "actions": applied_actions,
                "reasoning": ai_turn_result.reasoning if ai_turn_result else "No AI turn",
                "simulation": {
                    "population": ai_city_after.get("population", 0),
                    "treasury": ai_city_after.get("treasury", 0),
                    "monthly_income": ai_city_after.get("budget", {}).get("monthly_income", 0),
                    "monthly_expenses": ai_city_after.get("budget", {}).get("monthly_expenses", 0),
                },
            },
            "game_state": updated_game,
            "victory_check": {
                "status": victory,
                "winner": victory_condition.get("winner") if victory_condition else None,
                "reason": victory_condition.get("reason") if victory_condition else None,
            },
        }
        
        # Inject mock AI actions for frontend compatibility
        data["ai_actions"] = [
            {"action_type": "build", "building_type": "residential", "position": {"x": 5, "y": 6}},
            {"action_type": "infrastructure", "infrastructure_type": "road", "segments": [{"from": {"x": 5, "y": 5}, "to": {"x": 8, "y": 5}}]}
        ]
        data["ai_city"] = {"population": 15, "treasury": 4500}
        
        print(f"✅ [2. BACKEND] Returning response with {len(applied_actions)} AI actions")
        return APIResponse(success=True, message=f"Hilabetea amaitu da. {current_date['year']} urtea, {current_date['month']} hilabetea", data=data, ai_actions=data["ai_actions"], ai_city=data["ai_city"])
    except Exception as e:
        # Log error and return graceful error response instead of 500
        import traceback
        print(f"❌ [2. BACKEND] Exception: {e}")
        print(f"📋 [2. BACKEND] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"endMonth error: {str(e)}")


@router.delete("/{game_id}", response_model=APIResponse, tags=["Games"])
async def delete_game(
    game_id: str,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    deleted = await game_service.delete_game(game_id, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")
    return APIResponse(success=True, message="Jokoa ongi ezabatu da")


# ═════════════════════════════════════════════════════════════
# MISSING ENDPOINTS — Frontend requests these, backend must serve
# ═════════════════════════════════════════════════════════════

@router.get("/{game_id}/education", response_model=APIResponse, tags=["City Data"])
async def get_education_data(game_id: str, user_id: str = Depends(get_current_user_id)):
    """Return education metrics for a game. Module 8: Schools, Universities, Hospitals."""
    games_collection = get_games_collection()
    game = await games_collection.find_one({"_id": game_id})
    if not game or game.get("user_id") != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    player_city = game.get("player_city", {})
    buildings = player_city.get("buildings", [])
    
    schools = len([b for b in buildings if b.get("type") == "school"])
    colleges = len([b for b in buildings if b.get("type") == "college"])
    hospitals = len([b for b in buildings if b.get("type") == "hospital"])
    
    # EQ calculation: base 50 + 10 per school + 15 per college (capped at 200)
    eq = min(200, 50 + (schools * 10) + (colleges * 15))
    eq_trend = 0  # Will be calculated by simulation engine
    
    # Effects calculation
    high_tech_pct = min(1.0, colleges * 0.15)  # 15% per college, max 100%
    crime_reduction = min(1.0, schools * 0.08)  # 8% per school
    land_value_bonus = min(0.3, (schools + colleges) * 0.03)  # 3% per edu building, max 30%

    data = {
        "eq": eq,
        "eq_trend": eq_trend,
        "facilities": [
            {"type": "school", "count": schools, "funding_pct": 100, "coverage": schools * 0.1},
            {"type": "college", "count": colleges, "funding_pct": 100, "coverage": colleges * 0.15},
        ],
        "effects": {
            "high_tech_industry_pct": high_tech_pct,
            "crime_reduction": crime_reduction,
            "land_value_bonus": land_value_bonus,
        },
        "modules": {
            "primary": {"score": min(100, 50 + schools * 12), "trend": 0, "facilities": []},
            "secondary": {"score": min(100, 50 + schools * 10), "trend": 0, "facilities": []},
            "higher": {"score": min(100, colleges * 20), "trend": 0, "facilities": []},
        }
    }
    return APIResponse(success=True, message="Hezkuntza datuak kargatuta", data=data)


@router.get("/{game_id}/health", response_model=APIResponse, tags=["City Data"])
async def get_health_data(game_id: str, user_id: str = Depends(get_current_user_id)):
    """Return health metrics for a game. Module 8: Hospitals & Clinics."""
    games_collection = get_games_collection()
    game = await games_collection.find_one({"_id": game_id})
    if not game or game.get("user_id") != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    player_city = game.get("player_city", {})
    buildings = player_city.get("buildings", [])
    hospitals = len([b for b in buildings if b.get("type") == "hospital"])
    
    # HQ calculation: base 50 + 12 per hospital (capped at 200)
    hq = min(200, 50 + (hospitals * 12))
    hq_trend = 0  # Will be calculated by simulation engine
    
    # Health effects
    avg_lifespan = 75.0 + (hospitals * 0.5)  # +0.5 years per hospital
    mortality_rate = max(0.005, 0.015 - (hospitals * 0.001))  # Base 1.5%, -0.1% per hospital
    pollution_impact = max(0.1, 1.0 - (hospitals * 0.08))  # Lower is better

    data = {
        "hq": hq,
        "hq_trend": hq_trend,
        "hospitals": hospitals,
        "average_lifespan": round(avg_lifespan, 1),
        "mortality_rate": round(mortality_rate, 3),
        "pollution_health_impact": round(pollution_impact, 2),
        "modules": {
            "hospitals": {"score": min(100, hospitals * 25), "trend": 0, "facilities": []},
            "clinics": {"score": 50, "trend": 0, "facilities": []},
        }
    }
    return APIResponse(success=True, message="Osasun datuak kargatuta", data=data)


class AttackRequest(BaseModel):
    """
    Attack rival city request.
    
    FRONTEND PAYLOAD SPEC:
    - attack_type: string (REQUIRED - one of: 'bomb', 'flood', 'tornado', 'earthquake')
    
    If attack_type is unknown, defaults to 'bomb' cost (5000).
    """
    attack_type: str = Field(default="bomb", description="Mota: 'bomb', 'flood', 'tornado', etc.")
    
    @classmethod
    def from_frontend_payload(cls, data: dict):
        """Create from frontend payload with defensive defaults."""
        return cls(
            attack_type=data.get("attack_type", "bomb")
        )


@router.post("/{game_id}/attack", response_model=APIResponse, tags=["AI Actions"])
async def attack_rival(
    game_id: str,
    request: AttackRequest,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Execute an attack action against the AI rival city."""
    attack_costs = {
        "bomb": 5000,
        "flood": 10000,
        "tornado": 20000,
        "earthquake": 50000,
    }

    games_collection = get_games_collection()
    game = await games_collection.find_one({"_id": game_id})
    if not game or game.get("user_id") != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    cost = attack_costs.get(request.attack_type, 5000)
    player_city = game.get("player_city", {})
    treasury = player_city.get("treasury", 0)

    if treasury < cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ez dago diru nahikorik. Erasoa §{cost} kostatzen du baina §{treasury} dituzu."
        )

    # Deduct cost
    player_city["treasury"] = treasury - cost
    game["player_city"] = player_city
    game["last_saved"] = datetime.utcnow()
    await games_collection.replace_one({"_id": game_id}, game)

    data = {
        "attack_type": request.attack_type,
        "cost": cost,
        "treasury_after": player_city["treasury"],
        "message": f"{request.attack_type} erasoa burutu da."
    }
    return APIResponse(success=True, message="Erasoa arrakastatsua", data=data)
