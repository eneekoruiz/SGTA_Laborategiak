# Data Overlays Implementation Report
## Validation Against SPECS.md + Road Map for Completion

**Generated:** 2026-04-04
**Status:** Phase 1 Data Overlays - 60% Complete (Frontend), 0% Complete (Backend)
**Git Status:** All changes untracked/uncommitted

---

## EXECUTIVE SUMMARY

The Data Overlays system has a **solid foundation** with working frontend UI, canvas rendering, and 4 of 9 required overlay types implemented. However, it is **incomplete for production** due to:

1. **Missing 5 overlay types** (pollution_water, power, water, fire_coverage, police_coverage)
2. **No backend implementation** (API endpoint, database schema)
3. **Naming inconsistency** (uses 'pollution' instead of 'pollution_air')
4. **Untracked changes** (all files are uncommitted)

**Estimated effort to completion: 8-10 hours**

---

## COMPLIANCE MATRIX

### ✅ FULLY IMPLEMENTED (4/9 Overlays)

| Type | Status | Component | Canvas | Generator |
|------|--------|-----------|--------|-----------|
| `crime` | ✅ | ✓ Button | ✓ Rendering | ✓ Function |
| `pollution_air` | ⚠️ Named as 'pollution' | ✓ Button | ✓ Rendering | ✓ Function |
| `land_value` | ✅ | ✓ Button | ✓ Rendering | ✓ Function |
| `traffic` | ✅ | ✓ Button | ✓ Rendering | ✓ Function |

### ✅ PARTIALLY IMPLEMENTED (2/9 - Disabled)

| Type | Status | Component | Canvas | Generator |
|------|--------|-----------|--------|-----------|
| `health` | ⚠️ Disabled | ✗ "Coming Phase 2" | ✓ Rendering | ✓ Function |
| `education` | ⚠️ Disabled | ✗ "Coming Phase 2" | ✓ Rendering | ✓ Function |

**Note:** Generators exist but UI buttons are marked as disabled. This is reasonable for Group 8 modularity but creates inconsistency.

### ❌ MISSING (3/9 Overlays)

| Type | Generator | UI Button | Canvas Handler | Specs Requirement |
|------|-----------|-----------|-----------------|------------------|
| `pollution_water` | ✗ Missing | ✗ No button | ✗ No color def | Section 3.7, 6.7 |
| `power` | ✗ Missing | ✗ No button | ✗ No color def | Section 2.4, 4.2 |
| `water` | ✗ Missing | ✗ No button | ✗ No color def | Section 2.4, 4.2, 6.7 |

### ❌ NOT IMPLEMENTED (2/9 Service Coverage)

| Type | Generator | UI Button | Canvas Handler | Specs Requirement |
|------|-----------|-----------|-----------------|------------------|
| `fire_coverage` | ✗ Missing | ✗ No button | ✗ No color def | Section 2.4, 4.2 |
| `police_coverage` | ✗ Missing | ✗ No button | ✗ No color def | Section 2.4, 4.2 |

---

## CRITICAL GAPS & ERRORS

### 1. TYPE NAMING MISMATCH (BLOCKING BACKEND INTEGRATION)
**Specs require:** `pollution_air`, `pollution_water` (separate overlays)
**Implementation provides:** `pollution` (generic)

**Impact:** When backend API is implemented, frontend/backend will have mismatched type values.

**Fix:** Rename generator and button to `pollution_air` consistently.

---

### 2. MISSING OVERLAY GENERATORS (5 Functions)
Location: `frontend/src/services/overlayService.ts`

**Missing implementations:**
```typescript
// NOT IMPLEMENTED:
export function generatePollutionWaterOverlay(...): OverlayData
export function generatePowerOverlay(...): OverlayData
export function generateWaterOverlay(...): OverlayData
export function generateFireCoverageOverlay(...): OverlayData
export function generatePoliceCoverageOverlay(...): OverlayData
```

**Required formulas (from SPECS.md):**

#### generatePollutionWaterOverlay()
- Base: Industrial zone proximity pollution
- Ports increase water pollution heavily
- Water treatment plants reduce (formula: `water_pollution = industrial_runoff - treatment_plant_capacity`)
- Formula location: Section 3.7, 6.7

#### generatePowerOverlay()
- Power plants = 255 (max)
- BFS algorithm from plants, decay by distance
- Brownout zones = 30 (low)
- Formula location: Section 3.4, 6.10

#### generateWaterOverlay()
- Water pumps = 255 (max)
- BFS algorithm from pumps, pressure decay over distance
- Pressure map: `water_pressure = pump_output - (distance × decay_factor)`
- Formula location: Section 3.5, 6.7

#### generateFireCoverageOverlay()
- Fire stations = 240 (base coverage)
- Effective radius = 18 tiles × (funding_pct / 100)
- Distance decay: linear from 240 → 0
- Unprotected zones = 20
- Formula location: Section 3.6, section 1.7

#### generatePoliceCoverageOverlay()
- Police stations = 240 (base coverage)
- Effective radius = 18 tiles × (funding_pct / 100)
- Distance decay: inverse proportional
- Formula location: Section 3.6, section 1.7

---

### 3. INCOMPLETE COLOR MAPPING (IsometricMap.svelte)
**Location:** `getOverlayColor()` function

**Currently defined (4 colors):**
```javascript
const colorMap: Record<string, { light: string; dark: string }> = {
  crime: { light: '#ffebee', dark: '#c41c3b' },
  pollution: { light: '#fff3e0', dark: '#e65100' },
  land_value: { light: '#e8f5e9', dark: '#1b5e20' },
  traffic: { light: '#f3e5f5', dark: '#4a148c' }
};
```

**Missing (5 new colors):**
```javascript
pollution_air: { light: '#fff3e0', dark: '#e65100' },     // RENAME pollution
pollution_water: { light: '#e3f2fd', dark: '#01579b' },   // NEW
power: { light: '#fffde7', dark: '#f57f17' },             // NEW
water: { light: '#b3e5fc', dark: '#01579b' },             // NEW
fire_coverage: { light: '#ffebee', dark: '#d32f2f' },     // NEW
police_coverage: { light: '#e8eaf6', dark: '#1a237e' }    // NEW
health: { light: '#e0f2f1', dark: '#00695c' },            // Already defined
education: { light: '#ede7f6', dark: '#512da8' }          // Already defined
```

---

### 4. INCONSISTENT HEALTH/EDUCATION STATUS
**Current state:** Generators exist but UI buttons disabled with "Coming in Phase 2"

**Options:**
- Option A: Enable the buttons (generators are complete)
- Option B: Remove generators until truly ready (keep disabled state)
- Option C: Create clear phase timeline (recommended)

**Recommendation:** Enable with comment that they're available but might be refined in Phase 2.

---

### 5. NO BACKEND IMPLEMENTATION
**Missing:**
- `/backend` directory entirely absent
- API endpoint: `GET /api/games/{gameId}/overlay/{type}` (not implemented)
- Database schema for overlay persistence (not defined)
- FastAPI service layer

**Currently:** Frontend calls `apiService.getOverlay()` which tries real API, falls back to mock.
**When backend built:** API payload will match OverlayData interface ✓ (this is correct)

---

### 6. UNTRACKED CHANGES
**All new files uncommitted:**
```
Changes not staged for commit:
  ?? frontend/src/components/DataOverlaySelector.svelte
  ?? frontend/src/services/overlayService.ts (partially modified)
  ?? frontend/src/components/IsometricMap.svelte (partially modified)
  ?? frontend/src/App.svelte (partially modified)
```

**Action needed:** Commit these changes with proper message before merging.

---

## DETAILED SPECIFICATIONS FROM SPECS.MD

### Section 2.4: API Specification
**GET /api/games/{gameId}/overlay/{type}**

```yaml
Type Values:
  - crime
  - pollution_air        ← Currently named 'pollution'
  - pollution_water      ← MISSING
  - land_value
  - traffic
  - power                ← MISSING
  - water                ← MISSING
  - fire_coverage        ← MISSING
  - police_coverage      ← MISSING

Response:
  overlay_type: string
  data: number[][]       (2D grid of values 0-255)
  min_value: number
  max_value: number
```

### Section 4.2: Frontend Component
**DataOverlaySelector**

Specification (Basque):
> "Gainjarri aukeratzailea: krimena, kutsadura, lur-balioa, trafikoa, energia, ura, su/polizia estaldura."

Translation:
> "Overlay selector for: crime, pollution, land value, traffic, energy, water, fire/police coverage."

Current implementation: ✓ 4 of 4 main overlays + ✗ 5 missing (energy, water, fire, police, split pollution)

### Section 4.4: Frontend Acceptance Criteria
- [✓] Data overlays shown as color gradients on map
- [✓] Legend bar visible with value gradient
- [⚠️] All 9 overlay types accessible (currently only 4 + 2 disabled)

---

## PRIORITY IMPLEMENTATION ROADMAP

### Phase 1: Frontend Completion (4-5 hours)

#### 1.1 Add 5 Missing Generators (1.5 hours)
**File:** `frontend/src/services/overlayService.ts`

Add these 5 functions:
```typescript
generatePollutionWaterOverlay(tiles, mapWidth, mapHeight): OverlayData
generatePowerOverlay(tiles, mapWidth, mapHeight): OverlayData
generateWaterOverlay(tiles, mapWidth, mapHeight): OverlayData
generateFireCoverageOverlay(tiles, mapWidth, mapHeight): OverlayData
generatePoliceCoverageOverlay(tiles, mapWidth, mapHeight): OverlayData
```

**Test strategy:** Create simple test game state with service buildings, verify each overlay renders.

#### 1.2 Update DataOverlaySelector (1 hour)
**File:** `frontend/src/components/DataOverlaySelector.svelte`

1. Rename 'pollution' → 'pollution_air'
2. Add buttons for: pollution_water, power, water, fire_coverage, police_coverage
3. Remove `disabled: true` from health/education OR add comment explaining Phase 2

#### 1.3 Update Color Mapping in IsometricMap (0.5 hours)
**File:** `frontend/src/components/IsometricMap.svelte`

Update `getOverlayColor()` colorMap to include all 9 types with proper light/dark gradients.

#### 1.4 Update getOverlayData() Router (0.5 hours)
**File:** `frontend/src/services/overlayService.ts`

Update the switch statement to handle all 9 types with proper case names.

#### 1.5 Git Commit (0.5 hours)
```bash
git add frontend/src/components/DataOverlaySelector.svelte
git add frontend/src/services/overlayService.ts
git add frontend/src/components/IsometricMap.svelte
git add frontend/src/App.svelte
git commit -m "feat: complete data overlay system with all 9 overlay types

- Implement missing generators: pollution_water, power, water, fire_coverage, police_coverage
- Add UI buttons for all 9 overlay types with proper color scheme
- Update canvas color mapping for all overlay types with distance decay
- Fix naming: 'pollution' → 'pollution_air' for spec compliance
- Enable health/education overlays or defer to Phase 2 with clear notes
- Ensure proper BFS algorithms for service coverage overlays

Addresses SPECS.md Section 2.4 and 4.2 requirements."
```

---

### Phase 2: Backend Implementation (3-5 hours)

#### 2.1 Create FastAPI Backend Structure (1 hour)
Create `/backend` directory with:
```
backend/
├── requirements.txt        (FastAPI, Pydantic, NumPy)
├── app/
│   ├── main.py            (FastAPI app initialization)
│   ├── routes/
│   │   └── overlays.py    (Overlay endpoint)
│   ├── services/
│   │   └── overlay_service.py (Core logic)
│   └── models/
│       └── overlay.py     (Pydantic models)
```

#### 2.2 Implement Overlay Endpoint (1.5 hours)
**File:** `backend/app/routes/overlays.py`

```python
@router.get("/api/games/{game_id}/overlay/{overlay_type}")
async def get_overlay(
    game_id: str,
    overlay_type: str,
    current_user: User = Depends(get_current_user)
) -> OverlayData:
    """Get overlay data for game and type"""
    # Validate type
    # Load game state
    # Generate overlay (use overlayService matching frontend logic)
    # Return OverlayData
```

#### 2.3 Port Generator Logic (1.5 hours)
**File:** `backend/app/services/overlay_service.py`

Port all 9 generator functions from frontend TypeScript to Python using NumPy.
Use BFS (deque) for power/water/coverage algorithms.

#### 2.4 Integration Testing (0.5 hours)
Test all 9 overlay types with real game state.
Verify performance < 50ms per overlay.

---

### Phase 3: Optimization & Polish (1-2 hours)

#### 3.1 Add Caching Layer
- Cache overlay results if tiles unchanged (TTL: 30s)
- Consider Redis for distributed caching

#### 3.2 Add In-Game Tooltips
- Hover info for each overlay button
- Explain what values mean (Low→High)

#### 3.3 Documentation
- Update CLAUDE.md with overlay architecture
- Add tooltips to UI elements

---

## FILES IMPACTED

### To Modify (Frontend - Frontend Complete)
```
frontend/src/services/overlayService.ts
  - Rename: generatePollutionOverlay → generatePollutionAirOverlay
  - Add: 5 missing generator functions
  - Update: getOverlayData() switch statement

frontend/src/components/DataOverlaySelector.svelte
  - Update: overlayTypes array with all 9 types
  - Update: getLegendColor() colorMap for all types
  - Remove or clarify: disabled state for health/education

frontend/src/components/IsometricMap.svelte
  - Update: getOverlayColor() colorMap with all 9 definitions

frontend/src/App.svelte
  - Already updated: activeOverlay state + binding
  - Review: DataOverlaySelector integration
```

### To Create (Backend - Phase 2)
```
backend/app/routes/overlays.py          (NEW)
backend/app/services/overlay_service.py (NEW)
backend/app/models/overlay.py           (NEW)
backend/requirements.txt                 (UPDATE)
```

### Type Definitions
```
frontend/src/types/game.ts
  - OverlayData interface ✓ Already correct
  - May need OverlayType enum to add
```

---

## ACCEPTANCE CRITERIA FOR COMPLETION

### Frontend (Must complete Phase 1)
- [ ] All 9 overlay types have UI buttons
- [ ] All 9 overlay types render on canvas with correct colors
- [ ] Legend bar shows correct color gradient for selected overlay
- [ ] No disabled overlays (or clear phase-2 note)
- [ ] 'pollution_air' and 'pollution_water' are separate overlays
- [ ] Can toggle between overlays without errors
- [ ] Performance: < 50ms generation, < 16.67ms rendering per frame
- [ ] Changes committed to git with descriptive message

### Backend (For production readiness)
- [ ] FastAPI service created
- [ ] GET /api/games/{gameId}/overlay/{type} endpoint works
- [ ] All 9 types return OverlayData with correct structure
- [ ] Performance: < 100ms per request
- [ ] API tested with real game states
- [ ] Docker integration tested
- [ ] Caching layer implemented (optional but recommended)

---

## SUMMARY TABLE

| Item | Status | Effort | Priority |
|------|--------|--------|----------|
| Crime overlay | ✅ Complete | 0h | - |
| Pollution (air) overlay | ✅ Complete (rename needed) | 0.25h | HIGH |
| Pollution (water) overlay | ❌ Missing | 0.5h | HIGH |
| Land value overlay | ✅ Complete | 0h | - |
| Traffic overlay | ✅ Complete | 0h | - |
| Power overlay | ❌ Missing | 0.75h | HIGH |
| Water overlay | ❌ Missing | 0.75h | HIGH |
| Fire coverage overlay | ❌ Missing | 0.75h | MEDIUM |
| Police coverage overlay | ❌ Missing | 0.75h | MEDIUM |
| DataOverlaySelector UI | ✅ Complete (needs updates) | 1h | HIGH |
| Canvas rendering | ✅ Complete (color mapping) | 0.5h | HIGH |
| Backend API | ❌ Missing | 3-4h | MEDIUM |
| Git commit | ❌ Not done | 0.5h | HIGH |
| **TOTAL REMAINING** | | **8-10h** | |

---

## RECOMMENDATION

**Immediate Action:** Complete Frontend Phase 1 (4-5 hours) today.
- This puts the system in a shippable state for frontend demos
- Unblocks backend team to implement API
- Resolves naming inconsistencies before they cause integration issues

**Then proceed to:** Backend Phase 2 (3-5 hours) next.

**Why this matters:** The frontend is 60% done; finishing it is faster than debugging a half-built backend in parallel.

---

**Next Steps:**
1. Review this report
2. Confirm Phase 1 implementation plan
3. Run implementation phase (estimate: 1 working day)
4. Commit changes
5. Begin backend development (Phase 2)
