# SPECS.md — SimHiri: Zehaztapen Tekniko Osoa (SDD)

> **Fitxategi hau proiektuaren egia-iturri teknikoa da.** Datu eredu, API endpoint, joko-arau, frontend osagai, LLM integrazio, taldeko modulu, Docker hedapen eta onarpen irizpide guztiak hemen definitzen dira. Edozein zalantza kasuan, dokumentu honek lehentasuna du.

---

## AURKIBIDEA

1. [Datu Ereduak](#1-datu-ereduak)
2. [API REST — Endpoint-ak](#2-api-rest--endpoint-ak)
3. [Jokoaren Arauak](#3-jokoaren-arauak)
4. [Frontend Osagaiak](#4-frontend-osagaiak)
5. [LLM Integrazioa](#5-llm-integrazioa)
6. [Taldeko Modulu Espezifikoak](#6-taldeko-modulu-espezifikoak)
7. [Docker eta Hedapena](#7-docker-eta-hedapena)
8. [Onarpen Irizpide Globalak](#8-onarpen-irizpide-globalak)

---

## 1. DATU EREDUAK

### 1.1. Erabiltzailea (User)

```json
{
  "_id": "ObjectId",
  "username": "string (3-30 karaktere, bakarra)",
  "email": "string (email formatua, bakarra)",
  "password_hash": "string (bcrypt hash)",
  "created_at": "datetime (UTC)",
  "last_login": "datetime (UTC)",
  "games_count": "number (>= 0)"
}
```

**Balidazio arauak:**
- `username`: 3-30 karaktere, alfanumerikoak eta `_` soilik
- `email`: RFC 5322 formatua, bakarra sisteman
- `password`: Gutxienez 8 karaktere, letra eta zenbaki bat gutxienez

**Indizeak:**
- `username`: unique
- `email`: unique

---

### 1.2. Laukia (Tile)

```json
{
  "x": "number (0 - map_width-1)",
  "y": "number (0 - map_height-1)",
  "elevation": "number (0-31)",
  "terrain_type": "string enum",
  "zone": "Zone | null",
  "building": "Building | null",
  "infrastructure": ["string enum"],
  "tree": "boolean",
  "powered": "boolean",
  "watered": "boolean",
  "road_access": "boolean",
  "pollution_air": "number (0-255)",
  "pollution_water": "number (0-255)",
  "crime": "number (0-255)",
  "land_value": "number (0-255)"
}
```

**`terrain_type` balioak:**

| Balioa | Deskribapena |
|--------|-------------|
| `grass` | Belardia |
| `water` | Ura (itsasoa, ibaia, lakua) |
| `forest` | Basoa / zuhaitzak |
| `rock` | Harkaitza |
| `sand` | Harea |

---

### 1.3. Zona (Zone)

```json
{
  "id": "string (UUID)",
  "type": "string enum",
  "position": {"x": "number", "y": "number"},
  "size": {"w": "number (1-6)", "h": "number (1-6)"},
  "development_level": "number (0-3)",
  "powered": "boolean",
  "watered": "boolean",
  "road_access": "boolean",
  "abandoned": "boolean",
  "population": "number (zona mota eta garapen mailaren araberakoa)",
  "built_year": "number",
  "built_month": "number"
}
```

**`type` balioak:**

| Balioa | Deskribapena | Kostua/lauki | Garapen maximoa |
|--------|-------------|-------------|----------------|
| `residential_light` | Erresidentzial arina | §5 | 2x2 (etxeak) |
| `residential_dense` | Erresidentzial trinkoa | §10 | 3x3 (apartamentuak) |
| `commercial_light` | Komertziala arina | §5 | 2x2 (denda txikiak) |
| `commercial_dense` | Komertziala trinkoa | §10 | 3x3 (bulego dorreak) |
| `industrial_light` | Industriala arina | §5 | 2x2 (lantegi txikiak) |
| `industrial_dense` | Industriala trinkoa | §10 | 3x3 (lantegi handiak) |

**Garapen baldintzak:**

| Maila | Baldintza |
|-------|-----------|
| 0 | Jada zonduta baina garatu gabea |
| 1 | Energia + errepide sarbidea (~3 lauki) |
| 2 | Maila 1 + ura + eskari positiboa |
| 3 | Maila 2 + zerbitzu estaldura ona + krimena baxua + kutsadura baxua + lur-balio altua (trinkoa soilik) |

---

### 1.4. Eraikina (Building)

```json
{
  "id": "string (UUID)",
  "type": "string enum",
  "position": {"x": "number", "y": "number"},
  "size": {"w": "number", "h": "number"},
  "built_year": "number",
  "built_month": "number",
  "age_months": "number",
  "powered": "boolean",
  "funding_pct": "number (0-120, zerbitzu eraikinei soilik)",
  "active": "boolean"
}
```

**`type` balioak — Zentral Elektrikoak:**

| Balioa | Kostua | Potentzia (MW) | Kutsadura | Eskuragarri | Iraupena | Tamaina |
|--------|--------|----------------|-----------|-------------|----------|---------|
| `coal_power` | §4.000 | 200 | 150 | 1900 | 600 hilabete | 4x4 |
| `hydro_power` | §400/lauki | 20 | 0 | 1900 | ∞ | 1x1 |
| `oil_power` | §6.500 | 220 | 120 | 1900 | 600 hilabete | 4x4 |
| `gas_power` | §2.000 | 50 | 30 | 1950 | 600 hilabete | 4x4 |
| `nuclear_power` | §15.000 | 500 | 0* | 1955 | 600 hilabete | 4x4 |
| `wind_power` | §100 | 4 | 0 | 1980 | ∞ | 1x1 |
| `solar_power` | §1.300 | 50 | 0 | 1990 | 600 hilabete | 4x4 |
| `microwave_power` | §28.000 | 1.600 | 0 | 2020 | 600 hilabete | 4x4 |
| `fusion_power` | §40.000 | 2.500 | 0 | 2050 | 600 hilabete | 4x4 |

*Nuklear zentralak erradiazio kutsadura sor dezakete hondamendi kasuan.

**`type` balioak — Hiri Zerbitzuak:**

| Balioa | Kostua | Estaldura (laukiak) | Efektua |
|--------|--------|---------------------|---------|
| `police_station` | §500 | 18 | Krimena murrizten du |
| `fire_station` | §500 | 18 | Sute arriskua murrizten du |
| `hospital` | §500 | hiri osoa | HQ hobetzen du |
| `prison` | §3.000 | hiri osoa | Krimena murrizten du |

**`type` balioak — Hezkuntza:**

| Balioa | Kostua | Efektua |
|--------|--------|---------|
| `school` | §250 | EQ +5 (finantzaketa osoarekin) |
| `college` | §1.000 | EQ +10 |
| `library` | §500 | EQ +3 |
| `museum` | §1.000 | EQ +4 |

**`type` balioak — Garraio Azpiegiturak:**

| Balioa | Kostua | Efektua |
|--------|--------|---------|
| `bus_depot` | §250 | Trafiko murrizten du |
| `rail_station` | §500 | Trafiko murrizten du, R eskaria igotzen du |
| `subway_station` | §500 | Trafiko asko murrizten du |
| `airport` | §10.000 | C eskaria asko igotzen du (6x6) |
| `seaport` | §5.000 | I eskaria igotzen du (4x4) |

**`type` balioak — Ur Sistema:**

| Balioa | Kostua | Funtzioa |
|--------|--------|---------|
| `water_pump` | §100 | Ura ponpatzen du (~20 gal/hil ur iturburutik hurbil) |
| `water_treatment` | §500 | Ur kutsadura murrizten du |

---

### 1.5. Azpiegitura (Infrastructure)

```json
{
  "type": "string enum",
  "segments": [
    {"from": {"x": "number", "y": "number"}, "to": {"x": "number", "y": "number"}}
  ]
}
```

**`type` balioak:**

| Balioa | Kostua/lauki | Geruza | Deskribapena |
|--------|-------------|--------|-------------|
| `road` | §10 | gainazala | Oinarrizko garraioa |
| `highway` | §25 | gainazala | Ahalmen handiko garraioa |
| `highway_ramp` | §25 | gainazala | Autobidea errepidearekin konektatu |
| `power_line` | §2 | gainazala | Elektrizitate transmisioa |
| `rail` | §3 | gainazala | Trenbidea |
| `water_pipe` | §1 | lurpekoa | Ur banatzea |
| `subway_tunnel` | §5 | lurpekoa | Metro tunela |

---

### 1.6. Aurrekontua (Budget)

```json
{
  "tax_rates": {
    "residential": "number (0-20, lehenetsia 7)",
    "commercial": "number (0-20, lehenetsia 7)",
    "industrial": "number (0-20, lehenetsia 7)"
  },
  "funding": {
    "transportation": "number (0-120, lehenetsia 100)",
    "police": "number (0-120, lehenetsia 100)",
    "fire": "number (0-120, lehenetsia 100)",
    "health": "number (0-120, lehenetsia 100)",
    "education": "number (0-120, lehenetsia 100)"
  },
  "bonds": [
    {
      "id": "string",
      "amount": "number",
      "interest_rate": "number (20)",
      "months_remaining": "number",
      "monthly_payment": "number"
    }
  ],
  "last_year_income": "number",
  "last_year_expenses": "number",
  "monthly_income": "number",
  "monthly_expenses": "number"
}
```

**Zerga formulak:**
```
monthly_residential_tax = residential_population * residential_tax_rate * 0.01 * land_value_factor
monthly_commercial_tax  = commercial_zones_developed * commercial_tax_rate * 0.2 * land_value_factor
monthly_industrial_tax  = industrial_zones_developed * industrial_tax_rate * 0.15 * land_value_factor
total_monthly_income    = sum(taxes) + ordinance_income + neighbor_income
```

**Gastu formulak:**
```
monthly_transport_cost = (road_count * 0.1 + rail_count * 0.2) * (funding.transportation / 100)
monthly_police_cost    = police_stations * 2.5 * (funding.police / 100)
monthly_fire_cost      = fire_stations * 2.5 * (funding.fire / 100)
monthly_health_cost    = hospitals * 3.0 * (funding.health / 100)
monthly_education_cost = (schools * 1.5 + colleges * 5 + libraries * 2.5 + museums * 5) * (funding.education / 100)
monthly_ordinance_cost = sum(active_ordinance_costs) / 12
monthly_bond_payment   = sum(bond.monthly_payment for bond in bonds)
total_monthly_expenses = sum(all_costs)
```

---

### 1.7. Ordenantza (Ordinance)

```json
{
  "id": "string enum",
  "name": "string",
  "annual_cost": "number (negatiboak diru-sarrerak)",
  "active": "boolean",
  "effects": {
    "crime_modifier": "number (-1.0 ... 1.0)",
    "pollution_modifier": "number (-1.0 ... 1.0)",
    "health_modifier": "number (-1.0 ... 1.0)",
    "education_modifier": "number (-1.0 ... 1.0)",
    "commercial_demand_modifier": "number (-1.0 ... 1.0)",
    "residential_demand_modifier": "number (-1.0 ... 1.0)",
    "industrial_demand_modifier": "number (-1.0 ... 1.0)"
  }
}
```

**Oinarrizko ordenantzak (gutxienez 10):**

| id | Izena (EU) | Urteko kostua | Efektu nagusia |
|-----|-----------|---------------|---------------|
| `sales_tax` | Salmenta zerga | -§200 (diru-sarrera) | C eskaria -%5 |
| `income_tax` | Errenta zerga | -§200 (diru-sarrera) | R eskaria -%5 |
| `legalized_gambling` | Jokoa legalizatua | -§150 (diru-sarrera) | Krimena +%10 |
| `parking_fines` | Aparkatzeko isuna | -§50 (diru-sarrera) | — |
| `free_clinics` | Klinika doakoak | §50 | Osasuna +%5 |
| `junior_sports` | Gazte kirolak | §50 | Krimena -%5 |
| `pro_reading` | Irakurketa sustatzea | §50 | Hezkuntza +%5 |
| `anti_drug` | Drogen aurkako kanpaina | §50 | Krimena -%5 |
| `pollution_controls` | Kutsadura kontrolak | §50 | Kutsadura -%15, I eskaria -%5 |
| `tourist_promotion` | Turismo sustatzea | §100 | C eskaria +%10 |
| `nuclear_free` | Gune nuklearik gabea | §0 | Nuklear zentralak debekatuta |
| `neighborhood_watch` | Auzo zaintza | §25 | Krimena -%3 |

---

### 1.8. Hondamendia (Disaster)

```json
{
  "id": "string (UUID)",
  "type": "string enum",
  "position": {"x": "number", "y": "number"},
  "radius": "number",
  "damage_level": "number (0-100)",
  "game_date": {"year": "number", "month": "number"},
  "source": "string enum (random | cheat | attack)",
  "target_city": "string enum (player | ai)"
}
```

**`type` balioak:**

| Balioa | Kalte erradioa | Kalte mailak | Eraso kostua | Deskribapena |
|--------|----------------|-------------|-------------|-------------|
| `fire` | 3-8 lauki | 30-60 | §5.000 | Lauki batetik bestera hedatzen da |
| `flood` | 5-15 lauki | 20-50 | §10.000 | Altuera baxuko eremuak kaltetu |
| `tornado` | 2x20 lauki | 70-90 | §20.000 | Ibilbide lerro batean suntsitzen du |
| `earthquake` | 10-30 lauki | 40-80 | §50.000 | Eremu zabalean kaltetzen du |
| `riot` | 5-10 lauki | 20-40 | — (ez dago eraso gisa) | Krimena altuak sortua |
| `nuclear_meltdown` | 8-15 lauki | 90-100 | — (ez dago eraso gisa) | Nuklear zentral zaharretik |
| `monster` | ibilbidea | 60-80 | — (ez dago eraso gisa) | Munstroa hiritik zehar |

---

### 1.9. Hiri Egoera (CityState)

```json
{
  "name": "string",
  "owner": "string enum (player | ai)",
  "population": "number",
  "treasury": "number",
  "months_bankrupt": "number (0-12, 12 = game over)",
  "zones": ["Zone"],
  "buildings": ["Building"],
  "infrastructure": {
    "roads": ["InfraSegment"],
    "highways": ["InfraSegment"],
    "power_lines": ["InfraSegment"],
    "rail": ["InfraSegment"],
    "water_pipes": ["InfraSegment"],
    "subway": ["InfraSegment"]
  },
  "budget": "Budget",
  "ordinances": ["string (ordinance_id)"],
  "metrics": {
    "eq": "number (0-200)",
    "hq": "number (0-200)",
    "crime_rate": "number (0-100)",
    "pollution_air": "number (0-100)",
    "pollution_water": "number (0-100)",
    "land_value_avg": "number (0-255)",
    "approval": "number (0-100)",
    "unemployment": "number (0-100)",
    "traffic_avg": "number (0-100)",
    "rci_demand": {"r": "number (-200..200)", "c": "number (-200..200)", "i": "number (-200..200)"},
    "composite_score": "number"
  },
  "power_grid": {
    "total_capacity_mw": "number",
    "total_demand_mw": "number",
    "coverage_pct": "number (0-100)"
  },
  "water_system": {
    "total_capacity": "number",
    "total_demand": "number",
    "coverage_pct": "number (0-100)"
  }
}
```

**Puntuazio konposatua:**
```
composite_score = population * 0.4
              + eq * 50 * 0.15
              + hq * 50 * 0.15
              + land_value_avg * 40 * 0.15
              + (100 - crime_rate) * 100 * 0.10
              + (100 - pollution_air) * 50 * 0.05
```

---

### 1.10. Joko Egoera (GameState)

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "name": "string",
  "scenario_id": "string",
  "created_at": "datetime",
  "last_saved": "datetime",
  "is_autosave": "boolean",
  "current_date": {"year": "number", "month": "number (1-12)"},
  "current_player": "string enum (player | ai)",
  "difficulty": "string enum (easy | medium | hard)",
  "disasters_enabled": "boolean",
  "player_city": "CityState",
  "ai_city": "CityState",
  "ai_personality": "string enum (expansionist | ecologist | industrialist | balanced | tax_collector)",
  "map": {
    "size": {"width": "number", "height": "number"},
    "tiles": [["Tile"]],
    "water_level": "number"
  },
  "disaster_attacks": {
    "player_attacks_used": "number",
    "ai_attacks_used": "number",
    "last_player_attack_date": {"year": "number", "month": "number"} | null,
    "last_ai_attack_date": {"year": "number", "month": "number"} | null
  },
  "cheats_used": ["string"],
  "victory_status": "string enum (ongoing | player_population | player_score | player_rival_bankrupt | ai_population | ai_score | player_bankrupt | player_arkology_exodus)",
  "ai_context": {
    "conversation_history": ["object"],
    "strategy_notes": "string"
  }
}
```

---

### 1.11. Eszenatokia (Scenario)

```json
{
  "_id": "ObjectId",
  "name": "string",
  "description": "string",
  "difficulty_options": ["easy", "medium", "hard"],
  "starting_year": "number",
  "starting_funds": {"easy": "number", "medium": "number", "hard": "number"},
  "map_size": {"width": "number", "height": "number"},
  "terrain_seed": "number | null",
  "terrain_preset": {
    "heightmap": [[number]],
    "water_level": "number",
    "trees": [{"x": "number", "y": "number"}]
  },
  "player_start_area": {"x": "number", "y": "number", "radius": "number"},
  "ai_start_area": {"x": "number", "y": "number", "radius": "number"},
  "special_features": ["string"]
}
```

---

## 2. API REST — ENDPOINT-AK

### 2.1. Autentikazioa

#### POST /api/auth/register

**Eskaera:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Erantzuna (201):**
```json
{
  "message": "Erabiltzailea zuzen sortu da",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string"
  }
}
```

**Errorea (400):**
```json
{
  "error": "Erabiltzaile-izena dagoeneko existitzen da"
}
```

**Onarpen irizpideak:**
- [ ] 3-30 karaktereko erabiltzaile-izenak soilik onartzen dira
- [ ] Email formatua balidatzen da
- [ ] Pasahitzak gutxienez 8 karaktere izan behar ditu
- [ ] Pasahitza bcrypt bidez hash egiten da
- [ ] Erabiltzaile-izena eta emaila bakarrak dira

---

#### POST /api/auth/login

**Eskaera:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Erantzuna (200):**
```json
{
  "token": "string (JWT)",
  "user": {
    "id": "string",
    "username": "string"
  }
}
```

**Onarpen irizpideak:**
- [ ] JWT token-a itzultzen da autentikazio zuzenean
- [ ] Token-ak iraungitze data du (24h gomendatua)
- [ ] Kredentziala okerra → 401

---

#### GET /api/auth/profile

**Goiburuak:** `Authorization: Bearer <JWT>`

**Erantzuna (200):**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "created_at": "string",
  "games_count": "number"
}
```

---

### 2.2. Partiden Kudeaketa

#### GET /api/games

**Goiburuak:** `Authorization: Bearer <JWT>`

**Erantzuna (200):**
```json
{
  "games": [
    {
      "id": "string",
      "name": "string",
      "scenario_id": "string",
      "current_date": {"year": "number", "month": "number"},
      "player_city_name": "string",
      "player_population": "number",
      "ai_city_name": "string",
      "ai_population": "number",
      "victory_status": "string",
      "last_saved": "string",
      "is_autosave": "boolean"
    }
  ]
}
```

---

#### POST /api/games

**Eskaera:**
```json
{
  "name": "string",
  "scenario_id": "string",
  "difficulty": "string enum (easy | medium | hard)",
  "player_city_name": "string",
  "ai_personality": "string enum",
  "disasters_enabled": "boolean"
}
```

**Erantzuna (201):**
```json
{
  "game_id": "string",
  "game_state": "GameState (hasierako egoera osoa)"
}
```

**Onarpen irizpideak:**
- [ ] Eszenatokia existitu behar du
- [ ] Zailtasun mailak hasierako dirua definitzen du
- [ ] Mapa lurralde presetak kargatzen dira
- [ ] Jokalari eta AA hiriak hasierako kokapenetan jartzen dira
- [ ] Auto-gordetzea aktibatzen da

---

#### GET /api/games/{gameId}

**Erantzuna (200):**
```json
{
  "game_state": "GameState (egoera osoa)"
}
```

---

#### POST /api/games/{gameId}/save

**Eskaera:**
```json
{
  "name": "string (aukerakoa, auto-gordetzeetarako null)"
}
```

**Erantzuna (200):**
```json
{
  "message": "Partida zuzen gorde da",
  "saved_at": "string"
}
```

---

#### GET /api/scenarios

**Erantzuna (200):**
```json
{
  "scenarios": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "difficulty_options": ["string"],
      "map_size": {"width": "number", "height": "number"}
    }
  ]
}
```

---

### 2.3. Jokoko Ekintzak

#### POST /api/games/{gameId}/zone

**Eskaera:**
```json
{
  "zone_type": "string enum",
  "position": {"x": "number", "y": "number"},
  "size": {"w": "number (1-6)", "h": "number (1-6)"}
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "cost": "number",
  "zone": "Zone",
  "treasury_after": "number"
}
```

**Errorea (400):**
```json
{
  "error": "Ez dago nahikoa diru" | "Kokapena okupatuta dago" | "Lurra ez da laua"
}
```

**Onarpen irizpideak:**
- [ ] Zonak lur lau gainean soilik jar daitezke
- [ ] Zonak ezin dira ur gainean jarri
- [ ] Zonak ezin dira eraikin edo beste zona baten gainean jarri
- [ ] Kostua zona motan eta tamainan oinarrituta kalkulatzen da
- [ ] Altxorra eguneratzen da

---

#### POST /api/games/{gameId}/infrastructure

**Eskaera:**
```json
{
  "type": "string enum (road | highway | power_line | rail | water_pipe | subway_tunnel)",
  "segments": [
    {"from": {"x": "number", "y": "number"}, "to": {"x": "number", "y": "number"}}
  ]
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "cost": "number",
  "segments_placed": "number",
  "treasury_after": "number"
}
```

**Onarpen irizpideak:**
- [ ] Lurpeko azpiegiturak (water_pipe, subway_tunnel) lurpeko geruzan jartzen dira
- [ ] Gainazaleko azpiegiturak lur eraigarri gainean soilik
- [ ] Segmentu bakoitzak lauki bat kostatzen du
- [ ] Errepideak automatikoki bidegurutzeak sortzen dituzte

---

#### POST /api/games/{gameId}/build

**Eskaera:**
```json
{
  "building_type": "string enum",
  "position": {"x": "number", "y": "number"}
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "cost": "number",
  "building": "Building",
  "treasury_after": "number"
}
```

**Onarpen irizpideak:**
- [ ] Eraikina existitzen den motatakoa izan behar du
- [ ] Zentral elektrikoaren teknologia eskuragarri egon behar du (uneko urtearekiko)
- [ ] Kokapena libre eta egokia izan behar du (tamaina kontuan hartuz)
- [ ] Nahikoa diru egon behar du

---

#### POST /api/games/{gameId}/demolish

**Eskaera:**
```json
{
  "position": {"x": "number", "y": "number"},
  "type": "string enum (zone | building | infrastructure)"
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "demolished_type": "string",
  "refund": "number (kostuaren %50)"
}
```

---

#### POST /api/games/{gameId}/budget

**Eskaera:**
```json
{
  "tax_rates": {
    "residential": "number (0-20, aukerakoa)",
    "commercial": "number (0-20, aukerakoa)",
    "industrial": "number (0-20, aukerakoa)"
  },
  "funding": {
    "transportation": "number (0-120, aukerakoa)",
    "police": "number (0-120, aukerakoa)",
    "fire": "number (0-120, aukerakoa)",
    "health": "number (0-120, aukerakoa)",
    "education": "number (0-120, aukerakoa)"
  }
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "budget": "Budget (eguneratua)",
  "estimated_monthly_balance": "number"
}
```

**Onarpen irizpideak:**
- [ ] Zerga tasak 0 eta 20 artean egon behar dute
- [ ] Finantzaketa portzentajeak 0 eta 120 artean
- [ ] Aurreikusitako hileko balantzea kalkulatzen da

---

#### POST /api/games/{gameId}/ordinance

**Eskaera:**
```json
{
  "ordinance_id": "string",
  "action": "string enum (enact | repeal)"
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "ordinance": "Ordinance",
  "budget_impact": "number (urteko kostua/diru-sarrera)"
}
```

---

#### POST /api/games/{gameId}/bond

**Eskaera:**
```json
{
  "amount": "number (max 10000)"
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "bond": {"amount": "number", "interest_rate": 20, "months_remaining": 240},
  "treasury_after": "number"
}
```

**Onarpen irizpideak:**
- [ ] Gehienez 10 bonu aktibo aldi berean
- [ ] Bonu bakoitza §10.000 gehienez
- [ ] %20 urteko interesa, 20 urteko epea (240 hilabete)

---

#### POST /api/games/{gameId}/attack

**Eskaera:**
```json
{
  "disaster_type": "string enum (fire | flood | tornado | earthquake)",
  "target": "string enum (player | ai)"
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "cost": "number",
  "disaster": "Disaster",
  "damage_report": {
    "buildings_damaged": "number",
    "zones_damaged": "number",
    "infrastructure_damaged": "number",
    "estimated_repair_cost": "number"
  },
  "treasury_after": "number"
}
```

**Onarpen irizpideak:**
- [ ] Gutxienez 6 hilabete igaro behar dira azken erasoaren ondoren
- [ ] Nahikoa diru eraso kostua ordaintzeko
- [ ] Suhiltzaile estaldura onak kaltea -%50 murrizten du helburu hirian
- [ ] Erasoak jokoaren egoera eguneratzen du (eraikinak kaltetu/suntsitu)

---

#### POST /api/games/{gameId}/endMonth

**Eskaera:** (gorputzik ez)

**Erantzuna (200):**
```json
{
  "success": true,
  "new_date": {"year": "number", "month": "number"},
  "player_simulation": {
    "population_change": "number",
    "treasury_change": "number",
    "zones_developed": "number",
    "zones_abandoned": "number",
    "new_power_capacity": "number",
    "events": ["string"]
  },
  "ai_turn": {
    "actions": ["AIAction"],
    "reasoning": "string",
    "simulation": {
      "population_change": "number",
      "treasury_change": "number"
    }
  },
  "game_state": "GameState (egoera osoa eguneratua)",
  "victory_check": {
    "status": "string",
    "winner": "string | null",
    "reason": "string | null"
  }
}
```

**Onarpen irizpideak:**
- [ ] Jokalariaren hileko simulazioa kalkulatzen da (RCI, hazkundea, ekonomia)
- [ ] AA-ren txanda exekutatzen da (LLM deia)
- [ ] AA-ren simulazioa kalkulatzen da
- [ ] Bi hirien egoera eguneratzen da
- [ ] Garaipena baldintzak egiaztatzen dira
- [ ] Auto-gordetzea exekutatzen da
- [ ] Zentral elektriko zaharrak egiaztatzen dira eta alerta ematen da
- [ ] Ausazko hondamendiak gerta daitezke (aktibatuta badaude)

---

#### POST /api/games/{gameId}/cheat

**Eskaera:**
```json
{
  "cheat_code": "string"
}
```

**Erantzuna (200):**
```json
{
  "success": true,
  "cheat_code": "string",
  "message": "string (efektuaren deskribapena)",
  "changes": {"key": {"before": "any", "after": "any"}},
  "game_state": "GameState"
}
```

**Onarpen irizpideak:**
- [ ] Kode ezezagunak → 400 errorearekin
- [ ] Kodea `cheats_used` zerrendan erregistratzen da
- [ ] Kode bakoitzak bere efektu espezifikoa du

---

### 2.4. Kontsultak

#### GET /api/games/{gameId}/overlay/{type}

**`type` balioak:** `crime`, `pollution_air`, `pollution_water`, `land_value`, `traffic`, `power`, `water`, `fire_coverage`, `police_coverage`

**Erantzuna (200):**
```json
{
  "overlay_type": "string",
  "data": [[number]],
  "min_value": "number",
  "max_value": "number"
}
```

---

#### GET /api/games/{gameId}/stats

**Erantzuna (200):**
```json
{
  "player": {
    "population": "number",
    "treasury": "number",
    "composite_score": "number",
    "eq": "number",
    "hq": "number",
    "crime_rate": "number",
    "pollution": "number",
    "approval": "number",
    "rci_demand": {"r": "number", "c": "number", "i": "number"},
    "power_coverage": "number",
    "water_coverage": "number"
  },
  "ai": {
    "population": "number",
    "treasury": "number",
    "composite_score": "number",
    "approval": "number"
  },
  "comparison": {
    "population_diff": "number",
    "score_diff": "number",
    "months_to_victory": "number | null"
  }
}
```

---

## 3. JOKOAREN ARAUAK

### 3.1. Hileko Tick Simulazioa

Hilabete bakoitzaren amaieran, ondorengo kalkuluak egiten dira hiri bakoitzarentzat:

```
1. ENERGIA SAREA eguneratu (BFS zentral elektrikoetatik)
2. UR SAREA eguneratu (BFS ur-ponpetatik)
3. ERREPIDE SARBIDEA eguneratu (BFS errepideetatik)
4. ZONA GARAPEN BALDINTZAK egiaztatu
   - Energia + errepidea → maila 1
   - + Ura + eskari positiboa → maila 2
   - + Zerbitzu estaldura + baldintza onak → maila 3
5. ABANDONATZEA egiaztatu
   - Energia falta → abandonatu probabilitatea %30/hil
   - Krimena > 80 → abandonatu probabilitatea %20/hil
   - Kutsadura > 80 (erresidentzial) → abandonatu probabilitatea %15/hil
   - Zerga > 15% → abandonatu probabilitatea %10/hil
6. RCI ESKARIA kalkulatu
7. BIZTANLE HAZKUNDEA kalkulatu
8. DIRU-SARRERAK / GASTUAK kalkulatu
9. ALTXORRA eguneratu
10. METRIKAK eguneratu (EQ, HQ, krimena, kutsadura, lur-balioa, onarpena)
11. PORROT EKONOMIKOA egiaztatu
12. GARAIPENA BALDINTZAK egiaztatu
```

---

### 3.2. RCI Eskaria

```
R_demand = base_demand
         + (C_jobs + I_jobs - R_population) * 0.3       # Lanpostu diferentzia
         + service_coverage_bonus                         # Zerbitzuen eragina (+0..30)
         - residential_tax_rate * 5                       # Zerga penalizazioa
         + ordinance_modifiers                            # Ordenantzen eragina
         - crime_rate * 0.3                               # Krimena penalizazioa
         + neighbor_commuter_bonus                        # Auzokide konexioak (6. modulua)

C_demand = base_demand
         + R_population * 0.1                             # Biztanleria (bezeroak)
         + eq * 0.2                                       # Hezkuntza
         + airport_bonus                                  # Aireportua (+50)
         - commercial_tax_rate * 5
         + ordinance_modifiers
         + transport_access_bonus

I_demand = base_demand
         + R_population * 0.05                            # Langileak
         + seaport_bonus                                  # Portua (+40)
         + rail_bonus                                     # Trenbidea (+20)
         - industrial_tax_rate * 5
         + ordinance_modifiers
         - pollution_air * 0.1                            # Kutsaduraren auto-mugaketa
```

`base_demand` = 10 (beti eskari apur bat dago)

---

### 3.3. Biztanle Hazkundea

```
# Hilabeteko populazio hazkundea
if R_demand > 0:
    new_residents = min(R_demand * 0.1, available_residential_capacity * 0.05)
else:
    leaving_residents = abs(R_demand) * 0.05

population_change = new_residents - leaving_residents - disaster_losses

# Zona populazioa
residential_light_zone_pop = development_level * 50
residential_dense_zone_pop = development_level * 200
```

---

### 3.4. Energia Sare Hedapena

```
# BFS algoritmoa — energia zentral elektrikoetatik hedatzen da
1. Zentral elektriko aktibo guztiak ← hasierako nodoak
2. Alboko lauki garatuak ← energia automatikoki hedatzen da
3. Energia lineak ← konexio gehigarriak eremu isolatuentzat
4. Energia eskaria = sum(zona_garatuak * zona_mw + eraikin * eraikin_mw)
5. Energia falta → zonak garatzeko gai ez dira / abandonatzen dira
```

**Lauki bakoitzaren energia eskaria:**
| Elementua | MW eskaria |
|-----------|-----------|
| Zona garatu (maila 1) | 1 MW |
| Zona garatu (maila 2) | 2 MW |
| Zona garatu (maila 3) | 4 MW |
| Zerbitzu eraikina | 2 MW |

---

### 3.5. Ur Sare Hedapena

```
# BFS algoritmoa — ura ur-ponpetatik ur-hodien bidez hedatzen da
1. Ur-ponpa aktibo guztiak ← hasierako nodoak
2. Ur-hodiak jarraituz, alboko laukietara hedatzen da
3. Ur-ponpek gehiago eman ur iturburutik hurbil (×2 eraginkortasuna)
4. Ur falta → zona garapen maila baxua
```

---

### 3.6. Zerbitzu Estaldura

```
# Zerbitzu eraikin bakoitzarentzat
effective_radius = base_radius * (funding_pct / 100)

# Lauki bat estaldura barruan badago:
service_score(tile) = max(coverage_value for each service_building if distance <= effective_radius)

# Estaldura efektuak:
police_coverage → krimena murrizten du (inversely proportional)
fire_coverage → sute arriskua murrizten du, hondamendi kaltea -%50
health_coverage → HQ hobetzen du
education → EQ hobetzen du (motelagoa, belaunaldien artekoa)
```

---

### 3.7. Kutsadura, Krimena eta Lur-balioa Hedapena

```
# Kutsadura (hilabetero eguneratua)
pollution(tile) = sum(pollution_source * distance_decay for each source)
                + traffic_pollution
                - tree_reduction
                - ordinance_modifier

# Krimena (hilabetero eguneratua)
crime(tile) = base_crime * population_density
            - police_coverage
            - education_bonus
            - employment_bonus
            + gambling_ordinance_modifier

# Lur-balioa (hilabetero eguneratua)
land_value(tile) = base_value
                 + water_proximity_bonus (+20 itsasertzean)
                 + park_proximity_bonus
                 + service_coverage_bonus
                 + eq_bonus
                 - pollution_penalty
                 - crime_penalty
                 - industrial_proximity_penalty
                 - power_plant_proximity_penalty
```

---

### 3.8. Eraikin Zahartzea

```
# Hilabetero zentral elektriko guztientzat (hydro eta wind izan ezik)
building.age_months += 1

if building.age_months >= 600:  # 50 urte
    # LEHERKETA — zentrala suntsitu eta kaltea inguruan
    if building.type == "nuclear_power":
        # Erradiazio kutsadura eremu zabalean
        create_radiation_zone(building.position, radius=12)
    destroy_building(building)
    create_fire(building.position, radius=3)
    add_event("Zentral elektriko zaharra lehertu da!")

# 540 hilabetetik aurrera (45 urte): alerta ematen da
if building.age_months >= 540:
    add_warning("Zentral elektrikoa zahartu da, ordeztu behar da!")
```

---

### 3.9. Garaipena Baldintzak

```
# Hilabetero egiaztatzen da
def check_victory(game_state):
    player = game_state.player_city
    ai = game_state.ai_city

    # 1. Populazio Garaipena (100.000)
    if player.population >= 100000:
        return Victory(winner="player", type="population")
    if ai.population >= 100000:
        return Victory(winner="ai", type="population")

    # 2. Aurkariaren Porrot Ekonomikoa (12 hilabete jarraian bankruta)
    if ai.months_bankrupt >= 12:
        return Victory(winner="player", type="rival_bankrupt")
    if player.months_bankrupt >= 12:
        return Victory(winner="ai", type="player_bankrupt")

    # 3. Puntuazio Garaipena (1.200 hilabete = 100 urte ondoren)
    months_played = (game_state.current_date.year - game_state.starting_year) * 12
    if months_played >= 1200:
        if player.metrics.composite_score > ai.metrics.composite_score:
            return Victory(winner="player", type="score")
        else:
            return Victory(winner="ai", type="score")

    # 4. Arkologia Irteera (4. taldeko modulua soilik)
    # Ikus 6.4 atala

    return Victory(status="ongoing")
```

---

### 3.10. Porrot Ekonomikoa

```
# Hilabetero egiaztatzen da
if city.treasury < -100000:
    city.months_bankrupt += 1
else:
    city.months_bankrupt = 0

if city.months_bankrupt >= 12:
    # GAME OVER (edo aurkariaren garaipena)
    trigger_game_over(city.owner)
```

---

## 4. FRONTEND OSAGAIAK

### 4.1. Bide-Taula

| Bidea | Osagaia | Deskribapena |
|-------|---------|-------------|
| `/` | LandingPage | Hasiera orria, login/erregistro aukera |
| `/login` | LoginPage | Erabiltzaile login |
| `/register` | RegisterPage | Erabiltzaile erregistro |
| `/games` | GameListPage | Gordetako partiden zerrenda |
| `/games/new` | NewGamePage | Partida berria sortu |
| `/game/:id` | GamePage | Joko nagusia |

### 4.2. Joko Osagai Nagusiak

| Osagaia | Deskribapena |
|---------|-------------|
| **CityMapView** | Mapa isometrikoa: zonak, eraikinak, azpiegiturak, lurraldea. Zoom eta pan-a. Lauki hautatzailea. |
| **UndergroundView** | Lurpeko geruza: ur-hodiak, metro tunelak. Mapa isometrikoaren azpiko bista. |
| **ZoneToolbar** | Zona hautatzailea: R/C/I arin/trinkoa. Drag-to-paint zona jartzeko. |
| **BuildToolbar** | Eraikin hautatzailea: zentral elektrikoak, zerbitzuak, hezkuntza, garraioa. |
| **InfraToolbar** | Azpiegitura hautatzailea: errepideak, energia lineak, ur-hodiak, trenbidea. |
| **BudgetPanel** | Zerga tasak (3 slider), sailkako finantzaketa (5 slider), bonu kudeaketa, hileko/urteko laburpena. |
| **OrdinancePanel** | Ordenantza zerrenda aktibatu/desaktibatzeko taularekin. Kostu eta efektu adierazleak. |
| **DataOverlaySelector** | Gainjarri aukeratzailea: krimena, kutsadura, lur-balioa, trafikoa, energia, ura, su/polizia estaldura. |
| **RCIDemandBar** | R/C/I eskari adierazlea (barra grafiko bertikala, beti ikusgai). |
| **RivalCityView** | AA-ren hiriaren egoera laburra: biztanleria, puntuazioa, metriken konparaketa. |
| **DisasterPanel** | Hondamendi eraso aukera: mota hautatu, kostua ikusi, erasoa abiarazi. Cooldown adierazlea. |
| **AITurnViewer** | AA-ren txandaren animazio-erreproduzitzailea: ekintzak sekuentzialki ikusi (pantaila osoa edo zatitua). |
| **GameHUD** | Goiko barra: data (urtea/hilabetea), biztanleria, altxorra, puntuazioa, RCI barra, abiadura kontrolak. |
| **CheatConsole** | Ctrl+Tab txat interfazea kodeak sartzeko. Log bistaratzea. |
| **NewspaperModal** | Egunkari popup-a: titularrak, gertaerak, AA-ren ekintzaren laburpena (5. taldeko modulua). |

### 4.3. Frontend Store interfazea (TypeScript)

```typescript
interface GameStore {
  // Egoera
  gameState: GameState | null;
  selectedTool: ToolType | null;
  activeOverlay: OverlayType | null;
  viewMode: 'surface' | 'underground';
  aiTurnPlaying: boolean;

  // Ekintzak
  loadGame(gameId: string): Promise<void>;
  placeZone(type: ZoneType, pos: Position, size: Size): Promise<void>;
  placeInfrastructure(type: InfraType, segments: Segment[]): Promise<void>;
  buildStructure(type: BuildingType, pos: Position): Promise<void>;
  demolish(pos: Position): Promise<void>;
  updateBudget(budget: Partial<BudgetUpdate>): Promise<void>;
  toggleOrdinance(id: string, action: 'enact' | 'repeal'): Promise<void>;
  issueBond(amount: number): Promise<void>;
  attackRival(disasterType: DisasterType): Promise<void>;
  endMonth(): Promise<void>;
  submitCheat(code: string): Promise<void>;
  saveGame(name?: string): Promise<void>;
  loadOverlay(type: OverlayType): Promise<void>;
}
```

### 4.4. Frontend Onarpen Irizpideak

- [ ] Mapa isometrikoa zuzen errendatzen da zone kolore konbentzioekin (R=berdea, C=urdina, I=horia)
- [ ] Zona drag-to-paint funtzionatzen du
- [ ] Errepide, energia linea eta ur-hodi jartzea intuitiboa da
- [ ] Aurrekontu panelak denbora errealean hileko balantzea erakusten du
- [ ] Datu gainjarriak mapa gainean kolorezko degradatu gisa erakusten dira
- [ ] RCI eskari barra beti ikusgai dago
- [ ] AA txandaren bistaratzea bi moduetan funtzionatzen du
- [ ] Trikimailu kontsola Ctrl+Tab bidez aktibatzen da
- [ ] Lurpeko bista ur-hodiak eta metroa erakusten ditu
- [ ] Erantzun azkarra: AA txandaren bistaratzea abiadura kontrola du

---

## 5. LLM INTEGRAZIOA

### 5.1. Konfigurazioa (.env)

```env
# GroQ konfigurazioa
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_MODEL_PRIMARY=llama-3.3-70b-versatile
GROQ_MODEL_FALLBACK=llama-3.1-8b-instant
GROQ_MAX_TOKENS=4096
GROQ_TEMPERATURE=0.7

# GitHub Models konfigurazioa (ordezko)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_MODEL_PRIMARY=openai/gpt-4o-mini
GITHUB_MODEL_FALLBACK=meta/llama-3.1-8b-instruct

# AA Zerbitzuaren konfigurazioa
AI_SERVICE_PORT=5001
AI_REQUEST_TIMEOUT=30
AI_MAX_RETRIES=3
AI_CONTEXT_MAX_TOKENS=2000
```

### 5.2. Zerbitzu Arkitektura

```python
class LLMProvider(ABC):
    """LLM hornitzaile abstraktua"""
    @abstractmethod
    def generate(self, messages: list[dict], max_tokens: int) -> dict: ...
    @abstractmethod
    def is_available(self) -> bool: ...

class GroQProvider(LLMProvider):
    """GroQ API hornitzailea"""
    ...

class GitHubModelsProvider(LLMProvider):
    """GitHub Models API hornitzailea"""
    ...

class AIService:
    """AA zerbitzuaren orkestratzailea"""
    def __init__(self, providers: list[LLMProvider]):
        self.providers = providers  # Lehentasun ordenan

    def get_ai_turn(self, game_state: dict) -> dict:
        """AA-ren txanda lortu — failover logikarekin"""
        for provider in self.providers:
            try:
                if provider.is_available():
                    response = provider.generate(...)
                    return self.validate_and_parse(response)
            except RateLimitError:
                continue  # Hurrengo hornitzailera
        return self.fallback_response(game_state)  # Erantzun estatikoa
```

### 5.3. Prompt Fluxua

```
1. SISTEMA PROMPT-A → Hiri kudeatzaile AA-ren deskribapena + arauak + ekintza formatua
2. HIRI EGOERA → AA-ren hiriaren JSON egoera osoa
3. JOKALARIAREN INFORMAZIOA → Biztanleria + puntuazioa + zona kopurua (mugatua)
4. HISTORIA → Azken 5 hilabeteetako laburpena (token aurrezteko)
5. AA ERANTZUNA → JSON ekintza zerrenda + reasoning + analysis
6. BALIDAZIOA → Ekintza bakoitza jokoaren arauen arabera balidatu
7. EXEKUZIOA → Ekintza baliozkoak inplementatu
```

### 5.4. Erroreen Kudeaketa

| Errorea | Ekintza |
|---------|---------|
| 429 (Rate Limit) | Hurrengo hornitzailera aldatu |
| 500 (Server Error) | 3 saiakera, gero ordezko erantzuna |
| JSON parse errorea | Berriro eskatu formatu argiagoarekin |
| Ekintza baliogabea | Ekintza alde batera utzi, gainerakoak exekutatu |
| Timeout (30s) | Hurrengo hornitzailera aldatu |
| Hornitzaile guztiak huts | Erantzun estatikoa (oinarrizko ekintzak) |

### 5.5. LLM Onarpen Irizpideak

- [ ] AA-k hilabete bakoitzean erantzun koherentea itzultzen du
- [ ] Failover GroQ → GitHub Models → estatikoa funtzionatzen du
- [ ] AA-ren ekintzak jokoaren arauak errespetatzen dituzte
- [ ] AA-k ez du existitzen ez den dirua gastatzen
- [ ] AA-k nortasun koherentea mantentzen du partida osoan
- [ ] Tokenen erabilera kontrolatuta dago (< 4096 erantzun bakoitzeko)
- [ ] AA-ren reasoning testuinguru baliagarria ematen du

---

## 6. TALDEKO MODULU ESPEZIFIKOAK

Talde bakoitzak oinarrizko funtzionalitateaz gain, modulu espezifiko bat inplementatu behar du. Talde esleipen taula:

| Taldea | Frontend | Backend | Modulua |
|--------|----------|---------|---------|
| 1 | React | Flask | Hondamendiak |
| 2 | React | FastAPI | Garraio Aurreratua |
| 3 | Angular | Flask | Ordenantzak |
| 4 | Angular | FastAPI | Arkologiak |
| 5 | Vue | Flask | Egunkaria |
| 6 | Vue | FastAPI | Auzokide Hiriak |
| 7 | Svelte | Flask | Ur Sistema |
| 8 | Svelte | FastAPI | Hezkuntza & Osasuna |
| 9 | React | Flask | Lurralde Sistema |
| 10 | Vue | FastAPI | Energia Aurreratua |

---

### 6.1. 1. Taldea: Hondamendiak (React + Flask)

#### Endpoint gehigarriak:

**POST /api/games/{gameId}/disaster/manual**
```json
// Eskaera
{
  "disaster_type": "string enum (fire|flood|tornado|earthquake|riot|monster|ufo|volcano|meteor)",
  "position": {"x": "number", "y": "number"}
}
// Erantzuna (200)
{
  "disaster": "Disaster",
  "damage_report": {...},
  "affected_tiles": [{"x": "number", "y": "number", "damage": "number"}]
}
```

**GET /api/games/{gameId}/disaster/history**
```json
{
  "disasters": [
    {
      "type": "string",
      "date": {"year": "number", "month": "number"},
      "source": "string",
      "damage_level": "number",
      "affected_tiles": "number"
    }
  ]
}
```

#### Eredu gehigarriak:

```json
{
  "type": "DisasterConfig",
  "disaster_types": {
    "fire": {"spread_rate": 0.3, "damage_per_tick": 15, "duration_months": 2},
    "flood": {"water_rise": 3, "damage_factor": 0.5, "duration_months": 1},
    "tornado": {"path_length": 20, "path_width": 2, "damage_factor": 0.8},
    "earthquake": {"magnitude": "1-10", "radius_factor": 3, "aftershock_chance": 0.3},
    "riot": {"spread_rate": 0.2, "damage_per_tick": 10, "trigger_crime_threshold": 80},
    "nuclear_meltdown": {"radiation_radius": 12, "radiation_duration_months": 120},
    "monster": {"path_length": 30, "damage_factor": 0.7},
    "ufo": {"beam_damage": 50, "targets": 5},
    "volcano": {"lava_radius": 8, "lava_damage": 100, "duration_months": 6},
    "meteor": {"crater_radius": 5, "damage_factor": 0.9}
  }
}
```

#### Joko arauak:
```
# Hondamendi hedapena (sutea)
fire_spread_chance(tile) = base_spread_rate
                        * (1 - fire_station_coverage * 0.5)
                        * wind_factor
                        * building_density_factor

# Hondamendi kaltea
damage(tile) = disaster_damage_factor
             * (1 - fire_station_coverage * 0.5)
             * random(0.5, 1.0)

# Berreskuratzea
recovery_cost(tile) = original_building_cost * damage_pct * 0.5
```

#### Onarpen irizpideak:
- [ ] 10+ hondamendi mota inplementatuta daude
- [ ] Suteak lauki batetik bestera hedatzen dira (animazioarekin)
- [ ] Suhiltzaileen estaldurak kaltea murrizten du
- [ ] Hondamendi historia erregistratzen da
- [ ] Lurrikara osteko birgaikuntza (aftershock) gertatzen da %30 probabilitatearekin
- [ ] Nuklear hondamendiak erradiazio zona sortzen du

---

### 6.2. 2. Taldea: Garraio Aurreratua (React + FastAPI)

#### Endpoint gehigarriak:

**GET /api/games/{gameId}/traffic**
```json
{
  "traffic_map": [[number]],
  "congestion_zones": [{"position": {"x": "number", "y": "number"}, "level": "number"}],
  "commute_avg_minutes": "number",
  "transit_usage": {
    "road": "number (pct)",
    "bus": "number (pct)",
    "rail": "number (pct)",
    "subway": "number (pct)"
  }
}
```

**GET /api/games/{gameId}/transport/routes**
```json
{
  "bus_routes": [{"stops": [{"x": "number", "y": "number"}], "ridership": "number"}],
  "rail_routes": [{"stations": [{"x": "number", "y": "number"}], "ridership": "number"}],
  "subway_routes": [{"stations": [{"x": "number", "y": "number"}], "ridership": "number"}]
}
```

#### Joko arauak:
```
# Trafiko simulazioa
traffic(road_tile) = sum(commuters_using_road)
                   - bus_depot_reduction * 0.15
                   - rail_station_reduction * 0.25
                   - subway_station_reduction * 0.35

# Bidai denbora
commute_time(origin, dest) = distance * road_speed_factor
                           * (1 + congestion_penalty)
                           - transit_time_savings

# Trafiko efektuak
high_traffic → kutsadura +, zona garapen motela, herritarren atsekabe
```

#### Onarpen irizpideak:
- [ ] Trafiko bero-mapa funtzionatzen du
- [ ] Autobus, tren eta metro garraio publikoak trafiko murrizten dute
- [ ] Autobidea errepidea baino ahalmen handiagoa du
- [ ] Bidaia denbora kalkulatzen da eta zona garapenean eragiten du
- [ ] Aireportua eta portua merkataritza eta industria eskariari eragiten diote

---

### 6.3. 3. Taldea: Ordenantzak (Angular + Flask)

#### Endpoint gehigarriak:

**GET /api/games/{gameId}/ordinances**
```json
{
  "available": ["Ordinance (aktibatu gabeak)"],
  "active": ["Ordinance (aktibatoak)"],
  "total_annual_cost": "number",
  "total_annual_income": "number"
}
```

**GET /api/games/{gameId}/ordinances/{id}/impact**
```json
{
  "ordinance_id": "string",
  "estimated_effects": {
    "crime_change": "number",
    "pollution_change": "number",
    "rci_demand_change": {"r": "number", "c": "number", "i": "number"},
    "annual_budget_impact": "number"
  }
}
```

#### Eredu gehigarriak:
20+ ordenantza garatu, bakoitza efektu eta kostu zehatzekin. Ikus §1.7 oinarrizko zerrenda eta hedatu:

Ordenantza gehigarriak:
| id | Izena | Kostua/urtea | Efektua |
|----|-------|--------------|---------|
| `cpr_training` | CPR prestakuntza | §25 | Osasuna +%2 |
| `smoking_ban` | Erretze debekua | §0 | Osasuna +%3 |
| `homeless_shelters` | Etxerik gabeen babeslekuak | §50 | Krimena -%3, Onarpena +%5 |
| `water_conservation` | Ur aurreztea | §25 | Ur eskaria -%15 |
| `energy_conservation` | Energia aurreztea | §25 | Energia eskaria -%10 |
| `business_incentives` | Enpresa pizgarriak | §100 | C/I eskaria +%15, zerga diru-sarrera -%10 |
| `clean_air_act` | Aire garbi legea | §25 | Kutsadura -%10 |
| `volunteer_fire` | Boluntario suhiltzaileak | §50 | Su estaldura +%10 |

#### Onarpen irizpideak:
- [ ] 20+ ordenantza inplementatuta eta aktibatu/desaktibatu daitezke
- [ ] Ordenantza bakoitzak aurreikusitako efektuak adierazle gisa erakusten ditu
- [ ] Diru-sarrera sortzen duten ordenantzek aurrekontuan islatzen dira
- [ ] Ordenantza efektuak RCI eskarian eta hiri metriketan nabaritzen dira
- [ ] Ordenantza konbinazioak funtzionatzen dute (efektuak pilatzen dira)

---

### 6.4. 4. Taldea: Arkologiak (Angular + FastAPI)

#### Endpoint gehigarriak:

**POST /api/games/{gameId}/build/arcology**
```json
// Eskaera
{
  "arcology_type": "string enum (plymouth | forest | darco | launch)",
  "position": {"x": "number", "y": "number"}
}
// Erantzuna
{
  "success": true,
  "arcology": {...},
  "population_added": "number",
  "cost": "number",
  "treasury_after": "number"
}
```

**POST /api/games/{gameId}/arcology/exodus**
```json
// Erantzuna (Launch Arco kopurua >= 50 denean)
{
  "exodus_triggered": true,
  "launch_arcos_count": "number",
  "population_leaving": "number",
  "funds_refunded": "number",
  "message": "Irteera hasi da! Arkologia jaurtitzaileak espaziora abiatzen ari dira..."
}
```

#### Eredu gehigarriak:

| Arkologia | Eskuragarri | Kostua | Biztanleria | Kutsadura | Tamaina |
|-----------|------------|--------|-------------|-----------|---------|
| Plymouth | 2000 + pop≥120.000 | §100.000 | 55.000 | Baxua | 4x4 |
| Forest | 2050 + pop≥120.000 | §120.000 | 30.000 | Ezer ez | 4x4 |
| Darco | 2100 + pop≥120.000 | §150.000 | 45.000 | Ezer ez | 4x4 |
| Launch | 2150 + pop≥120.000 | §200.000 | 65.000 | Ezer ez | 4x4 |

#### Joko arauak:
```
# Arkologia desblokeatzea
arkologiak_desblokeatuak = (population >= 120000) AND (year >= required_year)

# Irteera gertaera
if count(launch_arcologies) >= 50 AND year >= 2051:
    trigger_exodus()
    # Launch Arko guztiak "abiatzen" dira
    # Biztanleria murrizten da (arkoetan bizi zirenak)
    # Eraikuntza kostuak itzultzen dira (§200.000 × arko kopurua)
    # Garaipen berezia: "Arkologia Irteera"
```

#### Onarpen irizpideak:
- [ ] 4 arkologia mota eraikitzeko daude
- [ ] Biztanleria eta urte baldintzak betetzen dira desblokeatzerako
- [ ] Arkologiek biztanleria handia gehitzen dute eremu txikian (4x4)
- [ ] Launch Arko irteera gertaera 50+ arkologiarekin abiarazten da
- [ ] Irteera animazioa erakusten da (arkologiak espaziora abiatzen)
- [ ] Arkologia garaipena garaipena baldintza gisa erregistratzen da

---

### 6.5. 5. Taldea: Egunkaria (Vue + Flask)

#### Endpoint gehigarriak:

**GET /api/games/{gameId}/newspaper**
```json
{
  "newspaper_name": "string (ausazko izena)",
  "date": {"year": "number", "month": "number"},
  "price": "number (urtearen araberakoa, inflazioa)",
  "headlines": [
    {
      "title": "string",
      "article": "string",
      "category": "string enum (city_news | opinion | humor | advice | poll)"
    }
  ],
  "opinion_poll": {
    "question": "Zer da garrantzitsuena zure hiriarentzat?",
    "results": [
      {"option": "Polizia gehiago", "pct": 35},
      {"option": "Zerga baxuagoak", "pct": 28},
      {"option": "Garraio hobea", "pct": 22},
      {"option": "Eskola gehiago", "pct": 15}
    ]
  }
}
```

**POST /api/games/{gameId}/newspaper/generate**
```json
// LLM bidez egunkari berri bat sortzen du
{
  "newspaper": "/* egunkari osoa */"
}
```

#### Joko arauak:
```
# Egunkaria urtean behin automatikoki sortzen da (Urtarrilean)
# Eskuz ere eskatu daiteke edozein momentutan

# Eduki motak:
1. HIRI BERRIAK — hiri gertaerei buruz (zentral berria, hondamendiak, populazio mugarriak)
2. INKESTA — herritarren iritzia (zer hobetu nahi duten)
3. AI LABURPENA — aurkari hiriaren berrien laburpena
4. UMOREA — ausazko titular barregarriak (LLM bidez sortua)
5. AHOLKULARIA — aholkulari baten iritzi zutabea
```

#### Onarpen irizpideak:
- [ ] Egunkari popup-a urtero automatikoki agertzen da
- [ ] Eskuz ere irekitzeko aukera dago
- [ ] Egunkari izenak ausazkoak dira (Berria, Posta, Kronika, etab.)
- [ ] Inkestek hiriaren benetako arazoak islatzen dituzte
- [ ] LLM bidez sortutako titular umoretsuak daude
- [ ] Egunkari prezioak inflazioa islatzen du (urteen arabera igotzen da)

---

### 6.6. 6. Taldea: Auzokide Hiriak (Vue + FastAPI)

#### Endpoint gehigarriak:

**GET /api/games/{gameId}/neighbors**
```json
{
  "neighbors": [
    {
      "id": "string",
      "name": "string",
      "direction": "string enum (north | south | east | west)",
      "population": "number",
      "connected_via": "string enum (road | highway | rail)",
      "deals": {
        "power_selling": "number (MW)",
        "power_buying": "number (MW)",
        "water_selling": "number",
        "commuters_in": "number",
        "commuters_out": "number"
      }
    }
  ]
}
```

**POST /api/games/{gameId}/neighbors/{neighborId}/deal**
```json
// Eskaera
{
  "deal_type": "string enum (buy_power | sell_power | buy_water | sell_water)",
  "amount": "number",
  "price_per_unit": "number"
}
// Erantzuna
{
  "success": true,
  "deal": {...},
  "monthly_income_change": "number"
}
```

#### Joko arauak:
```
# Auzokide hiriak maparen ertzetan konektatzen dira
# Autobidea/errepidea/trenbidea ertzera iristen denean → auzokide konexioa

# Langileen joan-etorria
commuters_in = neighbor_population * 0.05 * road_connection_factor
commuters_out = player_population * 0.03 * road_connection_factor

# Efektuak
commuters_in → R eskaria igo (langileak kanpotik datoz)
commuters_out → langabezia murriztu (jendeak kanpoan lan egiten du)

# Energia/ur saldaketak
sell_power → monthly_income += amount * price
buy_power → total_capacity += amount, monthly_expense += amount * price
```

#### Onarpen irizpideak:
- [ ] Maparen ertzeko konexioak automatikoki detektatzen dira
- [ ] Auzokide NPC hiriak 2-4 existitzen dira
- [ ] Energia eta ur saldaketak bi norabideetan funtzionatzen dute
- [ ] Langileen joan-etorriak R eskarian eragiten du
- [ ] Saldaketa akordioek aurrekontuan islatzen dira

---

### 6.7. 7. Taldea: Ur Sistema (Svelte + Flask)

#### Endpoint gehigarriak:

**GET /api/games/{gameId}/water**
```json
{
  "pumps": [
    {
      "id": "string",
      "position": {"x": "number", "y": "number"},
      "output": "number (gal/hil)",
      "near_water_source": "boolean",
      "efficiency": "number (0-100 pct)"
    }
  ],
  "treatment_plants": [...],
  "pipe_network": {
    "total_length": "number",
    "coverage_pct": "number",
    "pressure_map": [[number]]
  },
  "water_quality": "number (0-100)",
  "total_supply": "number",
  "total_demand": "number"
}
```

#### Joko arauak:
```
# Ur-ponpa eraginkortasuna ur iturburuaren hurbiltasunaren araberakoa
pump_output = base_output * proximity_factor
# proximity_factor: 2.0 ur iturburuaren ondoan, 0.5 urrun

# Ur presioa hodien bidez murrizten da
water_pressure(tile) = pump_output - (distance_from_pump * decay_factor)

# Ur kutsadura
water_pollution = industrial_runoff - treatment_plant_capacity

# Ura gabeko zonak
no_water → zona garapen maila maximoa = 1
```

#### Onarpen irizpideak:
- [ ] Lurpeko bista ur-hodien sarea erakusten du
- [ ] Ur-ponpak ur iturburu hurbiltasunaren arabera eraginkortasun ezberdina dute
- [ ] Ur presioa lurpeko bistan bistaratzen da (presio mapa)
- [ ] Ur kutsadura tratamendu plantekin kontrolatzen da
- [ ] Ur gabe zonak garapen baxua dute

---

### 6.8. 8. Taldea: Hezkuntza & Osasuna (Svelte + FastAPI)

#### Endpoint gehigarriak:

**GET /api/games/{gameId}/education**
```json
{
  "eq": "number",
  "eq_trend": "number (azken 12 hilabetetako aldaketa)",
  "facilities": [
    {"type": "school", "count": "number", "funding_pct": "number", "coverage": "number"},
    {"type": "college", "count": "number", "funding_pct": "number", "coverage": "number"},
    {"type": "library", "count": "number", "funding_pct": "number", "coverage": "number"},
    {"type": "museum", "count": "number", "funding_pct": "number", "coverage": "number"}
  ],
  "effects": {
    "high_tech_industry_pct": "number",
    "crime_reduction": "number",
    "land_value_bonus": "number"
  }
}
```

**GET /api/games/{gameId}/health**
```json
{
  "hq": "number",
  "hq_trend": "number",
  "hospitals": "number",
  "average_lifespan": "number",
  "mortality_rate": "number",
  "pollution_health_impact": "number"
}
```

#### Joko arauak:
```
# EQ kalkulua (belaunaldien artekoa, motela)
eq_change_per_month = (target_eq - current_eq) * 0.01
target_eq = sum(facility_eq_contribution * (funding_pct / 100)) + ordinance_bonuses

# EQ efektuak
high_tech_industry_pct = min(eq / 200, 1.0)  # EQ altua → industria garbiagoa
crime_reduction_from_eq = eq * 0.1
land_value_bonus_from_eq = eq * 0.5

# HQ kalkulua
hq_change_per_month = (target_hq - current_hq) * 0.02
target_hq = hospital_coverage * 50 - pollution_penalty + ordinance_bonuses

# HQ efektuak
average_lifespan = 50 + (hq * 0.2)  # Urte gehiago
mortality_rate = max(0, 10 - hq * 0.05)  # Hilkortasun baxuagoa
```

#### Onarpen irizpideak:
- [ ] EQ eta HQ metrikak grafiko dinamikoekin bistaratzen dira
- [ ] EQ aldaketak belaunaldien artean gertatzen dira (motela, hamarkadak)
- [ ] EQ altuak industria garbiagoa eragiten du (high-tech)
- [ ] HQ-k biztanle iraupena eta hilkortasuna kontrolatzen du
- [ ] Hezkuntza eta osasun finantzaketak zuzenean efektua du

---

### 6.9. 9. Taldea: Lurralde Sistema (React + Flask)

#### Endpoint gehigarriak:

**POST /api/games/{gameId}/terrain/modify**
```json
// Eskaera
{
  "action": "string enum (raise | lower | level | plant_trees | create_waterfall)",
  "position": {"x": "number", "y": "number"},
  "radius": "number (1-5)"
}
// Erantzuna
{
  "success": true,
  "cost": "number",
  "affected_tiles": [{"x": "number", "y": "number", "new_elevation": "number"}],
  "water_changes": [{"x": "number", "y": "number", "is_water": "boolean"}]
}
```

**GET /api/games/{gameId}/terrain/heightmap**
```json
{
  "heightmap": [[number]],
  "water_level": "number",
  "water_tiles": [{"x": "number", "y": "number"}],
  "waterfall_tiles": [{"x": "number", "y": "number"}]
}
```

#### Joko arauak:
```
# Altuera sistema
elevation_range = 0..31
water_level = sea_level (normalean 2)

# Ura betetzen:
if tile.elevation < water_level → tile is water

# Eraikuntza murrizketak
building_allowed = all_corners_same_elevation(tile)
# Eraikinak lur lau gainean soilik

# Tunelak: errepideak mendi baten zehar jar daitezke (tunela sortuz)
# Zubiak: errepideak automatikoki zubiak sortzen dituzte urazpitik

# Ur-jauziak: altuera diferentzia handia + ura → ur-jauzia
if elevation_diff(tile, neighbor) > 3 AND neighbor.has_water:
    tile.has_waterfall = true
    # Hidroelektriko zentrala jar daiteke
```

#### Onarpen irizpideak:
- [ ] Altuera mapa isometrikoan zuzen bistaratzen da (itzalak, kotoiak)
- [ ] Lurralde tresnak funtzionatzen dute (igo, jaitsi, berdindu)
- [ ] Ura altuera baxuko eremuetan betetzen da
- [ ] Eraikinak lur lau gainean soilik jar daitezke
- [ ] Zuhaitz jartzeak kutsadura murrizten du eta lur-balioa igotzen du
- [ ] Ur-jauziak hidroelektriko zentraletarako erabilgarriak dira

---

### 6.10. 10. Taldea: Energia Aurreratua (Vue + FastAPI)

#### Endpoint gehigarriak:

**GET /api/games/{gameId}/power**
```json
{
  "plants": [
    {
      "id": "string",
      "type": "string",
      "position": {"x": "number", "y": "number"},
      "capacity_mw": "number",
      "current_output_mw": "number",
      "age_months": "number",
      "max_age_months": "number",
      "health_pct": "number",
      "fuel_type": "string | null"
    }
  ],
  "grid": {
    "total_capacity": "number",
    "total_demand": "number",
    "coverage_pct": "number",
    "brownout_zones": [{"x": "number", "y": "number"}]
  },
  "technology_timeline": [
    {"type": "string", "available_year": "number", "unlocked": "boolean"}
  ]
}
```

**GET /api/games/{gameId}/power/aging-warnings**
```json
{
  "warnings": [
    {
      "plant_id": "string",
      "type": "string",
      "age_months": "number",
      "months_until_explosion": "number",
      "message": "string"
    }
  ]
}
```

#### Joko arauak:
```
# 9 zentral elektriko mota teknologia urteekin
technology_unlock = {
    "coal_power": 1900, "hydro_power": 1900, "oil_power": 1900,
    "gas_power": 1950, "nuclear_power": 1955, "wind_power": 1980,
    "solar_power": 1990, "microwave_power": 2020, "fusion_power": 2050
}

# Eguzki-energia eguraldiaren araberakoa
solar_output = base_output * weather_factor  # 0.3 (hodeitsu) - 1.0 (eguzkitsu)

# Mikrouhin izpi akatsa
if microwave_power.age_months > 480:  # 40 urte baino zaharragoa
    misfire_chance_per_month = 0.01  # %1 aukera hilabeteko
    # Erratu → sutea hiri erdian

# Zentral elektriko zahartze sistema
plant_health = 100 - (age_months / max_age_months * 100)
if plant_health <= 0 → LEHERKETA

# Energia sare brownout-ak
if total_demand > total_capacity:
    brownout_zones = zones_farthest_from_plants
    # Zona hauek energia gabe geratzen dira
```

#### Onarpen irizpideak:
- [ ] 9 zentral elektriko mota inplementatuta daude
- [ ] Teknologia urte-mugekin desblokeatzen dira
- [ ] Zentral elektriko zahartzea bistaratzen da (osasun adierazlea)
- [ ] Leherketa alerta 45 urtetik aurrera ematen da
- [ ] Eguzki-energiaren irteera eguraldi faktorearen araberakoa da
- [ ] Mikrouhin erratu gertaera inplementatuta dago
- [ ] Energia sare brownout-ak bistaratzen dira

---

## 7. DOCKER ETA HEDAPENA

### 7.1. docker-compose.yml

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:5000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/simhiri
      - AI_SERVICE_URL=http://ai-service:5001
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongo
      - ai-service

  ai-service:
    build:
      context: ./ai-service
      dockerfile: Dockerfile
    ports:
      - "5001:5001"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - GROQ_MODEL_PRIMARY=${GROQ_MODEL_PRIMARY}
      - GROQ_MODEL_FALLBACK=${GROQ_MODEL_FALLBACK}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - GITHUB_MODEL_PRIMARY=${GITHUB_MODEL_PRIMARY}

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

### 7.2. .env txantiloia

```env
# Segurtasuna
JWT_SECRET=aldatu_hau_zure_gako_sekretura

# GroQ
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_MODEL_PRIMARY=llama-3.3-70b-versatile
GROQ_MODEL_FALLBACK=llama-3.1-8b-instant

# GitHub Models (ordezko)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_MODEL_PRIMARY=openai/gpt-4o-mini

# MongoDB
MONGO_URI=mongodb://mongo:27017/simhiri
```

### 7.3. Hedapen Onarpen Irizpideak

- [ ] `docker compose up --build` errorerik gabe exekutatzen da
- [ ] Frontend http://localhost:3000 bidez eskuragarri dago
- [ ] Backend http://localhost:5000 bidez eskuragarri dago
- [ ] AI zerbitzua http://localhost:5001 bidez eskuragarri dago
- [ ] MongoDB datuak Docker bolumenean iraunkortzen dira
- [ ] Ingurune aldagaiak `.env` bidez konfiguratzen dira
- [ ] Berrabiaraztean datuak mantentzen dira

---

## 8. ONARPEN IRIZPIDE GLOBALAK

### 8.1. Oinarrizko Funtzionalitatea

- [ ] Erabiltzaile erregistroa eta login-a funtzionatzen du
- [ ] Partida berria eszenatoki batekin has daiteke
- [ ] Mapa isometrikoan zonak jar daitezke (R/C/I arin/trinkoa)
- [ ] Errepideak, energia lineak eta ur-hodiak jar daitezke
- [ ] Zentral elektrikoak eta zerbitzu eraikinak eraiki daitezke
- [ ] Aurrekontua doitu daiteke (zergak, finantzaketa)
- [ ] Hilabetea aurreratzean simulazioa kalkulatzen da (RCI, hazkundea, ekonomia)
- [ ] Zonak garatu eta hazten dira baldintzak betetzen direnean
- [ ] Energia eta ur sareak zuzen funtzionatzen dute (BFS hedapena)
- [ ] AA aurkari hiri bat kudeatzen du hilabete bakoitzean
- [ ] Lehia sistema funtzionatzen du (metrikak + hondamendi erasoak)
- [ ] Garaipena baldintzak egiaztatzen eta iragartzen dira
- [ ] Partidak gorde eta kargatu daitezke
- [ ] Trikimailu kodeak funtzionatzen dute

### 8.2. Kodearen Kalitatea

- [ ] Kode egituratua eta irakurgarria da
- [ ] Aldagai eta funtzio izen adierazgarriak
- [ ] Erroreen kudeaketa egokia (try/catch, HTTP errore kodeak)
- [ ] Kode bikoizketatik libre (DRY printzipioa)
- [ ] Git commit historia argia eta deskriptiboa

### 8.3. LLM Integrazioa

- [ ] AA-k hilabete bakoitzean ekintzak aukeratzen ditu
- [ ] AA-ren ekintzak jokoaren arauak errespetatzen dituzte
- [ ] Failover sistema funtzionatzen du (GroQ → GitHub Models → estatikoa)
- [ ] AA-k nortasun koherentea erakusten du
- [ ] Token erabilera kontrolatuta dago

### 8.4. Interfazea

- [ ] Mapa isometrikoa zuzen errendatzen da
- [ ] Zona koloreak intuitiboak dira (R=berdea, C=urdina, I=horia)
- [ ] Aurrekontu panela erabilgarria eta informatibo da
- [ ] Datu gainjarriak mapa gainean zuzen erakusten dira
- [ ] AA txandaren bistaratzea funtzionatzen du
- [ ] Responsive diseinua (gutxienez 1280x720)
