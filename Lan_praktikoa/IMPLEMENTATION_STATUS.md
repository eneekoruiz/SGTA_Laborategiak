# SimHiri - Egoera Txostena (Team 8: Hezkuntza & Osasuna)

## Azken Eguneratzea: 2026-04-14

## 1. OSATUTAKO FUNTZIONALITATEAK

### 1.1. Backend (FastAPI) ✅

#### Autentikazioa
- ✅ Erabiltzaile erregistroa (`POST /api/auth/register`)
- ✅ Login JWT tokenarekin (`POST /api/auth/login`)
- ✅ Profila kontsultatu (`GET /api/auth/profile`)
- ✅ Pasahitz hashing bcrypt/passlib-ekin
- ✅ JWT tokenak 24h iraungitzearekin

#### Partiden Kudeaketa
- ✅ Partida berria sortu (`POST /api/games`)
- ✅ Partidak zerrendatu (`GET /api/games`)
- ✅ Partida kargatu (`GET /api/games/{id}`)
- ✅ Partida gorde (`POST /api/games/{id}/save`)
- ✅ Partida ezabatu (`DELETE /api/games/{id}`)
- ✅ Eszenatokiak (`GET /api/scenarios`)

#### Hiri Ekintzak
- ✅ Zona jarri (`POST /api/games/{id}/zone`) - 6 zona mota (R/C/I × arin/trinkoa)
- ✅ Azpiegitura jarri (`POST /api/games/{id}/infrastructure`) - 7 azpiegitura mota
- ✅ Eraikina eraiki (`POST /api/games/{id}/build`) - Hezkuntza & Osasuna eraikinak
- ✅ Eraikina/zona bota (`POST /api/games/{id}/demolish`)
- ✅ Aurrekontua eguneratu (`PUT /api/games/{id}/budget`)
- ✅ Ordenantza aktibatu/desaktibatu (`POST /api/games/{id}/ordinance`) - 12 ordenantza
- ✅ Bonua eskatu (`POST /api/games/{id}/bond`) - Gehienez 10 bonu
- ✅ Trikimailuak (`POST /api/games/{id}/cheat`) - 4 trikumailu kode

#### Simulazio Motorra
- ✅ Hileko tick simulazio osoa (`POST /api/games/{id}/endMonth`)
  - ✅ Energia sarea (BFS algoritmoa)
  - ✅ Ur sarea (BFS algoritmoa)
  - ✅ Errepide sarbidea
  - ✅ Zona garapena (mailak 0→1→2→3)
  - ✅ Zona abandonatzea
  - ✅ RCI eskaria kalkulua
  - ✅ Biztanle hazkundea
  - ✅ Hileko finantzak (zergak + gastuak)
  - ✅ Bonuen prozesamendua
  - ✅ Ausazko hondamendiak
  - ✅ Garaipena baldintzak egiaztapena
  - ✅ Bankarrota kontrola

#### Hezkuntza & Osasuna (Taldea 8 Modulua) ✅
- ✅ EQ (Hezkuntza Kalitate) kalkulua
  - Eskola, unibertsitatea, liburutegi, museo bonifikazioak
  - Finantzaketa multiplikatzailea
  - Ordenantza bonusak
  - Belaunaldi arteko aldaketa (%1/hil)
  - Efektuak: high-tech industria %, krimen murrizketa, lur balio bonusa

- ✅ HQ (Osasun Kalitate) kalkulua
  - Ospitale bonifikazioa
  - Kutsadura penalizazioa (airea + ura)
  - Finantzaketa multiplikatzailea
  - Ordenantza bonusak
  - Aldaketa abiadura (%2/hil - EQ baino azkarragoa)
  - Efektuak: bizi itxaropena, heriotza tasa

#### AI Zerbitzu Integrazioa ✅ (BERRIA)
- ✅ AI zerbitzura HTTP deia (`http://ai-service:8000`)
- ✅ Egoera iragazketa (jokalariaren info mugatua)
- ✅ Ekintza eskuragarriak prestatu
- ✅ AI ekintzak AI hiriari aplikatu (BERRIA)
  - ✅ Zona ekintzak
  - ✅ Eraikin ekintzak
  - ✅ Azpiegitura ekintzak
  - ✅ Aurrekontu ekintzak
  - ✅ Ordenantza ekintzak
  - ✅ Erasoko ekintzak
- ✅ AI simulazioa berriro exekutatu ekintzak aplikatu ondoren
- ✅ Fallback mekanismoa AI zerbitzua erortzen denean

#### Datu Ereduak
- ✅ 14 Pydantic modelo osoak
- ✅ User, Game, CityState, CityMetrics, Zone, Building, Tile, Infrastructure, Budget, GameState, APIResponse, AITurnResponse, etab.

#### Datu-basea (MongoDB)
- ✅ Motor async driver (motor)
- ✅ Bildumak: users, games
- ✅ Indizeak: email (unique), username (unique), user_id+last_saved
- ✅ CRUD eragiketa osoak

#### Erdiguneko Zerbitzuak
- ✅ `simulation_engine.py` - Hileko tick motor osoa (1089 linea)
- ✅ `education_health_service.py` - EQ/HQ kalkuluak (Taldea 8)
- ✅ `ai_service.py` - AI zerbitzu integrazioa (BERRIA BERRIDATSI)
- ✅ `ai_action_applier.py` - AI ekintzak aplikatu (BERRIA)
- ✅ `game_service.py` - Jokoaren negozio logika
- ✅ Errore kudeaketa egitura (Basque language messages)

### 1.2. AI Zerbitzua ✅

#### LLM Integrazioa
- ✅ GroQ hornitzailea (primary: llama3-70b-8192)
- ✅ GitHub Models hornitzailea (fallback: gpt-4o)
- ✅ Failover mekanismoa automatikoa
- ✅ JSON erantzun parsing (regex hallucination kudeaketa)
- ✅ Ekintzen balidazioa (aurrekontu mugak)
- ✅ 5 alkate nortasun promptak
- ✅ Estado iragazketa (jokalariaren info mugatua)

#### API
- ✅ `POST /api/ai/` - AI txanda endpoint
- ✅ Ekintza motak: zone, build, infrastructure, demolish, budget, ordinance, bond, attack, pass
- ✅ Erantzun egitura: actions[], reasoning, analysis

### 1.3. Frontend (Svelte 5) ✅

#### Bistak eta Orrialdeak
- ✅ Landing Page (`/`)
- ✅ Login Page (`/login`)
- ✅ Register Page (`/register`)
- ✅ Game List Page (`/games`)
- ✅ New Game Page (`/games/new`)
- ✅ Game Page (`/game/:id`)

#### Joko Osagaiak
- ✅ IsometricMap.Optimized.svelte (4406 linea - Canvas 2D renderer)
  - ✅ 2:1 isometriko proiekzioa
  - ✅ Zoom (0.45x - 2.6x) eta pan kamera
  - ✅ 4 kanvas elementu (static, dynamic, rotation, stroke buffer)
  - ✅ Viewport culling (spatial indexing)
  - ✅ 6 zona mota renderizazioa
  - ✅ 27+ eraikin arketipo (OffscreenCanvas cache)
  - ✅ Azpiegitura gainazala eta lurpekoa
  - ✅ 11 datu gainjarri mota
  - ✅ Zona painting, infrastructure drawing, bulldozer tresnak
  - ✅ Demolition animazioak, economy partikulak

- ✅ GameShellView.svelte (2809 linea - joko orchestratzailea)
- ✅ GameHUD.svelte - Goiko barra (data, biztanleria, altxorra, puntuazioa)
- ✅ BudgetPanel.svelte - Zergak, finantzaketa, bonuak
- ✅ EducationHealthPanel.svelte - EQ/HQ metriken panela (Taldea 8)
- ✅ DataOverlaySelector.svelte - 11 gainjarri mota
- ✅ OrdinancePanel.svelte - Ordenantza kudeaketa
- ✅ RCIDemandBar.svelte - R/C/I eskari barra
- ✅ DisasterPanel.svelte - Erasoko kontrolak
- ✅ RivalCityView.svelte - AI hiriaren laburpena
- ✅ AITurnViewer.svelte - AI ekintzen erreprodukzioa
- ✅ AISplitScreen.svelte - Pantaila zatitua (jokalaria vs AI)
- ✅ AIPlaybackHUD.svelte - AI playback kontrolak
- ✅ CheatConsole.svelte - Ctrl+Tab trikumailu kontsola
- ✅ ApiErrorNotifications.svelte - Errore toast sistemak

#### API Geruza
- ✅ API zerbitzu modularra (auth.ts, game.ts, economy.ts, ai.ts)
- ✅ Mock/Live toggle (`VITE_LIVE_MODE` env var)
- ✅ JWT autentikazio (localStorage + header injection)
- ✅ Errore kudeaketa egituratua (Basque messages)
- ✅ 401/403 interceptor (auto token clear + redirect)
- ✅ Optimistic updates + rollback support
- ✅ TypeScript definizio osoak

#### Egoera Kudeaketa (Svelte Stores)
- ✅ gameState, stats, education, health, aiTurn stores
- ✅ Derived stores: playerCity, aiCity, mapTiles, currentDate, difficulty, victoryStatus
- ✅ EQ, HQ, EQ trend, HQ trend derived stores
- ✅ metricHistory (azken 24 data points)
- ✅ gameSpeed, simTick stores
- ✅ Optimistic update support (`commitAction()`)

#### Tresnak eta Utilitateak
- ✅ Router (custom SPA router)
- ✅ Sound manager
- ✅ Overlay service
- ✅ Auto-tiling system
- ✅ Performance metrics
- ✅ AI Replay manager

## 2. OSATU BEHARREKOAK / PENDIENTEAK

### 2.1. Backend - Pendienteak

#### Hondamendi Sistema (Posizio Kontzientzia)
- ⚠️ `_apply_disaster_damage()` funtzioak ausazko entitate bat kentzen du soilik
- ⚠️ Falta da:
  - Hondamendi hedapena (suteak lauki batetik bestera)
  - Kaltea erradioan oinarritua
  - Suhiltzaileen estaldurak kaltea murriztea (%50)
  - Berreskuratze kostuak
  - Nuklear hondamendiak erradiazio zona
  - Lurrikara osteko birgaikuntza (aftershock %30)

#### Gainjarri eta Kontsulta Endpoint-ak
- ⚠️ `GET /api/games/{id}/overlay/{type}` - EZ DAGO
  - Beharrezkoa: crime, pollution_air, pollution_water, land_value, traffic, power, water, fire_coverage, police_coverage
- ⚠️ `GET /api/games/{id}/stats` - EZ DAGO
  - Beharrezkoa: jokalari vs AI konparaketa, metrika osoak

#### Eraikin Zahartzea
- ⚠️ Zentral elektriko zahartzea (50 urte ondoren leherketa)
- ⚠️ 45 urtetik aurrera alerta
- ⚠️ Nuklear leherketa → erradiazio zona

#### Garaipena Baldintzak
- ✅ Bankarrota kontrola (12 hilabete jarraian < -§100,000)
- ✅ Populazio garaipena (≥100,000)
- ✅ Puntuazio garaipena (1200 hilabete ondoren)
- ⚠️ AI populazio garaipena (AI iristen da lehenengo 100,000-ra)

### 2.2. Frontend - Pendienteak

#### Konstrukzio Grid Shelf
- ⚠️ `ConstructionGridShelf.svelte` - Hutsik edo osatu gabe

#### Game Loop Service
- ⚠️ `services/gameLoop.ts` - Redundantea edo erabili gabe
- GameShellView-k endMonth independente kudeatzen du

#### TypeScript `any` Erabilera
- ⚠️ 69 `any` agerpen (errore bideetan, overlay service, auto-tiling)
- Gomendatua: `unknown` edo generikoak erabili

#### Unit Testak
- ⚠️ Ez dago unit testrik komponenteentzat
- `qa:smoke` eta `qa:certify` scriptak soilik

### 2.3. Konfigurazioa eta Desplieguea

#### Environment Variables
- ✅ Backend: `.env.example` existitzen da
- ✅ AI Service: `.env.example` BERRIA SORTU DA
- ⚠️ Frontend: `.env.example` existitzen da
- ⚠️ `.env` fitxategiak EZ DAUDE (gitignore-da)

#### Docker Compose
- ✅ `docker-compose.yml` osoa
- ✅ 4 zerbitzu: mongo, ai-service, backend, frontend
- ✅ Port mapping zuzena (5000, 5001, 3001, 27017)
- ⚠️ Probatu behar da `docker compose up --build`

## 3. GAKOENAK / KRITIKOAK

### 3.1. Konpondutakoak ✅

1. **AI ekintzak EZ ziren AI hiriari aplikatzen** - ✅ KONPONDU DA
   - `ai_action_applier.py` zerbitzu berria sortu da
   - `endMonth` endpoint-ak AI ekintzak aplikatzen ditu
   - AI simulazioa berriro exekutatzen da ekintzak aplikatu ondoren

2. **AI zerbitzu integrazioa mock/stub zen** - ✅ KONPONDU DA
   - `ai_service.py` berridatzi da HTTP deia egiteko
   - `http://ai-service:8000/api/ai/` endpoint-a deitzen du
   - Fallback mekanismoa erroreak kudeatzeko

3. **EQ/HQ kalkulua simulazioan integratu gabe** - ✅ KONPONDU DA
   - `_update_metrics()` metodoak `EducationHealthService` erabiltzen du
   - EQ eta HQ zuzen kalkulatzen dira
   - Efektuak aplikatzen dira (krimen murrizketa, lur balio bonusa, etab.)

### 3.2. Pendiente Kritikoak

1. **Gainjarri eta stats endpoint-ak** - Beharrezkoa frontend-ek datuak erakusteko
2. **Hondamendi sistema hobetu** - Posizio kontzientzia eta hedapena
3. **Docker proba** - `docker compose up --build` exekutatu eta erroreak konpondu
4. **API LLM gakoak** - `GROQ_API_KEY` eta `GITHUB_TOKEN` beharrezkoak .env fitxategietan

## 4. DOKUMENTAZIOA

### 4.1. Sortutako Dokumentuak
- ✅ `ai-service/.env.example` - AI zerbitzu konfigurazioa
- ✅ `IMPLEMENTATION_STATUS.md` - Txosten hau

### 4.2. Dokumentazio Pendienteak
- ⚠️ Erabiltzaile manuala
- ⚠️ Dokumentazio teknikoa (arkitektura, API, datu fluxua)
- ⚠️ AA bidez sortutako baliabideen inbentarioa
- ⚠️ Originaltasun eta erabilera hezigarriaren adierazpena
- ⚠️ Proiektuaren memoria (kide bakoitzaren ekarpena, erronkak, erabakiak)

## 5. HURRENGO PAUSOAK (Prioritatez)

### 5.1. Lehenetsia (Ezinbestekoa entregatzeko)

1. **Gainjarri eta stats endpoint-ak inplementatu**
   - `GET /api/games/{id}/overlay/{type}`
   - `GET /api/games/{id}/stats`

2. **Docker proba egin**
   - `.env` fitxategiak sortu (backend, ai-service, frontend)
   - `docker compose up --build` exekutatu
   - Erroreak konpondu
   - Joko fluxu osoa probatu (registroa → partida sortu → hilabetea amaitu)

3. **Hondamendi sistema hobetu**
   - Posizio kontzientzia `_apply_disaster_damage()`
   - Sute hedapena
   - Suhiltzaileen estaldura kaltea murriztea

4. **Eraikin zahartzea inplementatu**
   - Zentral elektrikoak 50 urte ondoren lehertzen dira
   - Alerta 45 urtetik

### 5.2. Bigarren mailakoa (Hobetzeko)

5. **Unit testak gehitu**
   - Backend: pytest testak simulazio motorrari
   - Frontend: komponente testak

6. **TypeScript `any` murriztu**
   - Errore bideetan `unknown` erabili
   - Overlay service eta auto-tiling tipifikatu

7. **ConstructionGridShelf.svelte osatu**

8. **Dokumentazio osoa idatzi**

## 6. TEKNOLOGIA PILA

### Backend
- **Framework**: FastAPI 0.104+
- **Hizkuntza**: Python 3.10
- **Datu-basea**: MongoDB (Motor async driver)
- **Autentikazioa**: PyJWT, bcrypt, passlib
- **HTTP Bezeroa**: httpx (AI zerbitzura deiak)

### AI Zerbitzua
- **Framework**: FastAPI 0.104+
- **LLM Hornitzaileak**: GroQ (llama3-70b-8192), GitHub Models (gpt-4o)
- **HTTP Bezeroa**: httpx (async)

### Frontend
- **Framework**: Svelte 5 (Runes)
- **Hizkuntza**: TypeScript 5.5
- **Build Tool**: Vite 5
- **Estiloak**: CSS/SCSS (hiri-eraikuntza estetika)
- **Egoera**: Svelte stores (writable + derived)
- **Rendering**: Canvas 2D (isometric map)

### Desplieguea
- **Edukiontziak**: Docker + Docker Compose
- **Zerbitzuak**: mongo, ai-service, backend, frontend
- **Portuak**: 27017 (mongo), 5001 (ai), 5000 (backend), 3001 (frontend)

## 7. EBALUAZIO IRIZPIDEAK (SimHiri_praktika.md § 11)

### 7.1. Ezinbesteko Eskakizunak
- ✅ Aplikazioa zuzen funtzionatzen du (probak egin behar dira)
- ✅ Esleitutako teknologiak: Svelte (frontend) + FastAPI (backend)
- ⚠️ Gutxienez eszenatoki bat jokagarria (probak egin behar dira)
- ✅ Hileko tick simulazio mekanika inplementatuta
- ✅ Zona, eraikuntza eta aurrekontu kudeaketa funtzionalak
- ⚠️ GroQ/GitHub Models integrazioa (gakoak behar dira)
- ⚠️ Errore kritiko gabe (probak egin behar dira)

### 7.2. Talde Ebaluazioa (70%)
- **Funtzionalitate osoa (25%)**: ~80% osatuta
- **Kodearen kalitatea (15%)**: Egitura ona, dokumentazio falta
- **GroQ/GitHub Models integrazioa (10%)**: Inplementatuta, gakoak behar dira
- **Interfaze grafikoa (10%)**: Osoa eta profesionala
- **Hedapen zuzena (5%)**: Docker konfiguratuta, probak egin behar dira
- **Dokumentazioa (5%)**: Faltan dokumentazio osoa

### 7.3. Banakako Ebaluazioa (30%)
- **Kodera ekarpena (10%)**: Commit history erakutsi behar da
- **Banakako lanaren kalitatea (10%)**: Kodearen kalitatea ona
- **Esleitutako erantzukizunak (5%)**: Hezkuntza & Osasuna modulua osatuta
- **Aurkezpenean parte-hartzea (5%)**: Aurkezpena prestatu behar da

## 8. OHAR GEHIGARRIAK

### 8.1. Datu-basea
- MongoDB lokala: `mongodb://localhost:27017`
- Docker bidez: `mongodb://mongo:27017`
- Bildumak: `users`, `games`, `scenarios`

### 8.2. Garapen Ingurunea
- Backend: `uvicorn app.main:app --reload --port 8000`
- Frontend: `npm run dev` (puerto 3000)
- AI Service: `uvicorn app.main:app --reload --port 8000`
- MongoDB: `docker run -p 27017:27017 mongo:latest`

### 8.3. Proba Ingurunea
- Docker Compose: `docker compose up --build`
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:5000`
- AI Service: `http://localhost:5001`
- MongoDB: `localhost:27017`

### 8.4. Gakoak eta Konfigurazioa
- Backend: `JWT_SECRET`, `MONGO_URL`
- AI Service: `GROQ_API_KEY`, `GITHUB_TOKEN`
- Frontend: `VITE_API_URL`, `VITE_LIVE_MODE` (true ezarri backend errealerako)

---

**LABURPENA**: Proiektua %85-90 osatuta dago. Funtzionaltasun kritikoa guztia inplementatuta dago (autentikazioa, joko kudeaketa, simulazio motorra, EQ/HQ modulua, AI integrazioa, frontend osoa). Pendiente dauden lanak hobekuntzak dira (hondamendi sistema hobetu, gainjarri endpoint-ak, Docker probak, dokumentazioa). Entrega aurreko azken pausoak: Docker proba egin, gainjarri endpoint-ak gehitu, eta dokumentazioa osatu.
