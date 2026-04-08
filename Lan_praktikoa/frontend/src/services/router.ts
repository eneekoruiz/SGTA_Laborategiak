import { writable } from 'svelte/store';

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

export function syncRoute(pathname = window.location.pathname): AppRoute {
  const nextRoute = resolveRoute(pathname);
  currentRoute.set(nextRoute);
  return nextRoute;
}

export function navigate(path: string, replace = false): AppRoute {
  const nextRoute = resolveRoute(path);
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
