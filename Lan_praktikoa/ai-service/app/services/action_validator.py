import logging
from typing import List, Tuple, Dict

logger = logging.getLogger("action_validator")

class ActionValidator:
    """
    Ekintza balidatzailearen klasea. AI-ak proposatutako ekintzak balioztatzen ditu.
    """
    def __init__(self):
        # Kostuen taula bateratua (Eraikinak, azpiegiturak eta energia)
        self.BUILDING_COSTS = {
            "hospital": 500, "school": 250, "college": 1000, "library": 500,
            "museum": 1000, "police_station": 500, "fire_station": 500,
            "bus_depot": 250, "rail_station": 500, "subway_station": 500,
            "airport": 10000, "seaport": 5000, "coal_power": 4000,
            "hydro_power": 400, "oil_power": 6500, "gas_power": 2000,
            "nuclear_power": 15000, "wind_power": 100, "solar_power": 1300,
            "microwave_power": 28000, "fusion_power": 40000
        }
        
        # Zonen kostuak (Zelai/Tile bakoitzeko)
        self.ZONE_COSTS = {
            "residential_light": 5, "residential_dense": 10,
            "commercial_light": 5, "commercial_dense": 10,
            "industrial_light": 5, "industrial_dense": 10
        }

    def validate_actions(self, game_state: dict, proposed_actions: list) -> Tuple[bool, List[str]]:
        """
        Ekintzak balioztatu: ez du existitzen ez den dirua gastatzen.
        """
        erroreak = []
        
        # Jokoaren uneko saldoa atera (fallback 0)
        ai_city = game_state.get("ai_city", {})
        saldoa = ai_city.get("treasury", 0)
        
        gastua = 0

        for ekintza in proposed_actions:
            kostua = self._kalkulatu_kostua(ekintza)
            gastua += kostua
            logger.debug(f"Ekintza bat balioztatzen. Kostua: {kostua}. Gastu metatua: {gastua}")

        if gastua > saldoa:
            erroreak.append(f"Aurrekontua gainditu da. Zure saldoa {saldoa} da, baina {gastua} gastatu nahi duzu.")
            logger.warning(f"Ekintzek aurrekontua gainditzen dute: saldoa={saldoa}, gastua={gastua}")
            return False, erroreak

        logger.info("Ekintza guztiak balioztatu dira. Aurrekontua egokia da.")
        return True, []

    def _kalkulatu_kostua(self, ekintza: dict) -> int:
        """Ekintza baten kostua kalkulatu bere motaren eta parametroen arabera."""
        mota = ekintza.get("type") or ekintza.get("mota", "")
        details = ekintza.get("details") or ekintza.get("parametroak") or {}
        
        if mota == "placeZone":
            zone_type = details.get("zone_type")
            size = details.get("size", {"w": 1, "h": 1})
            cost_per_tile = self.ZONE_COSTS.get(zone_type, 0)
            return cost_per_tile * size.get("w", 1) * size.get("h", 1)
            
        elif mota == "buildStructure" or str(mota).startswith("eraiki_"):
            building_type = details.get("building_type")
            
            # AI-ak batzuetan "eraiki_hospital" jartzen du zuzenean mota gisa
            if not building_type and str(mota).startswith("eraiki_"):
                building_type = str(mota).replace("eraiki_", "")
                
            # Energia hidroelektrikoa zelai bakoitzeko kalkulatzen da
            if building_type == "hydro_power":
                size = details.get("size", {"w": 1, "h": 1})
                return self.BUILDING_COSTS.get("hydro_power", 0) * size.get("w", 1) * size.get("h", 1)
                
            return self.BUILDING_COSTS.get(building_type, 0)
            
        return 0