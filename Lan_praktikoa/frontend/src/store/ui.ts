import { get, writable } from 'svelte/store';
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

// Overlay intensity
export const overlayStrength = writable<number>(72);

// Game loop settings
export const gameSpeed = writable<'normal' | 'fast' | 'instant'>('normal');

// Loading/error states
export const isLoading = writable<boolean>(false);
export const errorMessage = writable<string>('');

// Cheat history (UI-only, not persisted)
export const cheatHistory = writable<string[]>([]);

// Funding slider (for Education/Health preview)
export const fundingPct = writable<number>(100);

export type NotificationPriority = 'high' | 'medium' | 'low';

export type UINotification = {
  id: number;
  title: string;
  message: string;
  priority: NotificationPriority;
  expanded: boolean;
  ts: number;
};

export const notifications = writable<UINotification[]>([]);

const notificationTimers = new Map<number, ReturnType<typeof setTimeout>>();
const DRAG_ERROR_THROTTLE_MS = 2500;
const MAX_NOTIFICATIONS_ON_SCREEN = 6;
let lastDragErrorTs = 0;

function notificationTtl(priority: NotificationPriority): number {
  if (priority === 'high') return 6000;
  if (priority === 'medium') return 3800;
  return 3200;
}

function clearNotificationTimer(id: number): void {
  const timer = notificationTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    notificationTimers.delete(id);
  }
}

function armNotificationTimer(id: number, priority: NotificationPriority): void {
  clearNotificationTimer(id);
  const ttl = notificationTtl(priority);
  const timer = setTimeout(() => {
    notifications.update((list) => list.filter((entry) => entry.id !== id));
    notificationTimers.delete(id);
  }, ttl);
  notificationTimers.set(id, timer);
}

export function pushNotification(
  payload: {
    title: string;
    message: string;
    priority?: NotificationPriority;
    expanded?: boolean;
  },
  options?: {
    dragOperation?: boolean;
    isError?: boolean;
  }
): number | null {
  const priority = payload.priority ?? 'medium';
  const now = Date.now();

  if (options?.dragOperation && options.isError) {
    if (now - lastDragErrorTs < DRAG_ERROR_THROTTLE_MS) {
      return null;
    }
    lastDragErrorTs = now;
  }

  const current = get(notifications);
  const existing = current.find((entry) => entry.message === payload.message);

  if (existing) {
    notifications.update((list) =>
      list.map((entry) =>
        entry.id === existing.id
          ? {
              ...entry,
              title: payload.title,
              priority,
              expanded: payload.expanded ?? entry.expanded,
              ts: now
            }
          : entry
      )
    );
    armNotificationTimer(existing.id, priority);
    return existing.id;
  }

  const id = now + Math.floor(Math.random() * 1000);
  const next: UINotification = {
    id,
    title: payload.title,
    message: payload.message,
    priority,
    expanded: payload.expanded ?? false,
    ts: now
  };

  notifications.update((list) => [next, ...list].slice(0, MAX_NOTIFICATIONS_ON_SCREEN));
  armNotificationTimer(id, priority);
  return id;
}

export function clearNotification(id: number): void {
  clearNotificationTimer(id);
  notifications.update((list) => list.filter((entry) => entry.id !== id));
}

export function clearAllNotifications(): void {
  for (const id of notificationTimers.keys()) {
    clearNotificationTimer(id);
  }
  notifications.set([]);
}

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

export function setOverlayStrength(value: number) {
  overlayStrength.set(Math.max(0, Math.min(100, value)));
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
  overlayStrength.set(72);
  gameSpeed.set('normal');
  isLoading.set(false);
  errorMessage.set('');
  cheatHistory.set([]);
  fundingPct.set(100);
  clearAllNotifications();
}
