# SimHiri Frontend Handover (Backend + LLM Team)

## 1. Purpose
This document explains exactly what the frontend sends, what it expects back, and how to plug your backend/LLM services in with minimum back-and-forth.

Frontend status: SPECS-complete and compile-clean.

## 2. Base Integration Rules
1. Base URL is controlled by `VITE_API_URL`.
2. Real backend mode is controlled by `VITE_LIVE_MODE=true`.
3. All requests are JSON with header `Content-Type: application/json`.
4. If auth token exists, frontend sends `Authorization: Bearer <token>`.
5. Frontend expects errors as JSON with `error` or `message`.
6. Health check endpoint used by frontend: `GET /api/health`.

## 3. API Contract Summary (Exact Payloads)

### 3.1 Building Placement
Endpoint:
- `POST /api/games/{gameId}/build`

Request body (exact):
```json
{
  "building_type": "<BuildingType>",
  "position": {
    "x": 12,
    "y": 8
  }
}
```

BuildingType values currently sent by frontend:
- `coal_power`
- `hydro_power`
- `oil_power`
- `gas_power`
- `nuclear_power`
- `wind_power`
- `solar_power`
- `microwave_power`
- `fusion_power`
- `police_station`
- `fire_station`
- `hospital`
- `prison`
- `school`
- `college`
- `library`
- `museum`
- `university`
- `bus_depot`
- `rail_station`
- `subway_station`
- `airport`
- `seaport`
- `water_pump`
- `water_treatment`

### 3.2 Disaster Launch
Endpoint:
- `POST /api/games/{gameId}/attack`

Request body (exact):
```json
{
  "disaster_type": "fire",
  "target": "ai"
}
```

Allowed values used by frontend:
- `disaster_type`: `fire`, `flood`, `tornado`, `earthquake`
- `target`: `player`, `ai`

### 3.3 Ordinance Toggle
Endpoint:
- `POST /api/games/{gameId}/ordinance`

Request body (exact):
```json
{
  "ordinance_id": "sales_tax",
  "action": "enact"
}
```

Allowed values used by frontend:
- `action`: `enact`, `repeal`
- `ordinance_id`: any ordinance id string known by backend (frontend includes full ordinance list in UI)

## 4. Expected Response Shape (Required for UI State Updates)
The frontend uses optimistic UI in some interactions, but authoritative state synchronization expects `game_state` in action responses.

### 4.1 Building placement response
Expected shape:
```json
{
  "success": true,
  "cost": 4000,
  "building": {},
  "treasury_after": 120000,
  "game_state": { "...": "full GameState" }
}
```

### 4.2 Disaster launch response
Expected shape:
```json
{
  "success": true,
  "cost": 5000,
  "disaster": {},
  "damage_report": {
    "buildings_damaged": 2,
    "zones_damaged": 5,
    "infrastructure_damaged": 4,
    "estimated_repair_cost": 15000
  },
  "treasury_after": 115000,
  "game_state": { "...": "full GameState" }
}
```

### 4.3 Ordinance toggle response
Expected shape:
```json
{
  "success": true,
  "ordinance": {},
  "budget_impact": -200,
  "game_state": { "...": "full GameState" }
}
```

### 4.4 Full GameState expectation
`game_state` should be the complete canonical game object (not partial patch), including:
- `current_date`
- `player_city` and `ai_city` (metrics, budget, ordinances, treasury, population)
- `map.tiles`
- `disaster_attacks`
- `victory_status`

Reason: multiple panels (HUD, map, overlays, budget, rival panel, AI replay context) read from shared central state.

## 5. How to Test with LIVE_MODE=true

### 5.1 Frontend setup
1. In `frontend`, create `.env.local`:
```env
VITE_LIVE_MODE=true
VITE_API_URL=http://localhost:8000
```
2. Start frontend:
```bash
cd frontend
npm install
npm run dev
```
3. Open app on Vite URL (usually `http://localhost:5173`).

### 5.2 Backend requirements for smooth plug-in
1. Enable CORS for `http://localhost:5173`.
2. Implement all game endpoints used by frontend service layer.
3. Return JSON on both success and error.
4. Keep auth JWT in `Authorization: Bearer <token>` compatible format.
5. Provide `GET /api/health` returning `200`.

### 5.3 Smoke test path (recommended)
1. Register and login.
2. Create a game.
3. Place one building, one zone, one infra segment.
4. Toggle one ordinance.
5. Launch one disaster on AI target.
6. End month and verify AI replay prompt appears.
7. Open budget and verify monthly/yearly summaries update.

## 6. UI Capabilities Already Implemented (Waiting for Your Data)
1. AI Replay Viewer
- Panel, split, and fullscreen modes implemented.
- Playback controls implemented: play/pause, back/next, fast-forward, restart, speed.
- Action feed + reasoning visualization implemented.

2. Budget Panel
- Tax and funding sliders implemented.
- Monthly and yearly balance summaries implemented.
- Bond issuance UI implemented.

3. Rival Intelligence Panel
- Rival population, score, treasury, approval.
- EQ/HQ/crime/pollution meter view.
- Last AI attack cooldown indicator.

4. Core map/gameplay front
- Isometric map, zone paint, infra draw, overlays, underground mode, building placement, HUD, cheat console, newspaper modal.

## 7. LLM Team Notes (AI Turn Contract)
Frontend consumes AI turn data from `POST /api/games/{gameId}/endMonth` under `ai_turn`.

Expected minimum `ai_turn` payload:
```json
{
  "actions": [
    {
      "action_type": "build",
      "description": "Built a power plant",
      "position": { "x": 10, "y": 15 }
    }
  ],
  "reasoning": "Short natural language explanation",
  "simulation": {
    "population_change": 120,
    "treasury_change": -500
  }
}
```

Frontend behavior:
- Uses `actions` + `reasoning` to populate AI Replay.
- Uses action `position`/`tile`/`location`/`target_tile` when present to focus camera.

## 8. Practical Do/Don’t for Fast Integration
1. Do always include `game_state` on state-changing endpoints.
2. Do keep enums exactly as documented above.
3. Do keep response JSON stable even if you add extra fields.
4. Don’t return partial map/city fragments unless explicitly versioned and coordinated.
5. Don’t change key names (`building_type`, `disaster_type`, `ordinance_id`, `action`) without frontend update.

## 9. Ownership Boundary
1. Frontend: done, SPECS-complete UI and state consumers.
2. Backend: authoritative simulation/state generation and persistence.
3. LLM service: generate valid AI turn actions/reasoning and remain within game rules.

If backend follows this contract, integration should be plug-and-play.
