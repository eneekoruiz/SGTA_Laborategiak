"""Game service for business logic."""
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import uuid4
import pymongo.errors
from motor.motor_asyncio import AsyncIOMotorCollection
from fastapi import HTTPException, status
from ..models import GameCreate, BudgetUpdate, APIResponse, BuildingCreate
from ..models.building import Size



class GameService:
    """Jokoaren zerbitzua negozio logika kudeatzeko."""

    def __init__(self, games_collection: AsyncIOMotorCollection):
        self.games_collection = games_collection

    async def create_game(self, game_create: GameCreate, user_id: str) -> Dict[str, Any]:
        """Joko berria sortu eta MongoDB-n persistitu."""
        game_id = f"game_{uuid4().hex}"
        current_date = {"year": 1900, "month": 1}
        starting_treasury = 10000
        if game_create.difficulty.value == "easy":
            starting_treasury = 20000
        elif game_create.difficulty.value == "hard":
            starting_treasury = 5000

        game_state = {
            "_id": game_id,
            "user_id": user_id,
            "name": game_create.name,
            "scenario_id": game_create.scenario_id,
            "difficulty": game_create.difficulty.value,
            "ai_personality": game_create.ai_personality.value,
            "created_at": datetime.utcnow(),
            "last_saved": datetime.utcnow(),
            "current_date": current_date,
            "player_city": {
                "name": "Player City",
                "owner": "player",
                "population": 100,
                "treasury": starting_treasury,
                "months_bankrupt": 0,
                "zones": [],
                "buildings": [],
                "infrastructure": {
                    "roads": [],
                    "highways": [],
                    "power_lines": [],
                    "rail": [],
                    "water_pipes": [],
                    "subway": [],
                },
                "budget": {
                    "tax_rates": {"residential": 7, "commercial": 7, "industrial": 7},
                    "funding": {"transportation": 100, "police": 100, "fire": 100, "health": 100, "education": 100},
                    "bonds": [],
                    "last_year_income": 0,
                    "last_year_expenses": 0,
                    "monthly_income": 0,
                    "monthly_expenses": 0,
                },
                "ordinances": [],
                "metrics": {
                    "eq": 50,
                    "hq": 50,
                    "crime_rate": 50,
                    "pollution_air": 50,
                    "pollution_water": 50,
                    "land_value_avg": 50,
                    "approval": 50,
                    "unemployment": 5,
                    "traffic_avg": 50,
                    "rci_demand": {"r": 0, "c": 0, "i": 0},
                    "composite_score": 0,
                },
                "power_grid": {"total_capacity_mw": 0, "total_demand_mw": 0, "coverage_pct": 0},
                "water_system": {"total_capacity": 0, "total_demand": 0, "coverage_pct": 0},
            },
            "ai_city": {
                "name": "AI City",
                "owner": "ai",
                "population": 100,
                "treasury": 10000,
                "months_bankrupt": 0,
                "zones": [],
                "buildings": [],
                "infrastructure": {
                    "roads": [],
                    "highways": [],
                    "power_lines": [],
                    "rail": [],
                    "water_pipes": [],
                    "subway": [],
                },
                "budget": {
                    "tax_rates": {"residential": 7, "commercial": 7, "industrial": 7},
                    "funding": {"transportation": 100, "police": 100, "fire": 100, "health": 100, "education": 100},
                    "bonds": [],
                    "last_year_income": 0,
                    "last_year_expenses": 0,
                    "monthly_income": 0,
                    "monthly_expenses": 0,
                },
                "ordinances": [],
                "metrics": {
                    "eq": 50,
                    "hq": 50,
                    "crime_rate": 50,
                    "pollution_air": 50,
                    "pollution_water": 50,
                    "land_value_avg": 50,
                    "approval": 50,
                    "unemployment": 5,
                    "traffic_avg": 50,
                    "rci_demand": {"r": 0, "c": 0, "i": 0},
                    "composite_score": 0,
                },
                "power_grid": {"total_capacity_mw": 0, "total_demand_mw": 0, "coverage_pct": 0},
                "water_system": {"total_capacity": 0, "total_demand": 0, "coverage_pct": 0},
            },
            "map": {
                "size": {"width": 100, "height": 100},
                "tiles": [[{} for _ in range(100)] for _ in range(100)],
                "water_level": 2,
            },
            "disaster_attacks": {},
            "cheats_used": [],
            "victory_status": "ongoing",
        }

        try:
            await self.games_collection.insert_one(game_state)
            return game_state
        except pymongo.errors.DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Jokoaren IDa dagoeneko existitzen da")

    async def get_user_games(self, user_id: str, limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
        """Erabiltzailearen jokoak lortu paginazioarekin."""
        games = await self.games_collection.find({"user_id": user_id}).skip(offset).limit(limit).to_list(length=limit)
        # Convert MongoDB _id to id for frontend compatibility
        for game in games:
            if "_id" in game:
                game["id"] = game["_id"]
        return games

    async def get_game(self, game_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Joko zehatz bat lortu."""
        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        return game

    async def save_game(self, game_id: str, user_id: str, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Jokoaren egoera gorde."""
        existing_game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not existing_game:
            return None

        sanitized_updates = {
            k: v for k, v in game_state.items() if k not in ["_id", "id", "user_id"]
        }
        sanitized_updates["last_saved"] = datetime.utcnow()

        await self.games_collection.update_one(
            {"_id": game_id, "user_id": user_id},
            {"$set": sanitized_updates},
        )
        updated_game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        return updated_game

    async def update_budget(self, game_id: str, user_id: str, budget_update: BudgetUpdate) -> Optional[Dict[str, Any]]:
        """Aurrekontua eguneratu."""
        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not game:
            return None

        player_city = game.get("player_city", {})
        budget = player_city.get("budget", {})

        if budget_update.tax_rates:
            tax_rates = budget_update.tax_rates.dict()
            for key, value in tax_rates.items():
                if not (0 <= value <= 20):
                    raise ValueError(f"Zerga-tasa {key} 0-20% artean egon behar da")
            budget["tax_rates"] = tax_rates

        if budget_update.funding:
            funding = budget_update.funding.dict()
            for key, value in funding.items():
                if not (0 <= value <= 120):
                    raise ValueError(f"Finantzaketa {key} 0-120% artean egon behar da")
            budget["funding"] = funding

        player_city["budget"] = budget
        game["player_city"] = player_city
        game["last_saved"] = datetime.utcnow()

        await self.games_collection.replace_one({"_id": game_id, "user_id": user_id}, game)
        return budget

    async def issue_bond(self, game_id: str, user_id: str, amount: int) -> Optional[Dict[str, Any]]:
        """Bonu bat eskaerara gehitu, tesoreria handitu eta hileko ordainketa txertatu."""
        if amount <= 0 or amount > 10000:
            raise ValueError("Bonuaren kopurua 1 eta 10,000 artekoa izan behar da")

        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not game:
            return None

        player_city = game.get("player_city", {})
        budget = player_city.setdefault("budget", {})
        bonds = budget.setdefault("bonds", [])
        if len(bonds) >= 10:
            raise ValueError("Maximo 10 bonu aktibo izan daitezke")

        monthly_payment = round((amount * 1.20) / 240, 2)
        bond_id = f"bond_{uuid4().hex[:8]}"
        bond = {
            "id": bond_id,
            "amount": amount,
            "interest_rate": 20.0,
            "months_remaining": 240,
            "monthly_payment": monthly_payment,
        }

        bonds.append(bond)
        budget["bonds"] = bonds
        player_city["budget"] = budget
        player_city["treasury"] = player_city.get("treasury", 0) + amount
        game["player_city"] = player_city
        game["last_saved"] = datetime.utcnow()

        await self.games_collection.replace_one({"_id": game_id, "user_id": user_id}, game)
        return {
            "message": f"Bonua ongi gehitu da: §{amount} jasota",
            "bond": bond,
            "treasury": player_city["treasury"],
            "bonds_count": len(bonds),
        }

    async def delete_game(self, game_id: str, user_id: str) -> bool:
        """Jokoa ezabatu."""
        result = await self.games_collection.delete_one({"_id": game_id, "user_id": user_id})
        return result.deleted_count > 0

    async def toggle_ordinance(self, game_id: str, user_id: str, ordinance_id: str) -> Optional[Dict[str, Any]]:
        """Ordenantza bat aktibatu/desaktibatu."""
        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not game:
            return None

        valid_ordinances = {
            "sales_tax", "income_tax", "legalized_gambling", "parking_fines",
            "free_clinics", "junior_sports", "pro_reading", "anti_drug",
            "pollution_controls", "tourist_promotion", "nuclear_free", "neighborhood_watch",
        }
        if ordinance_id not in valid_ordinances:
            raise ValueError("Ordenantza ID baliogabea")

        player_city = game.get("player_city", {})
        active_ordinances = set(player_city.get("ordinances", []))

        if ordinance_id in active_ordinances:
            active_ordinances.remove(ordinance_id)
            message = f"'{ordinance_id}' ordenantza desaktibatu da"
        else:
            active_ordinances.add(ordinance_id)
            message = f"'{ordinance_id}' ordenantza aktibatu da"

        player_city["ordinances"] = sorted(list(active_ordinances))
        game["player_city"] = player_city
        game["last_saved"] = datetime.utcnow()

        await self.games_collection.replace_one({"_id": game_id, "user_id": user_id}, game)
        return {"message": message, "ordinances": player_city["ordinances"]}

    async def apply_cheat(self, game_id: str, user_id: str, cheat_code: str) -> Optional[Dict[str, Any]]:
        """Trukatu kode bat aplikatu."""
        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not game:
            return None

        code = cheat_code.strip().lower()
        player_city = game.get("player_city", {})

        if code == "diru_asko":
            player_city["treasury"] = 1_000_000
            message = "Trukua aplikatu da: diruzaina §1,000,000-ra ezarri da"
        elif code.startswith("diru_injektatu:"):
            amount_str = code.split(":", 1)[1]
            amount = int(amount_str)
            player_city["treasury"] = player_city.get("treasury", 0) + amount
            message = f"Trukua aplikatu da: §{amount:,} gehitu dira. Altxorra: §{player_city['treasury']:,}"
        elif code == "energia_mugagabea":
            player_city.setdefault("power_grid", {})["coverage_pct"] = 100
            message = "Trukua aplikatu da: energia estaldura %100-ra ezarri da"
        elif code == "populazio_maximoa":
            player_city["population"] = player_city.get("population", 0) + 10000
            message = "Trukua aplikatu da: populazioa 10,000 handitu da"
        elif code == "zerga_zero":
            player_city.setdefault("budget", {}).setdefault("tax_rates", {})
            player_city["budget"]["tax_rates"] = {"residential": 0, "commercial": 0, "industrial": 0}
            message = "Trukua aplikatu da: zerga-tasa guztiak 0-ra ezarri dira"
        else:
            raise ValueError("Trukatu kode ezezaguna")

        cheats_used = set(game.get("cheats_used", []))
        cheats_used.add(code)
        game["cheats_used"] = list(cheats_used)

        game["player_city"] = player_city
        game["last_saved"] = datetime.utcnow()
        await self.games_collection.replace_one({"_id": game_id, "user_id": user_id}, game)

        return {"message": message, "cheats_used": game["cheats_used"], "player_city": player_city}

    async def build_structure(self, game_id: str, user_id: str, building: BuildingCreate) -> Optional[Dict[str, Any]]:
        """Egitura bat eraiki eta kostua kendu."""
        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not game:
            return None

        # Complete cost map matching all frontend building types
        cost_map = {
            # Utility buildings
            "coal_power": 4000,
            "oil_power": 6500,
            "gas_power": 2000,
            "nuclear_power": 15000,
            "wind_power": 100,
            "solar_power": 1300,
            "hydro_power": 400,
            "microwave_power": 28000,
            "fusion_power": 40000,
            # Service buildings
            "police_station": 500,
            "fire_station": 500,
            "hospital": 500,
            "school": 250,
            "college": 1000,
            "library": 500,
            "museum": 1000,
            # Transport
            "bus_depot": 250,
            "rail_station": 500,
            "subway_station": 500,
            "airport": 10000,
            "seaport": 5000,
            "water_pump": 100,
            "water_treatment": 500,
            "prison": 3000,
            # Arcologies
            "arcology_plymouth": 100000,
            "arcology_darco": 150000,
            "arcology_launch": 200000,
        }

        building_type = building.type
        if building_type not in cost_map:
            raise ValueError(f"Eraikin mota baliogabea: {building_type}")

        map_size = game.get("map", {}).get("size", {"width": 100, "height": 100})
        pos = building.position
        size = building.size or Size(w=1, h=1)

        # Position and size are Pydantic models - use attribute access
        px, py = pos.x, pos.y
        sw, sh = size.w, size.h

        if not (0 <= px < map_size["width"] and 0 <= py < map_size["height"]):
            raise ValueError("Eraikinaren posizioa mapa mugaren kanpoan dago")

        if not (1 <= sw <= 6 and 1 <= sh <= 6):
            raise ValueError("Eraikinaren tamaina 1x1 eta 6x6 artean egon behar da")

        if px + sw > map_size["width"] or py + sh > map_size["height"]:
            raise ValueError("Eraikinaren kokapena mapa mugaren kanpoan dago")

        player_city = game.get("player_city", {})
        current_treasury = player_city.get("treasury", 0)
        cost = cost_map[building_type]

        # Strict budget validation - block if insufficient funds
        if current_treasury < cost:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ez dago diru nahikorik. Eraikuntzak §{cost} kostatzen du baina §{current_treasury} dituzu.",
            )

        building_id = f"building_{uuid4().hex[:8]}"
        current_date = game.get("current_date", {"year": 1900, "month": 1})

        new_building = {
            "id": building_id,
            "type": building_type,
            "position": {"x": px, "y": py},
            "size": {"w": sw, "h": sh},
            "built_year": current_date["year"],
            "built_month": current_date["month"],
            "age_months": 0,
            "powered": False,
            "funding_pct": 100,
            "active": True,
        }

        player_city.setdefault("buildings", []).append(new_building)
        player_city["treasury"] = current_treasury - cost

        # Update ALL tiles in building footprint
        tiles = game.get("map", {}).get("tiles", [])
        for dx in range(sw):
            for dy in range(sh):
                tx = px + dx
                ty = py + dy
                if tiles and len(tiles) > ty and len(tiles[ty]) > tx:
                    tile = tiles[ty][tx]
                    tile["building"] = {
                        "id": building_id,
                        "type": building_type,
                        "position": {"x": px, "y": py},
                        "size": {"w": sw, "h": sh},
                        "built_year": current_date["year"],
                        "built_month": current_date["month"],
                        "age_months": 0,
                        "powered": False,
                        "funding_pct": 100,
                        "active": True,
                    }
                    tile["surfaceEntity"] = {"type": "building", "value": building_type}

        game["player_city"] = player_city
        game["last_saved"] = datetime.utcnow()

        # Build $set fields: player_city, last_saved, and all updated tiles
        update_fields = {"player_city": player_city, "last_saved": datetime.utcnow()}
        if tiles:
            for dx in range(sw):
                for dy in range(sh):
                    tx = px + dx
                    ty = py + dy
                    if len(tiles) > ty and len(tiles[ty]) > tx:
                        update_fields[f"map.tiles.{ty}.{tx}"] = tiles[ty][tx]

        result = await self.games_collection.update_one(
            {"_id": game_id, "user_id": user_id, "player_city.treasury": current_treasury},
            {"$set": update_fields},
        )
        if result.matched_count != 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transakzio egoera desberdina izan da, berriro saiatu mesedez",
            )
        return {"message": f"{building_type} eraikina eraiki da §{cost} kostuarekin", "building": new_building, "treasury": player_city["treasury"]}

    async def demolish_entity(self, game_id: str, user_id: str, demolish: dict) -> Optional[Dict[str, Any]]:
        """Zona, eraikin edo azpiegitura bat hiritik kendu."""
        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not game:
            return None

        player_city = game.get("player_city", {})
        pos = demolish.get("position")
        target_id = demolish.get("target_id")
        
        removed = None
        found_target_type = None # "zone", "building", "infrastructure"
        infra_category = None

        # Balio hauek SimulationEngine-rekin sinkronizatuta daude (SPECS.md § 1.4)
        # game_constants.py-tik zuzenean hartuta
        from .game_constants import GAME_CONSTANTS
        ZONE_COSTS = GAME_CONSTANTS["ZONE_COSTS"]
        BUILDING_COSTS = GAME_CONSTANTS["BUILDING_COSTS"]
        INFRA_COSTS = GAME_CONSTANTS["INFRA_COSTS"]


        # 1. Search Logic: First by ID, then by Position (Smart Search)
        px, py = None, None
        if pos:
            try:
                px, py = int(pos.get("x")), int(pos.get("y"))
            except (TypeError, ValueError):
                pass

        print(f"DEBUG: Starting demolition search for target_id='{target_id}', target_type='{demolish.get('target')}', pos=({px}, {py})")

        # Search by ID if available
        if target_id:
            # Search Zones
            for z in player_city.get("zones", []):
                if z.get("id") == target_id:
                    removed, found_target_type = z, "zone"
                    break
            # Search Buildings
            if not removed:
                for b in player_city.get("buildings", []):
                    if b.get("id") == target_id:
                        removed, found_target_type = b, "building"
                        break
            # Search Infrastructure
            if not removed:
                infra = player_city.get("infrastructure", {})
                for cat, segments in infra.items():
                    if not isinstance(segments, list): continue
                    for seg in segments:
                        if seg.get("id") == target_id:
                            removed, found_target_type, infra_category = seg, "infrastructure", cat
                            break
                    if removed: break

        # 2. Position-based search (Footprint aware)
        if not removed and px is not None and py is not None:
            # Check Buildings
            for b in player_city.get("buildings", []):
                bx, by = b.get("position", {}).get("x"), b.get("position", {}).get("y")
                bw, bh = b.get("size", {}).get("w", 1), b.get("size", {}).get("h", 1)
                if bx is not None and by is not None:
                    if int(bx) <= px < int(bx) + int(bw) and int(by) <= py < int(by) + int(bh):
                        removed, found_target_type = b, "building"
                        break
            
            # Check Zones
            if not removed:
                for z in player_city.get("zones", []):
                    zx, zy = z.get("position", {}).get("x"), z.get("position", {}).get("y")
                    zw, zh = z.get("size", {}).get("w", 1), z.get("size", {}).get("h", 1)
                    if zx is not None and zy is not None:
                        if int(zx) <= px < int(zx) + int(zw) and int(zy) <= py < int(zy) + int(zh):
                            removed, found_target_type = z, "zone"
                            break
            
            # Check Infrastructure
            if not removed:
                infra = player_city.get("infrastructure", {})
                for cat, segments in infra.items():
                    if not isinstance(segments, list): continue
                    for seg in segments:
                        tiles_covered = seg.get("tiles_covered", [])
                        for t in tiles_covered:
                            try:
                                if int(t.get("x", -1)) == px and int(t.get("y", -1)) == py:
                                    removed, found_target_type, infra_category = seg, "infrastructure", cat
                                    break
                            except (TypeError, ValueError):
                                continue
                        if removed: break
                    if removed: break

        if not removed:
            print(f"DEBUG: Demolish FAILED - No entity found at ({px}, {py})")
            # Return success True but with 0 refund to let frontend refresh tiles from the reload in the route
            return {
                "success": False,
                "message": "Ez da entitaterik aurkitu koordenatu hauetan",
                "removed": None,
                "refund": 0,
                "cost": 10
            }

        # 3. Financial Impact
        infra_type = removed.get("type", "road")
        if found_target_type == "zone":
            original_cost = ZONE_COSTS.get(removed.get("type"), 10)
        elif found_target_type == "building":
            original_cost = BUILDING_COSTS.get(removed.get("type"), 500)
        else: # infrastructure
            # For infrastructure, we calculate the cost of ONE tile since we are doing atomic demolition
            original_cost = INFRA_COSTS.get(infra_type, 10)
        
        # SPECS.md § 772: Refund is 50% of cost.
        # We remove the hardcoded §10 fee to avoid negative net for cheap items (roads/zones).
        refund = int(original_cost * 0.5)
        demolition_fee = 0 
        # No local treasury update here - we will use atomic $inc later

        # 4. Remove from city state lists
        if found_target_type == "zone":
            player_city.get("zones", []).remove(removed)
        elif found_target_type == "building":
            player_city.get("buildings", []).remove(removed)
        elif found_target_type == "infrastructure":
            # ERROR 2 FIX: Atomic demolition for infrastructure.
            # Instead of removing the WHOLE segment, we only remove the specific tile.
            tiles_covered = removed.get("tiles_covered", [])
            new_tiles = [t for t in tiles_covered if not (int(t.get("x", -1)) == px and int(t.get("y", -1)) == py)]
            
            if not new_tiles:
                # If no tiles left, remove the whole segment from the list
                infra_list = player_city.get("infrastructure", {}).get(infra_category, [])
                if removed in infra_list:
                    infra_list.remove(removed)
            else:
                # Update the segment with remaining tiles
                removed["tiles_covered"] = new_tiles

        # 5. Map Synchronization (Clear tiles)
        tile_updates = {}
        tiles = game.get("map", {}).get("tiles", [])
        if tiles:
            if found_target_type in ("zone", "building"):
                bx, by = removed.get("position", {}).get("x"), removed.get("position", {}).get("y")
                bw, bh = removed.get("size", {}).get("w", 1), removed.get("size", {}).get("h", 1)
                for dx in range(int(bw)):
                    for dy in range(int(bh)):
                        tx, ty = int(bx) + dx, int(by) + dy
                        if 0 <= ty < len(tiles) and 0 <= tx < len(tiles[ty]):
                            tile = tiles[ty][tx]
                            tile.pop(found_target_type, None)
                            tile.pop("surfaceEntity", None)
                            tile_updates[f"map.tiles.{ty}.{tx}"] = tile
            else: # infrastructure
                # ERROR 2 FIX: Only clear the specific tile being demolished
                try:
                    if 0 <= py < len(tiles) and 0 <= px < len(tiles[py]):
                        tile = tiles[py][px]
                        if "infrastructure" in tile and isinstance(tile["infrastructure"], list):
                            if infra_type in tile["infrastructure"]:
                                tile["infrastructure"].remove(infra_type)
                            if not tile["infrastructure"]:
                                tile.pop("infrastructure")
                        
                        # Clear visual slots
                        for slot in ["surfaceEntity", "undergroundEntity"]:
                            ent = tile.get(slot)
                            if ent and ent.get("type") == "infrastructure" and ent.get("value") == infra_type:
                                tile.pop(slot, None)
                        tile_updates[f"map.tiles.{py}.{px}"] = tile
                except (TypeError, ValueError):
                    pass

        # 6. BFS UPDATE: Recalculate utility coverage immediately since network might be broken
        try:
            from .simulation_engine import SimulationEngine
            engine = SimulationEngine()
            # SimulationEngine methods expect a city object that has both buildings/zones AND the map.
            city_with_map = {**player_city, "map": game.get("map", {})}
            player_city["power_grid"] = engine._calculate_power_coverage(city_with_map)
            player_city["water_system"] = engine._calculate_water_coverage(city_with_map)
            player_city["road_coverage"] = engine._calculate_road_coverage(city_with_map)
        except Exception as e:
            print(f"DEBUG: BFS update skipped during demolition: {e}")

        # 7. ATOMIC UPDATE: Use $inc for treasury to avoid race conditions with parallel requests
        # and $set for map tiles and other state.
        update_fields = {
            "player_city.zones": player_city.get("zones", []),
            "player_city.buildings": player_city.get("buildings", []),
            "player_city.infrastructure": player_city.get("infrastructure", {}),
            "player_city.metrics": player_city.get("metrics", {}),
            "player_city.power_grid": player_city.get("power_grid", {}),
            "player_city.water_system": player_city.get("water_system", {}),
            "last_saved": datetime.utcnow()
        }
        
        # Add tile updates to the same operation
        for k, v in tile_updates.items():
            update_fields[k] = v

        result = await self.games_collection.update_one(
            {"_id": game_id, "user_id": user_id},
            {
                "$set": update_fields,
                "$inc": {"player_city.treasury": refund - demolition_fee}
            }
        )
        
        # Fetch fresh treasury for the response
        updated_game = await self.games_collection.find_one({"_id": game_id})
        final_treasury = updated_game.get("player_city", {}).get("treasury", 0)
        updated_game.pop("_id", None)
        
        print(f"DEBUG: Demolish SUCCESS -> {found_target_type} removed. Refund: {refund}, Fee: {demolition_fee}. New Treasury: {final_treasury}")
        
        return {
            "success": True,
            "message": f"{found_target_type} entitatea kendu da", 
            "removed": removed,
            "refund": refund,
            "cost": demolition_fee,
            "game_state": updated_game
        }
