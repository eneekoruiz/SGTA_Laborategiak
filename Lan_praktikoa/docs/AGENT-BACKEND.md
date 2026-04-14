# AGENT-BACKEND.md — SimHiri: Copilot Agent-aren Argibideak (Backend Garatzailea)

---

## ROLA

**Backend** garapen agentea zara SimHiri proiektuan, hiri-eraikuntza estrategia joko web bat. Zure erantzukizun nagusia da API REST inplementatzea, jokoaren logika (hileko tick simulazioa, RCI eskaria, energia/ur sareak, zona garapena, aurrekontua, hondamendiak), MongoDB-rekin elkarrekintza, eta Docker-eko hedapena konfiguratzea.

---

## TEKNOLOGIAK

- **Framework**: Kontsultatu SPECS.md § 6 taularen esleipena zure taldearentzat (Flask edo FastAPI)
- **Hizkuntza**: Python 3.11+
- **Datu-basea**: MongoDB (pymongo edo motor async-erako)
- **Autentikazioa**: JWT (PyJWT), bcrypt pasahitz hash-erako
- **Edukiontziak**: Docker, Docker Compose
- **Ingurune-aldagaiak**: python-dotenv
- **Balidazioa**: pydantic (FastAPI natiboa) edo marshmallow/cerberus (Flask)

---

## BACKEND ARKITEKTURA

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                # Sarrera puntua (FastAPI app edo Flask app)
│   ├── config.py              # Konfigurazioa eta ingurune aldagaiak
│   ├── models/                # Datu ereduak (pydantic/dataclass)
│   │   ├── user.py
│   │   ├── game.py
│   │   ├── city.py
│   │   ├── zone.py
│   │   ├── building.py
│   │   ├── infrastructure.py
│   │   ├── budget.py
│   │   └── disaster.py
│   ├── routes/                # API endpoint-ak
│   │   ├── auth.py            # /api/auth/*
│   │   ├── games.py           # /api/games/*
│   │   ├── city_actions.py    # /api/games/{id}/zone, build, demolish, infrastructure
│   │   ├── budget.py          # /api/games/{id}/budget, ordinance, bond
│   │   ├── combat.py          # /api/games/{id}/attack
│   │   ├── turn.py            # /api/games/{id}/endMonth
│   │   ├── queries.py         # /api/games/{id}/overlay, stats
│   │   └── cheat.py           # /api/games/{id}/cheat
│   ├── services/              # Negozio logika
│   │   ├── game_service.py    # Hileko tick orkestrazioa
│   │   ├── city_service.py    # Hiri kudeaketa
│   │   ├── zone_service.py    # Zona eskaera, garapen eta abandonatze logika
│   │   ├── power_service.py   # Energia sarea (BFS)
│   │   ├── water_service.py   # Ur sarea (BFS)
│   │   ├── budget_service.py  # Zerga, gastuak, bonu kalkuluak
│   │   ├── disaster_service.py # Hondamendi logika
│   │   ├── overlay_service.py  # Datu gainjarri kalkuluak
│   │   ├── victory_service.py  # Garaipena baldintza egiaztapena
│   │   ├── scenario_service.py # Eszenatoki eta mapa sortzea
│   │   └── cheat_service.py   # Trikimailu logika
│   ├── db/                    # MongoDB elkarrekintza
│   │   ├── database.py        # MongoDB konexioa
│   │   ├── user_repo.py
│   │   └── game_repo.py
│   ├── auth/                  # Autentikazioa
│   │   ├── jwt_handler.py     # JWT tokenak sortu eta egiaztatu
│   │   └── password.py        # Hash eta verify bcrypt-ekin
│   ├── data/                  # Jokoaren datu estatikoak
│   │   ├── buildings.json     # Eraikinen definizioak
│   │   ├── ordinances.json    # Ordenantzen definizioak
│   │   ├── disasters.json     # Hondamendi konfigurazioak
│   │   └── scenarios.json     # Eszenatoki aurredefinituak
│   └── middleware/            # Middleware (CORS, auth, logging)
├── tests/
├── requirements.txt
├── Dockerfile
└── .env
```

---

## ENDPOINT-AK — LABURPENA

Kontsultatu SPECS.md § 2 xehetasun osoetarako. Hemen laburpena:

### Autentikazioa (`/api/auth/`)

| Metodoa | Bidea | Funtzioa |
|---------|-------|---------|
| POST | `/api/auth/register` | Erabiltzailea erregistratu |
| POST | `/api/auth/login` | Login, JWT itzuli |
| GET | `/api/auth/profile` | Autentikatutako erabiltzailearen profila |

### Partidak (`/api/games/`)

| Metodoa | Bidea | Funtzioa |
|---------|-------|---------|
| GET | `/api/games` | Erabiltzailearen partidak zerrendatu |
| POST | `/api/games` | Partida berria sortu |
| GET | `/api/games/{gameId}` | Partida kargatu |
| POST | `/api/games/{gameId}/save` | Partida gorde |
| DELETE | `/api/games/{gameId}` | Partida ezabatu |
| GET | `/api/scenarios` | Eszenatoki eskuragarriak |

### Hiri Ekintzak

| Metodoa | Bidea | Funtzioa |
|---------|-------|---------|
| POST | `/api/games/{gameId}/zone` | Zona jarri |
| POST | `/api/games/{gameId}/infrastructure` | Azpiegitura jarri |
| POST | `/api/games/{gameId}/build` | Eraikina eraiki |
| POST | `/api/games/{gameId}/demolish` | Elementua bota |
| POST | `/api/games/{gameId}/budget` | Aurrekontua eguneratu |
| POST | `/api/games/{gameId}/ordinance` | Ordenantza aktibatu/desaktibatu |
| POST | `/api/games/{gameId}/bond` | Bonua eskatu |
| POST | `/api/games/{gameId}/attack` | Hondamendi erasoa |
| POST | `/api/games/{gameId}/endMonth` | Hilabetea amaitu + AA txanda |
| POST | `/api/games/{gameId}/cheat` | Trikimailua aplikatu |

### Kontsultak

| Metodoa | Bidea | Funtzioa |
|---------|-------|---------|
| GET | `/api/games/{gameId}/overlay/{type}` | Datu gainjarria (krimena, kutsadura, etab.) |
| GET | `/api/games/{gameId}/stats` | Jokoaren estatistikak eta konparaketa |

---

## JOKOAREN LOGIKA — ZER INPLEMENTATU

### 1. Mapa eta Eszenatoki Sorkuntza (`scenario_service.py`)

```python
def create_game_map(scenario: dict, difficulty: str) -> dict:
    """
    1. Kargatu eszenatokiaren lurralde presetak (heightmap eta zuhaitzak)
       edo sortu ausazko lurraldea seed-arekin
    2. Ur maila aplikatu (laukiak urpean ala gainean)
    3. Zuhaitzak kokatu aurredefinitutako posizioetan
    4. Jokalariaren eta AA-ren hasierako eremuak kokatu
    5. Hasierako altxorra ezarri zailtasunaren arabera
       (easy=§20.000, medium=§10.000, hard=§5.000)
    6. Mapa egitura itzuli (2D matrizea Tile objektuekin)
    """
```

### 2. Hileko Tick Simulazioa (`game_service.py`)

```python
def end_month(game_id: str) -> dict:
    """
    Hilabetea amaitzeko sekuentzia (hiri bakoitzarentzat):
    
    1. ENERGIA SAREA eguneratu (BFS zentral elektrikoetatik)
    2. UR SAREA eguneratu (BFS ur-ponpetatik eta ur-hodietatik)
    3. ERREPIDE SARBIDEA eguneratu (BFS errepide/autobideetatik)
    4. ZONA GARAPEN BALDINTZAK egiaztatu eta garapena aplikatu
    5. ZONA ABANDONATZEA egiaztatu eta aplikatu
    6. RCI ESKARIA kalkulatu (SPECS.md § 3.2)
    7. BIZTANLE HAZKUNDEA kalkulatu (SPECS.md § 3.3)
    8. KRIMENA, KUTSADURA, LUR-BALIOA eguneratu (SPECS.md § 3.7)
    9. ZERBITZU ESTALDURA kalkulatu (SPECS.md § 3.6)
    10. ERAIKIN ZAHARTZEA egiaztatu, leherketa arriskua (SPECS.md § 3.8)
    11. DIRU SARRERAK / GASTUAK kalkulatu (SPECS.md § 1.6)
    12. ALTXORRA eguneratu
    13. METRIKAK eguneratu (EQ, HQ, krimena, kutsadura, lur-balioa, onarpena)
    14. PORROT EKONOMIKOA egiaztatu (SPECS.md § 3.10)
    15. AUSAZKO HONDAMENDIAK (aktibatuta badaude, probabilitate txikia)
    16. AA TXANDA exekutatu (AA zerbitzura HTTP deia)
    17. AA SIMULAZIOA kalkulatu (AA-ren hiriarentzat 1-14 urratsak)
    18. GARAIPENA BALDINTZAK egiaztatu (SPECS.md § 3.9)
    19. AUTO-GORDETZEA
    20. Egoera eguneratua itzuli
    """
```

### 3. Energia Sarea (`power_service.py`)

```python
def update_power_grid(city: dict) -> dict:
    """
    BFS algoritmoa energia hedatzeko:
    
    1. Hasierako nodoak: zentral elektriko aktibo guztiak
    2. Hedapen arauak:
       - Zona garatu batetik albokora automatikoki hedatzen da
       - Energia lerroak konexio gehigarriak sortzen dituzte
    3. Eskaera kalkulatu: zona garatu bakoitzak MW bat eskatzen du
       (maila 1=1MW, maila 2=2MW, maila 3=4MW)
       Zerbitzu eraikinak 2MW eskatzen dute
    4. Eskaintza > eskaera → guztiak energia izango dute
    5. Eskaintza < eskaera → urrutienetako zonak energia gabe
    6. Lauki bakoitzaren 'powered' eremua eguneratu
    
    Itzuli: total_capacity, total_demand, coverage_pct
    """
```

### 4. Ur Sarea (`water_service.py`)

```python
def update_water_system(city: dict) -> dict:
    """
    BFS algoritmoa ura hedatzeko (lurpeko geruzan):
    
    1. Hasierako nodoak: ur-ponpa aktibo guztiak
    2. Ur-hodien bidez hedatzen da soilik
    3. Ur-ponpa eraginkortasuna ur iturburuaren hurbiltasunaren araberakoa:
       - Ur ondoan (1-3 lauki) → ×2 eraginkortasuna
       - Urrun (>3 lauki) → ×0.5 eraginkortasuna
    4. Ur-presioa distantziarekin murrizten da
    5. Lauki bakoitzaren 'watered' eremua eguneratu
    
    Itzuli: total_supply, total_demand, coverage_pct
    """
```

### 5. RCI Eskaria eta Zona Garapena (`zone_service.py`)

```python
def calculate_rci_demand(city: dict) -> dict:
    """
    SPECS.md § 3.2 formulak inplementatu:
    
    R_demand = base(10) + lanpostu_diff × 0.3 + zerbitzu_bonus - zerga × 5 + ...
    C_demand = base(10) + biztanleria × 0.1 + eq × 0.2 + aireportu_bonus + ...
    I_demand = base(10) + biztanleria × 0.05 + portu_bonus + trenbide_bonus + ...
    
    Itzuli: {"r": number, "c": number, "i": number}
    """

def process_zone_development(city: dict) -> dict:
    """
    Zona bakoitzarentzat garapen baldintzak egiaztatu:
    
    Maila 0→1: Energia + errepide sarbidea (3 lauki barruan)
    Maila 1→2: + Ura + eskari positiboa (dagokion R/C/I)
    Maila 2→3: + Zerbitzu estaldura ona + krimena baxua + kutsadura baxua
               + lur-balio altua (zona trinkoa soilik)
    
    Itzuli: zones_developed, zones_abandoned
    """

def process_zone_abandonment(city: dict) -> dict:
    """
    Abandonatze baldintzak egiaztatu:
    
    - Energia falta → %30/hil probabilitatea
    - Krimena > 80 → %20/hil probabilitatea
    - Kutsadura > 80 (erresidentzialetan) → %15/hil probabilitatea
    - Zerga > %15 → %10/hil probabilitatea
    
    Probabilitateak ez dira pilatzen, altuena hartzen da.
    """
```

### 6. Aurrekontua eta Ekonomia (`budget_service.py`)

```python
def calculate_monthly_finances(city: dict) -> dict:
    """
    SPECS.md § 1.6 formulak zehatz inplementatu:
    
    DIRU-SARRERAK:
    - Erresidentzial zerga = populazioa × zerga_tasa × 0.01 × lur_balio_faktore
    - Komertzial zerga = zona_garatuak × zerga_tasa × 0.2 × lur_balio_faktore
    - Industrial zerga = zona_garatuak × zerga_tasa × 0.15 × lur_balio_faktore
    - Ordenantza diru-sarrerak
    
    GASTUAK:
    - Garraioa = (errepideak × 0.1 + trenbidea × 0.2) × finantzaketa%
    - Polizia = komisaldegiak × 2.5 × finantzaketa%
    - Suhiltzaileak = su-parkeak × 2.5 × finantzaketa%
    - Osasuna = ospitaleak × 3.0 × finantzaketa%
    - Hezkuntza = (eskolak × 1.5 + ikastetxeak × 5 + liburutegiak × 2.5 + museoak × 5) × finantzaketa%
    - Ordenantza kostuak
    - Bonu ordainketak
    
    Itzuli: monthly_income, monthly_expenses, balance
    """

def issue_bond(game_state: dict) -> dict:
    """
    Bonu logika:
    - Gehienez 10 bonu aktibo aldi berean
    - Bonu bakoitza §10.000 gehienez
    - %20 urteko interesa
    - 240 hilabeteko epea (20 urte)
    - Hileko ordainketa: amount × 1.20 / 240
    """
```

### 7. Kutsadura, Krimena eta Lur-balioa (`overlay_service.py`)

```python
def calculate_overlays(city: dict) -> dict:
    """
    SPECS.md § 3.7 formulak inplementatu:
    
    KUTSADURA:
    kutsadura(lauki) = sum(iturburua × distantzia_decay) + trafiko_kutsadura
                     - zuhaitz_murrizketa - ordenantza_modifikatzailea

    KRIMENA:
    krimena(lauki) = oinarri × biztanleria_dentsitatea
                   - polizia_estaldura - hezkuntza_bonus - enplegu_bonus
                   + joko_ordenantza_modifikatzailea

    LUR-BALIOA:
    lur_balioa(lauki) = oinarri + ur_hurbiltasuna(+20)
                      + zerbitzu_estaldura + eq_bonus
                      - kutsadura_penalizazioa - krimena_penalizazioa
                      - industria_hurbiltasun_penalizazioa

    Itzuli: 2D matrizeak balio bakoitzarentzat
    """
```

### 8. Hondamendiak (`disaster_service.py`)

```python
def trigger_disaster(game_state: dict, disaster_type: str, target: str,
                     source: str = "attack") -> dict:
    """
    1. Hondamendi mota konfigurazioa kargatu (erradioa, kaltea)
    2. Kokapena aukeratu (ausazkoa target hirian)
    3. Erradioan dauden laukiak kalkulatu
    4. Lauki bakoitzean kaltea aplikatu:
       - Eraikinak kaltetu/suntsitu (kalte gradua oinarrituta)
       - Zonak kaltetu/abandonatu
       - Azpiegiturak eten
    5. Suhiltzaileen estaldurak kaltea -%50 murrizten du
    6. Kaltea txostena sortu
    
    Itzuli: disaster, damage_report, affected_tiles
    """

def process_random_disasters(game_state: dict) -> list:
    """
    Hilabete bakoitzean (hondamendiak aktibatuta badaude):
    - %0.5 probabilitatea sutea gertatzeko
    - %0.2 probabilitatea uholdea (ur ondoko eremuetan)
    - Krimena > 80 → %1 matxinada probabilitatea
    - Zentral nuklear zaharrak (>540 hil) → istripu probabilitate txikia
    """
```

### 9. Garaipena Egiaztapena (`victory_service.py`)

```python
def check_victory(game_state: dict) -> dict:
    """
    SPECS.md § 3.9 inplementatu:
    
    1. Biztanleria >= 100.000 → garaipena (lehena iristen dena)
    2. Aurkariaren porrot ekonomikoa (12 hil jarraian bankruta)
    3. Jokalariaren porrot ekonomikoa → galera
    4. 1.200 hilabete (100 urte) → puntuazio garaipena
    5. Arkologia irteera (4. taldeko modulua soilik)
    
    Itzuli: {"status": "ongoing|victory|defeat", "winner": ..., "reason": ...}
    """
```

### 10. Eraikin Zahartzea (`city_service.py`)

```python
def process_building_aging(city: dict) -> list:
    """
    Zentral elektriko guztientzat (hydro eta wind izan ezik):
    - age_months += 1
    - 540 hilabete (45 urte) → alerta mezua
    - 600 hilabete (50 urte) → LEHERKETA
    - Nuklear leherketa → erradiazio zona (12 lauki erradioa, 120 hil iraupen)
    - Beste leherketa → sutea (3 lauki erradioa)
    
    Itzuli: alertak eta gertaerak zerrenda
    """
```

### 11. Trikimailu Kodeak (`cheat_service.py`)

```python
def apply_cheat(game_state: dict, cheat_code: str) -> dict:
    """
    SPECS.md § 2.3 eta SimHiri_praktika.md § 3.6 trikimailu kodeak:
    
    diru_asko       → altxorra §1.000.000-ra ezarri
    zona_guztiak    → zona guztiak 3. mailara garatu
    hondamendi_bat  → ausazko hondamendi bat abiarazi
    energia_mugagabea → energia eskaintza infinitua
    populazio_maximoa → populazioa +10.000 biztanle gehitu
    zerga_zero      → zerga tasa guztiak %0 ezarri
    arkologia_ireki → arkologia guztiak desblokeatu (4. taldea)
    eraiki_dena     → zerbitzu eraikin guztiak berehalakoan eraiki
    garaipena       → berehala irabazi
    porrota         → berehala galdu
    
    Kodea 'cheats_used' zerrendan erregistratu.
    Itzuli: success, message, changes, game_state
    """
```

---

## AUTENTIKAZIOA

### JWT

```python
# auth/jwt_handler.py
import jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
EXPIRATION_HOURS = 24

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(hours=EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
```

### Pasahitz Hashing

```python
# auth/password.py
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())
```

### Autentikazio Middleware-a

Babestutako endpoint bakoitzak:
1. Token-a atera `Authorization: Bearer <token>` goiburutik
2. Token-a egiaztatu `verify_token()` funtzioarekin
3. `user_id` atera payload-etik
4. user_id handler-ean injektatu

---

## AA ZERBITZU INTEGRAZIOA

Backend-ak AA zerbitzuarekin (edukiontzi independentea) HTTP bidez komunikatzen da:

```python
async def get_ai_decisions(game_state: dict) -> list[dict]:
    """
    1. AA-ren hiriari dagokion egoera prestatu
    2. AA zerbitzura deia: POST http://ai-service:5001/api/ai/turn
    3. Ekintza zerrenda JSON formatuan jaso
    4. Ekintza bakoitza jokoaren arauen arabera balidatu
    5. Ekintza baliogabeak alde batera utzi
    6. Ekintza baliozkoak ordenean exekutatu
    7. Ekintzak frontend bistaratzeko erregistratu
    
    Itzuli: ai_actions, reasoning, simulation_results
    """
```

---

## MONGODB EGITURA

### Bildumak

| Bilduma | Deskribapena |
|---------|-------------|
| `users` | Erabiltzaile kontuak |
| `games` | Partida egoera osoak (GameState dokumentu bakarra partida bakoitzeko) |
| `scenarios` | Eszenatoki aurredefinituak |

### Indizeak

```python
# db/database.py
db.users.create_index("username", unique=True)
db.users.create_index("email", unique=True)
db.games.create_index([("user_id", 1), ("last_saved", -1)])
```

---

## DATU ESTATIKOAK

### buildings.json
SPECS.md § 1.4-ko eraikin mota guztien definizioa JSON formatuan: kostua, tamaina, efektuak, teknologia urtea.

### ordinances.json
SPECS.md § 1.7-ko ordenantza guztien definizioa: kostua, efektuak.

### disasters.json
SPECS.md § 1.8-ko hondamendi konfigurazioak: erradioa, kaltea, hedapena.

### scenarios.json
Gutxienez 3 eszenatoki aurredefinitu:
- **Hiri Berria**: Lur laua, hasierako mapa erraza
- **Ibai Harana**: Ibai handi batekin, mapa ertaina
- **Uharte Multzoa**: Ur asko, eraikitzeko espazio mugatua

---

## DOCKER

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Flask-entzat:
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"]

# FastAPI-rentzat:
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
```

### requirements.txt (Flask)
```
flask>=3.0.0
flask-cors>=4.0.0
pymongo>=4.6.0
pyjwt>=2.8.0
bcrypt>=4.1.0
python-dotenv>=1.0.0
```

### requirements.txt (FastAPI)
```
fastapi>=0.104.0
uvicorn>=0.24.0
pymongo>=4.6.0
motor>=3.3.0
pyjwt>=2.8.0
bcrypt>=4.1.0
python-dotenv>=1.0.0
pydantic>=2.5.0
```

---

## GARAPEN ARAUAK

1. **Kontsultatu SPECS.md** edozein endpoint, eredu edo formula inplementatu aurretik
2. **Ez asmatu datuak** — SPECS.md § 1-eko ereduak eta § 3-ko formulak zehatz jarraitu
3. **Erroreen kudeaketa egokia**: HTTP errore kode zuzenak (400 balidazio, 401 autentikazio, 404 ez aurkitua, 500 zerbitzaria)
4. **CORS konfiguratu**: Frontend-aren jatorria baimendu
5. **Hileko tick sekuentzia**: Ordenean exekutatu (energia → ura → errepideak → zonak → ekonomia → metrikak → garaipena)
6. **AA integrazioa**: Timeout-arekin kudeatu (30s), huts egitean → AA txandarik gabe jarraitu
7. **Auto-gordetzea**: Hilabete bakoitzaren ondoren automatikoki gorde
8. **Ingurune-aldagaiak**: INOIZ ez hardkodeatu gakoak edo tokenak
9. **Balidazioa**: Sarrera guztiak balidatu erabiltzaile sarreraren mugan

---

## CHECKLIST — ENTREGATU AURRETIK

- [ ] Erabiltzaile erregistroa eta login-a funtzionatzen du JWT-arekin
- [ ] Partida sortzea eszenatokiarekin funtzionatzen du
- [ ] Zona jartzea balidazioarekin funtzionatzen du
- [ ] Eraikin eta azpiegitura jartzea funtzionatzen du
- [ ] Aurrekontua doitzeak hileko balantzea eguneratzen du
- [ ] Hileko tick simulazioa zuzen funtzionatzen du (energia, ura, RCI, hazkundea, ekonomia)
- [ ] Zona garapen baldintzak zuzen implementatuta daude
- [ ] Energia eta ur sare BFS algoritmoak funtzionatzen dute
- [ ] Hondamendi eraso sistema funtzionatzen du (cooldown, kostua, kaltea)
- [ ] Garaipena/porrota baldintzak egiaztatzen dira
- [ ] AA txanda exekutatzen da hilabete bakoitzean
- [ ] Datu gainjarriak (krimena, kutsadura, lur-balioa) zuzen kalkulatzen dira
- [ ] Trikimailu kodeak funtzionatzen dute
- [ ] Partidak gorde eta kargatu daitezke
- [ ] Taldeko modulu espezifikoa inplementatuta
- [ ] Dockerfile funtzionala Docker Compose-rekin
