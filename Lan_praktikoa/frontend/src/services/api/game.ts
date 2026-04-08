import * as legacy from './legacy';

/** Why: game list pages need provider-neutral save metadata. How: delegates to legacy list handler. */
export function listGames(...args: Parameters<typeof legacy.listGames>): ReturnType<typeof legacy.listGames> {
  return legacy.listGames(...args);
}

/** Why: new game wizard should remain backend-pluggable. How: forwards config to legacy creator. */
export function createGame(...args: Parameters<typeof legacy.createGame>): ReturnType<typeof legacy.createGame> {
  return legacy.createGame(...args);
}

/** Why: delete actions must preserve same response shape across providers. How: delegates to legacy delete flow. */
export function deleteGame(...args: Parameters<typeof legacy.deleteGame>): ReturnType<typeof legacy.deleteGame> {
  return legacy.deleteGame(...args);
}

/** Why: scenario selector depends on canonical scenario schema. How: forwards to legacy scenario endpoint wrapper. */
export function getScenarios(...args: Parameters<typeof legacy.getScenarios>): ReturnType<typeof legacy.getScenarios> {
  return legacy.getScenarios(...args);
}

/** Why: gameplay shell needs canonical state loading. How: delegates to legacy getGame provider bridge. */
export function getGame(...args: Parameters<typeof legacy.getGame>): ReturnType<typeof legacy.getGame> {
  return legacy.getGame(...args);
}

/** Why: HUD metrics must stay in sync regardless of provider. How: forwards to legacy stats bridge. */
export function getStats(...args: Parameters<typeof legacy.getStats>): ReturnType<typeof legacy.getStats> {
  return legacy.getStats(...args);
}

/** Why: education panel consumes fixed contract. How: delegates to legacy provider implementation. */
export function getEducation(...args: Parameters<typeof legacy.getEducation>): ReturnType<typeof legacy.getEducation> {
  return legacy.getEducation(...args);
}

/** Why: health panel needs stable backend-ready payload. How: delegates to legacy provider implementation. */
export function getHealth(...args: Parameters<typeof legacy.getHealth>): ReturnType<typeof legacy.getHealth> {
  return legacy.getHealth(...args);
}

/** Why: save command must remain consistent for manual/autosave. How: forwards to legacy save handler. */
export function saveGame(...args: Parameters<typeof legacy.saveGame>): ReturnType<typeof legacy.saveGame> {
  return legacy.saveGame(...args);
}

/** Why: zoning interactions require unified API surface. How: delegates to legacy zone placement command. */
export function placeZone(...args: Parameters<typeof legacy.placeZone>): ReturnType<typeof legacy.placeZone> {
  return legacy.placeZone(...args);
}

/** Why: infrastructure painting must keep same call contract. How: forwards to legacy infrastructure command. */
export function placeInfrastructure(...args: Parameters<typeof legacy.placeInfrastructure>): ReturnType<typeof legacy.placeInfrastructure> {
  return legacy.placeInfrastructure(...args);
}

/** Why: building flows use one shared command endpoint. How: delegates to legacy buildStructure. */
export function buildStructure(...args: Parameters<typeof legacy.buildStructure>): ReturnType<typeof legacy.buildStructure> {
  return legacy.buildStructure(...args);
}

/** Why: map component emits placeBuilding specifically. How: reuses legacy specialized wrapper. */
export function placeBuilding(...args: Parameters<typeof legacy.placeBuilding>): ReturnType<typeof legacy.placeBuilding> {
  return legacy.placeBuilding(...args);
}

/** Why: bulldozer orchestration expects canonical demolish contract. How: delegates to legacy demolish logic. */
export function demolish(...args: Parameters<typeof legacy.demolish>): ReturnType<typeof legacy.demolish> {
  return legacy.demolish(...args);
}

/** Why: drag placement validation needs connection checks. How: forwards to legacy tile service probe. */
export function getTileServiceConnection(...args: Parameters<typeof legacy.getTileServiceConnection>): ReturnType<typeof legacy.getTileServiceConnection> {
  return legacy.getTileServiceConnection(...args);
}

/** Why: local contract wrappers remain used by QA smoke paths. How: delegates to legacy in-memory helper. */
export function postBuilding(...args: Parameters<typeof legacy.postBuilding>): ReturnType<typeof legacy.postBuilding> {
  return legacy.postBuilding(...args);
}

/** Why: local demolish helper is used by compatibility scripts. How: delegates to legacy local helper. */
export function postDemolish(...args: Parameters<typeof legacy.postDemolish>): ReturnType<typeof legacy.postDemolish> {
  return legacy.postDemolish(...args);
}

/** Why: local zone helper keeps contract tests stable. How: delegates to legacy local helper. */
export function postZone(...args: Parameters<typeof legacy.postZone>): ReturnType<typeof legacy.postZone> {
  return legacy.postZone(...args);
}

/** Why: local infra helper supports frontend-only testing. How: delegates to legacy local helper. */
export function postInfrastructure(...args: Parameters<typeof legacy.postInfrastructure>): ReturnType<typeof legacy.postInfrastructure> {
  return legacy.postInfrastructure(...args);
}
