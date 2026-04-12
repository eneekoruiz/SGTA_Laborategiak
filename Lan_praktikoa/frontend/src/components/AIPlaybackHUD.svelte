<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ReplaySpeed } from '../services/AIReplayManager';

  export let open = false;
  export let playing = false;
  export let currentActionIndex = 0;
  export let totalActions = 0;
  export let speed: ReplaySpeed = 'normal';
  export let currentLabel = 'AA ekintza';

  const dispatch = createEventDispatcher<{
    togglePlay: void;
    stepBack: void;
    stepForward: void;
    speedChange: { speed: ReplaySpeed };
    skipEnd: void;
  }>();

  function setSpeed(next: ReplaySpeed): void {
    dispatch('speedChange', { speed: next });
  }

  $: progress = totalActions > 0 ? ((currentActionIndex + 1) / totalActions) * 100 : 0;
</script>

{#if open}
  <section class="hud" aria-label="AA erreprodukzio HUD">
    <header>
      <p>AA Erreprodukzioa</p>
      <strong>{currentLabel}</strong>
      <span>{Math.min(currentActionIndex + 1, Math.max(totalActions, 1))} / {Math.max(totalActions, 1)}</span>
    </header>

    <div class="controls">
      <button type="button" on:click={() => dispatch('stepBack')} aria-label="Atzera urratsa">⏮</button>
      <button type="button" on:click={() => dispatch('togglePlay')} aria-label={playing ? 'Pausatu' : 'Erreproduzitu'}>{playing ? '⏸ Pausatu' : '▶ Erreproduzitu'}</button>
      <button type="button" on:click={() => dispatch('stepForward')} aria-label="Aurrera urratsa">⏭</button>
      <button type="button" on:click={() => dispatch('skipEnd')} aria-label="Amaierara salto">Amaierara</button>
    </div>

    <div class="speed-controls" role="group" aria-label="Erreprodukzio abiadura">
      <button type="button" class:active={speed === 'normal'} on:click={() => setSpeed('normal')}>Normala (1s)</button>
      <button type="button" class:active={speed === 'fast'} on:click={() => setSpeed('fast')}>Azkarra (0.2s)</button>
      <button type="button" class:active={speed === 'instant'} on:click={() => setSpeed('instant')}>Berehalakoa (0s)</button>
    </div>

    <div class="progress" aria-hidden="true">
      <div class="fill" style={`width:${progress}%`}></div>
    </div>
  </section>
{/if}

<style>
  .hud {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(197, 232, 255, 0.25);
    background: linear-gradient(165deg, rgba(6, 16, 30, 0.9), rgba(10, 24, 44, 0.84));
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
    color: rgba(236, 247, 255, 0.96);
  }

  header {
    display: grid;
    gap: 2px;
  }

  header p,
  header strong,
  header span {
    margin: 0;
  }

  header p {
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(173, 210, 239, 0.82);
  }

  header strong {
    font-size: 0.84rem;
  }

  header span {
    font-size: 0.72rem;
    color: rgba(203, 228, 246, 0.82);
  }

  .controls,
  .speed-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  button {
    border: 1px solid rgba(195, 223, 246, 0.3);
    border-radius: 10px;
    min-height: 34px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    cursor: pointer;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: background-color 140ms ease, border-color 140ms ease;
  }

  button:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .speed-controls button.active {
    background: rgba(126, 196, 255, 0.22);
    border-color: rgba(170, 225, 255, 0.8);
    color: #eef9ff;
  }

  .progress {
    height: 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, #4ac3ff, #8cf5ff);
  }
</style>
