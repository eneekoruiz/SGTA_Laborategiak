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
        return 'text-sky-900 border-sky-100 bg-white/95';
      case 'warning':
        return 'text-amber-900 border-amber-100 bg-white/95';
      case 'error':
        return 'text-rose-900 border-rose-100 bg-white/95';
      case 'critical':
        return 'text-red-950 border-red-200 bg-white/95';
      default:
        return 'text-slate-900 border-slate-100 bg-white/95';
    }
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case 'info':
        return 'Info';
      case 'warning':
        return 'Abisua';
      case 'error':
        return 'Errorea';
      case 'critical':
        return 'Kritikoa';
      default:
        return 'Oharra';
    }
  }
</script>


<!-- Error Toast Notifications -->
<div class="fixed top-8 right-8 z-[9999] pointer-events-none w-full max-w-md">
  <div class="flex flex-col gap-4">
    {#each errors as error (error.id)}
      <div
        transition:slide={{ duration: 400 }}
        class="pointer-events-auto backdrop-blur-2xl rounded-2xl border px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative {getLevelColors(
          error.level
        )}"
      >
        <!-- Background Accent -->
        <div class="absolute inset-0 opacity-[0.03] pointer-events-none bg-gradient-to-br {error.level === 'critical' ? 'from-red-500 to-transparent' : 'from-amber-500 to-transparent'}"></div>
        
        <div class="flex items-start gap-4 relative z-10">
          <div class="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center {error.level === 'critical' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}">
            {#if error.level === 'critical' || error.level === 'error'}
              <svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {/if}
          </div>

          <div class="flex-1 min-w-0">
            <div class="font-bold text-slate-900 text-[16px] leading-tight mb-1">{error.title}</div>
            <div class="text-slate-600 text-[14px] leading-relaxed font-medium">{error.message}</div>
            
            <div class="flex items-center gap-3 mt-4">
              {#if error.retryable}
                <button
                  on:click={() => window.location.reload()}
                  class="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/20"
                >
                  <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Berritu orrialdea
                </button>
              {/if}
              
              <button
                on:click={() => removeErrorNotification(error.id)}
                class="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors px-2 py-1"
              >
                Ezkutatu
              </button>
            </div>
          </div>
        </div>

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
