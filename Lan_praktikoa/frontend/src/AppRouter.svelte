<script lang="ts">
  import { onMount } from 'svelte';
  import App from './App.svelte';
  import ApiErrorNotifications from './components/ApiErrorNotifications.svelte';
  import { getStoredAuthToken } from './services/apiService';
  import LoginView from './views/auth/LoginView.svelte';
  import RegisterView from './views/auth/RegisterView.svelte';
  import GameListView from './views/lobby/GameListView.svelte';
  import LandingPage from './views/LandingPage.svelte';
  import NewGamePage from './views/NewGamePage.svelte';
  import { currentRoute, navigate, startRouter } from './services/router';

  let route = $currentRoute;
  $: route = $currentRoute;

  function enforceAuth(targetRoute = route): void {
    const token = getStoredAuthToken();
    const isProtected =
      targetRoute.name === 'games' ||
      targetRoute.name === 'new-game' ||
      targetRoute.name === 'game';

    if (isProtected && !token) {
      navigate('/login', true);
      return;
    }

    if ((targetRoute.name === 'login' || targetRoute.name === 'register') && token) {
      navigate('/games', true);
    }
  }

  $: if (route) {
    enforceAuth(route);
  }

  onMount(() => {
    startRouter();
    enforceAuth();
  });
</script>

<ApiErrorNotifications />

{#if route.name === 'landing'}
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
