import {
  clearAuthToken,
  getProfile,
  getStoredAuthToken,
  login,
  register,
  setAuthToken
} from './api/auth';
import {
  buildStructure,
  createGame,
  deleteGame,
  demolish,
  getEducation,
  getGame,
  getHealth,
  getScenarios,
  getStats,
  getTileServiceConnection,
  listGames,
  placeBuilding,
  placeInfrastructure,
  placeZone,
  postBuilding,
  postDemolish,
  postInfrastructure,
  postZone,
  saveGame
} from './api/game';
import { issueBond, toggleOrdinance, updateBudget } from './api/economy';
import {
  attackRival,
  endMonth,
  executeAiTurnActions,
  getOverlay,
  isBackendHealthy,
  submitCheat
} from './api/ai';
import { getApiConfig, isUsingMock, setUseMock } from './api/legacy';

/**
 * USE_MOCK runtime switch.
 *
 * Why: backend handoff needs one master toggle used by all service domains.
 * How: delegates to the shared runtime config in the legacy provider core.
 */
export { setUseMock, isUsingMock, getApiConfig };

/**
 * Unified service facade consumed by the app.
 *
 * Why: keeps call sites stable while internals are decomposed into domain modules.
 * How: composes auth, game, economy and AI micro-services behind one namespace.
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

export {
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
};
