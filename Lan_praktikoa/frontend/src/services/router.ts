import { writable } from 'svelte/store';
import { getStoredAuthToken } from './apiService';

export type RouteName = 'landing' | 'login' | 'register' | 'games' | 'new-game' | 'game';

export interface AppRoute {
  name: RouteName;
  path: string;
  gameId?: string;
}

const DEFAULT_ROUTE: AppRoute = resolveRoute(typeof window !== 'undefined' ? window.location.pathname : '/');

export const currentRoute = writable<AppRoute>(DEFAULT_ROUTE);

let routerStarted = false;

export function resolveRoute(pathname: string): AppRoute {
  const trimmed = pathname.replace(/\/+$/, '') || '/';

  if (trimmed === '/' || trimmed === '/landing') {
    return { name: 'landing', path: '/' };
  }

  if (trimmed === '/login' || trimmed === '/auth/login') {
    return { name: 'login', path: '/login' };
  }

  if (trimmed === '/register' || trimmed === '/auth/register') {
    return { name: 'register', path: '/register' };
  }

  if (trimmed === '/games' || trimmed === '/lobby/games') {
    return { name: 'games', path: '/games' };
  }

  if (trimmed === '/games/new') {
    return { name: 'new-game', path: '/games/new' };
  }

  const gameMatch = trimmed.match(/^\/game\/([^/]+)$/);
  if (gameMatch) {
    const gameId = decodeURIComponent(gameMatch[1]);
    return {
      name: 'game',
      path: `/game/${encodeURIComponent(gameId)}`,
      gameId
    };
  }

  return { name: 'landing', path: '/' };
}

/**
 * Determine if a route requires authentication
 */
function isProtectedRoute(route: AppRoute | RouteName): boolean {
  const routeName = typeof route === 'string' ? route : route.name;
  return routeName === 'games' || routeName === 'new-game' || routeName === 'game';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated(): boolean {
  const token = getStoredAuthToken();
  return !!token && token.length > 0;
}

export function syncRoute(pathname = window.location.pathname): AppRoute {
  const nextRoute = resolveRoute(pathname);

  // Check if target route requires authentication (direct URL access)
  if (isProtectedRoute(nextRoute) && !isAuthenticated()) {
    // Redirect to login
    const loginRoute = resolveRoute('/login');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', loginRoute.path);
    }
    currentRoute.set(loginRoute);
    return loginRoute;
  }

  currentRoute.set(nextRoute);
  return nextRoute;
}

export function navigate(path: string, replace = false): AppRoute {
  const nextRoute = resolveRoute(path);

  // Check if target route requires authentication
  if (isProtectedRoute(nextRoute) && !isAuthenticated()) {
    // Redirect to login instead
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
  syncRoute();

  window.addEventListener('popstate', () => {
    syncRoute();
  });
}

export function isGameRoute(route: AppRoute): boolean {
  return route.name === 'game';
}

export function getGameRouteId(route: AppRoute, fallback = 'game-001'): string {
  return route.gameId || fallback;
}
