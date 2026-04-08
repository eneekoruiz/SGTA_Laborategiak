<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GameState, StatsResponse } from '../types/game';

  export let open = false;
  export let gameState: GameState | null = null;
  export let stats: StatsResponse | null = null;

  const dispatch = createEventDispatcher<{ close: void }>();

  $: dateLabel = gameState ? `${gameState.current_date.month}/${gameState.current_date.year}` : '---';
  $: opinionBars = [
    { label: 'Public Trust', value: Math.min(100, Math.max(0, stats?.player.approval ?? 0)), tone: 'positive' },
    { label: 'Budget Pressure', value: Math.min(100, Math.max(0, (stats?.player.treasury ?? 0) / 1000)), tone: 'warn' },
    { label: 'City Buzz', value: Math.min(100, Math.max(0, stats?.comparison.score_diff ?? 0)), tone: 'neutral' }
  ];
</script>

{#if open}
  <div class="layer" role="presentation">
    <button class="scrim" type="button" aria-label="Close newspaper" on:click={() => dispatch('close')}></button>
    <div class="paper" role="dialog" aria-modal="true" aria-label="SimHiri Times">
      <header>
        <div>
          <p class="eyebrow">Classic Daily</p>
          <h2>SimHiri Times</h2>
        </div>
        <div class="masthead-meta">
          <span>{dateLabel}</span>
          <span>Front Page Edition</span>
        </div>
      </header>
      <div class="columns">
        <article class="lead-story">
          <h3>City Pulse: Population at {stats?.player.population ?? 0}</h3>
          <p>
            The treasury stands at § {stats?.player.treasury ?? 0}, while planners weigh a more
            aggressive civic agenda against the rival city’s current momentum.
          </p>
          <p class="dropcap">
            Transit demand remains the loudest public signal, but the mood on the street still
            hinges on whether services can keep pace with growth.
          </p>
        </article>

        <article class="news-column">
          <h4>Public Opinion</h4>
          <div class="gauges">
            {#each opinionBars as bar}
              <div class="gauge-row">
                <span>{bar.label}</span>
                <div class="gauge"><i class={bar.tone} style={`width:${bar.value}%`}></i></div>
              </div>
            {/each}
          </div>
        </article>

        <article class="news-column side-note">
          <h4>Editorial Brief</h4>
          <ul>
            <li>More public services</li>
            <li>Lower taxes</li>
            <li>Transport upgrades</li>
          </ul>
        </article>
      </div>
      <footer>
        <button on:click={() => dispatch('close')}>Close Edition</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .layer { position: fixed; inset: 0; display: grid; place-items: center; z-index: 80; }
  .scrim { position: absolute; inset: 0; border: 0; background: rgba(13, 17, 28, 0.42); }
  .paper {
    position: relative;
    z-index: 1;
    width: min(980px, 94vw);
    background: #f8f1dd;
    color: #2b2117;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 28px 72px rgba(0, 0, 0, 0.38);
    border: 1px solid rgba(87, 65, 39, 0.18);
    font-family: Georgia, 'Times New Roman', serif;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 2px solid #bfae8a;
    margin-bottom: 16px;
    padding-bottom: 12px;
  }
  .eyebrow {
    margin: 0 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 0.72rem;
    color: #7d694b;
  }
  h2, h3, h4 { margin: 0 0 8px; }
  .masthead-meta {
    display: grid;
    justify-items: end;
    gap: 4px;
    font-size: 0.82rem;
    color: #6c5b43;
  }
  .columns {
    display: grid;
    grid-template-columns: 1.4fr 1fr 0.9fr;
    gap: 18px;
  }
  .lead-story,
  .news-column {
    background: rgba(255, 255, 255, 0.36);
    border: 1px solid rgba(100, 77, 44, 0.12);
    border-radius: 10px;
    padding: 14px;
  }
  .dropcap::first-letter {
    float: left;
    font-size: 3rem;
    line-height: 0.95;
    padding-right: 0.1em;
    font-weight: 700;
  }
  .gauges { display: grid; gap: 12px; }
  .gauge-row { display: grid; gap: 6px; }
  .gauge {
    height: 12px;
    border-radius: 999px;
    background: rgba(92, 76, 52, 0.14);
    overflow: hidden;
  }
  .gauge i {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .positive { background: linear-gradient(90deg, #5c8d5a, #9bc48d); }
  .warn { background: linear-gradient(90deg, #c98a3a, #e0bc72); }
  .neutral { background: linear-gradient(90deg, #6e86a9, #a7bedf); }
  .side-note ul { margin: 0; padding-left: 18px; }
  footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
  button {
    border: 0;
    border-radius: 999px;
    padding: 10px 16px;
    background: #2b2117;
    color: #f8f1dd;
    cursor: pointer;
  }
  p { margin: 0 0 10px; line-height: 1.55; }
  ul { margin: 0 0 12px 18px; }
  @media (max-width: 880px) {
    .columns { grid-template-columns: 1fr; }
    header { flex-direction: column; }
    .masthead-meta { justify-items: start; }
  }
</style>
