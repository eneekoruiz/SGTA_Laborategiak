import { get, writable, derived, type Readable } from 'svelte/store';
import type {
  AITurnPayload,
  GameState,
  StatsResponse,
  EducationResponse,
  HealthResponse,
  CityState,
  Tile
} from '../types/game';

/**
 * GAME STATE STORES
 * Single source of truth for all game data.
 * All mutations flow through action functions that call apiService.
 * Components subscribe to stores via $storeName syntax.
 */

// Primary writable stores
export const gameState = writable<GameState | null>(null);
export const stats = writable<StatsResponse | null>(null);
export const education = writable<EducationResponse | null>(null);
export const health = writable<HealthResponse | null>(null);
export const aiTurn = writable<AITurnPayload | null>(null);

export type MetricHistoryPoint = {
  year: number;
  month: number;
  population: number;
  treasury: number;
  rci: { r: number; c: number; i: number };
};

const METRIC_HISTORY_LIMIT = 24;
export const metricHistory = writable<MetricHistoryPoint[]>([]);

// Game speed control
export const gameSpeed = writable<'normal' | 'fast' | 'instant'>('normal');

// Simulation tick counter
export const simTick = writable<number>(0);

// Derived stores for convenient access (read-only)
export const playerCity: Readable<CityState | null> = derived(gameState, ($gs) => $gs?.player_city || null);
export const aiCity: Readable<CityState | null> = derived(gameState, ($gs) => $gs?.ai_city || null);
export const mapTiles: Readable<Tile[][] | null> = derived(gameState, ($gs) => $gs?.map.tiles || null);
export const currentDate = derived(gameState, ($gs) => $gs?.current_date || null);
export const difficulty = derived(gameState, ($gs) => $gs?.difficulty || 'medium');
export const victoryStatus = derived(gameState, ($gs) => $gs?.victory_status || 'ongoing');

// Helper derived stores
export const playerPopulation = derived(stats, ($st) => $st?.player.population || 0);
export const playerTreasury = derived(stats, ($st) => $st?.player.treasury || 0);
export const playerScore = derived(stats, ($st) => $st?.player.composite_score || 0);
export const aiPopulation = derived(stats, ($st) => $st?.ai.population || 0);
export const aiTreasury = derived(stats, ($st) => $st?.ai.treasury || 0);

export const eq = derived(education, ($ed) => $ed?.eq || 0);
export const eqTrend = derived(education, ($ed) => $ed?.eq_trend || 0);
export const hq = derived(health, ($h) => $h?.hq || 0);
export const hqTrend = derived(health, ($h) => $h?.hq_trend || 0);

const SURFACE_INFRA = new Set(['road', 'highway', 'highway_ramp', 'power_line', 'rail']);
const UNDERGROUND_INFRA = new Set(['water_pipe', 'subway', 'subway_tunnel']);

function normalizeTileOccupancy(tile: Tile): Tile {
  const surfaceInfra = tile.infrastructure.find((infra) => SURFACE_INFRA.has(infra));
  const undergroundInfra = tile.infrastructure.find((infra) => UNDERGROUND_INFRA.has(infra));

  const normalizedInfrastructure = [
    ...(surfaceInfra ? [surfaceInfra] : []),
    ...(undergroundInfra ? [undergroundInfra] : [])
  ];

  const hasBuilding = Boolean(tile.building);
  const hasZone = Boolean(tile.zone);
  const keepZone = hasBuilding ? null : tile.zone;

  const surfaceEntity = hasBuilding
    ? { type: 'building' as const, value: String(tile.building?.type ?? '') }
    : hasZone
      ? { type: 'zone' as const, value: String(keepZone?.type ?? '') }
      : surfaceInfra
        ? { type: 'infrastructure' as const, value: surfaceInfra }
        : null;

  const undergroundEntity = undergroundInfra
    ? { type: 'infrastructure' as const, value: undergroundInfra }
    : null;

  return {
    ...tile,
    zone: keepZone,
    infrastructure: normalizedInfrastructure,
    surfaceEntity,
    undergroundEntity
  };
}

function normalizeMapOccupancy(tiles: Tile[][]): Tile[][] {
  return tiles.map((row) => row.map((tile) => normalizeTileOccupancy(tile)));
}

function appendMetricHistoryPoint(state: GameState, newStats: StatsResponse): void {
  const point: MetricHistoryPoint = {
    year: state.current_date.year,
    month: state.current_date.month,
    population: newStats.player.population,
    treasury: Math.round(newStats.player.treasury),
    rci: {
      r: newStats.player.rci_demand.r,
      c: newStats.player.rci_demand.c,
      i: newStats.player.rci_demand.i
    }
  };

  metricHistory.update((history) => {
    if (history.length === 0) return [point];

    const last = history[history.length - 1];
    if (last.year === point.year && last.month === point.month) {
      const next = [...history];
      next[next.length - 1] = point;
      return next;
    }

    return [...history, point].slice(-METRIC_HISTORY_LIMIT);
  });
}

/**
 * ACTION FUNCTIONS
 * These update the stores directly. Used after API calls succeed.
 * Pattern: API call → store update → components auto-re-render
 */

export function setGameState(state: GameState) {
  gameState.set(state);

  const currentStats = get(stats);
  if (currentStats) appendMetricHistoryPoint(state, currentStats);
}

export function setStats(newStats: StatsResponse) {
  stats.set(newStats);

  const currentState = get(gameState);
  if (currentState) appendMetricHistoryPoint(currentState, newStats);
}

export function setEducation(newEd: EducationResponse) {
  education.set(newEd);
}

export function setHealth(newHealth: HealthResponse) {
  health.set(newHealth);
}

export function setAiTurn(turn: AITurnPayload | null) {
  aiTurn.set(turn);
}

/**
 * Partial updates for specific game state properties.
 * Used when API returns only partial updates.
 */
export function updateGameState(updates: Partial<GameState>) {
  gameState.update((current) => {
    if (!current) return null;
    return { ...current, ...updates };
  });
}

export function updatePlayerCity(updates: Partial<CityState>) {
  gameState.update((current) => {
    if (!current) return null;
    return {
      ...current,
      player_city: { ...current.player_city, ...updates }
    };
  });
}

export function updateAICity(updates: Partial<CityState>) {
  gameState.update((current) => {
    if (!current) return null;
    return {
      ...current,
      ai_city: { ...current.ai_city, ...updates }
    };
  });
}

export function updateTiles(callback: (tiles: Tile[][]) => Tile[][]) {
  gameState.update((current) => {
    if (!current || !current.map.tiles) return current;
    const nextTiles = normalizeMapOccupancy(callback(current.map.tiles));
    return {
      ...current,
      map: {
        ...current.map,
        tiles: nextTiles
      }
    };
  });
}

/**
 * Update a single tile immutably. This keeps updates tiny and avoids cloning the full map.
 */
export function updateTileAt(x: number, y: number, updater: (tile: Tile) => Tile): void {
  gameState.update((current) => {
    if (!current || !current.map.tiles || !current.map.tiles[y]?.[x]) return current;

    const tiles = current.map.tiles;
    const nextRows = [...tiles];
    const nextRow = [...nextRows[y]];
    nextRow[x] = normalizeTileOccupancy(updater(nextRow[x]));
    nextRows[y] = nextRow;

    return {
      ...current,
      map: {
        ...current.map,
        tiles: nextRows
      }
    };
  });
}

/**
 * Optimistic state commit helper.
 * 1) Apply local mutation immediately.
 * 2) Execute API work in background.
 * 3) Keep optimistic state by default (rollback optional).
 */
export async function commitAction<T>(
  optimisticUpdate: (state: GameState) => GameState,
  backgroundAction: () => Promise<T>,
  options?: {
    rollbackOnError?: boolean;
    onError?: (error: unknown) => void;
  }
): Promise<T | undefined> {
  let snapshot: GameState | null = null;

  gameState.update((current) => {
    if (!current) return current;

    if (options?.rollbackOnError) {
      snapshot = JSON.parse(JSON.stringify(current)) as GameState;
    }

    return optimisticUpdate(current);
  });

  try {
    return await backgroundAction();
  } catch (error) {
    if (options?.rollbackOnError && snapshot) {
      gameState.set(snapshot);
    }
    options?.onError?.(error);
    return undefined;
  }
}

/**
 * Reset all stores (for new game or logout)
 */
export function resetGameStores() {
  gameState.set(null);
  stats.set(null);
  education.set(null);
  health.set(null);
  aiTurn.set(null);
  metricHistory.set([]);
}

/**
 * SIMULATION CONTROL
 * Manages game speed and monthly ticks
 */

export function setGameSpeed(speed: 'normal' | 'fast' | 'instant') {
  gameSpeed.set(speed);
}

export function incrementSimTick() {
  simTick.update((t) => t + 1);
}

/**
 * Applies the monthly simulation by delegating to the pure simulation engine.
 *
 * Why: the store should orchestrate state transitions, not host full game rules.
 */
export function applyMonthlySimulation(callback?: (state: GameState) => void) {
  const current = get(gameState);
  if (!current) return;
  if (callback) callback(current);
  if (import.meta.env.DEV) {
    console.warn('[store/game] applyMonthlySimulation() is disabled. Simulation belongs to backend/mock provider.');
  }
}

/**
 * Deduct cost from treasury immediately when player builds/zones
 */
export function deductTreasury(amount: number) {
  gameState.update((current) => {
    if (!current) return current;
    return {
      ...current,
      player_city: {
        ...current.player_city,
        treasury: current.player_city.treasury - amount
      }
    };
  });
}

/**
 * Apply automatic zone growth based on infrastructure
 * If zone has: road_access + watered + powered → level becomes 1
 */
export function applyAutoGrowth() {
  if (import.meta.env.DEV) {
    console.warn('[store/game] applyAutoGrowth() is disabled. Growth simulation belongs to backend/mock provider.');
  }
}
