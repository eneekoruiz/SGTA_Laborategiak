"""
Joko-simulazioaren motorra - Hilabeteko eguneraketarako.

Fitxategi honek SimulationEngine klasea biltzen du, SPECS.md § 3.1 jarraitzen
duena, jokoaren hilabeteko simulazioa exekutatzen du (denbora, ekonomia,
biztanleria, metrikak eta, azkenik, garaipena-baldintzak).

Grupo 8 (Hezkuntza eta Osasuna) espezializazioaren kalkuluak guztiak sartu direla.
"""

from typing import Dict, List, Tuple
from datetime import datetime
import random
from ..models.game import GameState, CurrentDate
from .education_health_service import EducationHealthService
from .game_constants import GAME_CONSTANTS, POWER_PLANT_SPECS, BUILDING_COSTS, SERVICE_MAINTENANCE, ARCOLOGY_SPECS


class SimulationEngine:
    """
    Joko-simulazioaren motorra - Hilabeteko simulazioa exekutatzen du.
    
    Klase honek SPECS.md § 3.1 sekuentzia zehatzki aplikatzen du:
    1. Azpiegituraren estaldura (energia, ura, bideak)
    2. Zonan garapenaren trantsizioak
    3. Zonan abandonatzea
    4. RCI eskaria (Erresidentzial, Komertziala, Industriala)
    5. Biztanleria-aldaketa
    6. Hileko finantzak
    7. Metrikak eguneratzea (EQ, HQ, krimena, kutsadura, etc)
    8. Bankarrota-kontrola
    9. Garaipena-baldintzak egiaztatzea
    """
    POWER_PLANT_SPECS = POWER_PLANT_SPECS
    BUILDING_COSTS = BUILDING_COSTS
    SERVICE_MAINTENANCE = SERVICE_MAINTENANCE
    ARCOLOGY_SPECS = ARCOLOGY_SPECS


    def __init__(self):
        """Simulazioaren motorra hasieratzen du."""
        pass

    def simulate_turn(self, game_state: Dict) -> Dict:
        """
        Jokoaren txanda simulatzen du.

        SPECS.md § 3.1 sekuentzia zehatzki:
        1. Energia
        2. Ura
        3. Transportes
        4. Zonas
        5. RCI
        6. Crecimiento
        7. Economía
        8. Métricas
        9. Desastres
        10. Victoria

        Args:
            game_state: Jokoaren uneko egoera

        Returns:
            Eguneratutako game_state garaipena-baldintzekin
        """
        # Hilabetearen zenbakia inkrementatu
        game_state["current_date"]["month"] += 1
        if game_state["current_date"]["month"] > 12:
            game_state["current_date"]["month"] = 1
            game_state["current_date"]["year"] += 1

        # Jokalariaren hiriak simulatzen dira
        player_update = self._simulate_city(game_state["player_city"])
        game_state["player_city"].update(player_update)

        # IAko hiriak simulatzen dira
        ai_update = self._simulate_city(game_state["ai_city"])
        game_state["ai_city"].update(ai_update)

        # Bankarrota-kontrola
        self._check_bankruptcy(game_state["player_city"])
        self._check_bankruptcy(game_state["ai_city"])

        # Garaipena-baldintzak egiaztatu
        victory_result = self._check_victory_conditions(game_state)
        game_state["victory_status"] = victory_result["status"]
        if victory_result["status"] != "ongoing":
            game_state["victory_condition"] = victory_result

        return game_state

    def _simulate_city(self, city: Dict) -> Dict:
        """
        Hiri bakarra simulatzen du hilabete batean.

        SPECS.md § 3.1 sekuentzia zehatzki aplikatzen du.

        Args:
            city: Hiriren egungo egoera

        Returns:
            Egoerari aplikatuko diren eguneraketaren hiztegia
        """
        # 1. ENERGIA
        power_coverage = self._calculate_power_coverage(city)

        # 2. URA
        water_coverage = self._calculate_water_coverage(city)

        # 3. TRANSPORTES
        road_coverage = self._calculate_road_coverage(city)

        # 4. ZONAS
        zones_developed = self._process_zone_development(
            city, power_coverage, water_coverage, road_coverage
        )
        zones_abandoned = self._process_zone_abandonment(city)

        # 5. RCI
        rci_demand = self._calculate_rci_demand(city)

        # 6. CRECIMIENTO
        population_delta = self._calculate_population_change(city, rci_demand)
        
        # Arcology population bonus
        arcology_pop = 0
        for b in city.get("buildings", []):
            if b.get("type") in ARCOLOGY_SPECS:
                arcology_pop += ARCOLOGY_SPECS[b.get("type")]["population"]
        
        new_population = max(0, city.get("population", 0) + population_delta + arcology_pop)

        # 7. ECONOMÍA
        monthly_income = self._calculate_monthly_income(city)
        monthly_expenses = self._calculate_monthly_expenses(city, include_bonds=False)
        monthly_balance = monthly_income - monthly_expenses

        starting_treasury = city.get("treasury", 0)
        city["treasury"] = starting_treasury + monthly_balance
        bond_payment = self._process_bonds(city)
        updated_bonds = city.get("budget", {}).get("bonds", [])
        new_treasury = city.get("treasury", 0)

        # 8. MÉTRICAS
        metrics_update = self._update_metrics(city, rci_demand, new_population)

        # 9. DESASTRES
        disasters_triggered = self._trigger_random_disasters(city)

        # Eguneraketa-hiztegia eraikitzen du
        updates = {
            "population": new_population,
            "treasury": new_treasury,
            "power_grid": {
                "total_capacity_mw": power_coverage["capacity"],
                "total_demand_mw": power_coverage["demand"],
                "coverage_pct": power_coverage["coverage_pct"],
            },
            "water_system": {
                "total_capacity": water_coverage["capacity"],
                "total_demand": water_coverage["demand"],
                "coverage_pct": water_coverage["coverage_pct"],
            },
            "metrics": metrics_update,
            "budget": {
                **city.get("budget", {}),
                "last_year_income": city.get("budget", {}).get("monthly_income", 0) * 12,
                "last_year_expenses": city.get("budget", {}).get("monthly_expenses", 0) * 12,
                "monthly_income": monthly_income,
                "monthly_expenses": monthly_expenses + bond_payment,
                "bonds": updated_bonds,
            },
            "events": [
                f"Zones developed: {zones_developed}",
                f"Zones abandoned: {zones_abandoned}",
                f"Population: +{population_delta}",
                f"Monthly balance: §{monthly_balance:.0f}",
                f"Bonds paid: §{bond_payment:.2f}",
                f"Active bonds: {len(updated_bonds)}",
                f"Disasters triggered: {len(disasters_triggered)}",
            ],
        }

        return updates

    def _process_bonds(self, city: Dict) -> float:
        """
        Bonuak prozesatzen ditu hilabete bakoitzean.

        SPECS.md § 1.6.3 oinarrian:
        - Hilabeteko ordainketak automatikoki kobratzen dira (monthly_expenses-en sartuta)
        - Hilabeteko iraupena murriztu (months_remaining -= 1)
        - Iraupena 0-ra iristen denean, azken kuota ordaindu eta bonua ezabatu

        Args:
            city: Hiriren egoera

        Returns:
            Bonu-ordainketa guztien batura
        """
        bonds = city.get("budget", {}).get("bonds", [])
        updated_bonds = []
        total_payment = 0.0

        for bond in bonds:
            payment = bond.get("monthly_payment", 0.0)
            total_payment += payment

            remaining = bond.get("months_remaining", 0) - 1
            if remaining > 0:
                updated_bond = bond.copy()
                updated_bond["months_remaining"] = remaining
                updated_bonds.append(updated_bond)

        city_budget = city.setdefault("budget", {})
        city_budget["bonds"] = updated_bonds
        city["budget"] = city_budget

        city["treasury"] = city.get("treasury", 0) - total_payment
        return total_payment

    def _trigger_random_disasters(self, city: Dict) -> List[Dict]:
        """
        Ausazko hondamendiak abiarazten ditu probabilitate txikiarekin.

        SPECS.md § 1.8 oinarrian:
        - %0.5 sutea
        - %0.2 uholdea (ur ondoko eremuetan)
        - Krimena > 80 -> %1 matxinada
        - Nuklear zaharra (>540 hil) -> istripu probabilitate txikia

        Args:
            city: Hiriren egoera

        Returns:
            Abiarazitako hondamendien zerrenda (hutsik normalean)
        """
        disasters = []
        metrics = city.get("metrics", {})

        # %0.5 sutea
        if random.random() < 0.005:
            disasters.append({
                "type": "fire",
                "description": "Random fire disaster triggered",
                "damage": "Minor building damage"
            })

        # %0.2 uholdea (ur ondoko eremuetan - sinplifikatua)
        if random.random() < 0.002:
            disasters.append({
                "type": "flood",
                "description": "Random flood disaster triggered",
                "damage": "Water system disruption"
            })

        # Krimena > 80 -> %1 matxinada
        crime_level = metrics.get("crime_rate", metrics.get("crime", 0))
        if crime_level > 80 and random.random() < 0.01:
            disasters.append({
                "type": "riot",
                "description": "Crime-induced riot triggered",
                "damage": "Zone abandonment risk increased"
            })

        # Nuklear zaharra (>540 hil) -> istripu txikia
        buildings = city.get("buildings", [])
        nuclear_plants = [b for b in buildings if b.get("type") == "nuclear_power"]
        for plant in nuclear_plants:
            age_months = plant.get("age_months", 0)
            if age_months > 540 and random.random() < 0.001:  # Prob txikia
                disasters.append({
                    "type": "nuclear_accident",
                    "description": f"Old nuclear plant accident at age {age_months} months",
                    "damage": "Radiation zone created"
                })

        for disaster in disasters:
            self._apply_disaster_damage(city, disaster)

        return disasters

    def _apply_disaster_damage(self, city: Dict, disaster: Dict) -> None:
        """
        Desastreak egindako kaltea aplikatzen du, entitate bat kentzen du eraikuntzen, zonen edo azpiegituraren artean.
        """
        candidates = []

        # Eraikinen kaltea
        for building in city.get("buildings", []):
            candidates.append(("building", building))

        # Zonen kaltea
        for zone in city.get("zones", []):
            candidates.append(("zone", zone))

        # Azpiegituraren kaltea
        infra = city.get("infrastructure", {})
        for infra_type, segments in infra.items():
            for segment in segments:
                candidates.append(("infrastructure", segment))

        if not candidates:
            disaster["removed_entity"] = None
            return

        entity_type, entity = random.choice(candidates)
        removed_entity = None

        if entity_type == "building":
            buildings = city.get("buildings", [])
            buildings.remove(entity)
            city["buildings"] = buildings
            disaster["removed_entity"] = {"type": "building", "id": entity.get("id"), "position": entity.get("position")}
        elif entity_type == "zone":
            zones = city.get("zones", [])
            zones.remove(entity)
            city["zones"] = zones
            disaster["removed_entity"] = {"type": "zone", "id": entity.get("id"), "position": entity.get("position")}
        else:
            infra_type = entity.get("type")
            category_map = {
                "road": "roads",
                "highway": "highways",
                "highway_ramp": "highways",
                "power_line": "power_lines",
                "rail": "rail",
                "water_pipe": "water_pipes",
                "subway_tunnel": "subway",
            }
            segment_key = category_map.get(infra_type, "roads")
            segments = city.get("infrastructure", {}).get(segment_key, [])
            if entity in segments:
                segments.remove(entity)
                city["infrastructure"][segment_key] = segments
            disaster["removed_entity"] = {
                "type": "infrastructure",
                "infra_type": infra_type,
                "id": entity.get("id"),
                "position": entity.get("start_position") or (entity.get("tiles_covered", [None])[0] if entity.get("tiles_covered") else None),
            }

        disaster["damage_location"] = disaster["removed_entity"].get("position")

    def _calculate_power_coverage(self, city: Dict) -> Dict:
        """
        Energiaren estaldura kalkulatzen du BFS algoritmoarekin.
        """
        tiles = city.get("map", {}).get("tiles", [])
        if not tiles:
            # Fallback if map not embedded in city state
            return {"capacity": 0, "demand": 0, "coverage_pct": 0}

        # 1. Zentral elektrikoak eta haien ahalmena aurkitu
        power_plants = []
        total_capacity = 0
        for b in city.get("buildings", []):
            spec = self.POWER_PLANT_SPECS.get(b.get("type"))
            if spec:
                total_capacity += spec["power"]
                # Power plant coordinates (footprint)
                px, py = b["position"]["x"], b["position"]["y"]
                pw, ph = b.get("size", {"w": 4, "h": 4})["w"], b.get("size", {"w": 4, "h": 4})["h"]
                power_plants.append((px, py, pw, ph))

        # 2. BFS konexioa kalkulatu (Zentraletatik hasita)
        connected_tiles = self._calculate_utility_connectivity_bfs(
            tiles, power_plants, "power_line"
        )

        # 3. Demanda eta estaldura markatu
        total_demand = 0
        powered_count = 0
        target_zones = city.get("zones", [])
        height = len(tiles)
        width = len(tiles[0])
        
        for zone in target_zones:
            zx, zy = zone["position"]["x"], zone["position"]["y"]
            level = zone.get("development_level", 0)
            demand = 1 + level
            total_demand += demand
            
            is_powered = (zx, zy) in connected_tiles
            zone["powered"] = is_powered
            if is_powered: powered_count += 1
            
            # Sync to physical tiles for frontend overlay
            if 0 <= zy < height and 0 <= zx < width:
                tiles[zy][zx]["powered"] = is_powered

        coverage_pct = min(100, int((total_capacity / max(total_demand, 1)) * 100))
        
        return {
            "capacity": total_capacity,
            "demand": total_demand,
            "coverage_pct": coverage_pct,
        }

    def _calculate_water_coverage(self, city: Dict) -> Dict:
        """
        Uraren estaldura kalkulatzen du BFS algoritmoarekin.
        """
        tiles = city.get("map", {}).get("tiles", [])
        if not tiles:
            return {"capacity": 0, "demand": 0, "coverage_pct": 0}

        # 1. Ur-ponpak
        pumps = []
        total_capacity = 0
        for b in city.get("buildings", []):
            if b.get("type") == "water_pump":
                total_capacity += 20
                pumps.append((b["position"]["x"], b["position"]["y"], 1, 1))

        # 2. BFS (Water pipes)
        connected_tiles = self._calculate_utility_connectivity_bfs(
            tiles, pumps, "water_pipe"
        )

        # 3. Estaldura markatu
        total_demand = 0
        target_zones = city.get("zones", [])
        height = len(tiles)
        width = len(tiles[0])

        for zone in target_zones:
            zx, zy = zone["position"]["x"], zone["position"]["y"]
            total_demand += 2 # Simplified water demand
            
            is_watered = (zx, zy) in connected_tiles
            zone["watered"] = is_watered
            
            # Sync to physical tiles for frontend overlay
            if 0 <= zy < height and 0 <= zx < width:
                tiles[zy][zx]["watered"] = is_watered

        coverage_pct = min(100, int((total_capacity / max(total_demand, 1)) * 100))
        return {
            "capacity": total_capacity,
            "demand": total_demand,
            "coverage_pct": coverage_pct,
        }

    def _calculate_utility_connectivity_bfs(self, tiles, sources, infra_type) -> set:
        """
        BFS bidez konexio sarea kalkulatzen du (Gara 8 - Konektibitate algoritmoa).
        """
        height = len(tiles)
        if height == 0: return set()
        width = len(tiles[0])
        connected = set()
        queue = []

        # Iturburuak gehitu (Zentralak/Ponpak)
        for sx, sy, sw, sh in sources:
            for dy in range(sh):
                for dx in range(sw):
                    tx, ty = sx + dx, sy + dy
                    if 0 <= ty < height and 0 <= tx < width:
                        connected.add((tx, ty))
                        queue.append((tx, ty))

        # Norabideak: Gora, Behera, Ezkerra, Eskuina
        dirs = [(0, 1), (0, -1), (1, 0), (-1, 0)]

        while queue:
            cx, cy = queue.pop(0)
            
            for dx, dy in dirs:
                nx, ny = cx + dx, cy + dy
                if 0 <= ny < height and 0 <= nx < width and (nx, ny) not in connected:
                    tile = tiles[ny][nx]
                    # Konexioa: azpiegitura mota bada, edo eraikina bada (konektore gisa)
                    infra_list = tile.get("infrastructure") or []
                    has_infra = infra_type in infra_list
                    has_building = "building" in tile
                    
                    if has_infra or has_building:
                        connected.add((nx, ny))
                        queue.append((nx, ny))
        
        return connected

    def _calculate_road_coverage(self, city: Dict) -> Dict:
        """
        Bide-serbitzua estaldura exekutatzen du.

        Bideak zonaei sarbidea ematen diete eta garraioa hobetzten dute.

        Args:
            city: Hiriren egoera

        Returns:
            Hiztegia: coverage_pct (0-100)
        """
        roads = city.get("infrastructure", {}).get("roads", [])
        if not isinstance(roads, list):
            roads = []
        road_tiles = sum(
            len(road.get("tiles_covered", [])) if isinstance(road.get("tiles_covered"), list) else 0
            for road in roads
        )

        total_tiles = 100 * 100  # 100x100 mapa gutxienez
        coverage_pct = min(100, int((road_tiles / max(total_tiles, 1)) * 100))

        return {"coverage_pct": coverage_pct}

    def _process_zone_development(
        self, city: Dict, power: Dict, water: Dict, roads: Dict
    ) -> int:
        """
        Zonan garapen-mailaren trantsizioak exekutatzen ditu (SPECS.md § 1.3).
        """
        zones_developed = 0
        zones = city.get("zones", [])
        tiles = city.get("map", {}).get("tiles", [])
        if not tiles: return 0

        for zone in zones:
            if zone.get("development_level", 0) < 3:
                current_level = zone.get("development_level", 0)
                zx, zy = zone["position"]["x"], zone["position"]["y"]
                
                has_road = self._has_nearby_infrastructure(zx, zy, tiles, ["road", "highway"], radius=3)
                is_powered = zone.get("powered", False)
                is_watered = zone.get("watered", False)

                # Maila 0→1: Energia + errepide sarbidea (~3 lauki)
                if current_level == 0 and is_powered and has_road:
                    zone["development_level"] = 1
                    zones_developed += 1
                # Maila 1→2: Ura + eskari positiboa
                elif current_level == 1 and is_watered:
                    # RCI eskaria check-a simulate_turn-ean egiten da, hemen garapen fisikoa
                    zone["development_level"] = 2
                    zones_developed += 1
                # Maila 2→3: Baldintza onak
                elif current_level == 2 and is_powered and is_watered:
                    zone["development_level"] = 3
                    zones_developed += 1

        return zones_developed

    def _has_nearby_infrastructure(self, x, y, tiles, infra_types, radius=3) -> bool:
        """Gertuko azpiegitura bilatzen du erradio batean."""
        height = len(tiles)
        width = len(tiles[0])
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                nx, ny = x + dx, y + dy
                if 0 <= ny < height and 0 <= nx < width:
                    tile_infra = tiles[ny][nx].get("infrastructure") or []
                    if any(t in tile_infra for t in infra_types):
                        return True
        return False

    def _process_zone_abandonment(self, city: Dict) -> int:
        """
        Zonan abandonatzea prozesu daiteke baldintza txarrengatik.

        SPECS.md § 3.1 oinarrian:
        - Energia gabea: -30% per hilabete
        - Krimena >80: -20% per hilabete
        - Kutsadura >80: -15% per hilabete
        - Zergak >15%: -10% per hilabete

        Probabilitate handiena aplikatzen da (ez aditiboa).

        Args:
            city: Hiriren egoera

        Returns:
            Nahitaez gordeta dauden zonan kopurua
        """
        zones_abandoned = 0
        zones = city.get("zones", [])
        metrics = city.get("metrics", {})

        crime_rate = metrics.get("crime_rate", 50)
        pollution = metrics.get("pollution_air", 50)
        tax_rate = city.get("budget", {}).get("tax_rates", {}).get("residential", 7)

        for zone in zones:
            if zone.get("abandoned", False):
                continue

            abandon_probability = 0

            # Krimena-penalizazioa
            if crime_rate > 80:
                abandon_probability = max(abandon_probability, 0.20)

            # Kutsadura-penalizazioa
            if pollution > 80:
                abandon_probability = max(abandon_probability, 0.15)

            # Zergaren penalizazioa
            if tax_rate > 15:
                abandon_probability = max(abandon_probability, 0.10)

            # Abandona daiteke bada probabilitatea > 0.15
            if abandon_probability > 0.15:
                zone["abandoned"] = True
                zones_abandoned += 1

        return zones_abandoned

    def _calculate_rci_demand(self, city: Dict) -> Dict:
        """
        RCI eskaria kalkulatzen du (Erresidentzial, Komertziala, Industriala).

        SPECS.md § 3.2 oinarrian:
        - R_demand = 10 + zerbitzu-bonusa - zergaren penalizazioa
        - C_demand = 10 + biztanleria×0.1 + EQ×0.2 + aireportuaren bonusa - zergak×5
        - I_demand = 10 + biztanleria×0.05 + portua-bonusa - zergak×5

        Args:
            city: Hiriren egoera

        Returns:
            Hiztegia: r, c, i (demanda balioez)
        """
        base_demand = 10
        metrics = city.get("metrics", {})
        budget = city.get("budget", {})
        population = city.get("population", 0)

        # Zergaren tasak
        residential_tax = budget.get("tax_rates", {}).get("residential", 7)
        commercial_tax = budget.get("tax_rates", {}).get("commercial", 7)
        industrial_tax = budget.get("tax_rates", {}).get("industrial", 7)

        # EQ bonusa komertziarentzat
        eq = metrics.get("eq", 50)

        # Zerbitzu-bonusa (ospitalak)
        buildings = city.get("buildings", [])
        service_bonus = min(30, len([b for b in buildings if b.get("type") == "hospital"]) * 10)

        # Aireportua bonusa (0 edo 50)
        airport_count = len([b for b in buildings if b.get("type") == "airport"])
        airport_bonus = 50 if airport_count > 0 else 0

        # Portua bonusa (0 edo 40)
        seaport_count = len([b for b in buildings if b.get("type") == "seaport"])
        seaport_bonus = 40 if seaport_count > 0 else 0

        ordinances = set(city.get("ordinances", []))

        r_demand = base_demand + service_bonus - (residential_tax * 5)
        c_demand = base_demand + (population * 0.1) + (eq * 0.2) + airport_bonus - (commercial_tax * 5)
        i_demand = base_demand + (population * 0.05) + seaport_bonus - (industrial_tax * 5)

        if "income_tax" in ordinances:
            r_demand -= 2
        if "sales_tax" in ordinances:
            c_demand -= 2
        if "tourist_promotion" in ordinances:
            c_demand += 5
        if "free_clinics" in ordinances:
            r_demand += 2
        if "pro_reading" in ordinances:
            r_demand += 2
        if "anti_drug" in ordinances:
            r_demand += 1

        return {
            "r": int(max(0, r_demand)),
            "c": int(max(0, c_demand)),
            "i": int(max(0, i_demand)),
        }

    def _calculate_population_change(
        self, city: Dict, rci_demand: Dict
    ) -> int:
        """
        Biztanleria-aldaketa kalkulatzen du (hazkuntza + heriotza).

        SPECS.md § 3.3 eta Grupo 8 osasun-mekanika oinarrian:
        - Hazkuntza: RCI positiboan zati eta zonan garapena bitartean
        - Murriztapena: RCI negatiboa bada
        - Heriotza: HQ eta kutsaduraren araberan

        Args:
            city: Hiriren egoera
            rci_demand: RCI eskaria hiztegia

        Returns:
            Biztanleria net-aldaketa (aldaketa per hilabete)
        """
        r_demand = rci_demand.get("r", 0)
        current_population = city.get("population", 0)

        # Erresidentzial-eskariak hazkuntza behartzen du
        if r_demand > 0:
            base_growth = int(min(r_demand * 0.1, 100))
            high_dev_zones = len(
                [z for z in city.get("zones", []) if z.get("development_level", 0) >= 2]
            )
            bonus_growth = high_dev_zones * 5
            monthly_growth = base_growth + bonus_growth
        elif r_demand < 0:
            monthly_growth = int(r_demand * 0.05)
        else:
            monthly_growth = 0

        # Heriotza HQ eta kutsaduraren araberan (Grupo 8 fokua)
        hq = city.get("metrics", {}).get("hq", 50)
        pollution = city.get("metrics", {}).get("pollution_air", 50)
        _lifespan, mortality_rate = self._calculate_life_expectancy_and_mortality(hq, pollution)
        deaths = int((current_population * mortality_rate) / 1000)

        return monthly_growth - deaths

    def _calculate_life_expectancy_and_mortality(self, hq: int, pollution_air: int) -> Tuple[float, float]:
        """
        Batez besteko bizitza-adina eta heriotza-tasa kalkulatzen du.

        HQ handiak bizitza-adina igotzen du, kutsadura jaitsitzen du.

        Args:
            hq: Osasun Kalitatearen balioa (0-200)
            pollution_air: Airearen kutsadura (0-100)

        Returns:
            Tupla: (average_lifespan_years, mortality_rate_per_1000)
        """
        # Batez besteko bizitza-adina urtetan
        avg_lifespan = 60 + (hq / 200 * 20) - (pollution_air / 100 * 15)
        avg_lifespan = float(max(40.0, min(100.0, avg_lifespan)))

        # Heriotza-tasa 1000 bizilagun kohartean
        mortality_rate = 15 - (hq / 200 * 8) + (pollution_air / 100 * 7)
        mortality_rate = float(max(1.0, min(50.0, mortality_rate)))

        return avg_lifespan, mortality_rate

    def _calculate_monthly_income(self, city: Dict) -> float:
        """
        Hileko zergaren sarrera kalkulatzen du (SPECS.md § 1.6).
        """
        budget = city.get("budget", {})
        population = city.get("population", 0)
        metrics = city.get("metrics", {})
        
        # land_value_factor: 100 is base (1.0), 200 is 2.0, etc.
        land_value_factor = metrics.get("land_value_avg", 50) / 100.0

        tax_rates = budget.get("tax_rates", {})
        r_rate = tax_rates.get("residential", 7)
        c_rate = tax_rates.get("commercial", 7)
        i_rate = tax_rates.get("industrial", 7)

        # Mota bakoitzaren garatu-zonak zenbatzen dira
        zones = city.get("zones", [])
        c_zones_developed = len(
            [z for z in zones if "commercial" in z.get("type", "") and z.get("development_level", 0) > 0]
        )
        i_zones_developed = len(
            [z for z in zones if "industrial" in z.get("type", "") and z.get("development_level", 0) > 0]
        )

        # SPECS.md § 1.6 formulak
        residential_income = population * r_rate * 0.01 * land_value_factor
        commercial_income = c_zones_developed * c_rate * 0.2 * land_value_factor
        industrial_income = i_zones_developed * i_rate * 0.15 * land_value_factor

        return residential_income + commercial_income + industrial_income

    def _calculate_monthly_expenses(self, city: Dict, include_bonds: bool = True) -> float:
        """
        Hileko mantentzeak gastuak kalkulatzen du (hiri-zerbitzuak).

        SPECS.md § 1.6 oinarrian:
        - Garraioa = (bideak + trena) × 0.1 × finantziazio%
        - Polizia = estazionak × 2.5 × finantziazio%
        - Atsodena = estazionak × 2.5 × finantziazio%
        - Osasuna = ospitalak × 3.0 × finantziazio%
        - Hezkuntza = (ikastetxeak + colegiak + liburtegia + museoa) × finantziazio%

        Args:
            city: Hiriren egoera
            include_bonds: Bonduen hileko ordainketa kontuan hartu

        Returns:
            Hileko guztiko gastuak (dirua)
        """
        budget = city.get("budget", {})
        funding = budget.get("funding", {})

        # Finantziazio-ehunekoak (0-120)
        transport_funding = funding.get("transportation", 100) / 100
        police_funding = funding.get("police", 100) / 100
        fire_funding = funding.get("fire", 100) / 100
        health_funding = funding.get("health", 100) / 100
        education_funding = funding.get("education", 100) / 100

        # Azpiegitura zenbatzen dira
        infra = city.get("infrastructure", {})
        roads = len(infra.get("roads", []))
        rail = len(infra.get("rail", []))

        # Eraikina zenbatzen dira
        buildings = city.get("buildings", [])
        police_stations = len([b for b in buildings if b.get("type") == "police_station"])
        fire_stations = len([b for b in buildings if b.get("type") == "fire_station"])
        hospitals = len([b for b in buildings if b.get("type") == "hospital"])
        schools = len([b for b in buildings if b.get("type") == "school"])
        colleges = len([b for b in buildings if b.get("type") == "college"])
        libraries = len([b for b in buildings if b.get("type") == "library"])
        museums = len([b for b in buildings if b.get("type") == "museum"])

        # Gastuak kalkulatu
        transport_cost = (roads * 0.1 + rail * 0.2) * transport_funding
        police_cost = police_stations * 2.5 * police_funding
        fire_cost = fire_stations * 2.5 * fire_funding
        health_cost = hospitals * 3.0 * health_funding
        education_cost = (
            schools * 1.5 + colleges * 5 + libraries * 2.5 + museums * 5
        ) * education_funding

        # Bonuen ordainketa gehitzen dugu
        bonds = budget.get("bonds", [])
        bond_cost = 0
        if include_bonds:
            bond_cost = sum(
                bond.get("monthly_payment", 0) for bond in bonds
            )

        total = (
            transport_cost
            + police_cost
            + fire_cost
            + health_cost
            + education_cost
            + bond_cost
        )

        return total

    def _update_metrics(self, city: Dict, rci_demand: Dict, new_population: int) -> Dict:
        """
        Hiriren metrikak eguneratzen ditu (EQ, HQ, krimena, kutsadura, etc).
        SPECS.md § 3.6 eta § 1.9 oinarrian.
        """
        current_metrics = city.get("metrics", {})
        ordinances = set(city.get("ordinances", []))
        buildings = city.get("buildings", [])

        # 1. EQ / HQ (Hezkuntza eta Osasuna - Grupo 8 logic)
        pollution_air_prev = current_metrics.get("pollution_air", 50)
        pollution_water_prev = current_metrics.get("pollution_water", 50)
        
        eq_value, eq_breakdown = EducationHealthService.calculate_eq(city, list(ordinances))
        hq_value, hq_breakdown = EducationHealthService.calculate_hq(
            city, list(ordinances), pollution_air_prev, pollution_water_prev
        )
        eq_effects = EducationHealthService.calculate_eq_effects(eq_value)
        hq_effects = EducationHealthService.calculate_hq_effects(hq_value)

        # 2. Krimena (Polizia + EQ bonusa + Ordenantzak)
        police_stations = len([b for b in buildings if b.get("type") == "police_station"])
        base_crime = max(0, min(100, (new_population / 500) + 50 - police_stations * 10))
        
        # EQ high reduces crime (max -20)
        crime_reduction_eq = (eq_value / 200) * 20
        crime_rate = base_crime - crime_reduction_eq
        
        if "legalized_gambling" in ordinances: crime_rate += 10
        if "junior_sports" in ordinances: crime_rate -= 5
        if "anti_drug" in ordinances: crime_rate -= 5
        if "neighborhood_watch" in ordinances: crime_rate -= 3
        crime_rate = max(0, min(100, crime_rate))

        # 3. Kutsadura (Industria + Zentralak + Ordenantzak)
        industrial_zones = len([z for z in city.get("zones", []) if "industrial" in z.get("type", "")])
        power_plants = len([b for b in buildings if "power" in b.get("type", "") and b.get("type") != "solar_power"])
        pollution_air = (industrial_zones * 2) + (power_plants * 5)
        
        if "pollution_controls" in ordinances: pollution_air *= 0.85
        pollution_air = max(0, min(100, pollution_air))
        pollution_water = max(0, min(100, pollution_air * 0.7))

        # 4. RCI Demand modifications (Ordinances)
        r_demand = rci_demand.get("r", 0)
        c_demand = rci_demand.get("c", 0)
        i_demand = rci_demand.get("i", 0)
        
        if "sales_tax" in ordinances: c_demand *= 0.95
        if "income_tax" in ordinances: r_demand *= 0.95
        if "pollution_controls" in ordinances: i_demand *= 0.95
        if "tourist_promotion" in ordinances: c_demand *= 1.10

        # 5. Lurraren balioa (Zerbitzuak, EQ/HQ, Krimena)
        land_value = 50 + (eq_value/4) + (hq_value/4) - (crime_rate/2) - (pollution_air/2)
        land_value = max(0, min(255, land_value))

        # 6. Composite Score (SPECS.md § 1.9.1)
        score = self._calculate_composite_score(
            new_population, eq_value, hq_value, land_value, crime_rate, pollution_air
        )

        return {
            "eq": round(eq_value, 2),
            "hq": round(hq_value, 2),
            "crime_rate": round(crime_rate, 2),
            "pollution_air": round(pollution_air, 2),
            "pollution_water": round(pollution_water, 2),
            "land_value_avg": round(land_value, 2),
            "approval": max(0, min(100, 50 + (new_population / 1000) - (crime_rate / 10))),
            "unemployment": current_metrics.get("unemployment", 5),
            "traffic_avg": current_metrics.get("traffic_avg", 30),
            "rci_demand": {"r": int(r_demand), "c": int(c_demand), "i": int(i_demand)},
            "composite_score": score,
            "education": {
                "facility_count": {
                    "schools": eq_breakdown.get("schools", 0),
                    "colleges": eq_breakdown.get("colleges", 0),
                    "libraries": eq_breakdown.get("libraries", 0),
                    "museums": eq_breakdown.get("museums", 0),
                },
                "target_eq": eq_breakdown.get("target_eq", 0),
                "eq_change": eq_breakdown.get("eq_change", 0),
                "high_tech_industry_pct": eq_effects.get("high_tech_industry_pct", 0),
                "crime_reduction_from_eq": eq_effects.get("crime_reduction", 0),
                "land_value_bonus_from_eq": eq_effects.get("land_value_bonus", 0),
            },
            "health": {
                "hospital_count": hq_breakdown.get("hospitals", 0),
                "hospital_contribution": hq_breakdown.get("hospital_contribution", 0),
                "pollution_penalty": hq_breakdown.get("pollution_total_penalty", 0),
                "target_hq": hq_breakdown.get("target_hq", 0),
                "hq_change": hq_breakdown.get("hq_change", 0),
                "average_lifespan": hq_effects.get("average_lifespan", 50),
                "mortality_rate": hq_effects.get("mortality_rate", 10),
            },
        }

    def _calculate_composite_score(
        self,
        population: int,
        eq: int,
        hq: int,
        land_value: int,
        crime: int,
        pollution: int,
    ) -> int:
        """
        Hiriren oskar-puntuazioa kalkulatzen du.

        SPECS.md § 1.9 oinarrian:
        score = pop×0.4 + eq×50×0.15 + hq×50×0.15 + land_value×40×0.15
                + (100-crime)×100×0.10 + (100-pollution)×50×0.05

        Args:
            population: Hiriren biztanleria
            eq: Hezkuntza Kalitate (0-200)
            hq: Osasun Kalitate (0-200)
            land_value: Lurraren batez besteko balioa (0-255)
            crime: Krimena-tasa (0-100)
            pollution: Kutsadura maila (0-100)

        Returns:
            Oskar-puntuazio osoaren balioa (integer)
        """
        score = (
            population * 0.4
            + eq * 50 * 0.15
            + hq * 50 * 0.15
            + land_value * 40 * 0.15
            + (100 - crime) * 100 * 0.10
            + (100 - pollution) * 50 * 0.05
        )
        return int(score)

    def _check_bankruptcy(self, city: Dict) -> None:
        """
        Hiriren bankarrota-maila egiaztatzen du.

        Hiri bat bankarra da balantsak < -100,000 bada.
        12 hilabete jarraian bankartan daude, hiriak galatzen du.

        Args:
            city: Hiriren egoera
        """
        treasury = city.get("treasury", 0)

        if treasury < -100000:
            city["months_bankrupt"] = city.get("months_bankrupt", 0) + 1
        else:
            city["months_bankrupt"] = 0

    def _check_victory_conditions(self, game_state: Dict) -> Dict:
        """
        Jokoaren garaipena-baldintzak egiaztatu du.

        SPECS.md § 3.9 oinarrian, 5 baldintza:
        1. Biztanleria >= 100,000 (Jokalaria garaitzen du)
        2. IAko bankarrata >= 12 hilabete jarraian (Jokalaria garaitzen du)
        3. Jokalariaren bankarrata >= 12 hilabete jarraian (Jokalaria galantzen du!)
        4. Gero denbora >= 1,200 hilabete 1900tik (Score garaipena)
        5. Arkology (Grupo 4 - hona ez du hemen)

        Args:
            game_state: Jokoaren egungo egoera

        Returns:
            Hiztegia garaipena-baldintzarekin:
            {
                "status": "ongoing" | "player_won" | "ai_won" | "player_defeated",
                "condition": "population" | "rival_bankrupt" | "player_bankrupt" | "score" | None,
                "winner": "player" | "ai" | None,
                "reason": string deskriptiboak
            }
        """
        player_city = game_state.get("player_city", {})
        ai_city = game_state.get("ai_city", {})
        current_date = game_state.get("current_date", {"year": 1900, "month": 1})

        # 1. BIZTANLERIA GARAIPENA: Jokalaria >= 100,000
        if player_city.get("population", 0) >= 100000:
            return {
                "status": "player_won",
                "condition": "population",
                "winner": "player",
                "reason": f"Jokalariaren populazioa 100.000era iritsi da {current_date['year']}/{current_date['month']}",
            }

        # 2. IAko BANKARRATA: IAk 12 hilabete bankarra (Jokalaria garaitzen du!)
        if ai_city.get("months_bankrupt", 0) >= 12:
            return {
                "status": "player_won",
                "condition": "rival_bankrupt",
                "winner": "player",
                "reason": f"AI 12 hilabete jarraian bankarra izan da {current_date['year']}/{current_date['month']}", 
            }

        # 3. JOKALARIAREN BANKARRATA: Jokalaria 12 hilabete bankarra (GALTZEA!)
        if player_city.get("months_bankrupt", 0) >= 12:
            return {
                "status": "player_defeated",
                "condition": "player_bankrupt",
                "winner": "ai",
                "reason": f"Jokalaria 12 hilabete jarraian bankarra izan da {current_date['year']}/{current_date['month']}", 
            }

        # 4. DENBORA-GARAIPENA (SCORE): 1900 + 1200 hil = 2000. urte (100 urtean)
        total_months = (current_date["year"] - 1900) * 12 + current_date["month"]
        if total_months >= 1200:
            player_score = player_city.get("metrics", {}).get("composite_score", 0)
            ai_score = ai_city.get("metrics", {}).get("composite_score", 0)
            winner = "player" if player_score >= ai_score else "ai"
            return {
                "status": "player_won" if winner == "player" else "ai_won",
                "condition": "score",
                "winner": winner,
                "reason": f"100 urteko epea amaitu da. Jokalariaren puntuazioa: {player_score}, AI puntuazioa: {ai_score} {current_date['year']}/{current_date['month']}",
            }

        # 5. ARKOLOGY EXODUS: 4 Arkology eraiki dira
        arcology_count = 0
        for b in player_city.get("buildings", []):
            if b.get("type") in ARCOLOGY_SPECS:
                arcology_count += 1
        
        if arcology_count >= GAME_CONSTANTS["VICTORY_CONDITIONS"].get("arcology_target", 4):
            return {
                "status": "player_won",
                "condition": "arcology_exodus",
                "winner": "player",
                "reason": f"Arkology Éxodoa aktibatu da! {arcology_count} arkologia eraiki dituzu eta gizadia izarretara doa {current_date['year']}/{current_date['month']}",
            }

        # 6. Ez da garaipena-baldintza betetzen
        return {
            "status": "ongoing",
            "condition": None,
            "winner": None,
            "reason": None,
        }