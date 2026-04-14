"""
Hezkuntza eta Osasun Kalitatearen (EQ/HQ) kalkulua zerbitzua - Grupo 8 fokua.

Funtzio honek Hezkuntza Kalitatearen (EQ) eta Osasun Kalitatearen (HQ)
kalkulua exekutatzen du jokoaren simulazioan, SPECS.md § 6.8 aplikatuz.
"""
from typing import Dict, List, Tuple


class EducationHealthService:
    """
    Hezkuntza Kalitatearen (EQ) eta Osasun Kalitatearen (HQ) kalkulurako zerbitzua.
    
    Klase honek Grupo 8 (Hezkuntza eta Osasuna) espezializazioaren
    kalkuluak guztiak biltzen ditu.
    """

    # Hezkuntza-fasilitate bakoitzaren EQ ekarpena (SPECS.md § 1.4)
    SCHOOL_EQ_BONUS = 5
    COLLEGE_EQ_BONUS = 10
    LIBRARY_EQ_BONUS = 3
    MUSEUM_EQ_BONUS = 4

    # Osasun-fasilitate bakoitzaren HQ ekarpena
    HOSPITAL_HQ_BONUS = 50

    # Ordenantzen modifikadoreak
    ORDINANCE_MODS = {
        "free_clinics": {"hq_bonus": 5},          # +5% HQ
        "pro_reading": {"eq_bonus": 5},           # +5% EQ
        "cpr_training": {"hq_bonus": 2},          # +2% HQ
        "smoking_ban": {"hq_bonus": 3},           # +3% HQ
        "junior_sports": {"eq_bonus": 3},         # +3% EQ
    }

    @staticmethod
    def calculate_eq(
        city_state: Dict,
        active_ordinances: List[str],
    ) -> Tuple[int, Dict]:
        """
        Hezkuntza Kalitatearen (EQ) kalkulua hezkuntza-fasilitate oinarrian.

        Formulak SPECS.md § 6.8 eta § 3.6 iturrian:
        - target_eq = 50 + (ikastetxe×5 + colegIO×10 + liburtegia×3 + museoa×4) × funding%
        - eq_change_per_month = (target_eq - current_eq) × 0.01
        - final_eq = current_eq + eq_change (generazionala, astero aldarazi)

        Hau Grupo 8 espezializazioaren osako bere kalkulua da.

        Args:
            city_state: Hiriren egungo egoera, bilakota eta aurrekontua barne
            active_ordinances: Aktibo dauden ordenantzen IDen zerrenda

        Returns:
            Tupla: (eq_value_integer, breakdown_dict_detaliadundua)
        """
        # Desglose detaliatu baten egitura
        breakdown = {
            "schools": 0,
            "colleges": 0,
            "libraries": 0,
            "museums": 0,
            "ordinance_bonus": 0,
            "target_eq": 0,
            "eq_change": 0,
            "new_eq": 0,
        }

        # Uneko EQ balioa (default: 50 - balantsearen puntua)
        current_eq = city_state.get("metrics", {}).get("eq", 50)

        # Hezkuntza-finantziazioaren ehunekoa (0-120)
        education_funding = city_state.get("budget", {}).get("funding", {}).get("education", 100)
        funding_multiplier = education_funding / 100.0

        # Eraikina bakoitzaren zerrenda igarotzen dugu
        for building in city_state.get("buildings", []):
            building_type = building.get("type")

            if building_type == "school":
                breakdown["schools"] += EducationHealthService.SCHOOL_EQ_BONUS * funding_multiplier
            elif building_type == "college":
                breakdown["colleges"] += EducationHealthService.COLLEGE_EQ_BONUS * funding_multiplier
            elif building_type == "library":
                breakdown["libraries"] += EducationHealthService.LIBRARY_EQ_BONUS * funding_multiplier
            elif building_type == "museum":
                breakdown["museums"] += EducationHealthService.MUSEUM_EQ_BONUS * funding_multiplier

        # Ordenantzen bonusa aplikatzen dugu (ordenantza bakoitzak +X EQ ematen ditu)
        ordinance_bonus = 0
        for ordinance_id in active_ordinances:
            mods = EducationHealthService.ORDINANCE_MODS.get(ordinance_id, {})
            ordinance_bonus += mods.get("eq_bonus", 0)

        breakdown["ordinance_bonus"] = ordinance_bonus

        # Helburuko EQ kalkulatu: base 50 + guztiak
        facility_contribution = (
            breakdown["schools"]
            + breakdown["colleges"]
            + breakdown["libraries"]
            + breakdown["museums"]
        )
        target_eq = 50 + facility_contribution + ordinance_bonus
        target_eq = max(0, min(200, target_eq))  # Mugak: 0-200

        breakdown["target_eq"] = target_eq

        # Hileko aldaketa (generazionala, astero %1): (helburua - unekoa) × 0.01
        eq_change = (target_eq - current_eq) * 0.01
        breakdown["eq_change"] = eq_change

        # Uneko balioari aldaketa gehien
        new_eq = current_eq + eq_change
        new_eq = max(0, min(200, int(new_eq)))

        breakdown["new_eq"] = new_eq

        return new_eq, breakdown

    @staticmethod
    def calculate_hq(
        city_state: Dict,
        active_ordinances: List[str],
        pollution_air: int = 50,
        pollution_water: int = 50,
    ) -> Tuple[int, Dict]:
        """
        Osasun Kalitatearen (HQ) kalkulua ospitaleen estaldura eta airearen oinarrian.

        Formulak SPECS.md § 6.8 eta § 3.6 iturrian:
        - hospital_contribution = hospitals × 50 × (health_funding % / 100)
        - pollution_penalty = (pollution_air + pollution_water) × 0.25
        - target_hq = 50 + hospital_contribution - pollution_penalty + ordinance_bonus
        - hq_change_per_month = (target_hq - current_hq) × 0.02 (bizkorrago EQ baino!)

        Hau Grupo 8 espezializazioaren osako bere kalkulua da.
        Kontaminazioak (airea eta ura) HQ murrizten dute.

        Args:
            city_state: Hiriren egungo egoera
            active_ordinances: Aktibo dauden ordenantzen IDen zerrenda
            pollution_air: Airearen kutsaduraren maila (0-100)
            pollution_water: Uraren kutsaduraren maila (0-100)

        Returns:
            Tupla: (hq_value_integer, breakdown_dict_detaliadundua)
        """
        breakdown = {
            "hospitals": 0,
            "hospital_contribution": 0,
            "pollution_air_penalty": 0,
            "pollution_water_penalty": 0,
            "pollution_total_penalty": 0,
            "ordinance_bonus": 0,
            "target_hq": 0,
            "hq_change": 0,
            "new_hq": 0,
        }

        # Uneko HQ balioa (default: 50 - balantzearen puntua)
        current_hq = city_state.get("metrics", {}).get("hq", 50)

        # Osasun-finantziazioaren ehunekoa (0-120)
        health_funding = city_state.get("budget", {}).get("funding", {}).get("health", 100)
        funding_multiplier = health_funding / 100.0

        # Ospitak zenbatzen dira
        hospitals = 0
        for building in city_state.get("buildings", []):
            if building.get("type") == "hospital":
                hospitals += 1

        breakdown["hospitals"] = hospitals

        # Hospital ekarpena: hospital × 50 × finantziazio%
        hospital_contribution = hospitals * EducationHealthService.HOSPITAL_HQ_BONUS * funding_multiplier
        breakdown["hospital_contribution"] = hospital_contribution

        # Kutsadura-penalizazioa: bai airearentzat, bai urarentzat
        # Airearen kutsadura: × 0.3
        pollution_air_penalty = pollution_air * 0.3
        breakdown["pollution_air_penalty"] = pollution_air_penalty

        # Uraren kutsadura: × 0.3 (aireak bezain garrantzia du)
        pollution_water_penalty = pollution_water * 0.3
        breakdown["pollution_water_penalty"] = pollution_water_penalty

        # Kutsadura osoaren penalizazioa
        total_pollution_penalty = pollution_air_penalty + pollution_water_penalty
        breakdown["pollution_total_penalty"] = total_pollution_penalty

        # Ordenantzen bonusa aplikatzen dugu
        ordinance_bonus = 0
        for ordinance_id in active_ordinances:
            mods = EducationHealthService.ORDINANCE_MODS.get(ordinance_id, {})
            ordinance_bonus += mods.get("hq_bonus", 0)

        breakdown["ordinance_bonus"] = ordinance_bonus

        # Helburuko HQ kalkulatu: base 50 + ospitalak - kutsadura + ordenantzak
        target_hq = 50 + hospital_contribution - total_pollution_penalty + ordinance_bonus
        target_hq = max(0, min(200, target_hq))  # Mugak: 0-200

        breakdown["target_hq"] = target_hq

        # Hileko aldaketa (bizkorrago EQ baino: %2): (helburua - unekoa) × 0.02
        hq_change = (target_hq - current_hq) * 0.02
        breakdown["hq_change"] = hq_change

        # Uneko balioari aldaketa gehien
        new_hq = current_hq + hq_change
        new_hq = max(0, min(200, int(new_hq)))

        breakdown["new_hq"] = new_hq

        return new_hq, breakdown

    @staticmethod
    def calculate_eq_effects(eq: int) -> Dict:
        """
        Hezkuntza Kalitatearen (EQ) efektuak hirian kalkulatzen ditu.

        SPECS.md § 6.8 iturrian:
        - high_tech_industry: EQ / 200 handiagoa = teknologia handiko industriak
        - crime_reduction: EQ handiak krimena gutxitzen du
        - land_value_bonus: EQ handiak lurraren balioa igotzen du

        Args:
            eq: Uneko Hezkuntza Kalitate balioa (0-200)

        Returns:
            Hiztegia efektuarekin
        """
        return {
            "high_tech_industry_pct": min(eq / 200.0, 1.0),
            "crime_reduction": min(eq * 0.1, 100),
            "land_value_bonus": min(eq * 0.5, 100),
        }

    @staticmethod
    def calculate_hq_effects(hq: int) -> Dict:
        """
        Osasun Kalitatearen (HQ) efektuak hirian kalkulatzen ditu.

        SPECS.md § 6.8 iturrian:
        - average_lifespan: Batez bestean bizitzaren adina urtetan
        - mortality_rate: Heriotzen kopurua 1000 bizilagun kohartean

        Args:
            hq: Uneko Osasun Kalitate balioa (0-200)

        Returns:
            Hiztegia efektuarekin
        """
        return {
            "average_lifespan": 50 + (hq * 0.2),  # Urteak
            "mortality_rate": max(0, 10 - hq * 0.05),  # Heriotza kopurua 1000-ean
        }