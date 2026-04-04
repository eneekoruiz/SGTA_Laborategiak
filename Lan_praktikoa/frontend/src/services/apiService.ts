import { mockApiService } from './mockApiService';
import { deductTreasury } from '../store/game';
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
 * API SERVICE LAYER
 *
 * This is the CRITICAL layer for backend readiness.
 * All player actions flow through here: UI → apiService → API/Mock → Store → Render
 *
 * Pattern:
 * 1. Try real backend (if VITE_API_URL is set and available)
 * 2. Fall back to mock if backend fails
 * 3. Type-safe returns matching SPECS.md
 *
 * When FastAPI backend is ready, only this file needs updates.
 * No changes needed in App.svelte or components.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_TIMEOUT = 10000; // 10 seconds

interface FetchOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
}

/**
 * Low-level fetch wrapper.
 * Handles JWT auth, error translation, timeouts.
 */
async function request<T>(
  endpoint: string,
  options: FetchOptions
): Promise<T> {
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
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    // Network error, timeout, or parse failure
    throw new Error(
      err instanceof Error ? err.message : 'API request failed'
    );
  }
}

/**
 * Fallback wrapper: Try real API, fall back to mock on failure.
 * This is the magic that makes the frontend backend-agnostic.
 */
async function tryRealElseMock<T>(
  endpoint: string,
  options: FetchOptions,
  mockFallback: () => Promise<T>
): Promise<T> {
  // If no real backend URL, use mock immediately
  if (!import.meta.env.VITE_API_URL) {
    return mockFallback();
  }

  try {
    return await request<T>(endpoint, options);
  } catch (err) {
    console.warn(`Real API failed (${endpoint}), falling back to mock:`, err);
    return mockFallback();
  }
}

/**
 * GAME LIFECYCLE ENDPOINTS
 */

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

/**
 * GAME ACTION ENDPOINTS - These modify game state
 * Return format: { success: true, ... state updates ... }
 */

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

  // Deduct cost from treasury immediately
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

  // Deduct cost from treasury immediately
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

  // Deduct cost from treasury immediately
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

  // Add refund to treasury immediately
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

/**
 * QUERY ENDPOINTS - These read game data without modifying
 */

export async function getOverlay(
  gameId: string,
  type: string
): Promise<OverlayData> {
  return tryRealElseMock(
    `/api/games/${gameId}/overlay/${type}`,
    { method: 'GET' },
    () => mockApiService.getOverlay(gameId, type)
  );
}

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
 */
export async function isBackendHealthy(): Promise<boolean> {
  if (!import.meta.env.VITE_API_URL) return false;
  try {
    const response = await fetch(`${API_BASE}/api/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}
