import * as legacy from './legacy';

/**
 * Triggers a rival city disaster attack.
 *
 * Why: disaster module must call one provider-neutral endpoint.
 * How: delegates to legacy attack orchestration.
 */
export function attackRival(...args: Parameters<typeof legacy.attackRival>): ReturnType<typeof legacy.attackRival> {
  return legacy.attackRival(...args);
}

/**
 * Advances simulation by one month.
 *
 * Why: gameplay loop depends on a canonical end-turn command.
 * How: forwards to legacy endMonth provider bridge.
 */
export function endMonth(...args: Parameters<typeof legacy.endMonth>): ReturnType<typeof legacy.endMonth> {
  return legacy.endMonth(...args);
}

/**
 * Replays AI action stream client-side when requested.
 *
 * Why: deterministic AI playback is needed for UX parity.
 * How: delegates to legacy replay executor.
 */
export function executeAiTurnActions(...args: Parameters<typeof legacy.executeAiTurnActions>): ReturnType<typeof legacy.executeAiTurnActions> {
  return legacy.executeAiTurnActions(...args);
}

/**
 * Submits cheat command.
 *
 * Why: devtools console needs one contract in mock and live modes.
 * How: delegates to legacy cheat endpoint adapter.
 */
export function submitCheat(...args: Parameters<typeof legacy.submitCheat>): ReturnType<typeof legacy.submitCheat> {
  return legacy.submitCheat(...args);
}

/**
 * Retrieves map overlay data.
 *
 * Why: overlay renderer expects a stable payload format.
 * How: forwards to legacy overlay fetch wrapper.
 */
export function getOverlay(...args: Parameters<typeof legacy.getOverlay>): ReturnType<typeof legacy.getOverlay> {
  return legacy.getOverlay(...args);
}

/**
 * Probes backend health when live mode is enabled.
 *
 * Why: integration diagnostics need an explicit liveness signal.
 * How: delegates to legacy health probe helper.
 */
export function isBackendHealthy(...args: Parameters<typeof legacy.isBackendHealthy>): ReturnType<typeof legacy.isBackendHealthy> {
  return legacy.isBackendHealthy(...args);
}
