<script lang="ts">
  import { onMount } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { apiErrors, isBackendHealthy, removeErrorNotification } from '../services/errorHandler';
  import type { ApiErrorNotification } from '../services/errorHandler';

  let errors: ApiErrorNotification[] = [];
  let backendOffline = false;

  onMount(() => {
    const unsubscribeErrors = apiErrors.subscribe((value) => {
      errors = value;
    });

    const unsubscribeHealth = isBackendHealthy.subscribe((value) => {
      backendOffline = !value;
    });

    return () => {
      unsubscribeErrors();
      unsubscribeHealth();
    };
  });

  function getLevelColors(level: string) {
    switch (level) {
      case 'info':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-200';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200';
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-200';
      case 'critical':
        return 'bg-red-600/30 border-red-600/70 text-red-100';
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-200';
    }
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🔴';
      default:
        return '•';
    }
  }
</script>

<!-- Server Offline Banner -->
{#if backendOffline}
  <div class="fixed top-0 left-0 right-0 bg-red-600/20 border-b border-red-500/50 px-4 py-3 z-50">
    <div class="flex items-center gap-3 text-red-100 text-sm">
      <span class="text-lg">🔌</span>
      <span>
        <strong>Backend Server Offline</strong> — Some features may be limited. Using local mock data.
      </span>
    </div>
  </div>
{/if}

<!-- Error Toast Notifications -->
<div class="fixed top-16 right-4 z-40 pointer-events-none">
  <div class="flex flex-col gap-3">
    {#each errors as error (error.id)}
      <div
        transition:slide={{ duration: 300 }}
        class="pointer-events-auto backdrop-blur-md rounded-lg border px-4 py-3 shadow-lg {getLevelColors(
          error.level
        )}"
      >
        <div class="flex items-start gap-3">
          <span class="text-lg flex-shrink-0">{getLevelIcon(error.level)}</span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm">{error.title}</div>
            <div class="text-xs opacity-90 mt-1">{error.message}</div>
            {#if error.endpoint}
              <div class="text-xs opacity-75 mt-1 font-mono">{error.endpoint}</div>
            {/if}
          </div>
          <button
            on:click={() => removeErrorNotification(error.id)}
            class="flex-shrink-0 text-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close notification"
          >
            ×
          </button>
        </div>

        {#if error.action && error.retryable}
          <button
            on:click={() => {
              error.action?.();
              removeErrorNotification(error.id);
            }}
            class="mt-2 text-xs px-2 py-1 rounded opacity-80 hover:opacity-100 bg-white/10 transition-opacity"
          >
            Retry
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  :global(body) {
    /* Reserve space for top banner */
    padding-top: 0;
  }
</style>
