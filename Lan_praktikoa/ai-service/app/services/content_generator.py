import logging

logger = logging.getLogger("content_generator")

class ContentGenerator:
    """
    Prompt sortzailearen klasea. System eta user promptak eraikitzen ditu.
    """
    def generate_system_prompt(self, personality: str = "balanced") -> str:
        """
        System prompta sortu, nortasun koherentea mantentzeko jarraibideekin eta SPECS.md-ko ekintza katalogo zorrotza barne.
        """
        logger.info("System prompta sortzen...")
        return (
            "SimHiri jokoan AI hiri-kudeatzailea zara. Nortasun koherentea mantendu partida osoan. "
            f"Zure nortasuna: {personality}.\n"
            "Helburua: zure hiria haztea eta jokalariaren hiria gainditzea.\n"
            "Arauak: Hilabetero ekintzak aukeratu (zonak, eraikinak, azpiegiturak, aurrekontua, ordenantzak, erasoa).\n"
            "EQ edo HQ baxua bada, lehenetsi hezkuntza/osasun ekintzak.\n"
            "Ekintzak JSON formatuan itzuli. Reasoning eta analysis beti euskaraz.\n"
            "Ez duzu existitzen ez den dirua gastatu behar. Aurrekontua zorrotz kontrolatu.\n"
            "\n"
            "❗❗❗ GARRANTZITSUA: Zure erantzunean, SOILIK onartutako ekintza motak (type) eta parametroak erabil ditzakezu, SPECS.md dokumentuan zehaztutakoak.\n"
            "Debekatuta dago ekintza mota berriak asmatzea edo parametro berriak gehitzea.\n"
            "Onartutako ekintza motak (type):\n"
            "- 'placeZone': zona bat jartzea (details: zone_type, size)\n"
            "- 'buildStructure': eraikin bat eraikitzea (details: building_type, size)\n"
            "- 'pass': ekintzarik ez egitea\n"
            "Ekintza bakoitzaren parametroak ere zorrotz bete behar dira.\n"
            "Ez da onartzen beste ekintza motarik edo parametro gehigarririk.\n"
        )

    def generate_user_prompt(self, game_state: dict, historia: list) -> str:
        """
        User prompta sortu, game_state eta historia txertatuz.
        """
        logger.info("User prompta sortzen... Game state eta historia txertatuz.")
        prompt = (
            f"Jokoaren egungo egoera: {game_state}\n"
            f"Partidaren historia laburra: {historia}\n"
            "Zure ekintzak proposatu aurrekontua eta historia kontuan hartuta."
        )
        return prompt