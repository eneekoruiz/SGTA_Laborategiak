import {
  getEducation,
  getGame,
  getHealth,
  getScenarios,
  getStats,
  listGames,
  mockEducation,
  mockGameState,
  mockHealth,
  mockStats
} from './mock/scenarioData.ts';
import {
  attackRival,
  buildStructure,
  createGame,
  deleteGame,
  demolish,
  getProfile,
  issueBond,
  login,
  placeInfrastructure,
  placeZone,
  register,
  submitCheat,
  toggleOrdinance,
  updateBudget
} from './mock/handlers.ts';
import {
  getOverlay,
  getTileServiceConnection,
  endMonth,
  MockSimulationEngine
} from './mock/simulator.ts';

/**
 * Canonical mock simulation engine export.
 *
 * Why: consumers need one stable simulation symbol in mock mode.
 * How: re-exported from simulator module.
 */
export { MockSimulationEngine };

/**
 * Mock game state fixture export.
 *
 * Why: tests and tools depend on deterministic game seed data.
 * How: re-exported from scenarioData.
 */
export { mockGameState };

/**
 * Mock stats fixture export.
 *
 * Why: dashboard tests need deterministic metric fixtures.
 * How: re-exported from scenarioData.
 */
export { mockStats };

/**
 * Mock education fixture export.
 *
 * Why: education panel snapshot tests rely on static baseline values.
 * How: re-exported from scenarioData.
 */
export { mockEducation };

/**
 * Mock health fixture export.
 *
 * Why: health panel snapshot tests rely on static baseline values.
 * How: re-exported from scenarioData.
 */
export { mockHealth };

/**
 * USE_MOCK provider object implementing the backend-compatible contract.
 *
 * Why: apiService must switch providers through one master interface.
 * How: composes domain handlers, scenario data readers, and simulator commands.
 */
export const mockApiService = {
  login,
  register,
  getProfile,
  listGames,
  createGame,
  deleteGame,
  getScenarios,
  getGame,
  getStats,
  getEducation,
  getHealth,
  getTileServiceConnection,
  placeZone,
  placeInfrastructure,
  buildStructure,
  demolish,
  updateBudget,
  toggleOrdinance,
  issueBond,
  attackRival,
  endMonth,
  submitCheat,
  getOverlay
} as const;
