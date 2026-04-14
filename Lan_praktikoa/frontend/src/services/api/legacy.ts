import { mockApiService } from '../mock/legacy';
import {
  deductTreasury,
  population,
  rci_demand,
  setGameState,
  setStats,
  treasury,
  updateTileAt
} from '../../store/game';
import { handleApiError, onApiSuccess } from '../errorHandler';
import { navigate } from '../router';
import type {
  AITurnAction,
  AITurnPayload,
  Budget,
  BuildingType,
  GameState,
  Building,
  Tile,
  StatsResponse,
  EducationResponse,
  HealthResponse,
  OverlayData,
  CheatResponse,
  Position,
  Size,
  Zone,
  ZoneType,
  InfrastructureType,
  InfraSegment
} from '../../types/game';

interface AuthUser {
  id: string;
  username: string;
  email?: string;
}

interface RegisterResponse {
  message: string;
  user: AuthUser;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface ProfileResponse {
  id: string;
  username: string;
  email: string;
  created_at: string;
  games_count: number;
}

interface GameListItem {
  id: string;
  name: string;
  scenario_id: string;
  current_date: { year: number; month: number };
  player_city_name: string;
  player_population: number;
  ai_city_name: string;
  ai_population: number;
  victory_status: string;
  last_saved: string;
  is_autosave: boolean;
}

interface GamesListResponse {
  games: GameListItem[];
}

interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  difficulty_options: string[];
  map_size: { width: number; height: number };
}

interface ScenariosResponse {
  scenarios: ScenarioSummary[];
}

interface CreateGameConfig {
  name: string;
  scenario_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  player_city_name: string;
  ai_personality: 'expansionist' | 'ecologist' | 'industrialist' | 'balanced' | 'tax_collector';
  disasters_enabled: boolean;
}

interface CreateGameResponse {
  game_id: string;
  game_state: GameState;
}

interface DeleteGameResponse {
  success: boolean;
  message: string;
}

interface ZoneActionResponse {
  success: boolean;
  cost: number;
  zone: Zone;
  treasury_after: number;
  game_state: GameState;
}

interface BuildActionResponse {
  success: boolean;
  cost: number;
  building: Building;
  treasury_after: number;
  game_state: GameState;
}

interface DemolishResponse {
  success: boolean;
  demolished_type: string;
  cost?: number;
  refund: number;
  game_state: GameState;
}

interface BudgetUpdateResponse {
  success: boolean;
  budget: Budget;
  estimated_monthly_balance: number;
  game_state: GameState;
}

interface OrdinanceActionResponse {
  success: boolean;
  ordinance: { id?: string; active?: boolean; [key: string]: unknown };
  budget_impact: number;
  game_state: GameState;
}

interface BondActionResponse {
  success: boolean;
  bond: {
    amount: number;
    interest_rate: number;
    months_remaining: number;
    monthly_payment?: number;
  };
  treasury_after: number;
  game_state: GameState;
}

interface DisasterDamageReport {
  buildings_damaged: number;
  zones_damaged: number;
  infrastructure_damaged: number;
  estimated_repair_cost: number;
}

interface AttackResponse {
  success: boolean;
  cost: number;
  disaster: {
    id: string;
    type: string;
    position: Position;
    radius: number;
    damage_level: number;
  };
  damage_report: DisasterDamageReport;
  treasury_after: number;
  game_state: GameState;
}

interface EndMonthResponse {
  success: boolean;
  new_date: { year: number; month: number };
  player_simulation: {
    population_change: number;
    treasury_change: number;
    zones_developed: number;
    zones_abandoned: number;
    new_power_capacity: number;
    events: string[];
  };
  ai_turn: AITurnPayload | null;
  game_state: GameState;
  victory_check: {
    status: string;
    winner: 'player' | 'ai' | null;
    reason: string | null;
  };
  stats?: StatsResponse;
}

const AUTH_TOKEN_KEY = 'authToken';

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
 * Runtime provider switch.
 *
 * Why: pluggability requires changing provider behavior without touching
 * call sites, so the rest of the app remains backend-agnostic.
 */
const apiRuntimeConfig = {
  useMock: !LIVE_MODE
};

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
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          const isAuthRoute = path === '/login' || path === '/register';
          if (!isAuthRoute) {
            navigate('/login', true);
          }
        }
      }

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
  if (apiRuntimeConfig.useMock) {
    try {
      return await mockFallback();
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error('Mock provider failed');
      handleApiError(wrapped, endpoint, 'mock provider');
      throw wrapped;
    }
  }

  return request<T>(endpoint, options);
}

/**
 * Force-real request: Always hits backend, no mock fallback
 * Used for critical endpoints where mocks don't make sense
 */
async function realOnly<T>(endpoint: string, options: FetchOptions): Promise<T> {
  if (apiRuntimeConfig.useMock) {
    throw new Error(
      `[API] Mock provider is active. Cannot call ${endpoint} in real-only mode. ` +
        `Disable useMock to force backend integration calls.`
    );
  }
  return request<T>(endpoint, options);
}

// ═════════════════════════════════════════════════════════════
// GAME LIFECYCLE ENDPOINTS
// ═════════════════════════════════════════════════════════════

/**
 * Loads canonical game state from active provider.
 *
 * Why: route-level loaders must consume one provider-agnostic contract for
 * seamless backend handoff between USE_MOCK and live APIs.
 */
export async function getGame(gameId: string): Promise<{ game_state: GameState }> {
  return tryRealElseMock(
    `/api/games/${gameId}`,
    { method: 'GET' },
    () => mockApiService.getGame(gameId)
  );
}

/**
 * Loads scoreboard/stats projection for HUD and side panels.
 *
 * Why: keeping this endpoint wrapper stable avoids coupling UI widgets to
 * provider-specific payload differences during backend integration.
 */
export async function getStats(gameId: string): Promise<StatsResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/stats`,
    { method: 'GET' },
    () => mockApiService.getStats(gameId)
  );
}

/**
 * Fetches education analytics from the active API provider.
 *
 * Why: group-module UI should not branch by provider when backend endpoints land.
 */
export async function getEducation(gameId: string): Promise<EducationResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/education`,
    { method: 'GET' },
    () => mockApiService.getEducation(gameId)
  );
}

/**
 * Fetches health analytics from the active API provider.
 *
 * Why: keeps module-specific dashboards compatible across mock/live modes.
 */
export async function getHealth(gameId: string): Promise<HealthResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/health`,
    { method: 'GET' },
    () => mockApiService.getHealth(gameId)
  );
}

/**
 * Persists a savegame snapshot through the provider boundary.
 *
 * Why: persistence semantics stay centralized while backend save APIs mature.
 */
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
): Promise<ZoneActionResponse> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/zone`,
    {
      method: 'POST',
      body: { zone_type: zoneType, position, size }
    },
    () => mockApiService.placeZone(gameId, zoneType, position, size)
  );

  // Deduct cost from treasury immediately (action buffering)
  if (result.success) {
    deductTreasury(result.cost);
  }

  return result;
}

/**
 * Places infrastructure segments through a provider-agnostic endpoint wrapper.
 *
 * Why: keeps action buffering and treasury updates identical in mock and backend modes.
 */
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
    () => mockApiService.placeInfrastructure(gameId, type, segments)
  );

  // Deduct cost from treasury immediately (action buffering)
  if (result.success) {
    deductTreasury(result.cost);
  }

  return result;
}

/**
 * Places a building using the canonical /build contract.
 *
 * Why: simulation write operations must share one boundary for backend parity.
 */
export async function buildStructure(
  gameId: string,
  buildingType: string,
  position: Position
): Promise<BuildActionResponse> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/build`,
    {
      method: 'POST',
      body: { building_type: buildingType, position }
    },
    () => mockApiService.buildStructure(gameId, buildingType, position)
  );

  // Deduct cost from treasury immediately (action buffering)
  if (result.success) {
    deductTreasury(result.cost);
  }

  return result;
}

/**
 * Alias retained for older callers while preserving canonical build behavior.
 *
 * Why: avoids breaking existing UI integration while backend contract stabilizes.
 */
export async function placeBuilding(
  gameId: string,
  buildingType: string,
  position: Position
): Promise<BuildActionResponse> {
  return buildStructure(gameId, buildingType, position);
}

/**
 * Demolishes map content and applies refund/cost treasury side effects.
 *
 * Why: monetary effects are normalized here so provider differences do not leak to UI.
 */
export async function demolish(
  gameId: string,
  position: Position,
  type: string
): Promise<DemolishResponse> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/demolish`,
    {
      method: 'POST',
      body: { position, type }
    },
    () => mockApiService.demolish(gameId, position, type)
  );

  // Demolition has an explicit fee and a 50% refund of original cost.
  // Positive delta means treasury increases, negative delta means treasury decreases.
  if (result.success) {
    const demolitionFee = typeof result.cost === 'number' ? result.cost : 10;
    const treasuryDelta = result.refund - demolitionFee;
    deductTreasury(-treasuryDelta);
  }

  return result;
}

/**
 * Updates tax/funding budget values through provider boundary.
 *
 * Why: this isolates budget payload shape changes from panel component logic.
 */
export async function updateBudget(
  gameId: string,
  taxRates?: Record<string, number>,
  funding?: Record<string, number>
): Promise<BudgetUpdateResponse> {
  const body: Record<string, unknown> = {};
  if (taxRates) body.tax_rates = taxRates;
  if (funding) body.funding = funding;

  return tryRealElseMock(
    `/api/games/${gameId}/budget`,
    { method: 'POST', body },
    () => mockApiService.updateBudget(gameId, taxRates, funding)
  );
}

/**
 * Enacts or repeals one ordinance.
 *
 * Why: ordinance mutations stay backend-compatible behind one stable function.
 */
export async function toggleOrdinance(
  gameId: string,
  ordinanceId: string,
  action: 'enact' | 'repeal'
): Promise<OrdinanceActionResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/ordinance`,
    { method: 'POST', body: { ordinance_id: ordinanceId, action } },
    () => mockApiService.toggleOrdinance(gameId, ordinanceId, action)
  );
}

/**
 * Issues one municipal bond.
 *
 * Why: debt actions are centralized for consistent validation across providers.
 */
export async function issueBond(
  gameId: string,
  amount: number
): Promise<BondActionResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/bond`,
    { method: 'POST', body: { amount } },
    () => mockApiService.issueBond(gameId, amount)
  );
}

/**
 * Executes rival attack command.
 *
 * Why: disaster API semantics remain identical in mock/live integration flows.
 */
export async function attackRival(
  gameId: string,
  disasterType: string,
  target: 'player' | 'ai'
): Promise<AttackResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}/attack`,
    { method: 'POST', body: { disaster_type: disasterType, target } },
    () => mockApiService.attackRival(gameId, disasterType, target)
  );
}

/**
 * Commits one full month tick and synchronizes global stores.
 *
 * Why: this is the integration hinge where backend simulation output becomes
 * frontend authoritative state in both provider modes.
 */
export async function endMonth(
  gameId: string
): Promise<EndMonthResponse> {
  const result = await tryRealElseMock(
    `/api/games/${gameId}/endMonth`,
    { method: 'POST' },
    () => mockApiService.endMonth(gameId)
  );

  if (result?.game_state) {
    const gs = result.game_state;
    setGameState(gs);
    treasury.set(gs.player_city.treasury);
    population.set(gs.player_city.population);
    rci_demand.set({ ...gs.player_city.metrics.rci_demand });
    if (result.stats) {
      setStats(result.stats);
    }
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAiActions(rawActions: unknown): AITurnAction[] {
  if (typeof rawActions === 'string') {
    try {
      return parseAiActions(JSON.parse(rawActions));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(rawActions)) {
    return [];
  }

  return rawActions.filter(
    (action): action is AITurnAction =>
      !!action && typeof action === 'object' && typeof (action as AITurnAction).action_type === 'string'
  );
}

type MaybeGameStateResult = { game_state?: GameState } | null | undefined;

function syncStateFromAction(result: MaybeGameStateResult): void {
  if (result?.game_state) {
    setGameState(result.game_state);
  }
}

/**
 * Executes one normalized AI action against API wrappers.
 *
 * Why: backend AI payload shape evolves independently, so isolating action
 * dispatch keeps replay behavior stable in both USE_MOCK and live modes.
 */
async function runAiAction(gameId: string, action: AITurnAction): Promise<void> {
  if (action.action_type === 'zone' && action.position && action.zone_type) {
    const result = await placeZone(gameId, action.zone_type, action.position, { w: 1, h: 1 });
    syncStateFromAction(result);
    return;
  }

  if (action.action_type === 'build' && action.position && action.building_type) {
    const result = await buildStructure(gameId, action.building_type, action.position);
    syncStateFromAction(result);
    return;
  }

  if (action.action_type === 'infrastructure') {
    const infraType = action.infrastructure_type;
    const segments = Array.isArray(action.segments)
      ? action.segments
      : action.position
        ? [{ from: action.position, to: action.position }]
        : [];

    if (infraType && segments.length > 0) {
      const result = await placeInfrastructure(gameId, infraType, segments);
      syncStateFromAction(result);
    }
    return;
  }

  if (action.action_type === 'demolish' && action.position) {
    const result = await demolish(gameId, action.position, 'building');
    syncStateFromAction(result);
    return;
  }

  if (action.action_type === 'attack' && action.disaster_type && action.target) {
    const result = await attackRival(gameId, action.disaster_type, action.target);
    syncStateFromAction(result);
  }
}

/**
 * Replays AI action list against API wrappers step-by-step.
 *
 * Why: backend AI reasoning payloads can vary; replay normalization here keeps UI deterministic.
 */
export async function executeAiTurnActions(
  gameId: string,
  rawActions: unknown,
  stepDelayMs = 220
): Promise<void> {
  const actions = parseAiActions(rawActions);

  for (const action of actions) {
    if (!action || typeof action.action_type !== 'string') continue;
    await runAiAction(gameId, action);
    if (stepDelayMs > 0) await sleep(stepDelayMs);
  }
}

/**
 * Submits one cheat code request through active provider.
 *
 * Why: keeps cheat console independent from backend rollout status.
 */
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
 * Helper for tile-to-network diagnostics used by map interactions.
 *
 * Why: this stays outside public REST contract while frontend integration with
 * utility overlays is still being validated against backend behavior.
 */
export async function getTileServiceConnection(
  gameId: string,
  x: number,
  y: number,
  tilesGrid: Tile[][]
) {
  return mockApiService.getTileServiceConnection(gameId, x, y, tilesGrid);
}

/**
 * Pings backend health endpoint when live provider is selected.
 *
 * Why: lets frontend gate integration behaviors without forcing mock fallback logic.
 */
export async function isBackendHealthy(): Promise<boolean> {
  if (apiRuntimeConfig.useMock) return false;
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
 * Returns current API runtime configuration.
 *
 * Why: integration tooling and QA panels need visibility into active provider mode.
 */
export function getApiConfig() {
  return {
    LIVE_MODE,
    useMock: apiRuntimeConfig.useMock,
    API_BASE,
    API_TIMEOUT
  };
}

/**
 * Switches provider mode at runtime.
 *
 * Why: USE_MOCK toggling must be explicit and centralized for reliable backend tests.
 */
export function setUseMock(useMock: boolean): void {
  apiRuntimeConfig.useMock = useMock;
}

/**
 * Reports whether mock provider mode is currently active.
 *
 * Why: UI and diagnostics depend on this signal to avoid accidental live calls.
 */
export function isUsingMock(): boolean {
  return apiRuntimeConfig.useMock;
}

/**
 * Reads persisted auth token from browser storage.
 *
 * Why: auth hydration must remain backend-compatible without duplicating storage logic.
 */
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem('token');
}

/**
 * Stores auth token for subsequent backend-authenticated calls.
 *
 * Why: login/register flows share one persistence point across providers.
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem('token', token);
}

/**
 * Clears persisted auth token.
 *
 * Why: logout/401 handling should invalidate credentials consistently in all modes.
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem('token');
}

/**
 * Registers a user through active provider and persists token when returned.
 *
 * Why: keeps auth onboarding flow backend-ready while supporting mock development.
 */
export async function register(
  username: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  const result = await tryRealElseMock(
    '/api/auth/register',
    { method: 'POST', body: { username, email, password } },
    () => mockApiService.register(username, email, password)
  );

  if ((result as LoginResponse & { token?: string }).token) {
    setAuthToken((result as LoginResponse & { token: string }).token);
  }

  return result;
}

/**
 * Authenticates user and stores token.
 *
 * Why: one login boundary prevents provider-specific auth handling in UI components.
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const result = await tryRealElseMock(
    '/api/auth/login',
    { method: 'POST', body: { username, password } },
    () => mockApiService.login(username, password)
  );

  setAuthToken(result.token);
  return result;
}

/**
 * Fetches authenticated profile payload.
 *
 * Why: account UI consumes a provider-neutral shape while backend evolves.
 */
export async function getProfile(): Promise<ProfileResponse> {
  return tryRealElseMock(
    '/api/auth/profile',
    { method: 'GET' },
    () => mockApiService.getProfile()
  );
}

/**
 * Lists saved games for current user.
 *
 * Why: game list page should not care whether data comes from mock or backend.
 */
export async function listGames(): Promise<GamesListResponse> {
  return tryRealElseMock(
    '/api/games',
    { method: 'GET' },
    () => mockApiService.listGames()
  );
}

/**
 * Creates a new game with scenario and difficulty config.
 *
 * Why: preserving request/response shape here guarantees backend plug-and-play.
 */
export async function createGame(config: CreateGameConfig): Promise<CreateGameResponse> {
  return tryRealElseMock(
    '/api/games',
    { method: 'POST', body: config },
    () => mockApiService.createGame(config)
  );
}

/**
 * Deletes one savegame.
 *
 * Why: centralized deletion semantics prevent route components from branching by provider.
 */
export async function deleteGame(gameId: string): Promise<DeleteGameResponse> {
  return tryRealElseMock(
    `/api/games/${gameId}`,
    { method: 'DELETE' },
    () => mockApiService.deleteGame(gameId)
  );
}

/**
 * Fetches available scenario list.
 *
 * Why: scenario selectors rely on one contract across mock and backend data sources.
 */
export async function getScenarios(): Promise<ScenariosResponse> {
  return tryRealElseMock(
    '/api/scenarios',
    { method: 'GET' },
    () => mockApiService.getScenarios()
  );
}

// ═════════════════════════════════════════════════════════════
// MOCK CONTRACT WRAPPERS (frontend-only for backend preparation)
// ═════════════════════════════════════════════════════════════

type ApiContractResult = { status: 'success' };

function createLocalBuilding(type: BuildingType, x: number, y: number) {
  const now = new Date();
  return {
    id: `local-b-${x}-${y}-${Date.now()}`,
    type,
    position: { x, y },
    size: { w: 1, h: 1 },
    built_year: now.getFullYear(),
    built_month: now.getMonth() + 1,
    age_months: 0,
    powered: false,
    funding_pct: 100,
    active: true
  };
}

/**
 * Local-only mock API method: place a building and resolve success.
 */
export function postBuilding(x: number, y: number, type: BuildingType): Promise<ApiContractResult> {
  updateTileAt(x, y, (tile) => ({
    ...tile,
    zone: null,
    building: createLocalBuilding(type, x, y)
  }));

  treasury.update((value) => value - 100);
  population.update((value) => Math.max(0, value + 2));
  rci_demand.update((value) => ({ r: value.r - 1, c: value.c - 1, i: value.i + 1 }));

  return Promise.resolve({ status: 'success' });
}

/**
 * Local-only mock API method: remove any content from one tile and resolve success.
 */
export function postDemolish(x: number, y: number): Promise<ApiContractResult> {
  updateTileAt(x, y, (tile) => ({
    ...tile,
    zone: null,
    building: null,
    infrastructure: []
  }));

  treasury.update((value) => value - 20);
  rci_demand.update((value) => ({ r: value.r + 1, c: value.c + 1, i: value.i + 1 }));

  return Promise.resolve({ status: 'success' });
}

/**
 * Local-only mock API method: place a zone and resolve success.
 */
export function postZone(x: number, y: number, type: ZoneType): Promise<ApiContractResult> {
  updateTileAt(x, y, (tile) => ({
    ...tile,
    building: null,
    zone: {
      id: `local-z-${x}-${y}-${Date.now()}`,
      type,
      position: { x, y },
      size: { w: 1, h: 1 },
      development_level: 0,
      powered: tile.powered,
      watered: tile.watered,
      road_access: tile.road_access,
      abandoned: false,
      population: 0,
      built_year: new Date().getFullYear(),
      built_month: new Date().getMonth() + 1
    }
  }));

  treasury.update((value) => value - 5);
  rci_demand.update((value) => ({ r: value.r - 2, c: value.c, i: value.i }));

  return Promise.resolve({ status: 'success' });
}

/**
 * Local-only mock API method: place one infrastructure type and resolve success.
 */
export function postInfrastructure(
  x: number,
  y: number,
  type: InfrastructureType
): Promise<ApiContractResult> {
  updateTileAt(x, y, (tile) => ({
    ...tile,
    infrastructure: tile.infrastructure.includes(type) ? tile.infrastructure : [...tile.infrastructure, type]
  }));

  treasury.update((value) => value - 2);

  return Promise.resolve({ status: 'success' });
}

/**
 * Unified API namespace used by app-level consumers.
 *
 * Why: backend/LLM pluggability requires one stable API boundary regardless of
 * active provider (mock engine vs real HTTP backend).
 */
export const SimHiriAPI = {
  setUseMock,
  isUsingMock,
  getApiConfig,
  getStoredAuthToken,
  setAuthToken,
  clearAuthToken,
  register,
  login,
  getProfile,
  listGames,
  createGame,
  deleteGame,
  getScenarios,
  getGame,
  getStats,
  getEducation,
  getHealth,
  saveGame,
  placeZone,
  placeInfrastructure,
  buildStructure,
  placeBuilding,
  demolish,
  updateBudget,
  toggleOrdinance,
  issueBond,
  attackRival,
  endMonth,
  executeAiTurnActions,
  submitCheat,
  getOverlay,
  getTileServiceConnection,
  isBackendHealthy,
  postBuilding,
  postDemolish,
  postZone,
  postInfrastructure
} as const;
