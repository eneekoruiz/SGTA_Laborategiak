/**
 * Simulation core facade.
 *
 * Why: the store should depend on a stable domain-core entrypoint so simulation
 * internals can evolve without leaking architectural changes into state wiring.
 */
export {
  applyAutoGrowthSnapshot,
  applyMonthlySimulationSnapshot,
  computeRCIDemandValues,
  getTickInterval,
  growthLevelForTile,
  hasServiceCoverage,
  zonePopulationForLevel,
  updateUtilityCoverage,
  type RCIValues
} from './engine';
