import { writable, derived, type Readable } from 'svelte/store';
import type {
  GameState,
  StatsResponse,
  EducationResponse,
  HealthResponse,
  CityState,
  Tile,
  Zone,
  Building
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

/**
 * ACTION FUNCTIONS
 * These update the stores directly. Used after API calls succeed.
 * Pattern: API call → store update → components auto-re-render
 */

export function setGameState(state: GameState) {
  gameState.set(state);
}

export function setStats(newStats: StatsResponse) {
  stats.set(newStats);
}

export function setEducation(newEd: EducationResponse) {
  education.set(newEd);
}

export function setHealth(newHealth: HealthResponse) {
  health.set(newHealth);
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
    return {
      ...current,
      map: {
        ...current.map,
        tiles: callback(current.map.tiles)
      }
    };
  });
}

/**
 * Reset all stores (for new game or logout)
 */
export function resetGameStores() {
  gameState.set(null);
  stats.set(null);
  education.set(null);
  health.set(null);
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
 * Get tick interval in milliseconds based on game speed
 * - normal: 5000ms (5 seconds per month)
 * - fast: 1000ms (1 second per month)
 * - instant: 0ms (no delay, runs every frame)
 */
export function getTickInterval(speed?: 'normal' | 'fast' | 'instant'): number {
  if (speed === 'instant') return 0;
  if (speed === 'fast') return 1000;
  return 5000;
}

/**
 * Apply monthly simulation:
 * - Advance date
 * - Calculate budget (Population × TaxRate - Maintenance)
 * - Apply abandonment logic for Health/Education funding < 50%
 * - Update RCI demand
 */
export function applyMonthlySimulation(callback?: (state: GameState) => void) {
  gameState.update((current) => {
    if (!current) return current;

    // Advance month
    const nextMonth = current.current_date.month === 12 ? 1 : current.current_date.month + 1;
    const nextYear = nextMonth === 1 ? current.current_date.year + 1 : current.current_date.year;

    // Calculate monthly budget
    const taxRate = current.player_city.budget?.tax_rates?.residential ?? 7;
    const population = current.player_city.population ?? 0;
    const monthlyIncome = Math.round((population / 5) * (taxRate / 7));
    const monthlyExpense = 50 + Math.round(population / 100);
    const monthlyBalance = monthlyIncome - monthlyExpense;

    // Update treasury
    const newTreasury = current.player_city.treasury + monthlyBalance;

    // Abandonment check: if Health/Education funding < 50%, 10% buildings chance to abandon
    let updatedTiles = current.map.tiles;
    const ehFunding = current.player_city.budget?.funding?.education ?? 100;
    if (ehFunding < 50) {
      updatedTiles = updatedTiles.map((row) =>
        row.map((tile) => {
          if (tile.zone && Math.random() < 0.1) {
            return {
              ...tile,
              zone: { ...tile.zone, abandoned: true }
            };
          }
          return tile;
        })
      );
    }

    const updated = {
      ...current,
      current_date: { year: nextYear, month: nextMonth },
      player_city: {
        ...current.player_city,
        treasury: newTreasury
      },
      map: {
        ...current.map,
        tiles: updatedTiles
      }
    };

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

    const updatedTiles = current.map.tiles.map((row) =>
      row.map((tile) => {
        // Only grow residential zones at level 0
        if (tile.zone && tile.zone.development_level === 0) {
          const hasRoad = tile.road_access === true;
          const hasWater = tile.watered === true;
          const hasPower = tile.powered === true;

          if (hasRoad && hasWater && hasPower) {
            return {
              ...tile,
              zone: {
                ...tile.zone,
                development_level: 1
              }
            };
          }
        }
        return tile;
      })
    );

    return {
      ...current,
      map: {
        ...current.map,
        tiles: updatedTiles
      }
    };
  });
}
