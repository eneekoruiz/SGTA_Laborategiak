/**
 * GAME LOOP SERVICE
 * Manages monthly simulation ticks and auto-advancement
 *
 * Timing:
 * - normal: 5 seconds per month
 * - fast: 1 second per month
 * - instant: no delay (manual control)
 */

import { gameState, gameSpeed, simTick, incrementSimTick } from '../store/game';
import { endMonth } from './apiService';
import { get } from 'svelte/store';

let loopInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Start automatic game loop
 */
export function startGameLoop() {
  if (isRunning) return;
  isRunning = true;

  const tick = () => {
    const state = get(gameState);
    const speed = get(gameSpeed);

    if (!state || state.victory_status !== 'ongoing') {
      stopGameLoop();
      return;
    }

    // Increment tick counter
    incrementSimTick();

    // If instant mode, don't auto-advance months (player controls it)
    if (speed !== 'instant') {
      // Auto-advance month every tick
      advanceMonth();
    }
  };

  const speed = get(gameSpeed);
  const interval = speed === 'fast' ? 1000 : speed === 'instant' ? 999999 : 5000;

  loopInterval = setInterval(tick, interval);
}

/**
 * Stop the game loop
 */
export function stopGameLoop() {
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }
  isRunning = false;
}

/**
 * Manually advance one month (endMonth API call)
 */
export async function advanceMonth() {
  const state = get(gameState);
  if (!state) return;

  try {
    const result = await endMonth(state._id);

    if (result.success) {
      // The API has already updated game_state, just sync it
      gameState.set(result.game_state);
      incrementSimTick();
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Error advancing month:', err);
    }
  }
}

/**
 * Handle game speed changes - restart loop with new interval
 */
export function updateGameSpeed(speed: 'normal' | 'fast' | 'instant') {
  const wasRunning = isRunning;
  stopGameLoop();

  if (wasRunning && speed !== 'instant') {
    // Restart loop with new speed (other than instant)
    startGameLoop();
  }
}

/**
 * Check if loop is currently running
 */
export function isGameLoopRunning(): boolean {
  return isRunning;
}
