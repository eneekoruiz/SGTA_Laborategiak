import * as legacy from './legacy';

/**
 * Reads persisted auth token from browser storage.
 *
 * Why: token hydration must stay centralized for router and session guards.
 * How: delegates to legacy storage bridge used by both mock and live modes.
 */
export function getStoredAuthToken(): ReturnType<typeof legacy.getStoredAuthToken> {
  return legacy.getStoredAuthToken();
}

/**
 * Stores auth token in browser storage.
 *
 * Why: login/register flows require one canonical persistence point.
 * How: writes both compatibility keys via the legacy auth implementation.
 */
export function setAuthToken(...args: Parameters<typeof legacy.setAuthToken>): ReturnType<typeof legacy.setAuthToken> {
  return legacy.setAuthToken(...args);
}

/**
 * Clears persisted auth token.
 *
 * Why: logout and 401 recovery must invalidate credentials consistently.
 * How: forwards to the legacy token clearing routine.
 */
export function clearAuthToken(): ReturnType<typeof legacy.clearAuthToken> {
  return legacy.clearAuthToken();
}

/**
 * Registers a user in the active provider.
 *
 * Why: onboarding must stay provider-agnostic for USE_MOCK and live backend.
 * How: routes request to the legacy provider gateway.
 */
export function register(...args: Parameters<typeof legacy.register>): ReturnType<typeof legacy.register> {
  return legacy.register(...args);
}

/**
 * Authenticates a user and returns auth payload.
 *
 * Why: UI should not branch by provider for login behavior.
 * How: delegates to legacy login implementation.
 */
export function login(...args: Parameters<typeof legacy.login>): ReturnType<typeof legacy.login> {
  return legacy.login(...args);
}

/**
 * Gets authenticated profile data.
 *
 * Why: account pages need one stable profile contract.
 * How: resolves through the same provider bridge used elsewhere.
 */
export function getProfile(...args: Parameters<typeof legacy.getProfile>): ReturnType<typeof legacy.getProfile> {
  return legacy.getProfile(...args);
}
