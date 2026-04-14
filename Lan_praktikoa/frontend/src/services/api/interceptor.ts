/**
 * Global HTTP Response Interceptor
 * Captures 401/403 errors and handles session recovery silently
 * 
 * CRITICAL: This intercepts at the network layer BEFORE components see the error
 */

import { navigate } from '../router';
import { clearAuthToken } from './auth';
import { sendNotification } from '../errorHandler';

/**
 * Global response interceptor for all fetch requests
 * Must be called in every fetch() after response is received
 * 
 * @param response The fetch Response object
 * @param endpoint The API endpoint being called
 * @returns The same response if OK, or throws enriched error if not
 */
export async function interceptResponse(response: Response, endpoint: string): Promise<Response> {
  // ✅ CRITICAL: Handle 401 Unauthorized (expired/invalid token)
  if (response.status === 401) {
    // 1. Clear all auth data IMMEDIATELY
    clearAuthToken();
    
    // 2. Extract error message from response
    let message = 'Zure saioa amaitu da, mesedez saioa hasi berriro.';
    try {
      const errorData = await response.clone().json();
      if (errorData.message) {
        message = errorData.message;
      }
    } catch {
      // Response was not JSON, use default
    }
    
    // 3. Check if already on auth route to avoid redirect loop
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthRoute = currentPath === '/login' || currentPath === '/register';
    
    // 4. Log what we're doing
    console.warn(`[HTTP_INTERCEPTOR] 🔴 401 on ${endpoint} - Token cleared`);
    
    // 5. Redirect ONLY if not already on auth route (prevents redirect loops)
    if (typeof window !== 'undefined' && !isAuthRoute) {
      console.warn(`[HTTP_INTERCEPTOR] Redirecting to /login and showing notification`);
      // Use setTimeout to ensure state is cleared first
      setTimeout(() => {
        navigate('/login', true);
        // Show notification with message
        sendNotification({
          title: 'Saioa Amaitu da',
          message,
          priority: 'high',
          endpoint,
          duration: 5000
        });
      }, 0);
    } else if (isAuthRoute) {
      console.warn(`[HTTP_INTERCEPTOR] Already on auth route (${currentPath}) - Skipping redirect`);
    }
    
    // 6. Throw error so calling code knows something happened
    const error = new Error(message);
    (error as any).statusCode = 401;
    (error as any).isSessionError = true;
    throw error;
  }
  
  // ✅ CRITICAL: Handle 403 Forbidden (permission denied)
  if (response.status === 403) {
    // Treat 403 like 401 for safety (might be permissions issue)
    clearAuthToken();
    
    let message = 'Ez duzu berari diren baimenak.';
    try {
      const errorData = await response.clone().json();
      if (errorData.message) {
        message = errorData.message;
      }
    } catch {
      // Response was not JSON
    }
    
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthRoute = currentPath === '/login' || currentPath === '/register';
    
    console.warn(`[HTTP_INTERCEPTOR] 🔴 403 on ${endpoint} - Token cleared`);
    
    if (typeof window !== 'undefined' && !isAuthRoute) {
      console.warn(`[HTTP_INTERCEPTOR] Redirecting to /login and showing notification`);
      setTimeout(() => {
        navigate('/login', true);
        sendNotification({
          title: 'Baimena Ukatua',
          message,
          priority: 'high',
          endpoint,
          duration: 5000
        });
      }, 0);
    } else if (isAuthRoute) {
      console.warn(`[HTTP_INTERCEPTOR] Already on auth route (${currentPath}) - Skipping redirect`);
    }
    
    const error = new Error(message);
    (error as any).statusCode = 403;
    (error as any).isSessionError = true;
    throw error;
  }
  
  // ✅ Handle 5xx Server Errors (log but don't redirect)
  if (response.status >= 500) {
    console.error(`[HTTP_INTERCEPTOR] 5xx Server Error on ${endpoint}: ${response.status}`);
    
    let message = 'Zerbitzarian errore bat gertatu da. Saiatu berriro geroago.';
    try {
      const errorData = await response.clone().json();
      if (errorData.message) {
        message = errorData.message;
      }
    } catch {
      // Response was not JSON
    }
    
    sendNotification({
      title: 'Zerbitzarian Errore',
      message,
      priority: 'high',
      endpoint,
      duration: 5000
    });
    
    const error = new Error(message);
    (error as any).statusCode = response.status;
    throw error;
  }
  
  // ✅ All other statuses pass through normally
  return response;
}

/**
 * Wrapper for fetch that automatically applies interceptor
 * Use this instead of fetch() directly to get automatic error handling
 */
export async function fetchWithInterceptor(
  endpoint: string, 
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(endpoint, options);
  
  // Apply interceptor (will throw if 401/403/5xx)
  return interceptResponse(response, endpoint);
}
