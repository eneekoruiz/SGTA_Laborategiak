import {
  mockApiService as legacyService,
  mockEducation,
  mockGameState,
  mockHealth,
  mockStats
} from './legacy.ts';

/**
 * Shared mock game-state fixture.
 *
 * Why: scenario bootstrapping and regression tests need deterministic seed state.
 * How: re-exports the canonical legacy state object.
 */
export { mockGameState };

/**
 * Shared mock stats fixture.
 *
 * Why: dashboards rely on stable fixture values in mock mode.
 * How: re-exports canonical legacy stats.
 */
export { mockStats };

/**
 * Shared mock education fixture.
 *
 * Why: education module snapshots must stay deterministic.
 * How: re-exports canonical legacy fixture.
 */
export { mockEducation };

/**
 * Shared mock health fixture.
 *
 * Why: health module snapshots must stay deterministic.
 * How: re-exports canonical legacy fixture.
 */
export { mockHealth };

/**
 * Lists mock saves.
 *
 * Why: game list screens require one fixture-compatible source.
 * How: delegates to legacy mock service listGames.
 */
export function listGames(...args: Parameters<typeof legacyService.listGames>): ReturnType<typeof legacyService.listGames> {
  return legacyService.listGames(...args);
}

/**
 * Gets one mock game state.
 *
 * Why: shell load path must read canonical mock state.
 * How: delegates to legacy mock service getGame.
 */
export function getGame(...args: Parameters<typeof legacyService.getGame>): ReturnType<typeof legacyService.getGame> {
  return legacyService.getGame(...args);
}

/**
 * Gets computed mock stats.
 *
 * Why: HUD and analytics use provider-neutral stats contract.
 * How: delegates to legacy mock service getStats.
 */
export function getStats(...args: Parameters<typeof legacyService.getStats>): ReturnType<typeof legacyService.getStats> {
  return legacyService.getStats(...args);
}

/**
 * Gets education metrics.
 *
 * Why: education panel expects backend-compatible response shape.
 * How: delegates to legacy mock service getEducation.
 */
export function getEducation(...args: Parameters<typeof legacyService.getEducation>): ReturnType<typeof legacyService.getEducation> {
  return legacyService.getEducation(...args);
}

/**
 * Gets health metrics.
 *
 * Why: health panel expects backend-compatible response shape.
 * How: delegates to legacy mock service getHealth.
 */
export function getHealth(...args: Parameters<typeof legacyService.getHealth>): ReturnType<typeof legacyService.getHealth> {
  return legacyService.getHealth(...args);
}

/**
 * Lists available scenarios.
 *
 * Why: new game flow needs canonical scenario catalog in mock mode.
 * How: delegates to legacy mock service getScenarios.
 */
export function getScenarios(...args: Parameters<typeof legacyService.getScenarios>): ReturnType<typeof legacyService.getScenarios> {
  return legacyService.getScenarios(...args);
}
