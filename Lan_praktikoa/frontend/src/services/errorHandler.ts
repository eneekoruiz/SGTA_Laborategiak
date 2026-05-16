/**
 * ERROR HANDLER SERVICE
 *
 * Global error handling for API failures.
 * - Detects when backend is offline
 * - Shows user-friendly notifications
 * - Prevents app crashes from network errors
 * - Tracks error state for UI (e.g., "Server Offline" notice)
 */

import { writable } from 'svelte/store';

export type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';
export type NotificationPriority = 'low' | 'medium' | 'high';

export interface ApiErrorNotification {
  id: string;
  level: ErrorLevel;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  endpoint?: string;
  retryable?: boolean;
  action?: () => void;
  duration?: number; // milliseconds, null = persist
}

/**
 * Global error notification store
 * Subscribe to show toast/notification UI
 */
export const apiErrors = writable<ApiErrorNotification[]>([]);

/**
 * Backend health status store
 * true = backend is responding
 * false = backend is offline
 */
export const isBackendHealthy = writable<boolean>(true);

/**
 * Number of consecutive API failures
 * Used to decide when to mark backend as "offline"
 */
let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 2; // Mark offline after 2 consecutive failures

/**
 * Add a new error notification
 */
export function addErrorNotification(
  error: Partial<ApiErrorNotification> & { title: string; message: string }
): void {
  const notification: ApiErrorNotification = {
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    level: error.level || 'error',
    priority: error.priority || 'medium',
    title: error.title,
    message: error.message,
    timestamp: new Date(),
    endpoint: error.endpoint,
    retryable: error.retryable ?? false,
    action: error.action,
    duration: error.duration ?? 5000 // Default 5 seconds
  };

  apiErrors.update((errors) => [...errors, notification]);

  // Auto-remove after duration (if not persistent)
  if (notification.duration) {
    setTimeout(() => removeErrorNotification(notification.id), notification.duration);
  }
}

function levelFromPriority(priority: NotificationPriority): ErrorLevel {
  if (priority === 'high') return 'critical';
  if (priority === 'low') return 'info';
  return 'error';
}

/**
 * App-wide notification entry point for API and integration events.
 *
 * Why: all providers (real backend and mock simulation engine) should publish
 * failures through one contract so UI behavior is deterministic.
 */
export function sendNotification(options: {
  title: string;
  message: string;
  priority?: NotificationPriority;
  endpoint?: string;
  retryable?: boolean;
  duration?: number;
  action?: () => void;
}): void {
  const priority = options.priority ?? 'medium';
  addErrorNotification({
    title: options.title,
    message: options.message,
    priority,
    level: levelFromPriority(priority),
    endpoint: options.endpoint,
    retryable: options.retryable,
    duration: options.duration,
    action: options.action
  });
}

/**
 * Remove an error notification by ID
 */
export function removeErrorNotification(id: string): void {
  apiErrors.update((errors) => errors.filter((e) => e.id !== id));
}

/**
 * Clear all error notifications
 */
export function clearErrors(): void {
  apiErrors.set([]);
}

/**
 * Handle API response errors (4xx, 5xx, network, timeout, etc.)
 */
export function handleApiError(
  error: Error | Response | any,
  endpoint: string,
  contextOrLevel?: string | ErrorLevel
): void {
  let title = 'API Error';
  let message = 'An unexpected error occurred';
  let level: ErrorLevel = 'error';
  let priority: NotificationPriority = 'medium';
  let isNetworkError = false;

  // Extract error details if new format
  const errorType = error?.errorType || error?.error_type;
  const affectedFields = error?.affectedFields || error?.fields || [];
  const fieldMessages = error?.fieldMessages || error?.details || {};
  const statusCode = error?.statusCode || error?.status || 0;

  if (error instanceof Response) {
    // HTTP response error
    if (error.status >= 500) {
      level = 'critical';
      priority = 'high';
      title = 'Zerbitzari errorea';
      message = 'Arazo bat gertatu da zerbitzarian. Saiatu berriro minutu batzuk barru.';
      isNetworkError = true;
    } else if (error.status === 408 || error.status === 504) {
      priority = 'high';
      title = 'Konexio motela';
      message = 'Zerbitzariak denbora gehiegi behar du erantzuteko. Egiaztatu zure konexioa.';
      isNetworkError = true;
    } else if (error.status >= 400) {
      title = 'Eskaera errorea';
      message = 'Ezin izan da ekintza burutu. Baliteke datu batzuk okerrak izatea.';
    }
  } else if (error instanceof Error) {
    // JavaScript error (network, timeout, parse, etc.)
    const msg = error.message.toLowerCase();

    if (msg.includes('fetch') || msg.includes('network')) {
      title = 'Konexio errorea';
      priority = 'high';
      message = 'Ezin izan dugu zerbitzarira iritsi. Egiaztatu zure WiFi-a edo datu-konexioa.';
      isNetworkError = true;
    } else if (msg.includes('timeout') || msg.includes('abort')) {
      title = 'Konexio motela';
      priority = 'high';
      message = 'Zerbitzaria ez dago erantzuten. Saiatu berriro orrialdea berritzen.';
      isNetworkError = true;
    } else if (msg.includes('json')) {
      title = 'Datu errorea';
      message = 'Datuen tratamenduan errore bat gertatu da.';
    } else {
      // Use the message from the error object (which may have been enhanced)
      message = error.message;
    }
  } else if (error && typeof error === 'object') {
    // Plain object with error details (new format)
    title = error.title || message || 'Errorea';
    message = error.message || 'Ustekabeko errore bat gertatu da';
    level = (contextOrLevel as ErrorLevel) || error.level || 'error';
    priority = error.priority || 'medium';

    // Check if network error
    if (statusCode === 0 || error.message?.toLowerCase().includes('network') || error.message?.includes('konexio')) {
      isNetworkError = true;
    }
  }

  // Override level if provided as context parameter
  if (typeof contextOrLevel === 'string' && ['info', 'warning', 'error', 'critical'].includes(contextOrLevel)) {
    level = contextOrLevel as ErrorLevel;
  }

  // Track consecutive network failures
  if (isNetworkError) {
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      isBackendHealthy.set(false);
    }
  } else {
    consecutiveFailures = 0;
    isBackendHealthy.set(true);
  }

  // Create notification with error details
  sendNotification({
    title,
    message,
    priority,
    endpoint,
    retryable: isNetworkError,
    duration: level === 'critical' ? null : 5000
  });

  if (import.meta.env.DEV) {
    // Log for local debugging only
    console.error(`[API Error] ${endpoint}:`, {
      error,
      statusCode,
      errorType,
      affectedFields,
      fieldMessages,
      message
    });
  }
}

/**
 * Reset failure counter when API call succeeds
 */
export function onApiSuccess(): void {
  if (consecutiveFailures > 0) {
    consecutiveFailures = 0;
    isBackendHealthy.set(true);
  }
}

/**
 * Get current backend health status (synchronously)
 */
export function getBackendStatus(): 'healthy' | 'offline' {
  let status: 'healthy' | 'offline' = 'healthy';
  isBackendHealthy.subscribe((value) => {
    status = value ? 'healthy' : 'offline';
  })();
  return status;
}
