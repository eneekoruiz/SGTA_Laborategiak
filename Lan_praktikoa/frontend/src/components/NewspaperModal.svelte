<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GameState, StatsResponse } from '../types/game';

  export let open = false;
  export let gameState: GameState | null = null;
  export let stats: StatsResponse | null = null;

  const dispatch = createEventDispatcher<{ close: void }>();

  $: dateLabel = gameState ? `${gameState.current_date.month}/${gameState.current_date.year}` : '---';
  $: monthlyIncome = stats?.player.monthly_income ?? 0;
  $: monthlyExpenses = stats?.player.monthly_expenses ?? 0;
  $: finalBalance = monthlyIncome - monthlyExpenses;
  $: opinionBars = [
    { label: 'Herritarren konfiantza', value: Math.min(100, Math.max(0, stats?.player.approval ?? 0)), tone: 'positive' },
    { label: 'Aurrekontu-presioa', value: Math.min(100, Math.max(0, (stats?.player.treasury ?? 0) / 1000)), tone: 'warn' },
    { label: 'Hiriaren zurrumurrua', value: Math.min(100, Math.max(0, stats?.comparison.score_diff ?? 0)), tone: 'neutral' }
  ];
</script>

{#if open}
  <div class="layer" role="presentation">
    <button class="scrim" type="button" aria-label="Egunkaria itxi" on:click={() => dispatch('close')}></button>
    <div class="paper" role="dialog" aria-modal="true" aria-label="SimHiri Egunkaria">
      <header class="masthead">
        <div>
          <p class="eyebrow">Eguneroko klasikoa</p>
          <h2>SimHiri Egunkaria</h2>
        </div>
        <div class="masthead-meta">
          <span>{dateLabel}</span>
          <span>Azaleko edizioa</span>
        </div>
      </header>

      <section class="layout">
        <!-- Ekonomia Laburpena - Monthly Financial Summary -->
        <article class="financial-summary spread">
          <p class="section-label">Ekonomia Laburpena</p>
          <h3>Hileko Laburpena - {dateLabel}</h3>
          <div class="finance-grid">
            <div class="finance-item positive">
              <span class="finance-label">Zergak (Guztira)</span>
              <span class="finance-value">§{Math.round(monthlyIncome).toLocaleString()}</span>
            </div>
            <div class="finance-item negative">
              <span class="finance-label">Mantentze Kostuak</span>
              <span class="finance-value">§{Math.round(monthlyExpenses).toLocaleString()}</span>
            </div>
            <div class="finance-item total">
              <span class="finance-label">Oreka Finala</span>
              <span class="finance-value" class:pos={finalBalance >= 0} class:neg={finalBalance < 0}>
                {finalBalance >= 0 ? '+' : ''}§{Math.round(finalBalance).toLocaleString()}
              </span>
            </div>
            <div class="finance-item treasury">
              <span class="finance-label">Altxorra (Unekoa)</span>
              <span class="finance-value">§{Math.round(stats?.player.treasury ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </article>

        <article class="lead-story">
          <p class="section-label">Azaleko albistea</p>
          <h3>Hiriaren taupada: biztanleria {stats?.player.population ?? 0}</h3>
          <p>
            Altxorra § {Math.floor(stats?.player.treasury ?? 0)} da une honetan, eta planifikatzaileek agenda
            ausartagoa baloratzen dute aurkariaren uneko erritmoaren aurrean.
          </p>
          <p class="dropcap">
            Garraioaren eskaria da oraindik seinale ozenena, baina kaleko giroa zerbitzuek
            hazkundearekin erritmoa eutsiko ote diotenaren menpe dago.
          </p>
        </article>

        <article class="news-column tall">
          <p class="section-label">Iritzi publikoa</p>
          <h4>Hiriaren termometroa</h4>
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
          <p class="section-label">Erredakzio-oharra</p>
          <h4>Gomendio azkarrak</h4>
          <ul>
            <li>Zerbitzu publiko gehiago</li>
            <li>Zerga txikiagoak</li>
            <li>Garraio hobekuntzak</li>
          </ul>
        </article>

        <article class="news-column footer-note">
          <p class="section-label">Azken oharra</p>
          <h4>Aurrekontu-presioa</h4>
          <p>
            Hiriaren osasuna eta aurrekontuaren oreka ez daude oraindik erabat bermatuta; garaiz
            mugituz gero, joera hobetu daiteke.
          </p>
        </article>
      </section>

      <footer class="paper-footer">
        <button on:click={() => dispatch('close')}>Edizioa itxi</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .layer { position: fixed; inset: 0; display: grid; place-items: stretch; z-index: 80; }
  .scrim { position: absolute; inset: 0; border: 0; background: rgba(13, 17, 28, 0.42); }
  .paper {
    position: relative;
    z-index: 1;
    width: 100vw;
    height: 100vh;
    background: #f8f1dd;
    color: #2b2117;
    border-radius: 0;
    padding: clamp(18px, 3vw, 34px);
    box-shadow: none;
    border: 0;
    font-family: Georgia, 'Times New Roman', serif;
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: auto;
  }
  .masthead {
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
  .section-label {
    margin: 0 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.68rem;
    color: #8a6f48;
  }
  .masthead-meta {
    display: grid;
    justify-items: end;
    gap: 4px;
    font-size: 0.82rem;
    color: #6c5b43;
  }
  .layout {
    display: grid;
    grid-template-columns: 1.5fr 1fr 0.9fr;
    gap: 18px;
    align-content: start;
  }
  .lead-story,
  .news-column {
    background: rgba(255, 255, 255, 0.36);
    border: 1px solid rgba(100, 77, 44, 0.12);
    border-radius: 10px;
    padding: 14px;
  }
  
  /* Financial Summary Styles */
  .financial-summary {
    background: linear-gradient(135deg, rgba(43, 33, 23, 0.08), rgba(43, 33, 23, 0.04));
    border: 2px solid rgba(100, 77, 44, 0.25);
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 8px;
  }
  .finance-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 10px;
  }
  .finance-item {
    background: rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    padding: 12px;
    display: grid;
    gap: 4px;
    text-align: center;
  }
  .finance-item.positive { border-bottom: 3px solid #5c8d5a; }
  .finance-item.negative { border-bottom: 3px solid #c94a4a; }
  .finance-item.total { border-bottom: 3px solid #6e86a9; background: rgba(110, 134, 169, 0.15); }
  .finance-item.treasury { border-bottom: 3px solid #c98a3a; }
  .finance-label {
    font-size: 0.72rem;
    color: #6c5b43;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .finance-value {
    font-size: 1.2rem;
    font-weight: 700;
    color: #2b2117;
  }
  .finance-value.pos { color: #5c8d5a; }
  .finance-value.neg { color: #c94a4a; }
  
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
  .paper-footer {
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
  .spread {
    grid-column: 1 / span 2;
  }
  .tall {
    min-height: 100%;
  }
  .footer-note {
    grid-column: 1 / -1;
  }
  @media (max-width: 880px) {
    .layout { grid-template-columns: 1fr; }
    .spread,
    .footer-note { grid-column: auto; }
    .masthead { flex-direction: column; }
    .masthead-meta { justify-items: start; }
  }
</style>
