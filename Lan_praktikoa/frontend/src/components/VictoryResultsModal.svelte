<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import type { GameState, StatsResponse } from '../types/game';

  export let gameState: GameState;
  export let stats: StatsResponse;

  const dispatch = createEventDispatcher<{
    close: void;
    exit: void;
  }>();

  $: victoryInfo = gameState.victory_condition || {
    status: gameState.victory_status,
    condition: 'unknown',
    winner: gameState.victory_status === 'player_won' ? 'player' : 'ai',
    reason: 'Partida amaitu da.'
  };

  $: isWin = ['player_population', 'player_score', 'player_rival_bankrupt', 'player_arcology_exodus', 'arcology_exodus', 'player_won'].includes(victoryInfo.status);
  $: isDefeat = ['player_bankrupt', 'ai_population', 'ai_score', 'ai_won'].includes(victoryInfo.status);

  $: playerStats = stats.player;
  $: aiStats = stats.ai || { population: 0, treasury: 0, metrics: { composite_score: 0 } };

  function handleExit() {
    dispatch('exit');
  }

  function handleContinue() {
    dispatch('close');
  }

  onMount(() => {
    // Play celebratory sound if win
    // soundManager.playSFX(isWin ? 'victory' : 'defeat');
  });
</script>

<div class="victory-overlay" transition:fade={{ duration: 400 }}>
  <div class="modal-container" in:scale={{ duration: 600, easing: backOut, start: 0.8 }}>
    <header class="modal-header" class:win={isWin} class:defeat={isDefeat}>
      <div class="header-glow"></div>
      <div class="icon-wrap">
        {#if isWin}
          <svg viewBox="0 0 24 24" class="trophy"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" class="defeat-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        {/if}
      </div>
      <h2>{isWin ? 'Garaipena!' : 'Partida Amaituta'}</h2>
      <p class="reason">{victoryInfo.reason || 'Zure hiriaren historia idatzita dago.'}</p>
    </header>

    <main class="modal-content">
      <div class="stats-grid">
        <div class="stat-card player">
          <span class="label">Zure Hiria</span>
          <div class="main-val">{playerStats.population.toLocaleString()}</div>
          <span class="sub-label">Biztanleria</span>
          
          <div class="mini-metrics">
            <div class="m-item">
              <small>Altxorra</small>
              <strong>§{Math.round(playerStats.treasury).toLocaleString()}</strong>
            </div>
            <div class="m-item">
              <small>Puntuazioa</small>
              <strong>{Math.round(playerStats.composite_score ?? 0).toLocaleString()}</strong>
            </div>
          </div>
        </div>

        <div class="stat-card vs">
          <div class="vs-line"></div>
          <span>VS</span>
          <div class="vs-line"></div>
        </div>

        <div class="stat-card rival">
          <span class="label">Aurkaria (AA)</span>
          <div class="main-val">{aiStats.population.toLocaleString()}</div>
          <span class="sub-label">Biztanleria</span>

          <div class="mini-metrics">
            <div class="m-item">
              <small>Altxorra</small>
              <strong>§{Math.round(aiStats.treasury).toLocaleString()}</strong>
            </div>
            <div class="m-item">
              <small>Puntuazioa</small>
              <strong>{Math.round(aiStats.composite_score ?? 0).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="historical-note" in:slide={{ delay: 400, duration: 500, easing: cubicOut }}>
        <p>
          {gameState.current_date.year} urtean, {playerStats.population > aiStats.population ? 'zure hiria eskualdeko nagusia bihurtu da' : 'aurkariak abantaila hartu du garapenean'}. 
          Hiri plangintzaren historia luzea da, eta alkate bakoitzak bere arrastoa uzten du.
        </p>
      </div>
    </main>

    <footer class="modal-footer">
      <button class="btn-secondary" on:click={handleContinue}>
        Ikusten jarraitu
      </button>
      <button class="btn-primary" class:win={isWin} on:click={handleExit}>
        Irten atarira
      </button>
    </footer>
  </div>
</div>

<style>
  .victory-overlay {
    position: fixed;
    inset: 0;
    background: rgba(7, 11, 20, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .modal-container {
    background: #1a1f2e;
    width: 100%;
    max-width: 680px;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header {
    padding: 40px 30px;
    text-align: center;
    position: relative;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
  }

  .modal-header.win {
    background: linear-gradient(180deg, rgba(212, 175, 55, 0.15) 0%, transparent 100%);
  }
  
  .modal-header.defeat {
    background: linear-gradient(180deg, rgba(201, 74, 74, 0.15) 0%, transparent 100%);
  }

  .header-glow {
    position: absolute;
    top: -50px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 100px;
    background: radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%);
    filter: blur(20px);
    pointer-events: none;
  }

  .win .header-glow { background: radial-gradient(circle, rgba(212, 175, 55, 0.4) 0%, transparent 70%); }
  .defeat .header-glow { background: radial-gradient(circle, rgba(201, 74, 74, 0.4) 0%, transparent 70%); }

  .icon-wrap {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .trophy { width: 44px; height: 44px; fill: #d4af37; filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.5)); }
  .defeat-icon { width: 44px; height: 44px; fill: #c94a4a; }

  h2 {
    font-size: 2.5rem;
    margin: 0 0 10px;
    color: #fff;
    letter-spacing: -0.02em;
  }

  .reason {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.7);
    max-width: 80%;
    margin: 0 auto;
    line-height: 1.4;
  }

  .modal-content {
    padding: 0 40px 40px;
  }

  .stats-grid {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-card {
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    padding: 24px;
    border-radius: 16px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .stat-card.player { border-top: 3px solid #5b9fd1; }
  .stat-card.rival { border-top: 3px solid #c94a4a; }

  .label {
    display: block;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 12px;
  }

  .main-val {
    font-size: 2.2rem;
    font-weight: 800;
    color: #fff;
    line-height: 1;
  }

  .sub-label {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .mini-metrics {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .m-item { display: flex; flex-direction: column; }
  .m-item small { font-size: 0.75rem; color: rgba(255, 255, 255, 0.3); }
  .m-item strong { font-size: 0.95rem; color: #fff; }

  .vs {
    flex: 0 0 auto;
    background: transparent;
    border: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .vs span {
    font-weight: 900;
    color: rgba(255, 255, 255, 0.2);
    font-size: 1.2rem;
  }

  .vs-line {
    width: 2px;
    height: 40px;
    background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.1), transparent);
  }

  .historical-note {
    background: rgba(0, 0, 0, 0.2);
    padding: 20px;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
    line-height: 1.6;
    font-size: 0.95rem;
  }

  .modal-footer {
    padding: 25px 40px;
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    justify-content: space-between;
    gap: 15px;
  }

  button {
    padding: 12px 28px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1rem;
    border: 1px solid transparent;
  }

  .btn-secondary {
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .btn-primary {
    background: #fff;
    color: #000;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 255, 255, 0.2);
  }

  .btn-primary.win {
    background: #d4af37;
    color: #000;
  }

  .btn-primary.win:hover {
    box-shadow: 0 5px 15px rgba(212, 175, 55, 0.3);
  }

  @media (max-width: 600px) {
    .stats-grid { flex-direction: column; }
    .vs { flex-direction: row; width: 100%; justify-content: center; }
    .vs-line { width: 40px; height: 2px; }
    .modal-footer { flex-direction: column; }
    button { width: 100%; }
  }
</style>
