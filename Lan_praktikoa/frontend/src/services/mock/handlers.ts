import { mockApiService as legacyService } from './legacy.ts';

/** Why: auth tests need deterministic mock login. How: forwards to legacy login handler. */
export function login(...args: Parameters<typeof legacyService.login>): ReturnType<typeof legacyService.login> {
  return legacyService.login(...args);
}

/** Why: registration flow must stay provider-compatible. How: forwards to legacy register handler. */
export function register(...args: Parameters<typeof legacyService.register>): ReturnType<typeof legacyService.register> {
  return legacyService.register(...args);
}

/** Why: profile pages require mock identity data. How: delegates to legacy profile handler. */
export function getProfile(...args: Parameters<typeof legacyService.getProfile>): ReturnType<typeof legacyService.getProfile> {
  return legacyService.getProfile(...args);
}

/** Why: savegame creation should keep same contract in mock mode. How: delegates to legacy createGame. */
export function createGame(...args: Parameters<typeof legacyService.createGame>): ReturnType<typeof legacyService.createGame> {
  return legacyService.createGame(...args);
}

/** Why: delete actions must remain deterministic in QA smoke tests. How: delegates to legacy deleteGame. */
export function deleteGame(...args: Parameters<typeof legacyService.deleteGame>): ReturnType<typeof legacyService.deleteGame> {
  return legacyService.deleteGame(...args);
}

/** Why: zoning interactions are core editing actions. How: delegates to legacy placeZone. */
export function placeZone(...args: Parameters<typeof legacyService.placeZone>): ReturnType<typeof legacyService.placeZone> {
  return legacyService.placeZone(...args);
}

/** Why: infrastructure drawing uses same backend contract in mock mode. How: delegates to legacy placeInfrastructure. */
export function placeInfrastructure(...args: Parameters<typeof legacyService.placeInfrastructure>): ReturnType<typeof legacyService.placeInfrastructure> {
  return legacyService.placeInfrastructure(...args);
}

/** Why: building placement must remain API-compatible. How: delegates to legacy buildStructure. */
export function buildStructure(...args: Parameters<typeof legacyService.buildStructure>): ReturnType<typeof legacyService.buildStructure> {
  return legacyService.buildStructure(...args);
}

/** Why: bulldozer workflow depends on this endpoint shape. How: delegates to legacy demolish. */
export function demolish(...args: Parameters<typeof legacyService.demolish>): ReturnType<typeof legacyService.demolish> {
  return legacyService.demolish(...args);
}

/** Why: budget panel requires consistent economics response fields. How: delegates to legacy updateBudget. */
export function updateBudget(...args: Parameters<typeof legacyService.updateBudget>): ReturnType<typeof legacyService.updateBudget> {
  return legacyService.updateBudget(...args);
}

/** Why: ordinance panel toggles legal policies. How: delegates to legacy toggleOrdinance. */
export function toggleOrdinance(...args: Parameters<typeof legacyService.toggleOrdinance>): ReturnType<typeof legacyService.toggleOrdinance> {
  return legacyService.toggleOrdinance(...args);
}

/** Why: financing panel relies on bond issuance shape. How: delegates to legacy issueBond. */
export function issueBond(...args: Parameters<typeof legacyService.issueBond>): ReturnType<typeof legacyService.issueBond> {
  return legacyService.issueBond(...args);
}

/** Why: rival attack workflow must be stable under USE_MOCK. How: delegates to legacy attackRival. */
export function attackRival(...args: Parameters<typeof legacyService.attackRival>): ReturnType<typeof legacyService.attackRival> {
  return legacyService.attackRival(...args);
}

/** Why: cheat console needs mock-compatible command path. How: delegates to legacy submitCheat. */
export function submitCheat(...args: Parameters<typeof legacyService.submitCheat>): ReturnType<typeof legacyService.submitCheat> {
  return legacyService.submitCheat(...args);
}
