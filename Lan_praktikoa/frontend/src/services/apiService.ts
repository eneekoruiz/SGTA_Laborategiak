import { mockApiService } from './mockApiService';
import { deductTreasury } from '../store/game';
import { handleApiError, onApiSuccess } from './errorHandler';
import type {
  GameState,
  StatsResponse,
  EducationResponse,
  HealthResponse,
  OverlayData,
  CheatResponse,
  Position,
  Size,
  ZoneType,
  InfrastructureType,
  InfraSegment
} from '../types/game';

/**
 * API SERVICE LAYER — BACKEND-READY
 *
 * ✅ LIVE_MODE toggle: Control real vs mock
 * ✅ Environment-based BASE_URL: Switch backends without code changes
 * ✅ Global error handling: Network failures → user notifications
 * ✅ Type-safe contracts: Exact SPECS.md JSON structures
 *
 * When the backend (FastAPI/Flask) is deployed:
 * 1. Set VITE_LIVE_MODE=true
 * 2. Set VITE_API_URL=http://backend-url:port
 * 3. No frontend code changes needed ✨
 */

// ═════════════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════════════

/**
 * LIVE_MODE toggle: true = real backend, false = mocks only
 * Default: false (always use mocks in dev)
 * Set via: VITE_LIVE_MODE=true in .env or env var
 */
const LIVE_MODE = import.meta.env.VITE_LIVE_MODE === 'true';

/**
 * Backend URL
 * Default: http://localhost:8000 (FastAPI standard)
 * Can override: VITE_API_URL=http://custom-backend:5000
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Request timeout in milliseconds
 */
const API_TIMEOUT = 10000; // 10 seconds

// Log configuration on startup
if (typeof window !== 'undefined') {
  console.info('[API Config]', {
    LIVE_MODE,
    API_BASE,
    Backend: LIVE_MODE ? 'REAL (FastAPI/Flask)' : 'MOCK (development)',
    Timeout: `${API_TIMEOUT}ms`
  });
}

interface FetchOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
}

/**
 * Low-level fetch wrapper with error handling.
 * Handles JWT auth, timeouts, and all error scenarios.
 */
async function request<T>(endpoint: string, options: FetchOptions): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Add JWT token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (token || options.token) {
    headers['Authorization'] = `Bearer ${token || options.token}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Parse error response from backend
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Backend returned invalid JSON
      }

      const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      (error as any).response = response;
      throw error;
    }

    const data = await response.json();
    onApiSuccess(); // Reset failure counter on success
    return data;
  } catch (err) {
    // Handle all types of errors
    if (err instanceof Error) {
      if (err.message.includes('abort')) {
        // Request was aborted (timeout)
        handleApiError(err, endpoint, 'Request timeout');
        throw new Error('Request timeout');
      } else {
        // Network error or parse error
        handleApiError(err, endpoint);
        throw err;
      }
    } else {
      // Unknown error
      const error = new Error('API request failed');
      handleApiError(error, endpoint);
      throw error;
    }
  }
}

/**
 * Smart fallback wrapper: Try real API, fall back to mock.
 *
 * LIVE_MODE=true: Always try real backend
 * LIVE_MODE=false: Always use mock (development)
 */
async function tryRealElseMock<T>(
  endpoint: string,
  options: FetchOptions,
  mockFallback: () => Promise<T>
): Promise<T> {
  // If LIVE_MODE disabled, use mock immediately
  if (!LIVE_MODE) {
    return mockFallback();
  }

  // LIVE_MODE enabled: Try real backend
  try {
    return await request<T>(endpoint, options);
  } catch (err) {
    console.warn(`[API] Real backend failed for ${endpoint}, falling back to mock:`, err);
    // Fallback to mock if real API fails
    return mockFallback();
  }
}

/**
 * Force-real request: Always hits backend, no mock fallback
 * Used for critical endpoints where mocks don't make sense
 */
async function realOnly<T>(endpoint: string, options: FetchOptions): Promise<T> {
  if (!LIVE_MODE) {
    throw new Error(
      `[API] LIVE_MODE is disabled. Cannot call ${endpoint} without backend. ` +
        `Set VITE_LIVE_MODE=true in .env to enable real backend.`
    );
  }
  return request<T>(endpoint, options);
}

// ═════════════════════════════════════════════════════════════
// GAME LIFECYCLE ENDPOINTS
// ═════════════════════════════════════════════════════════════

export async function getGame(gameId: string): Promise<{ game_state: GameState }> {
  return tryRealElseMock(
    `/api/games/${gameId}`,
    { method: 'GET' },
    () => mockApiService.getGame(gameId)
  );
}

export async function getStats(gameId: string): Promise<StatsResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/stats`,
    { method: 'GET' },
    () => mockApiService.getStats(gameId)
  );
}

export async function getEducation(gameId: string): Promise<EducationResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/education`,
    { method: 'GET' },
    () => mockApiService.getEducation(gameId)
  );
}

export async function getHealth(gameId: string): Promise<HealthResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/health`,
    { method: 'GET' },
    () => mockApiService.getHealth(gameId)
  );
}

export async function saveGame(
  gameId: string,
  name?: string
): Promise<{ message: string; saved_at: string }> {
  return tryRealElseMock(
    `/api/games/${gameId}/save`,
    { method: 'POST', body: { name } },
    () =>
      Promise.resolve({
        message: 'Game saved (mock)',
        saved_at: new Date().toISOString()
      })
  );
}

// ═════════════════════════════════════════════════════════════
// GAME ACTION ENDPOINTS - These modify game state
// ═════════════════════════════════════════════════════════════

export async function placeZone(
  gameId: string,
  zoneType: ZoneType,
  position: Position,
  size: Size
): Promise<{
  success: boolean;
  cost: number;
  zone: any;
  treasury_after: number;
  game_state: GameState;
}> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/zone`,
    {
      method: 'POST',
      body: { zone_type: zoneType, position, size }
    },
    () =>
      mockApiService.placeZone(gameId, zoneType, position, size).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );

  // Deduct cost from treasury immediately (action buffering)
  if (result.success) {
    deductTreasury(result.cost);
  }

  return result;
}

export async function placeInfrastructure(
  gameId: string,
  type: InfrastructureType,
  segments: InfraSegment[]
): Promise<{
  success: boolean;
  cost: number;
  segments_placed: number;
  treasury_after: number;
  game_state: GameState;
}> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/infrastructure`,
    {
      method: 'POST',
      body: { type, segments }
    },
    () =>
      mockApiService.placeInfrastructure(gameId, type, segments).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );

  // Deduct cost from treasury immediately (action buffering)
  if (result.success) {
    deductTreasury(result.cost);
  }

  return result;
}

export async function buildStructure(
  gameId: string,
  buildingType: string,
  position: Position
): Promise<{
  success: boolean;
  cost: number;
  building: any;
  treasury_after: number;
  game_state: GameState;
}> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/build`,
    {
      method: 'POST',
      body: { building_type: buildingType, position }
    },
    () =>
      mockApiService.buildStructure(gameId, buildingType, position).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );

  // Deduct cost from treasury immediately (action buffering)
  if (result.success) {
    deductTreasury(result.cost);
  }

  return result;
}

export async function demolish(
  gameId: string,
  position: Position,
  type: string
): Promise<{
  success: boolean;
  demolished_type: string;
  refund: number;
  game_state: GameState;
}> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/demolish`,
    {
      method: 'POST',
      body: { position, type }
    },
    () =>
      mockApiService.demolish(gameId, position, type).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );

  // Add refund to treasury immediately (action buffering)
  if (result.success) {
    deductTreasury(-result.refund); // Negative deduction = addition
  }

  return result;
}

export async function updateBudget(
  gameId: string,
  taxRates?: Record<string, number>,
  funding?: Record<string, number>
): Promise<{
  success: boolean;
  budget: any;
  estimated_monthly_balance: number;
  game_state: GameState;
}> {
  const body: Record<string, any> = {};
  if (taxRates) body.tax_rates = taxRates;
  if (funding) body.funding = funding;

  return tryRealElseMock(
    `/api/games/${gameId}/budget`,
    { method: 'POST', body },
    () =>
      mockApiService.updateBudget(gameId, taxRates, funding).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );
}

export async function toggleOrdinance(
  gameId: string,
  ordinanceId: string,
  action: 'enact' | 'repeal'
): Promise<{
  success: boolean;
  ordinance: any;
  budget_impact: number;
  game_state: GameState;
}> {
  return tryRealElseMock(
    `/api/games/${gameId}/ordinance`,
    { method: 'POST', body: { ordinance_id: ordinanceId, action } },
    () =>
      mockApiService.toggleOrdinance(gameId, ordinanceId, action).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );
}

export async function issueBond(
  gameId: string,
  amount: number
): Promise<{
  success: boolean;
  bond: any;
  treasury_after: number;
  game_state: GameState;
}> {
  return tryRealElseMock(
    `/api/games/${gameId}/bond`,
    { method: 'POST', body: { amount } },
    () =>
      mockApiService.issueBond(gameId, amount).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );
}

export async function attackRival(
  gameId: string,
  disasterType: string,
  target: 'player' | 'ai'
): Promise<{
  success: boolean;
  cost: number;
  disaster: any;
  damage_report: any;
  treasury_after: number;
  game_state: GameState;
}> {
  return tryRealElseMock(
    `/api/games/${gameId}/attack`,
    { method: 'POST', body: { disaster_type: disasterType, target } },
    () =>
      mockApiService.attackRival(gameId, disasterType, target).then((result) => ({
        ...result,
        game_state: { /* Will be populated by mock */ } as GameState
      }))
  );
}

export async function endMonth(
  gameId: string
): Promise<{
  success: boolean;
  new_date: { year: number; month: number };
  player_simulation: any;
  ai_turn: any;
  game_state: GameState;
  victory_check: any;
}> {
  return tryRealElseMock(
    `/api/games/${gameId}/endMonth`,
    { method: 'POST' },
    () => mockApiService.endMonth(gameId)
  );
}

export async function submitCheat(
  gameId: string,
  cheatCode: string
): Promise<CheatResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/cheat`,
    { method: 'POST', body: { cheat_code: cheatCode } },
    () => mockApiService.submitCheat(gameId, cheatCode)
  );
}

// ═════════════════════════════════════════════════════════════
// QUERY ENDPOINTS - These read game data without modifying
// ═════════════════════════════════════════════════════════════

export async function getOverlay(gameId: string, type: string): Promise<OverlayData> {
  return tryRealElseMock(
    `/api/games/${gameId}/overlay/${type}`,
    { method: 'GET' },
    () => mockApiService.getOverlay(gameId, type)
  );
}

// ═════════════════════════════════════════════════════════════
// UTILITY ENDPOINTS
// ═════════════════════════════════════════════════════════════

/**
 * Helper function for tile service connections (used by IsometricMap)
 * This is mock-only for now (not part of SPECS.md public API)
 */
export async function getTileServiceConnection(
  gameId: string,
  x: number,
  y: number,
  tilesGrid: any
) {
  return mockApiService.getTileServiceConnection(gameId, x, y, tilesGrid);
}

/**
 * Utility: Check if real backend is available
 * Returns immediately without error handling
 */
export async function isBackendHealthy(): Promise<boolean> {
  if (!LIVE_MODE) return false;
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * API Configuration Getters (for debugging/admin)
 */
export function getApiConfig() {
  return {
    LIVE_MODE,
    API_BASE,
    API_TIMEOUT
  };
}
