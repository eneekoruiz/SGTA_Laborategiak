<script lang="ts">
  import { onMount } from 'svelte';
  import { blur, fade } from 'svelte/transition';
  import App from './App.svelte';
  import ApiErrorNotifications from './components/ApiErrorNotifications.svelte';
  import { getStoredAuthToken } from './services/apiService';
  import LoginView from './views/auth/LoginView.svelte';
  import RegisterView from './views/auth/RegisterView.svelte';
  import GameListView from './views/lobby/GameListView.svelte';
  import LandingPage from './views/LandingPage.svelte';
  import NewGamePage from './views/NewGamePage.svelte';
  import { currentRoute, navigate, startRouter } from './services/router';

import SessionExpiredOverlay from './components/SessionExpiredOverlay.svelte';
  import { sessionStatus } from './store/ui';

  let route = $currentRoute;
  let isRedirecting = false;
  
  $: route = $currentRoute;

  /**
   * ✅ CRITICAL: Enforce authentication on protected routes
   * BLOCKS rendering for 0 milliseconds if not authenticated
   * @param targetRoute The route being accessed
   */
  function enforceAuth(targetRoute = route): void {
    const token = getStoredAuthToken();
    
    // Define routes that require authentication
    const protectedRoutes = ['games', 'new-game', 'game'];
    const isProtectedRoute = protectedRoutes.includes(targetRoute.name);

    // 🔴 CRITICAL: If accessing protected route without token
    if (isProtectedRoute && !token) {
      console.warn(`[ROUTE_GUARD] Unauthorized access attempt to ${targetRoute.name}. Redirecting...`);
      isRedirecting = true;
      navigate('/login', true);
      return;
    }

    // 🟢 OPTIMIZATION: If logged in but on auth routes, redirect to games
    if ((targetRoute.name === 'login' || targetRoute.name === 'register') && token) {
      navigate('/games', true);
      return;
    }
    
    isRedirecting = false;
  }

  $: if (route) {
    enforceAuth(route);
  }

  onMount(() => {
    startRouter();
    enforceAuth();
  });
</script>

<!-- Global Error Notifications -->
<ApiErrorNotifications />

<!-- CRITICAL: Show loading while redirecting from protected routes -->
{#key route.name}
  <div class="route-container" in:blur={{ duration: 400, amount: 8 }} out:fade={{ duration: 200 }}>
    {#if isRedirecting}
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Aguardatzen...</p>
      </div>
    {:else if route.name === 'landing'}
      <LandingPage />
    {:else if route.name === 'login'}
      <LoginView />
    {:else if route.name === 'register'}
      <RegisterView />
    {:else if route.name === 'games'}
      <GameListView />
    {:else if route.name === 'new-game'}
      <NewGamePage />
    {:else if route.name === 'game'}
      <App />
    {:else}
      <LandingPage />
    {/if}
  </div>
{/key}

<SessionExpiredOverlay />

<style>
  .route-container {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /**
   * Loading screen shown during redirects
   * Z-index 9999 to appear above all content
   */
  .loading-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 1rem;
    background: linear-gradient(135deg, #0f1b2f 0%, #13233c 100%);
    color: #f4f8ff;
    z-index: 9999;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(244, 248, 255, 0.1);
    border-top-color: #5b9fd1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  p {
    font-size: 1rem;
    opacity: 0.7;
  }
</style>
