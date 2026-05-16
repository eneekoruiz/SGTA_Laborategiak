"""Hiriko zonen kudeaketa bideak MongoDB persistentearekin."""
from fastapi import APIRouter, HTTPException, status, Depends
from uuid import uuid4
from datetime import datetime

from ..models import ZoneCreate, APIResponse
from ..db.database import get_games_collection
from ..auth.dependencies import get_current_user_id

from ..services.game_constants import GAME_CONSTANTS

router = APIRouter()

ZONE_COSTS = GAME_CONSTANTS["ZONE_COSTS"]


@router.post("/{game_id}/zone", response_model=APIResponse, tags=["City Actions"])
async def create_zone(game_id: str, zone: ZoneCreate, user_id: str = Depends(get_current_user_id)):
    """Jokoan zona berri bat sortu, balidatu eta ordaindu."""
    games_collection = get_games_collection()
    game = await games_collection.find_one({"_id": game_id})

    if not game or game.get("user_id") != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    if zone.type not in ZONE_COSTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zona mota baliogabea da")

    if not (1 <= zone.size.w <= 6 and 1 <= zone.size.h <= 6):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zona tamaina 1x1 eta 6x6 artean egon behar da",
        )

    cost_per_tile = ZONE_COSTS[zone.type]
    total_tiles = zone.size.w * zone.size.h
    total_cost = cost_per_tile * total_tiles

    player_city = game.get("player_city", {})
    current_treasury = player_city.get("treasury", 0)

    if current_treasury < total_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ez dago diru nahikorik. Zona honek §{total_cost} kostatzen du baina §{current_treasury} dituzu.",
        )

    map_size = game.get("map", {}).get("size", {"width": 100, "height": 100})
    affected_tiles = []

    for dx in range(zone.size.w):
        for dy in range(zone.size.h):
            x = zone.position.x + dx
            y = zone.position.y + dy
            if not (0 <= x < map_size["width"] and 0 <= y < map_size["height"]):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zona kokapena maparen muga kanpoan dago")
            affected_tiles.append({"x": x, "y": y})

    zone_id = f"zone_{uuid4().hex[:8]}"
    current_date = game.get("current_date", {"year": 1900, "month": 1})

    new_zone = {
        "id": zone_id,
        "type": zone.type,
        "position": {"x": zone.position.x, "y": zone.position.y},
        "size": {"w": zone.size.w, "h": zone.size.h},
        "development_level": 0,
        "powered": False,
        "watered": False,
        "road_access": False,
        "abandoned": False,
        "population": 0,
        "built_year": current_date["year"],
        "built_month": current_date["month"],
    }

    player_city.setdefault("zones", []).append(new_zone)
    player_city["treasury"] = current_treasury - total_cost

    game["player_city"] = player_city
    game["last_saved"] = datetime.utcnow()

    # Update map tiles so the zone renders immediately
    tiles = game.get("map", {}).get("tiles", [])
    for dt in affected_tiles:
        tx, ty = dt["x"], dt["y"]
        if tiles and len(tiles) > ty and len(tiles[ty]) > tx:
            tile = tiles[ty][tx]
            if not tile.get("building"):
                tile["zone"] = {
                    "id": zone_id,
                    "type": zone.type,
                    "position": {"x": tx, "y": ty},
                    "size": {"w": 1, "h": 1},
                    "development_level": 0,
                    "powered": False,
                    "watered": False,
                    "road_access": False,
                }
                tile["surfaceEntity"] = {"type": "zone", "value": zone.type}

    await games_collection.replace_one({"_id": game_id}, game)

    # Clean up internal fields for response
    game.pop("_id", None)
    game.pop("user_id", None)

    return APIResponse(
        success=True,
        message=f"{zone.type} mota duen zona sortu da",
        data={
            "zone": new_zone,
            "cost": total_cost,
            "treasury_after": player_city["treasury"],
            "affected_tiles": affected_tiles,
            "game_state": game,
        },
    )


@router.post("/{game_id}/infrastructure", response_model=APIResponse, tags=["City Actions"])
async def create_infrastructure(game_id: str, data: dict, user_id: str = Depends(get_current_user_id)):
    """Azpiegitura berri bat sortu maparen muga eta kostuak kontuan hartuta."""
    INFRA_COSTS = {
        "road": 10,
        "highway": 25,
        "highway_ramp": 25,
        "power_line": 2,
        "rail": 3,
        "water_pipe": 1,
        "subway_tunnel": 5,
    }

    games_collection = get_games_collection()
    game = await games_collection.find_one({"_id": game_id})

    if not game or game.get("user_id") != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jokoa ez da aurkitu")

    infra_type = data.get("type", "").lower()
    start = data.get("start_position")
    end = data.get("end_position")

    if not start or not end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_position eta end_position beharrezkoak dira")

    if infra_type not in INFRA_COSTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Azpiegitura mota baliogabea da")

    dx = abs(end["x"] - start["x"])
    dy = abs(end["y"] - start["y"])
    steps = max(dx, dy)

    tiles_covered = []
    if steps == 0:
        tiles_covered.append({"x": start["x"], "y": start["y"]})
    else:
        for i in range(steps + 1):
            t = i / steps
            x = int(start["x"] + (end["x"] - start["x"]) * t)
            y = int(start["y"] + (end["y"] - start["y"]) * t)
            if not tiles_covered or (tiles_covered[-1]["x"], tiles_covered[-1]["y"]) != (x, y):
                tiles_covered.append({"x": x, "y": y})

    map_size = game.get("map", {}).get("size", {"width": 100, "height": 100})
    for tile in tiles_covered:
        if not (0 <= tile["x"] < map_size["width"] and 0 <= tile["y"] < map_size["height"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Azpiegitura segmentu bat maparen mugetatik kanpo doa")

    cost_per_tile = INFRA_COSTS[infra_type]
    total_cost = cost_per_tile * len(tiles_covered)

    player_city = game.get("player_city", {})
    current_treasury = player_city.get("treasury", 0)

    if current_treasury < total_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ez dago diru nahikorik. Azpiegitura honek §{total_cost} kostatzen du baina §{current_treasury} dituzu.",
        )

    infra_id = f"infra_{uuid4().hex[:8]}"
    current_date = game.get("current_date", {"year": 1900, "month": 1})

    infra_segment = {
        "id": infra_id,
        "type": infra_type,
        "start_position": start,
        "end_position": end,
        "tiles_covered": tiles_covered,
        "built_year": current_date["year"],
        "built_month": current_date["month"],
        "maintenance_level": 100,
    }

    inventory = player_city.setdefault("infrastructure", {
        "roads": [],
        "highways": [],
        "power_lines": [],
        "rail": [],
        "water_pipes": [],
        "subway": [],
    })

    category_map = {
        "road": "roads",
        "highway": "highways",
        "highway_ramp": "highways",
        "power_line": "power_lines",
        "rail": "rail",
        "water_pipe": "water_pipes",
        "subway_tunnel": "subway",
    }

    cat = category_map.get(infra_type, "roads")
    inventory.setdefault(cat, []).append(infra_segment)

    player_city["treasury"] = current_treasury - total_cost
    game["player_city"] = player_city
    game["last_saved"] = datetime.utcnow()

    # Update map tiles with infrastructure data
    tiles = game.get("map", {}).get("tiles", [])
    is_underground = infra_type in ("water_pipe", "subway_tunnel")
    for dt in tiles_covered:
        tx, ty = dt["x"], dt["y"]
        if tiles and len(tiles) > ty and len(tiles[ty]) > tx:
            tile = tiles[ty][tx]
            infra_list = tile.setdefault("infrastructure", [])
            if infra_type not in infra_list:
                infra_list.append(infra_type)
            if is_underground:
                tile["undergroundEntity"] = {"type": "infrastructure", "value": infra_type}
            else:
                tile["surfaceEntity"] = {"type": "infrastructure", "value": infra_type}

    await games_collection.replace_one({"_id": game_id}, game)

    # Clean up internal fields for response
    game.pop("_id", None)
    game.pop("user_id", None)

    return APIResponse(
        success=True,
        message=f"{infra_type} azpiegitura sortu da {start} eta {end} artean",
        data={
            "infrastructure": infra_segment,
            "cost": total_cost,
            "segments_placed": len(tiles_covered),
            "treasury_after": player_city["treasury"],
            "game_state": game,
        },
    )
