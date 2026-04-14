"""AI ekintzak AI hiriari aplikatzeko zerbitzua.

Fitxategi honek AI zerbitzutik jasotako ekintzak (zona, eraikin, azpiegitura,
aurrekontu, ordenantza, eraso) AIaren hiriari aplikatzen dizkio.
"""
from typing import Dict, Any, List
from uuid import uuid4
from datetime import datetime


class AIActionApplier:
    """AI ekintzak AI hiriari aplikatzeko klasea."""

    ZONE_COSTS = {
        "residential_light": 5,
        "residential_dense": 10,
        "commercial_light": 5,
        "commercial_dense": 10,
        "industrial_light": 5,
        "industrial_dense": 10,
    }

    BUILDING_COSTS = {
        "school": 250,
        "college": 1000,
        "library": 500,
        "museum": 1000,
        "hospital": 500,
        "police_station": 500,
        "fire_station": 500,
        "coal_power": 4000,
        "oil_power": 6500,
        "gas_power": 2000,
        "nuclear_power": 15000,
        "wind_power": 100,
        "solar_power": 1300,
        "hydro_power": 400,
        "microwave_power": 28000,
        "fusion_power": 40000,
    }

    INFRA_COSTS = {
        "road": 10,
        "highway": 25,
        "highway_ramp": 25,
        "power_line": 2,
        "rail": 3,
        "water_pipe": 1,
        "subway_tunnel": 5,
    }

    DISASTER_COSTS = {
        "fire": 5000,
        "flood": 10000,
        "tornado": 20000,
        "earthquake": 50000,
    }

    @staticmethod
    def apply_actions(ai_city: Dict[str, Any], actions: List[Dict], 
                      current_date: Dict, map_size: Dict) -> Dict[str, Any]:
        """AI ekintzak AI hiriari aplikatu.

        Args:
            ai_city: AI hiriaren egoera
            actions: AI zerbitzutik jasotako ekintzak
            current_date: Uneko data
            map_size: Mapa tamaina

        Returns:
            Eguneratutako ai_city eta aplikatutako ekintzen zerrenda
        """
        applied_actions = []
        treasury = ai_city.get("treasury", 0)

        for action in actions:
            action_type = action.get("type", "")
            details = action.get("details", {})

            if action_type == "pass":
                applied_actions.append({"action": "pass", "success": True})
                continue

            if action_type == "zone":
                success, treasury, action_result = AIActionApplier._apply_zone(
                    ai_city, details, treasury, current_date, map_size
                )
                if success:
                    applied_actions.append(action_result)

            elif action_type == "build":
                success, treasury, action_result = AIActionApplier._apply_build(
                    ai_city, details, treasury, current_date, map_size
                )
                if success:
                    applied_actions.append(action_result)

            elif action_type == "infrastructure":
                success, treasury, action_result = AIActionApplier._apply_infrastructure(
                    ai_city, details, treasury, map_size
                )
                if success:
                    applied_actions.append(action_result)

            elif action_type == "budget":
                success, action_result = AIActionApplier._apply_budget(
                    ai_city, details
                )
                if success:
                    applied_actions.append(action_result)

            elif action_type == "ordinance":
                success, action_result = AIActionApplier._apply_ordinance(
                    ai_city, details
                )
                if success:
                    applied_actions.append(action_result)

            elif action_type == "attack":
                # Erasoa jokalariaren hiriari (backend-ean kudeatuko da)
                applied_actions.append({
                    "action": "attack",
                    "details": details,
                    "success": True,
                })

        ai_city["treasury"] = treasury
        return ai_city, applied_actions

    @staticmethod
    def _apply_zone(ai_city: Dict, details: Dict, treasury: float,
                   current_date: Dict, map_size: Dict) -> tuple:
        """Zona bat aplikatu AI hiriari."""
        zone_type = details.get("zone_type", "")
        position = details.get("position", {})
        size = details.get("size", {"w": 1, "h": 1})

        if zone_type not in AIActionApplier.ZONE_COSTS:
            return False, treasury, {}

        cost_per_tile = AIActionApplier.ZONE_COSTS[zone_type]
        total_cost = cost_per_tile * size.get("w", 1) * size.get("h", 1)

        if treasury < total_cost:
            return False, treasury, {}

        # Posizioa balidatu
        px, py = position.get("x", 0), position.get("y", 0)
        if not (0 <= px < map_size.get("width", 100)) or not (0 <= py < map_size.get("height", 100)):
            return False, treasury, {}

        zone_id = f"zone_{uuid4().hex[:8]}"
        new_zone = {
            "id": zone_id,
            "type": zone_type,
            "position": position,
            "size": size,
            "development_level": 0,
            "powered": False,
            "watered": False,
            "road_access": False,
            "abandoned": False,
            "population": 0,
            "built_year": current_date.get("year", 1900),
            "built_month": current_date.get("month", 1),
        }

        ai_city.setdefault("zones", []).append(new_zone)
        treasury -= total_cost

        return True, treasury, {
            "action": "zone",
            "details": {"zone_type": zone_type, "position": position, "size": size},
            "cost": total_cost,
            "success": True,
        }

    @staticmethod
    def _apply_build(ai_city: Dict, details: Dict, treasury: float,
                    current_date: Dict, map_size: Dict) -> tuple:
        """Eraikin bat aplikatu AI hiriari."""
        building_type = details.get("building_type", "")
        position = details.get("position", {})

        if building_type not in AIActionApplier.BUILDING_COSTS:
            return False, treasury, {}

        cost = AIActionApplier.BUILDING_COSTS[building_type]
        if treasury < cost:
            return False, treasury, {}

        # Posizioa balidatu
        px, py = position.get("x", 0), position.get("y", 0)
        if not (0 <= px < map_size.get("width", 100)) or not (0 <= py < map_size.get("height", 100)):
            return False, treasury, {}

        building_id = f"building_{uuid4().hex[:8]}"
        new_building = {
            "id": building_id,
            "type": building_type,
            "position": position,
            "size": {"w": 1, "h": 1},
            "built_year": current_date.get("year", 1900),
            "built_month": current_date.get("month", 1),
            "age_months": 0,
            "powered": False,
            "funding_pct": 100,
            "active": True,
        }

        ai_city.setdefault("buildings", []).append(new_building)
        treasury -= cost

        return True, treasury, {
            "action": "build",
            "details": {"building_type": building_type, "position": position},
            "cost": cost,
            "success": True,
        }

    @staticmethod
    def _apply_infrastructure(ai_city: Dict, details: Dict, treasury: float,
                             map_size: Dict) -> tuple:
        """Azpiegitura bat aplikatu AI hiriari."""
        infra_type = details.get("type", "")
        segments = details.get("segments", [])

        if infra_type not in AIActionApplier.INFRA_COSTS:
            return False, treasury, {}

        cost_per_segment = AIActionApplier.INFRA_COSTS[infra_type]
        total_cost = cost_per_segment * len(segments)

        if treasury < total_cost:
            return False, treasury, {}

        infra_category_map = {
            "road": "roads",
            "highway": "highways",
            "highway_ramp": "highways",
            "power_line": "power_lines",
            "rail": "rail",
            "water_pipe": "water_pipes",
            "subway_tunnel": "subway",
        }
        category = infra_category_map.get(infra_type, "roads")

        for segment in segments:
            new_segment = {
                "from": segment.get("from", {}),
                "to": segment.get("to", {}),
            }
            tiles_covered = AIActionApplier._interpolate_tiles(
                segment.get("from", {}), segment.get("to", {})
            )
            new_segment["tiles_covered"] = tiles_covered
            ai_city.setdefault("infrastructure", {}).setdefault(category, []).append(new_segment)

        treasury -= total_cost

        return True, treasury, {
            "action": "infrastructure",
            "details": {"type": infra_type, "segments_count": len(segments)},
            "cost": total_cost,
            "success": True,
        }

    @staticmethod
    def _apply_budget(ai_city: Dict, details: Dict) -> tuple:
        """Aurrekontu aldaketa aplikatu AI hiriari."""
        budget = ai_city.get("budget", {})

        if "tax_rates" in details:
            tax_rates = details["tax_rates"]
            if all(0 <= v <= 20 for v in tax_rates.values()):
                budget["tax_rates"] = tax_rates

        if "funding" in details:
            funding = details["funding"]
            if all(0 <= v <= 120 for v in funding.values()):
                budget["funding"] = funding

        ai_city["budget"] = budget

        return True, {
            "action": "budget",
            "details": details,
            "success": True,
        }

    @staticmethod
    def _apply_ordinance(ai_city: Dict, details: Dict) -> tuple:
        """Ordenantza aldaketa aplikatu AI hiriari."""
        ordinance_id = details.get("ordinance_id", "")
        action = details.get("action", "")

        valid_ordinances = {
            "sales_tax", "income_tax", "legalized_gambling", "parking_fines",
            "free_clinics", "junior_sports", "pro_reading", "anti_drug",
            "pollution_controls", "tourist_promotion", "nuclear_free",
            "neighborhood_watch",
        }

        if ordinance_id not in valid_ordinances:
            return False, {}

        active_ordinances = set(ai_city.get("ordinances", []))

        if action == "enact":
            active_ordinances.add(ordinance_id)
        elif action == "repeal":
            active_ordinances.discard(ordinance_id)

        ai_city["ordinances"] = sorted(list(active_ordinances))

        return True, {
            "action": "ordinance",
            "details": {"ordinance_id": ordinance_id, "action": action},
            "success": True,
        }

    @staticmethod
    def _interpolate_tiles(start: Dict, end: Dict) -> list:
        """Bi puntu arteko laukiak interpolatu (Bresenham algoritmoa)."""
        x0, y0 = start.get("x", 0), start.get("y", 0)
        x1, y1 = end.get("x", 0), end.get("y", 0)

        tiles = []
        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy

        while True:
            tiles.append({"x": x0, "y": y0})
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy

        return tiles
