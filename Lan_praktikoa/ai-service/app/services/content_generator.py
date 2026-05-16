import logging

logger = logging.getLogger("content_generator")

class ContentGenerator:
    """
    Prompt sortzailearen klasea. System eta user promptak eraikitzen ditu.
    ENFORCES: JSON-only output, valid actions, budget constraints.
    """
    def generate_system_prompt(self, personality: str = "balanced") -> str:
        """
        System prompta sortu, nortasun koherentea mantentzeko jarraibideekin.
        """
        logger.info("System prompta sortzen...")
        return (
            "Eres un asistente JSON para SimHiri. Devuelve ÚNICAMENTE JSON válido. Sin markdown, sin explicaciones.\n\n"
            f"ERROLA: AI hiri-kudeatzailea SimHiri jokoan. Nortasuna: {personality}.\n"
            "HELBURUA: Zure hiria (AI City) haztea eta jokalariaren hiria gainditzea.\n\n"
            "⚠️ ARAU GARRANTZITSUAK:\n"
            "1. SOILIK onartutako ekintza motak erabili: 'placeZone', 'build', 'placeInfrastructure', 'pass'\n"
            "2. Ez gastatu existitzen ez den dirua. AI City treasury: kontrolatu aurrekontua.\n"
            "3. Koordinatu baliodunak soilik: 0 <= x,y < map_size (normalean 100x100)\n"
            "4. Formatua: JSON array bat 'ekintzak' (actions) izeneko objektu batean.\n\n"
            "✅ ONARTUTAKO EKINTZAK:\n"
            "- placeZone: zone_type (residential_light|commercial_light|industrial_light), size (w,h), position (x,y)\n"
            "- build: building_type (school|hospital|police_station|fire_station), position (x,y)\n"
            "- placeInfrastructure: infrastructure_type (road|power_line|water_pipe), start_position (x,y), end_position (x,y)\n"
            "- pass: ekintzarik ez (parametrorik gabe)\n\n"
            "❌ DEBEKATUTA:\n"
            "- Ekintza mota berriak asmatzea\n"
            "- Parametro gehigarriak\n"
            "- Testua JSON kanpoan\n"
            "- Markdown blokeak (```json)\n\n"
            "ITXAROTAKO IRTEERA FORMATUA:\n"
            '{"ekintzak": [{"type": "placeZone", "zone_type": "residential_light", "size": {"w": 2, "h": 2}, "position": {"x": 10, "y": 10}}], "reasoning": {"testuingurua": "...", "analisia": "..."}}\n'
        )

    def generate_user_prompt(self, game_state: dict, historia: list) -> str:
        """
        User prompta sortu, game_state eta historia txertatuz.
        Includes AI treasury and valid coordinates for constraint-aware generation.
        """
        logger.info("User prompta sortzen... Game state eta historia txertatuz.")
        
        ai_treasury = game_state.get("ai_city", {}).get("treasury", 0)
        map_size = game_state.get("map", {}).get("size", {"width": 100, "height": 100})
        
        return (
            f"🎮 JOKOAREN EGOERA:\n"
            f"- AI City Treasury: §{ai_treasury}\n"
            f"- Mapa tamaina: {map_size.get('width', 100)}x{map_size.get('height', 100)}\n"
            f"- Koordinatu baliodunak: 0 <= x < {map_size.get('width', 100)}, 0 <= y < {map_size.get('height', 100)}\n\n"
            f"Jokoaren egoera osoa: {game_state}\n\n"
            f"Partidaren historia: {historia}\n\n"
            f"📝 ZURE ATAZA: Aukeratu 1-5 ekintza zentzudun aurrekontua eta historia kontuan hartuta. "
            f"Itzuli SOILIK JSON. Ez testurik."
        )
