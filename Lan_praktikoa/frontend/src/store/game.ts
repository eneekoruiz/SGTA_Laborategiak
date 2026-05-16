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
import {
  applyAutoGrowthSnapshot,
  applyMonthlySimulationSnapshot,
  getTickInterval
} from '../lib/simulation/core';

const STORAGE_KEY = 'simhiri_game_state';

function loadPersistedState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

function persistState(state: GameState | null) {
  try {
    if (!state) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    // Don't store the full map tiles in localStorage — just metadata
    const light = {
      ...state,
      map: { tiles: [] } // Strip heavy tile data
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
  } catch {
    // Storage full or unavailable — silent fail
  }
}

/**
 * GAME STATE STORES
 * Single source of truth for all game data.
 */

// Primary writable stores
export const gameState = writable<GameState | null>(loadPersistedState());
export const stats = writable<StatsResponse | null>(null);
export const education = writable<EducationResponse | null>(null);
export const health = writable<HealthResponse | null>(null);
export const aiTurn = writable<AITurnPayload | null>(null);

// AI Service Status Store
export const aiServiceStatus = writable<'available' | 'unavailable' | 'loading'>('loading');
export const aiActions = writable<Array<{
  action_type: string;
  position?: { x: number; y: number };
  building_type?: string;
  infrastructure_type?: string;
  segments?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
}>>([]);

// Auto-persist gameState metadata on every change
if (typeof window !== 'undefined') {
  gameState.subscribe(persistState);
}

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

// Mock simulation engine state (API-contract preparation)
export const treasury = writable<number>(5000);
export const population = writable<number>(1000);
export const rci_demand = writable<{ r: number; c: number; i: number }>({ r: 10, c: 8, i: 6 });

let mockTurnTimer: ReturnType<typeof setInterval> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Simulate one lightweight turn for frontend-only integration testing.
 */
export function simulateTurn(): void {
  const popDelta = Math.floor(Math.random() * 41) - 20;
  const treasuryDelta = Math.floor(Math.random() * 151) - 70;
  const rDelta = Math.floor(Math.random() * 7) - 3;
  const cDelta = Math.floor(Math.random() * 7) - 3;
  const iDelta = Math.floor(Math.random() * 7) - 3;

  population.update((value) => Math.max(0, value + popDelta));
  treasury.update((value) => value + treasuryDelta);
  rci_demand.update((value) => ({
    r: clamp(value.r + rDelta, -200, 200),
    c: clamp(value.c + cDelta, -200, 200),
    i: clamp(value.i + iDelta, -200, 200)
  }));
}

/**
 * Starts the mock turn loop (10 seconds by default).
 */
export function startMockSimulationEngine(intervalMs = 10000): void {
  if (typeof window === 'undefined' || mockTurnTimer) return;
  mockTurnTimer = setInterval(() => {
    simulateTurn();
  }, intervalMs);
}

export function stopMockSimulationEngine(): void {
  if (!mockTurnTimer) return;
  clearInterval(mockTurnTimer);
  mockTurnTimer = null;
}

if (typeof window !== 'undefined') {
  startMockSimulationEngine(10000);
}

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
  const infra = Array.isArray(tile.infrastructure) ? tile.infrastructure : [];
  const surfaceInfra = infra.find((i) => SURFACE_INFRA.has(i));
  const undergroundInfra = infra.find((i) => UNDERGROUND_INFRA.has(i));

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
 * Surgical batch update for multiple tiles.
 * Prevents full map cloning by only cloning affected rows and the top-level array.
 */
export function updateTilesAt(updates: Array<{ x: number; y: number; updater: (tile: Tile) => Tile }>): void {
  gameState.update((current) => {
    if (!current || !current.map.tiles) return current;

    const tiles = current.map.tiles;
    const nextRows = [...tiles];
    const modifiedRows = new Set<number>();

    for (const { x, y, updater } of updates) {
      if (!nextRows[y]?.[x]) continue;

      if (!modifiedRows.has(y)) {
        nextRows[y] = [...nextRows[y]];
        modifiedRows.add(y);
      }
      nextRows[y][x] = normalizeTileOccupancy(updater(nextRows[y][x]));
    }

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
  aiServiceStatus.set('loading');
  aiActions.set([]);
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
  gameState.update((current) => {
    if (!current) return current;
    const updated = applyMonthlySimulationSnapshot(current);
    if (callback) callback(updated);
    return updated;
  });

  incrementSimTick();
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
  gameState.update((current) => {
    if (!current || !current.map.tiles) return current;
    return applyAutoGrowthSnapshot(current);
  });
}


