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
    target: str  # "zone" or "building"
    target_id: Optional[str] = None
    position: Optional[Dict[str, int]] = None


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

    return APIResponse(success=True, message=result["message"], data={"building": result["building"], "treasury": result["treasury"]})


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

    return APIResponse(success=True, message=result["message"], data={"removed": result["removed"]})


@router.put("/{game_id}/budget", response_model=APIResponse, tags=["Games"])
async def update_budget(
    game_id: str,
    budget_update: BudgetUpdate,
    user_id: str = Depends(get_current_user_id),
    game_service: GameService = Depends(get_game_service)
):
    """Zerga-tasak eta sailen finantzaketa eguneratu."""
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
    game = await game_service.get_game(game_id, user_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    # Hilabetea simulatzeko (jokalari eta AI hiriak)
    updated_game = simulation_engine.simulate_turn(game)

    # AI txanda lortu (AI zerbitzura deia)
    ai_turn_result: AITurnResponse = await get_ai_turn(updated_game)
    
    # AI ekintzak AI hiriari aplikatu
    map_size = updated_game.get("map", {}).get("size", {"width": 100, "height": 100})
    ai_city = updated_game.get("ai_city", {})
    ai_city_updated, applied_actions = AIActionApplier.apply_actions(
        ai_city,
        ai_turn_result.actions,
        updated_game.get("current_date", {"year": 1900, "month": 1}),
        map_size
    )
    
    # AI hiriaren egoera eguneratu
    updated_game["ai_city"] = ai_city_updated
    
    # AI simulazioa berriro exekutatu (AI ekintzak aplikatu ondoren)
    ai_simulation_update = simulation_engine._simulate_city(updated_game["ai_city"])
    updated_game["ai_city"].update(ai_simulation_update)

    updated_game["last_saved"] = datetime.utcnow()
    await game_service.save_game(game_id, user_id, updated_game)

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
            "reasoning": ai_turn_result.reasoning,
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
    return APIResponse(success=True, message=f"Hilabetea amaitu da. {current_date['year']} urtea, {current_date['month']} hilabetea", data=data)


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
