<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { GameState, StatsResponse } from '../types/game';

  interface AITurnAction {
    type: string;
    label: string;
    detail?: string;
  }

  export let open = false;
  export let mode: 'fullscreen' | 'split' | 'panel' = 'panel';
  export let actions: AITurnAction[] = [];
  export let reasoning = '';
  export let gameState: GameState | null = null;
  export let stats: StatsResponse | null = null;

  const dispatch = createEventDispatcher<{ close: void }>();

  let playing = true;
  let speed: 'normal' | 'fast' | 'instant' = 'normal';
  let step = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clampPct(value: number, max = 100): number {
    return Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  }

  $: currentAction = actions[Math.min(step, Math.max(actions.length - 1, 0))] ?? null;

  function stopTimer(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleNextStep(): void {
    stopTimer();
    if (!open || !playing) return;
    if (step >= actions.length - 1) return;

    const delay = speed === 'normal' ? 900 : speed === 'fast' ? 350 : 100;
    timer = setTimeout(() => {
      step = Math.min(actions.length - 1, step + 1);
    }, delay);
  }

  function togglePlayback(): void {
    playing = !playing;
  }

  function rewind(): void {
    step = Math.max(0, step - 1);
  }

  function advance(): void {
    step = Math.min(actions.length - 1, step + 1);
  }

  function fastForward(): void {
    step = Math.max(0, actions.length - 1);
    playing = false;
    stopTimer();
  }

  function reset(): void {
    step = 0;
    playing = true;
  }

  function closeViewer(): void {
    stopTimer();
    playing = false;
    dispatch('close');
  }

  $: if (open && playing) {
    scheduleNextStep();
  } else if (!open) {
    stopTimer();
    step = 0;
  }

  $: if (!playing) {
    stopTimer();
  }

  onDestroy(stopTimer);
</script>

{#if open}
  <div class={`replay ${mode}`} role="region" aria-label="AA txandaren errepikapena">
    <header class="topbar">
      <div>
        <p>AA Errepikapena</p>
        <h3>{playing ? 'Txandaren laburpena' : 'Erreprodukzioa pausatuta'}</h3>
      </div>
      <button on:click={closeViewer}>Itxi</button>
    </header>

    <div class="layout" class:compare-mode={mode !== 'panel'}>
      {#if mode !== 'panel'}
        <section class="panel city-state">
          <h4>Jokalariaren hiriaren egoera</h4>
          <div class="city-grid">
            <article>
              <span class="card-label">Biztanleria</span>
              <strong>{stats?.player.population ?? gameState?.player_city.population ?? 0}</strong>
            </article>
            <article>
              <span class="card-label">Altxorra</span>
              <strong>§ {stats?.player.treasury ?? gameState?.player_city.treasury ?? 0}</strong>
            </article>
            <article>
              <span class="card-label">Puntuazioa</span>
              <strong>{stats?.player.composite_score ?? gameState?.player_city.metrics.composite_score ?? 0}</strong>
            </article>
            <article>
              <span class="card-label">Onarpena</span>
              <strong>{stats?.player.approval ?? gameState?.player_city.metrics.approval ?? 0}%</strong>
            </article>
          </div>

          <div class="city-meters">
            <div class="meter-row">
              <span>Energia</span>
              <div class="meter"><div class="fill power" style={`width: ${clampPct(stats?.player.power_coverage ?? gameState?.player_city.power_grid.coverage_pct ?? 0)}%`}></div></div>
              <span>{Math.round(stats?.player.power_coverage ?? gameState?.player_city.power_grid.coverage_pct ?? 0)}%</span>
            </div>
            <div class="meter-row">
              <span>Ura</span>
              <div class="meter"><div class="fill water" style={`width: ${clampPct(stats?.player.water_coverage ?? gameState?.player_city.water_system.coverage_pct ?? 0)}%`}></div></div>
              <span>{Math.round(stats?.player.water_coverage ?? gameState?.player_city.water_system.coverage_pct ?? 0)}%</span>
            </div>
            <div class="meter-row">
              <span>Krimena</span>
              <div class="meter"><div class="fill crime" style={`width: ${clampPct(stats?.player.crime_rate ?? gameState?.player_city.metrics.crime_rate ?? 0)}%`}></div></div>
              <span>{Math.round(stats?.player.crime_rate ?? gameState?.player_city.metrics.crime_rate ?? 0)}%</span>
            </div>
          </div>
        </section>
      {/if}

      <section class="panel timeline">
        <div class="controls">
          <button on:click={togglePlayback}>{playing ? 'Pausatu' : 'Erreproduzitu'}</button>
          <button on:click={rewind}>Atzera</button>
          <button on:click={advance}>Hurrengoa</button>
          <button on:click={fastForward}>Azkartu</button>
          <button on:click={reset}>Berrabiarazi</button>
          <select bind:value={speed} aria-label="Erreprodukzio abiadura">
            <option value="normal">Normala</option>
            <option value="fast">Azkarra</option>
            <option value="instant">Berehalakoa</option>
          </select>
        </div>

        <div class="progress">
          <div class="fill" style={`width: ${actions.length ? ((step + 1) / actions.length) * 100 : 0}%`}></div>
        </div>

        <div class="action-list">
          {#each actions as action, idx}
            <article class:active={idx === step} class:done={idx < step}>
              <strong>{action.label}</strong>
              <span>{action.type}</span>
              {#if action.detail}
                <p>{action.detail}</p>
              {/if}
            </article>
          {/each}
        </div>
      </section>

      <aside class="panel summary">
        <h4>AA ekintzen jarioa</h4>
        {#if currentAction}
          <div class="spotlight">
            <p>Uneko ekintza</p>
            <strong>{currentAction.label}</strong>
            <span>{currentAction.type}</span>
            {#if currentAction.detail}
              <small>{currentAction.detail}</small>
            {/if}
          </div>
        {/if}

        <h4>Txandaren laburpena</h4>
        <p>{reasoning || 'Ez dago txanda honetarako arrazoiketa erabilgarririk.'}</p>
        <div class="meta">
          <span>{actions.length} ekintza</span>
          <span>Urratsa {Math.min(step + 1, Math.max(actions.length, 1))}</span>
        </div>
      </aside>
    </div>
  </div>
{/if}

<style>
  .replay {
    position: fixed;
    z-index: 36;
    display: grid;
    gap: 16px;
    padding: 14px;
    border-radius: 20px;
    background: radial-gradient(circle at top, rgba(136, 160, 184, 0.15), transparent 28%), rgba(6, 12, 22, 0.92);
    backdrop-filter: blur(14px) saturate(120%);
    color: rgba(243, 248, 255, 0.96);
    border: 1px solid rgba(248, 252, 255, 0.12);
    box-shadow: 0 24px 48px rgba(2, 9, 20, 0.28);
  }

  
  .replay.panel {
    right: 16px;
    bottom: 110px; /* Above new dock */
    width: min(440px, calc(100vw - 32px));
    max-height: min(72vh, 760px);
  }

  .replay.split {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    bottom: auto;
    right: auto;
    width: min(980px, calc(100vw - 32px));
    max-height: min(80vh, 860px);
  }

  .replay.fullscreen {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    bottom: auto;
    right: auto;
    width: 90vw;
    height: 90vh;
    max-height: none;
    border-radius: 24px;
  }


  .topbar,
  .panel {
    border: 1px solid rgba(248, 252, 255, 0.12);
    background: rgba(13, 24, 42, 0.62);
    box-shadow: 0 24px 48px rgba(2, 9, 20, 0.24);
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 18px;
    padding: 14px 16px;
  }

  .topbar p,
  .topbar h3,
  .summary h4,
  .action-list strong,
  .action-list p {
    margin: 0;
  }

  .topbar p {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.7rem;
    color: rgba(218, 227, 240, 0.68);
  }

  .topbar h3 {
    font-size: 1rem;
  }

  .topbar button,
  .controls button,
  select {
    border: 0;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    padding: 10px 12px;
    font: inherit;
    cursor: pointer;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    min-height: 0;
    flex: 1;
  }

  .replay.split .layout,
  .replay.fullscreen .layout {
    grid-template-columns: 1fr 1.35fr 1fr;
  }

  .city-state {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .city-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .city-grid article {
    display: grid;
    gap: 3px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .city-grid .card-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(218, 227, 240, 0.7);
  }

  .city-grid strong {
    font-size: 0.95rem;
  }

  .city-meters {
    display: grid;
    gap: 8px;
  }

  .meter-row {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: rgba(233, 241, 252, 0.86);
  }

  .meter {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .meter .fill {
    height: 100%;
  }

  .meter .fill.power {
    background: #b9c087;
  }

  .meter .fill.water {
    background: #8ab8d3;
  }

  .meter .fill.crime {
    background: #d79a9a;
  }

  .panel {
    border-radius: 20px;
    padding: 16px;
    min-height: 0;
  }

  .timeline {
    display: grid;
    gap: 14px;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .progress {
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, #a8d5ba, #87ceeb);
  }

  .action-list {
    display: grid;
    gap: 10px;
    overflow: auto;
    padding-right: 4px;
  }

  .action-list article {
    padding: 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    opacity: 0.5;
  }

  .action-list article.active {
    opacity: 1;
    background: rgba(182, 154, 99, 0.16);
    border-color: rgba(182, 154, 99, 0.28);
  }

  .action-list article.done {
    opacity: 0.72;
  }

  .action-list span,
  .meta span,
  .summary p {
    color: rgba(233, 241, 252, 0.78);
  }

  .action-list span {
    display: block;
    margin-top: 4px;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .action-list p {
    margin-top: 6px;
    line-height: 1.45;
    font-size: 0.9rem;
  }

  .summary {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .spotlight {
    display: grid;
    gap: 4px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(182, 154, 99, 0.16);
    border: 1px solid rgba(182, 154, 99, 0.32);
  }

  .spotlight p,
  .spotlight strong,
  .spotlight span,
  .spotlight small {
    margin: 0;
  }

  .spotlight p {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(233, 241, 252, 0.76);
  }

  .spotlight span {
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(233, 241, 252, 0.76);
  }

  .spotlight small {
    color: rgba(233, 241, 252, 0.82);
  }

  .replay .summary {
    display: none;
  }

  .replay.split .summary,
  .replay.fullscreen .summary {
    display: grid;
  }

  .summary h4 {
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: rgba(218, 227, 240, 0.72);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .replay.panel .action-list,
  .replay.split .action-list {
    max-height: 34vh;
  }

  .replay.fullscreen .action-list {
    max-height: calc(100vh - 260px);
  }

  .meta span {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 0.8rem;
  }

  @media (max-width: 980px) {
    .replay.panel,
    .replay.split,
    .replay.fullscreen {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      bottom: auto;
      right: auto;
      width: calc(100vw - 24px);
      max-height: 80vh;
    }

    .layout {
      grid-template-columns: 1fr;
    }

    .city-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
