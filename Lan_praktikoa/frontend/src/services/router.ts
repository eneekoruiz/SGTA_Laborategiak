import { writable } from 'svelte/store';
import { getStoredAuthToken } from './apiService';

export type RouteName = 'landing' | 'login' | 'register' | 'games' | 'new-game' | 'game';

export interface AppRoute {
  name: RouteName;
  path: string;
  gameId?: string;
}

/**
 * ✅ Routes requiring authentication
 */
const PROTECTED_ROUTES: RouteName[] = ['games', 'new-game', 'game'];

/**
 * ✅ Routes for authenticated users (should redirect if already logged in)
 */
const AUTH_ROUTES: RouteName[] = ['login', 'register'];

const DEFAULT_ROUTE: AppRoute = resolveRoute(typeof window !== 'undefined' ? window.location.pathname : '/');

export const currentRoute = writable<AppRoute>(DEFAULT_ROUTE);

let routerStarted = false;
let routerInitialized = false;

export function resolveRoute(pathname: string): AppRoute {
  const trimmed = pathname.replace(/\/+$/, '') || '/';

  // Landing page
  if (trimmed === '/' || trimmed === '/landing') {
    return { name: 'landing', path: '/' };
  }

  // Auth routes
  if (trimmed === '/login' || trimmed === '/auth/login') {
    return { name: 'login', path: '/login' };
  }

  if (trimmed === '/register' || trimmed === '/auth/register') {
    return { name: 'register', path: '/register' };
  }

  // Protected routes
  if (trimmed === '/games' || trimmed === '/lobby/games') {
    return { name: 'games', path: '/games' };
  }

  if (trimmed === '/games/new') {
    return { name: 'new-game', path: '/games/new' };
  }

  // Dynamic game route
  const gameMatch = trimmed.match(/^\/game\/([^/]+)$/);
  if (gameMatch) {
    const gameId = decodeURIComponent(gameMatch[1]);
    return {
      name: 'game',
      path: `/game/${encodeURIComponent(gameId)}`,
      gameId
    };
  }

  // Default: landing page for unknown routes
  return { name: 'landing', path: '/' };
}

/**
 * ✅ Determine if a route requires authentication
 * @param route The route to check
 * @returns true if route is protected
 */
function isProtectedRoute(route: AppRoute | RouteName): boolean {
  const routeName = typeof route === 'string' ? route : route.name;
  return PROTECTED_ROUTES.includes(routeName);
}

/**
 * ✅ Check if user is authenticated
 * @returns true if valid token exists
 */
function isAuthenticated(): boolean {
  const token = getStoredAuthToken();
  return !!token && token.length > 0;
}

/**
 * ✅ CRITICAL: Sync router state with current URL
 * Called on page load or history back/forward
 * If accessing protected route without token, redirect to /login
 * @param pathname The current pathname or window.location.pathname
 * @returns The resolved route after potential redirects
 */

export function syncRoute(pathname = window.location.pathname): AppRoute {
  const nextRoute = resolveRoute(pathname);

  // 🔴 CRITICAL: Check if target route requires authentication (direct URL access)
  if (isProtectedRoute(nextRoute) && !isAuthenticated()) {
    console.warn(`[ROUTER] 🔴 Unauthorized access to protected route: ${nextRoute.name}. Redirecting to login.`);
    
    const loginRoute = resolveRoute('/login');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', loginRoute.path);
    }
    currentRoute.set(loginRoute);
    return loginRoute;
  }

  // 🟢 OPTIMIZATION: If logged in but on auth pages, redirect to /games
  if (AUTH_ROUTES.includes(nextRoute.name) && isAuthenticated()) {
    console.info(`[ROUTER] 👤 Already authenticated. Redirecting to games.`);
    
    const gamesRoute = resolveRoute('/games');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', gamesRoute.path);
    }
    currentRoute.set(gamesRoute);
    return gamesRoute;
  }

  currentRoute.set(nextRoute);
  return nextRoute;
}

export function navigate(path: string, replace = false): AppRoute {
  const nextRoute = resolveRoute(path);

  // 🔴 CRITICAL: Check if target route requires authentication (programmatic navigation)
  if (isProtectedRoute(nextRoute) && !isAuthenticated()) {
    console.warn(`[ROUTER] 🔴 Programmatic navigate to protected route blocked: ${nextRoute.name}. Redirecting to login.`);
    
    const loginRoute = resolveRoute('/login');
    if (typeof window !== 'undefined') {
      if (replace) {
        window.history.replaceState({}, '', loginRoute.path);
      } else {
        window.history.pushState({}, '', loginRoute.path);
      }
    }
    currentRoute.set(loginRoute);
    return loginRoute;
  }

  // 🟢 OPTIMIZATION: Already authenticated on auth pages, redirect to games
  if (AUTH_ROUTES.includes(nextRoute.name) && isAuthenticated()) {
    console.info(`[ROUTER] 👤 Already authenticated. Redirecting from ${nextRoute.name} to games.`);
    
    const gamesRoute = resolveRoute('/games');
    if (typeof window !== 'undefined') {
      if (replace) {
        window.history.replaceState({}, '', gamesRoute.path);
      } else {
        window.history.pushState({}, '', gamesRoute.path);
      }
    }
    currentRoute.set(gamesRoute);
    return gamesRoute;
  }

  // Update browser history
  if (typeof window !== 'undefined') {
    if (replace) {
      window.history.replaceState({}, '', nextRoute.path);
    } else {
      window.history.pushState({}, '', nextRoute.path);
    }
  }
  
  currentRoute.set(nextRoute);
  return nextRoute;
}

export function startRouter(): void {
  if (routerStarted || typeof window === 'undefined') {
    return;
  }

  routerStarted = true;
  console.info('[ROUTER] ✅ Router initialized. Syncing current location.');
  
  syncRoute();

  window.addEventListener('popstate', () => {
    console.info('[ROUTER] 🔙 Browser history event detected. Re-syncing route.');
    syncRoute();
  });
}

export function isGameRoute(route: AppRoute): boolean {
  return route.name === 'game';
}

export function getGameRouteId(route: AppRoute, fallback = 'game-001'): string {
  return route.gameId || fallback;
}
