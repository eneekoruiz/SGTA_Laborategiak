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
