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
        return 'text-sky-900 border-sky-200 bg-sky-50/80';
      case 'warning':
        return 'text-amber-900 border-amber-200 bg-amber-50/80';
      case 'error':
        return 'text-rose-900 border-rose-200 bg-rose-50/80';
      case 'critical':
        return 'text-red-950 border-red-300 bg-red-100/85';
      default:
        return 'text-slate-900 border-slate-200 bg-white/80';
    }
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case 'info':
        return 'Info';
      case 'warning':
        return 'Warn';
      case 'error':
        return 'Error';
      case 'critical':
        return 'Critical';
      default:
        return 'Notice';
    }
  }
</script>

<!-- Server Offline Banner -->
{#if backendOffline}
  <div class="fixed top-0 left-0 right-0 border-b border-rose-300/70 bg-rose-100/80 backdrop-blur-md px-4 py-3 z-50 shadow-sm">
    <div class="flex items-center gap-3 text-rose-950 text-sm">
      <span class="text-xs uppercase tracking-[0.18em] font-semibold">Offline</span>
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
        class="pointer-events-auto backdrop-blur-xl rounded-2xl border px-4 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.18)] {getLevelColors(
          error.level
        )}"
      >
        <div class="flex items-start gap-3">
          <span class="text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-1 rounded-full border border-current/20 bg-white/45 flex-shrink-0">{getLevelIcon(error.level)}</span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm leading-tight">{error.title}</div>
            <div class="text-xs opacity-80 mt-1 leading-relaxed">{error.message}</div>
            {#if error.endpoint}
              <div class="text-[11px] opacity-60 mt-2 font-mono truncate">{error.endpoint}</div>
            {/if}
          </div>
          <button
            on:click={() => removeErrorNotification(error.id)}
            class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity rounded-xl bg-white/50 hover:bg-white/80 p-1"
            aria-label="Close notification"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="w-3.5 h-3.5">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>
          </button>
        </div>

        {#if error.action && error.retryable}
          <button
            on:click={() => {
              error.action?.();
              removeErrorNotification(error.id);
            }}
            class="mt-2 text-xs px-2 py-1 rounded-lg opacity-80 hover:opacity-100 bg-white/60 transition-opacity"
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
