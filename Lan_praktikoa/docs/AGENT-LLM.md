# AGENT-LLM.md — SimHiri: Copilot Agent-aren Argibideak (AA/ML Espezialista)

---

## ROLA

**AA/ML Espezialista** garapen agentea zara SimHiri proiektuan, hiri-eraikuntza estrategia joko web bat. Zure erantzukizun nagusia da AA zerbitzua inplementatzea: aurkari hiri kudeatzaile gisa jokatzen duen LLM integrazioa, prompt diseinua 5 alkate nortasunekin, GroQ / GitHub Models integrazioa, ekintzen balidazioa, eduki sortzea (egunkari artikuluak, alkate arrazoiamendua), eta sistema osoaren dokumentazioa.

---

## TEKNOLOGIAK

- **Hizkuntza**: Python 3.11+
- **Framework**: FastAPI (zerbitzu independentea)
- **LLM Hornitzaileak**: GroQ API, GitHub Models API
- **Eredu gomendioak**:
  - GroQ: `llama-3.3-70b-versatile` (nagusia), `llama-3.1-8b-instant` (ordezko)
  - GitHub: `gpt-4o-mini` (nagusia), `meta/llama-3.1-8b-instruct` (ordezko)
- **HTTP Bezeroa**: httpx (async)
- **Edukiontzia**: Docker independentea (ai-service)

---

## AA ZERBITZU ARKITEKTURA

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py                # Sarrera puntua FastAPI
│   ├── config.py              # Konfigurazioa eta ingurune-aldagaiak
│   ├── routes/
│   │   └── ai.py              # POST /api/ai/turn endpoint-a
│   ├── providers/             # LLM hornitzaileak
│   │   ├── base.py            # Oinarrizko klase abstraktua
│   │   ├── groq_provider.py   # GroQ integrazioa
│   │   └── github_provider.py # GitHub Models integrazioa
│   ├── services/
│   │   ├── ai_service.py      # AA txanden orkestrazioa
│   │   ├── prompt_builder.py  # Prompt eraikuntza
│   │   ├── state_filter.py    # Egoera iragazketa (AA-rentzat ikusgaia)
│   │   ├── action_validator.py # Ekintzen balidazioa
│   │   └── content_generator.py # Eduki sortzea (izenak, egunkaria)
│   ├── prompts/               # Prompt txantiloiak
│   │   ├── system_prompt.txt  # Sistema prompt-a arauekin
│   │   ├── turn_prompt.txt    # Txandaren prompt txantiloia
│   │   └── personality/       # Nortasun prompt-ak
│   │       ├── expansionist.txt
│   │       ├── ecologist.txt
│   │       ├── industrialist.txt
│   │       ├── balanced.txt
│   │       └── tax_collector.txt
│   └── models/                # Datu motak
│       ├── ai_request.py
│       └── ai_response.py
├── tests/
├── requirements.txt
├── Dockerfile
└── .env
```

---

## ENDPOINT NAGUSIA

### POST /api/ai/turn

AA-ren txanda osoa prozesatzen du.

**Eskaera:**
```json
{
  "game_state": {
    "current_date": {"year": 1950, "month": 6},
    "ai_city": {
      "name": "AA Hiria",
      "population": 12500,
      "treasury": 8200,
      "zones": ["...AA-ren zona guztiak..."],
      "buildings": ["...AA-ren eraikin guztiak..."],
      "infrastructure": {"..."},
      "budget": {"...aurrekontu osoa..."},
      "ordinances": ["...aktibatutako ordenantzak..."],
      "metrics": {
        "eq": 85,
        "hq": 70,
        "crime_rate": 15,
        "pollution_air": 25,
        "land_value_avg": 120,
        "rci_demand": {"r": 30, "c": 15, "i": 20},
        "composite_score": 45000
      },
      "power_grid": {"total_capacity_mw": 400, "total_demand_mw": 280, "coverage_pct": 100},
      "water_system": {"total_capacity": 200, "total_demand": 150, "coverage_pct": 95}
    },
    "player_info": {
      "population": 15000,
      "composite_score": 52000,
      "zone_count": 45,
      "treasury_range": "ertaina"
    },
    "available_actions": {
      "can_zone": ["residential_light", "residential_dense", "commercial_light", "commercial_dense", "industrial_light", "industrial_dense"],
      "can_build": ["coal_power", "oil_power", "police_station", "fire_station", "hospital", "school", "bus_depot"],
      "can_build_infra": ["road", "power_line", "water_pipe"],
      "can_enact_ordinances": ["pro_reading", "junior_sports", "anti_drug"],
      "can_attack": true,
      "attack_options": ["fire", "flood"],
      "attack_cooldown_months": 0
    },
    "history": ["...azken 5 hilabeteetako laburpena..."]
  },
  "personality": "expansionist",
  "difficulty": "medium"
}
```

**Erantzuna (200):**
```json
{
  "actions": [
    {
      "type": "zone",
      "details": {
        "zone_type": "residential_dense",
        "position": {"x": 15, "y": 22},
        "size": {"w": 3, "h": 3}
      }
    },
    {
      "type": "build",
      "details": {
        "building_type": "police_station",
        "position": {"x": 10, "y": 18}
      }
    },
    {
      "type": "infrastructure",
      "details": {
        "type": "road",
        "segments": [
          {"from": {"x": 15, "y": 22}, "to": {"x": 15, "y": 23}},
          {"from": {"x": 15, "y": 23}, "to": {"x": 14, "y": 23}}
        ]
      }
    },
    {
      "type": "budget",
      "details": {
        "tax_rates": {"residential": 7, "commercial": 8, "industrial": 6},
        "funding": {"police": 100, "fire": 80, "education": 110}
      }
    },
    {
      "type": "ordinance",
      "details": {
        "ordinance_id": "pro_reading",
        "action": "enact"
      }
    }
  ],
  "reasoning": "Biztanleria hazten ari da baina krimena igo da. Polizia komisaldegi bat eraiki dut eta hezkuntza sustatzea aktibatu dut. Zona erresidentzial trinkoa gehitu dut populazio eskaria asetzeko.",
  "analysis": "Jokalariaren biztanleria nirea baino %20 handiagoa da. Erresidentzial zona gehiago behar ditut eta zerbitzuak hobetu."
}
```

**Erantzuna 500 (fallback — eredu guztiek huts egiten badute):**
```json
{
  "actions": [{"type": "pass"}],
  "reasoning": "AA zerbitzu errorea — ekintzarik gabeko txanda",
  "analysis": "Zerbitzua ez dago eskuragarri"
}
```

---

## LLM HORNITZAILEAK

### Oinarrizko Klase Abstraktua

```python
# providers/base.py
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Prompt-a bidali eta erantzuna testu gisa jaso."""
        pass

    @abstractmethod
    def get_name(self) -> str:
        """Hornitzailearen izena logging-erako."""
        pass
```

### GroQ Hornitzailea

```python
# providers/groq_provider.py
import httpx

class GroQProvider(LLMProvider):
    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.BASE_URL,
                headers=self.headers,
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4096,
                    "response_format": {"type": "json_object"}
                }
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
```

### GitHub Models Hornitzailea

```python
# providers/github_provider.py
import httpx

class GitHubModelsProvider(LLMProvider):
    BASE_URL = "https://models.inference.ai.azure.com/chat/completions"

    def __init__(self, token: str, model: str):
        self.token = token
        self.model = model
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.BASE_URL,
                headers=self.headers,
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4096
                }
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
```

---

## AA ZERBITZUAREN ORKESTRAZIOA

```python
# services/ai_service.py

class AIService:
    def __init__(self, providers: list[LLMProvider]):
        self.providers = providers  # Lehentasun ordenan

    async def get_ai_turn(self, request: AITurnRequest) -> AITurnResponse:
        """
        Fluxu osoa:
        1. AA-ren hiriaren egoera iragaztea (jokalariaren info mugatua)
        2. Prompt-a eraiki egoera, nortasun eta ekintza eskuragarriekin
        3. LLM-ari deitu (retry eta fallback-ekin)
        4. JSON erantzuna parseatu
        5. Ekintzak balidatu
        6. Ekintza baliozkoak itzuli
        """
        filtered_state = self.filter_state(request.game_state)
        system_prompt = self.build_system_prompt(request.personality, request.difficulty)
        user_prompt = self.build_user_prompt(filtered_state, request.game_state["available_actions"])

        raw_response = await self.call_with_fallback(system_prompt, user_prompt)
        parsed = self.parse_response(raw_response)
        validated = self.validate_actions(parsed["actions"], request)

        return AITurnResponse(
            actions=validated,
            reasoning=parsed.get("reasoning", ""),
            analysis=parsed.get("analysis", "")
        )

    async def call_with_fallback(self, system_prompt: str, user_prompt: str) -> str:
        """
        Hornitzaile bakoitza ordenean saiatu.
        429 (rate limit) → hurrengora salto.
        500 → berriro saiatu 1 aldiz, orduan hurrengora.
        Guztiak huts → ekintza lehenetsia (pass).
        """
        for provider in self.providers:
            try:
                return await provider.generate(system_prompt, user_prompt)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    continue
                elif e.response.status_code >= 500:
                    try:
                        return await provider.generate(system_prompt, user_prompt)
                    except:
                        continue
            except Exception:
                continue

        # Hornitzaile guztiak huts egin dute
        return '{"actions": [{"type": "pass"}], "reasoning": "AA eredu guztiak ezin dira erabili", "analysis": "N/A"}'
```

---

## PROMPT DISEINUA

### Sistema Prompt-a (prompts/system_prompt.txt)

```
Hiri kudeatzaile adimentsua zara "SimHiri" joko batean. Aurkari hiri bat kudeatzen duzu
jokalariaren hiriaren ondoan. Zure helburua da zure hiria haztea eta jokalariaren hiria
gainditzea biztanlerian, puntuazio konposatuan edo jokalariaren porrot ekonomikora eramanez.

JOKOAREN ARAUAK:
- Hilabetero ekintzak aukeratzen dituzu: zonak jarri, eraikinak eraiki, azpiegiturak jarri,
  aurrekontua doitu, ordenantzak aktibatu/desaktibatu, edo aurkariaren hiriari hondamendi
  erasoa bidali.
- Zonek energia, ura eta errepide sarbidea behar dute garatzeko.
- Zerga tasak R/C/I eskarian eragiten dute.
- Zentral elektrikoak 50 urteren ondoren lehertu daitezke.
- Hondamendi erasoak gutxienez 6 hilabete tartean eta kostua dute.
- Bankrota 12 hilabete jarraian altxorra < -§100.000 izanez gero.
- Lehen hiria 100.000 biztanle lortzen duena irabazten du.

EKINTZA FORMATUA (JSON):
{
  "actions": [
    {"type": "zone", "details": {"zone_type": "...", "position": {"x": N, "y": N}, "size": {"w": N, "h": N}}},
    {"type": "build", "details": {"building_type": "...", "position": {"x": N, "y": N}}},
    {"type": "infrastructure", "details": {"type": "...", "segments": [...]}},
    {"type": "budget", "details": {"tax_rates": {...}, "funding": {...}}},
    {"type": "ordinance", "details": {"ordinance_id": "...", "action": "enact|repeal"}},
    {"type": "attack", "details": {"disaster_type": "...", "target": "player"}},
    {"type": "pass"}
  ],
  "reasoning": "Zure estrategiaren azalpena euskaraz",
  "analysis": "Jokuaren egoeraren analisia euskaraz"
}

ARAU GARRANTZITSUAK:
- Soilik available_actions-en agertzen diren ekintzak erabili
- Ez gastu gehiago egiten zure altxorrak baimentzen duena baino
- Erantzuna BETI JSON formatuan eman
- reasoning eta analysis eremuak BETI euskaraz idatzi
```

### Nortasun Prompt-ak (prompts/personality/)

**expansionist.txt (Hedatzailea):**
```
Zure nortasuna HEDATZAILEA da. Hiri hedapena da zure lehentasun nagusia.
- Zona ahalik eta gehien jarri, batez ere erresidentzialak
- Azpiegiturak zabaldu zona berrietara heltzeko
- Zerga baxuak mantendu biztanleria erakartzeko
- Energia nahikoa ziurtatu hedapen azkarrerako
- Lurralde hori guztia betetzea da helburua
- Erasoak soilik aurkaria oso aurreratuta badago erabiltzen ditu
```

**ecologist.txt (Ekologista):**
```
Zure nortasuna EKOLOGISTA da. Ingurumena eta bizi-kalitatea dira lehentasuna.
- Kutsadura kontrolatzeko ordenantzak aktibatu
- Zentral garbiagoak hobetsi (eguzkia, haizea, hidroelektrikoa)
- Zuhaitz asko landu kutsadura murrizteko
- Industria zona gutxiago, komertzialak gehiago
- Hezkuntza eta osasunean finantzaketa altua mantendu
- Lur-balioa eta metrika sozialak pribilegiatu populazio gordinaren gainetik
```

**industrialist.txt (Industrialista):**
```
Zure nortasuna INDUSTRIALISTA da. Ekoizpena eta ekonomia dira lehentasuna.
- Industria zona asko jarri
- Portua eta trenbidea eraiki industria eskaria suspertzeko
- Zerga baxuak industriarentzat, altuagoak bestearentzat
- Energia merkea (ikatza, petrolioa) erabili
- Kutsadura onargarria da biztanleria eta ekonomia hazkundearentzat
- Enpresa pizgarriak aktibatu
```

**balanced.txt (Orekatua):**
```
Zure nortasuna OREKATUA da. Egoerari egokitzen zara.
- R/C/I eskariaren araberako zona jartzea
- Inbertsio orekatua zerbitzuetan eta azpiegituretan
- Zerga ertaina (%7 inguru)
- Erasoak eta defentsa estrategikoki erabili
- Biztanleria eta puntuazio konposatua orekatuta mantendu
- Egoeraren analisia jokabidea gidatzen du
```

**tax_collector.txt (Zerga-biltzailea):**
```
Zure nortasuna ZERGA-BILTZAILEA da. Diru-sarrerak maximizatzea da lehentasuna.
- Zerga tasak altu mantendu (baina ez gehiegi, eskaria galtzeko)
- Diru-sarrera sortzen duten ordenantzak aktibatu (salmenta zerga, jokoa, etab.)
- Bonuak gutxiesten dituzu (interesak ordaintzen dituzte ere)
- Gastu gutxien posiblea zerbitzuetan
- Altxor handia pilatu eta orduan hedatu
- Erasoak merkeko aukerak soilik (sutea §5.000)
```

### Txanda Prompt-a (hilabetero)

```python
# services/prompt_builder.py

def build_user_prompt(filtered_state: dict, available_actions: dict) -> str:
    return f"""
Hau da uneko jokoaren egoera ({filtered_state['current_date']['year']}. urtea, 
{filtered_state['current_date']['month']}. hilabetea):

<zure_hiria>
{json.dumps(filtered_state['ai_city'], indent=2, ensure_ascii=False)}
</zure_hiria>

<jokalariaren_info>
Jokalariaren biztanleria: {filtered_state['player_info']['population']}
Jokalariaren puntuazioa: {filtered_state['player_info']['composite_score']}
Jokalariaren zona kopurua: {filtered_state['player_info']['zone_count']}
</jokalariaren_info>

Hilabete honetako ekintza eskuragarriak:
- Jar ditzakezun zonak: {json.dumps(available_actions['can_zone'])}
- Eraiki ditzakezun eraikinak: {json.dumps(available_actions['can_build'])}
- Jar ditzakezun azpiegiturak: {json.dumps(available_actions['can_build_infra'])}
- Aktibatu ditzakezun ordenantzak: {json.dumps(available_actions['can_enact_ordinances'])}
- Erasoa posible: {available_actions['can_attack']}
- Eraso aukerak: {json.dumps(available_actions.get('attack_options', []))}

Zure altxorra: §{filtered_state['ai_city']['treasury']}

Azken hilabeteetako historia:
{json.dumps(filtered_state.get('history', []), ensure_ascii=False)}

Aztertu egoera, formulatu zure estrategia, eta eman zure ekintzak JSON balideoan.
"""
```

---

## EGOERAREN IRAGAZKETA

```python
# services/state_filter.py

def filter_state_for_ai(full_game_state: dict) -> dict:
    """
    AA-k soilik ikusi behar du:
    1. Bere hiriaren xehetasun osoak (zonak, eraikinak, aurrekontua, metrikak)
    2. Jokalariaren hiriaren informazio MUGATUA:
       - Biztanleria (zenbaki gordina)
       - Puntuazio konposatua
       - Zona kopurua
       - Altxor maila (baxua/ertaina/altua, zenbaki zehatza EZ)
    3. Uneko data
    4. Azken hilabeteetako historia (5 hilabete)
    
    AA-k EZ du ikusi behar:
    - Jokalariaren aurrekontu xehetasunak
    - Jokalariaren zona kokapen zehatzak
    - Jokalariaren eraikin zerrenda
    - Jokalariaren ordenantzak
    - Jokalariaren trikimailu erabilera
    """
    ai_city = full_game_state["ai_city"]
    player_city = full_game_state["player_city"]
    
    # Jokalariaren altxor maila kalkulatu (mugatua)
    treasury = player_city["treasury"]
    if treasury < 0:
        treasury_range = "baxua"
    elif treasury < 10000:
        treasury_range = "ertaina"
    else:
        treasury_range = "altua"
    
    return {
        "current_date": full_game_state["current_date"],
        "ai_city": ai_city,
        "player_info": {
            "population": player_city["population"],
            "composite_score": player_city["metrics"]["composite_score"],
            "zone_count": len(player_city["zones"]),
            "treasury_range": treasury_range
        },
        "history": full_game_state.get("ai_context", {}).get("conversation_history", [])[-5:]
    }
```

---

## EKINTZEN BALIDAZIOA

```python
# services/action_validator.py

def validate_actions(actions: list[dict], game_state: dict) -> list[dict]:
    """
    AA-ren ekintza bakoitza balidatu:
    
    zone:
      - Zona mota available_actions-en dagoen
      - Kokapena libre eta eraikitzeko modukoa
      - Nahikoa altxorra
    
    build:
      - Eraikin mota available_actions-en dagoen
      - Kokapena libre eta tamaina egokia
      - Nahikoa altxorra
      - Teknologia urtea betetzen da
    
    infrastructure:
      - Azpiegitura mota available_actions-en dagoen
      - Segmentuak baliozko posizioetan
      - Nahikoa altxorra
    
    budget:
      - Zerga tasak 0-20 artean
      - Finantzaketa 0-120 artean
    
    ordinance:
      - Ordenantza existitzen da
      - Ordenantza available_actions-en dagoen (enact-erako)
    
    attack:
      - can_attack = true
      - Hondamendi mota attack_options-en dagoen
      - Nahikoa altxorra eraso kosturako
      - Cooldown betetzen da (6 hilabete)
    
    Ekintza baliogabeak isil-isilik alde batera uzten dira.
    Ekintza baliozkorik ez badago, "pass" itzultzen da.
    """
    valid_actions = []
    remaining_treasury = game_state["ai_city"]["treasury"]
    
    for action in actions:
        if action["type"] == "pass":
            continue
        
        cost = estimate_action_cost(action)
        if cost <= remaining_treasury:
            if is_valid_action(action, game_state):
                valid_actions.append(action)
                remaining_treasury -= cost
    
    if not valid_actions:
        valid_actions.append({"type": "pass"})
    
    return valid_actions
```

---

## EDUKI SORTZEA

### Hiri Izenak

```python
# services/content_generator.py

async def generate_city_name() -> str:
    """
    LLM bidez euskarazko hiri izen bat sortu.
    Fallback: aurredefinitutako zerrenda.
    """

FALLBACK_CITY_NAMES = [
    "Irubide", "Harkaitza", "Zubialde", "Itsasondo", "Mendilur",
    "Ibaiondo", "Zelaia", "Goikoetxe", "Etxeberri", "Uribarri",
    "Arriaga", "Iturria", "Basauri", "Elkarreta", "Landeta"
]
```

### Egunkari Edukia (5. taldeko modulua)

```python
async def generate_newspaper(city_state: dict, events: list, ai_actions: list) -> dict:
    """
    LLM bidez euskarazko egunkari bat sortu:
    1. Hiri berriak (gertaera garrantzitsuetatik)
    2. Inkesta (hiriaren arazo handiena balio baxuenaren araberakoa)
    3. AA laburpena (aurkari hiriaren berrien laburpena)
    4. Umore titularra (ausazko titular barregarria)
    5. Aholkulariaren zutabea (aholku bat alkateari)
    
    Fallback: txantiloi estatikoak hiriaren metriken arabera
    """
```

### AA Alkatearen Arrazoiamendua

```python
async def generate_reasoning(personality: str, actions: list, city_state: dict) -> str:
    """
    AA-k nortasunaren arabera arrazoiamendua sortzen du BETI euskaraz.
    Hau frontend-ean bistaratzen da AA txandaren bistaratzailean.
    """
```

---

## DOKUMENTAZIOA

AA/ML Espezialista dokumentazioaren arduraduna da:

### Erabiltzaile Eskuliburua
- Nola erregistratu eta partida sortu
- Interfazearen gida (mapa, aurrekontua, zonak, eraikinak)
- Jokoaren arauak azalduak (energia, ura, RCI, metrikak)
- AA-ren funtzionamendua azalduta
- Trikimailu kodeen zerrenda

### Dokumentazio Teknikoa
- Sistemaren arkitektura (4 edukiontzi)
- Datuen fluxua osagaien artean
- Prompt formatuak eta LLM erantzunak
- Erabilitako ereduen inbentarioa eta haien ezaugarriak
- AA-ren errendimendu metrikak (erantzun denbora, erabaki kalitatea)

### AA Baliabideen Inbentarioa
- AA bidez sortutako baliabide guztien zerrenda
- Baliabide bakoitzarentzat erabilitako tresna
- Aplikatutako prompt-a
- Sorrera data
- Proiektuan kokapena

---

## DOCKER

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5001"]
```

### requirements.txt
```
fastapi>=0.104.0
uvicorn>=0.24.0
httpx>=0.25.0
pydantic>=2.5.0
python-dotenv>=1.0.0
```

---

## GARAPEN ARAUAK

1. **Kontsultatu SPECS.md** datu formatuak eta jokoaren arauetarako
2. **AA-k informazio mugatua soilik jaso**: Jokalariaren hiriaren xehetasunak inoiz ez eman AA-ri
3. **JSON baliozko erantzunak**: Ziurtatu LLM-aren erantzunak beti JSON parseable direla
4. **Ordezko sistema sendoa**: Eredu guztiek huts egiten badute, AA-k txanda pasatzen du (ez crash)
5. **Denbora mugak**: Gehienez 30 segundo AA txanda bakoitzeko
6. **Logging**: Bidalitako prompt guztiak eta jasotako erantzunak erregistratu (debug-erako)
7. **API tokenak**: INOIZ ez hardkodeatu — ingurune-aldagaiak erabili
8. **Balidazioa**: AA-ren ekintza guztiak arauak errespetatzen dituztela egiaztatu exekutatu aurretik
9. **Nortasunak**: AA bakoitzak jokabide berezia izan behar du nortasunaren arabera
10. **Euskara**: AA-ren reasoning eta analysis beti EUSKARAZ

---

## CHECKLIST — ENTREGATU AURRETIK

- [ ] AA zerbitzua Docker-en errorerik gabe abiarazten da
- [ ] GroQ integrazioa funtzionala (gutxienez eredu 1)
- [ ] Edo GitHub Models integrazioa funtzionala (gutxienez eredu 1)
- [ ] Hornitzaileen arteko fallback funtzionala
- [ ] AA-k erabaki koherenteak hartzen ditu (zonak jartzen, eraikinak eraikitzen, aurrekontua doitzen)
- [ ] AA-k jokalariaren informazio mugatua soilik jasotzen du
- [ ] Ekintzen balidazioa sendoa (ekintza baliogabeak alde batera uzten dira)
- [ ] 5 nortasun prompt inplementatuta (hedatzailea, ekologista, industrialista, orekatua, zerga-biltzailea)
- [ ] Erantzun denbora < 30 segundo
- [ ] JSON egitura partiden dokumentatua eta backend/frontend-ekin koherentea
- [ ] AA-ren ekintzak frontend bistaratzeko itzultzen dira
- [ ] Taldeko modulu espezifikoa prompt-etan integratuta
- [ ] Dokumentazio osoa (erabiltzaile eskuliburua + teknikoa)
- [ ] AA baliabideen inbentarioa osatuta
