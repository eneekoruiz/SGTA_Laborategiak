import { MockSimulationEngine, mockApiService as legacyService } from './legacy';

/**
 * Canonical mock simulation engine.
 *
 * Why: AI and utility simulation must reuse one deterministic implementation.
 * How: re-exports the established legacy simulation engine.
 */
export { MockSimulationEngine };

/**
 * Resolves service-connection probe for one tile.
 *
 * Why: map validation UX needs real-time utility reachability in mock mode.
 * How: delegates to legacy getTileServiceConnection implementation.
 */
export function getTileServiceConnection(
  ...args: Parameters<typeof legacyService.getTileServiceConnection>
): ReturnType<typeof legacyService.getTileServiceConnection> {
  return legacyService.getTileServiceConnection(...args);
}

/**
 * Computes next simulation month.
 *
 * Why: end-turn command must keep deterministic mock behavior.
 * How: forwards to legacy endMonth logic.
 */
export function endMonth(...args: Parameters<typeof legacyService.endMonth>): ReturnType<typeof legacyService.endMonth> {
  return legacyService.endMonth(...args);
}

/**
 * Retrieves overlay data layers.
 *
 * Why: map overlay rendering requires consistent mock payloads.
 * How: delegates to legacy getOverlay implementation.
 */
export function getOverlay(...args: Parameters<typeof legacyService.getOverlay>): ReturnType<typeof legacyService.getOverlay> {
  return legacyService.getOverlay(...args);
}
