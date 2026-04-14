import * as legacy from './legacy';

/**
 * Applies budget and funding changes.
 *
 * Why: economy UI requires a stable budget update contract.
 * How: delegates to the legacy provider bridge without altering payload shape.
 */
export function updateBudget(...args: Parameters<typeof legacy.updateBudget>): ReturnType<typeof legacy.updateBudget> {
  return legacy.updateBudget(...args);
}

/**
 * Enacts or repeals ordinances.
 *
 * Why: policy toggles should remain API-compatible across providers.
 * How: forwards request to the legacy ordinance endpoint abstraction.
 */
export function toggleOrdinance(...args: Parameters<typeof legacy.toggleOrdinance>): ReturnType<typeof legacy.toggleOrdinance> {
  return legacy.toggleOrdinance(...args);
}

/**
 * Issues municipal bonds.
 *
 * Why: financing controls rely on predictable treasury response fields.
 * How: uses legacy issueBond implementation directly.
 */
export function issueBond(...args: Parameters<typeof legacy.issueBond>): ReturnType<typeof legacy.issueBond> {
  return legacy.issueBond(...args);
}
