import { writable } from 'svelte/store';
import type { ZoneType, InfrastructureType } from '../types/game';

/**
 * UI STATE STORES
 * Manages UI-only state: tool selection, open modals, settings.
 * Separate from game state for cleaner organization.
 */

// Tool selection
export const selectedZone = writable<ZoneType | null>(null);
export const selectedInfra = writable<InfrastructureType | null>(null);

// Modal & drawer states
export const activeModal = writable<'budget' | 'ordinance' | 'rival' | 'disaster' | null>(null);
export const educationDrawerOpen = writable<boolean>(false);
export const cheatConsoleOpen = writable<boolean>(false);

// View modes
export const undergroundMode = writable<boolean>(false);

// Game loop settings
export const gameSpeed = writable<'normal' | 'fast' | 'instant'>('normal');

// Loading/error states
export const isLoading = writable<boolean>(false);
export const errorMessage = writable<string>('');

// Cheat history (UI-only, not persisted)
export const cheatHistory = writable<string[]>([]);

// Funding slider (for Education/Health preview)
export const fundingPct = writable<number>(100);

/**
 * ACTION FUNCTIONS
 */

export function setSelectedZone(zone: ZoneType | null) {
  selectedZone.set(zone);
  selectedInfra.set(null); // Clear infra when switching to zone
}

export function setSelectedInfra(infra: InfrastructureType | null) {
  selectedInfra.set(infra);
  selectedZone.set(null); // Clear zone when switching to infra
}

export function openModal(modal: 'budget' | 'ordinance' | 'rival' | 'disaster') {
  activeModal.set(modal);
  educationDrawerOpen.set(false); // Close drawer if modal opens
}

export function closeModal() {
  activeModal.set(null);
}

export function toggleEducationDrawer() {
  educationDrawerOpen.update((val) => !val);
  activeModal.set(null); // Close modal if drawer opens
}

export function toggleCheatConsole() {
  cheatConsoleOpen.update((val) => !val);
}

export function toggleUndergroundMode() {
  undergroundMode.update((val) => !val);
}

export function setGameSpeed(speed: 'normal' | 'fast' | 'instant') {
  gameSpeed.set(speed);
}

export function addCheatToHistory(cheat: string) {
  cheatHistory.update((history) => [cheat, ...history].slice(0, 10)); // Keep last 10
}

export function clearCheatHistory() {
  cheatHistory.set([]);
}

export function setFundingPct(pct: number) {
  fundingPct.set(Math.max(60, Math.min(140, pct)));
}

export function showError(message: string) {
  errorMessage.set(message);
  setTimeout(() => errorMessage.set(''), 4000);
}

export function resetUIStores() {
  selectedZone.set(null);
  selectedInfra.set(null);
  activeModal.set(null);
  educationDrawerOpen.set(false);
  cheatConsoleOpen.set(false);
  undergroundMode.set(false);
  gameSpeed.set('normal');
  isLoading.set(false);
  errorMessage.set('');
  cheatHistory.set([]);
  fundingPct.set(100);
}
