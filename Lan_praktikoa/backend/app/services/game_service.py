"""Game service for business logic."""
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import uuid4
import pymongo.errors
from motor.motor_asyncio import AsyncIOMotorCollection
from fastapi import HTTPException, status
from ..models import GameCreate, BudgetUpdate, APIResponse, BuildingCreate



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

        cost_map = {
            "hospital": 500,
            "school": 250,
            "college": 1000,
            "library": 500,
            "museum": 1000,
        }

        building_type = building.type
        if building_type not in cost_map:
            raise ValueError("Eraikin mota baliogabea")

        map_size = game.get("map", {}).get("size", {"width": 100, "height": 100})
        pos = building.position
        size = building.size or {"w": 1, "h": 1}
        if not (0 <= pos["x"] < map_size["width"] and 0 <= pos["y"] < map_size["height"]):
            raise ValueError("Eraikinaren posizioa mapa mugaren kanpoan dago")

        if not (1 <= size.get("w", 1) <= 6 and 1 <= size.get("h", 1) <= 6):
            raise ValueError("Eraikinaren tamaina 1x1 eta 6x6 artean egon behar da")

        if pos["x"] + size.get("w", 1) > map_size["width"] or pos["y"] + size.get("h", 1) > map_size["height"]:
            raise ValueError("Eraikinaren kokapena mapa mugaren kanpoan dago")

        player_city = game.get("player_city", {})
        current_treasury = player_city.get("treasury", 0)
        cost = cost_map[building_type] * (size.get("w", 1) * size.get("h", 1))

        if current_treasury < cost:
            raise ValueError(f"Diru nahikoa ez. Eraikuntzak §{cost} kostatzen du baina §{current_treasury} dituzu")

        building_id = f"building_{uuid4().hex[:8]}"
        current_date = game.get("current_date", {"year": 1900, "month": 1})

        new_building = {
            "id": building_id,
            "type": building_type,
            "position": pos,
            "size": size,
            "built_year": current_date["year"],
            "built_month": current_date["month"],
            "age_months": 0,
            "powered": False,
            "funding_pct": 100,
            "active": True,
        }

        player_city.setdefault("buildings", []).append(new_building)
        player_city["treasury"] = current_treasury - cost

        game["player_city"] = player_city
        game["last_saved"] = datetime.utcnow()
        result = await self.games_collection.update_one(
            {"_id": game_id, "user_id": user_id, "player_city.treasury": current_treasury},
            {"$set": {"player_city": player_city, "last_saved": datetime.utcnow()}},
        )
        if result.matched_count != 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transakzio egoera desberdina izan da, berriro saiatu mesedez",
            )
        return {"message": f"{building_type} eraikina eraiki da §{cost} kostuarekin", "building": new_building, "treasury": player_city["treasury"]}

    async def demolish_entity(self, game_id: str, user_id: str, demolish: dict) -> Optional[Dict[str, Any]]:
        """Zona edo eraikin bat hiritik kendu."""
        game = await self.games_collection.find_one({"_id": game_id, "user_id": user_id})
        if not game:
            return None

        player_city = game.get("player_city", {})
        removed = None

        if demolish["target"] == "zone":
            zones = player_city.get("zones", [])
            if demolish.get("target_id"):
                for z in zones:
                    if z.get("id") == demolish["target_id"]:
                        removed = z
                        zones.remove(z)
                        break
            elif demolish.get("position"):
                for z in zones:
                    px, py = z.get("position", {}).get("x"), z.get("position", {}).get("y")
                    if px == demolish["position"].get("x") and py == demolish["position"].get("y"):
                        removed = z
                        zones.remove(z)
                        break
            player_city["zones"] = zones
        elif demolish["target"] == "building":
            buildings = player_city.get("buildings", [])
            if demolish.get("target_id"):
                for b in buildings:
                    if b.get("id") == demolish["target_id"]:
                        removed = b
                        buildings.remove(b)
                        break
            elif demolish.get("position"):
                for b in buildings:
                    bp = b.get("position", {})
                    if bp.get("x") == demolish["position"].get("x") and bp.get("y") == demolish["position"].get("y"):
                        removed = b
                        buildings.remove(b)
                        break
            player_city["buildings"] = buildings
        else:
            raise ValueError("Helburu mota baliogabea")

        if not removed:
            raise ValueError("Ez da entitaterik aurkitu kendutzeko")

        game["player_city"] = player_city
        game["last_saved"] = datetime.utcnow()
        await self.games_collection.replace_one({"_id": game_id, "user_id": user_id}, game)

        return {"message": f"{demolish['target']} entitatea kendu da", "removed": removed}