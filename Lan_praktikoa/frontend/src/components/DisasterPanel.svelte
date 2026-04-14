<script lang="ts">
  import * as apiService from '../services/apiService';
  import * as gameStore from '../store/game';
  import type { GameState } from '../types/game';

  export let gameState: GameState | null = null;
  export let gameId: string = 'game-001';

  const disasters = [
    { id: 'fire', name: 'Sua', cost: 5000 },
    { id: 'flood', name: 'Uholde', cost: 10000 },
    { id: 'tornado', name: 'Ehorzabal', cost: 20000 },
    { id: 'earthquake', name: 'Lurrikara', cost: 50000 }
  ];

  let selectedDisaster = 'fire';
  let selectedTarget: 'player' | 'ai' = 'ai';
  let loading = false;
  let error = '';
  let lastReport: {
    target: 'player' | 'ai';
    type: string;
    buildings: number;
    zones: number;
    infrastructure: number;
    repairCost: number;
  } | null = null;
  let confirmOpen = false;
  let monthsSinceAttack = 999;
  let cooldownPercent = 100;

  $: selectedDisasterCost =
    disasters.find((d) => d.id === selectedDisaster)?.cost || 0;
  $: selectedDisasterName =
    disasters.find((d) => d.id === selectedDisaster)?.name || selectedDisaster;

  function getMonthsSinceLastAttack(): number {
    if (!gameState) return 999;
    const lastAttack = gameState.disaster_attacks.last_player_attack_date;
    if (!lastAttack) return 999;

    const lastDate = new Date(lastAttack.year, lastAttack.month - 1);
    const currentDate = new Date(gameState.current_date.year, gameState.current_date.month - 1);
    const monthDiff =
      (currentDate.getFullYear() - lastDate.getFullYear()) * 12 +
      (currentDate.getMonth() - lastDate.getMonth());

    return monthDiff;
  }

  function canAttack(): boolean {
    const monthsSince = getMonthsSinceLastAttack();
    return monthsSince >= 6;
  }

  async function launchAttack() {
    loading = true;
    error = '';
    confirmOpen = false;

    try {
      const result = await apiService.attackRival(
        gameId,
        selectedDisaster,
        selectedTarget
      );

      if (result.success && result.game_state) {
        gameStore.setGameState(result.game_state);
        if (result.damage_report) {
          lastReport = {
            target: selectedTarget,
            type: selectedDisaster,
            buildings: Number(result.damage_report.buildings_damaged ?? 0),
            zones: Number(result.damage_report.zones_damaged ?? 0),
            infrastructure: Number(result.damage_report.infrastructure_damaged ?? 0),
            repairCost: Number(result.damage_report.estimated_repair_cost ?? 0)
          };
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erasoa abiaraztean errorea gertatu da';
    } finally {
      loading = false;
    }
  }

  $: monthsSinceAttack = getMonthsSinceLastAttack();
  $: cooldownPercent = Math.max(0, Math.min(100, (monthsSinceAttack / 6) * 100));
</script>

<div class="disaster-panel">
  {#if error}
    <div class="alert error">{error}</div>
  {/if}

  <section class="disaster-selection">
    <h3>Hondamendia aukeratu</h3>
    <div class="disaster-buttons">
      {#each disasters as disaster (disaster.id)}
        <button
          class="disaster-btn"
          class:active={selectedDisaster === disaster.id}
          on:click={() => (selectedDisaster = disaster.id)}
          disabled={loading}
        >
          <span class="name">{disaster.name}</span>
          <span class="cost mono">§ {disaster.cost.toLocaleString()}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="target-select">
    <h3>Helburua</h3>
    <div class="target-buttons">
      <button
        class="target-btn"
        class:active={selectedTarget === 'ai'}
        on:click={() => (selectedTarget = 'ai')}
        disabled={loading}
      >
        {gameState?.ai_city.name || 'Hiri aurkaria'}
      </button>
      <button
        class="target-btn"
        class:active={selectedTarget === 'player'}
        on:click={() => (selectedTarget = 'player')}
        disabled={loading}
        title="Norberari kaltea eragin"
      >
        Norbera (ez gomendatua)
      </button>
    </div>
  </section>

  <section class="cooldown-section">
    <h3>Erasoaren hozte-denbora</h3>
    <div class="cooldown-info">
      <p class="months">
        {#if monthsSinceAttack >= 6}
          <span class="ready">✓ Erasorako prest!</span>
        {:else}
          <span class="waiting">{6 - monthsSinceAttack} hilabete falta dira</span>
        {/if}
      </p>
      <div class="cooldown-bar">
        <div class="cooldown-fill" style="width: {cooldownPercent}%"></div>
      </div>
    </div>
  </section>

  <section class="attack-confirm">
    {#if !confirmOpen}
      <button
        class="attack-btn"
        on:click={() => (confirmOpen = true)}
        disabled={loading || !canAttack()}
      >
        {loading ? 'Abiarazten...' : 'Erasoa abiatu'}
      </button>
    {:else}
      <div class="confirm-box">
        <p class="warning">
          ⚠ Berretsi erasoa <strong>{selectedTarget === 'ai' ? gameState?.ai_city.name : 'zure hiria'}</strong> helburura,
          <strong>{selectedDisasterName}</strong> erabiliz, <strong class="cost">§ {selectedDisasterCost.toLocaleString()}</strong> kostuarekin?
        </p>
        <div class="confirm-buttons">
          <button
            class="confirm-yes"
            on:click={launchAttack}
            disabled={loading}
          >
            Bai, erasotu!
          </button>
          <button
            class="confirm-no"
            on:click={() => (confirmOpen = false)}
            disabled={loading}
          >
            Utzi
          </button>
        </div>
      </div>
    {/if}
  </section>

  {#if lastReport}
    <section class="damage-report">
      <h3>Azken kalte txostena</h3>
      <p>
        {lastReport.type.toUpperCase()} {lastReport.target === 'ai' ? (gameState?.ai_city.name || 'hiri aurkaria') : 'zure hiria'} hirian:
        eraikinak {lastReport.buildings}, zonak {lastReport.zones}, azpiegiturak {lastReport.infrastructure},
        konponketen estimazioa § {lastReport.repairCost.toLocaleString()}.
      </p>
    </section>
  {/if}
</div>

<style>
  .disaster-panel {
    display: grid;
    gap: 16px;
    padding: 16px;
    background: rgba(13, 24, 42, 0.6);
    border-radius: 12px;
  }

  .alert {
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .alert.error {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.5);
  }

  section {
    display: grid;
    gap: 10px;
  }

  h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(243, 248, 255, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .disaster-buttons,
  .target-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .disaster-btn,
  .target-btn {
    display: grid;
    grid-template-rows: auto auto;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(243, 248, 255, 0.9);
    cursor: pointer;
    transition: all 160ms;
    text-align: left;
  }

  .disaster-btn:hover,
  .target-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .disaster-btn.active,
  .target-btn.active {
    background: rgba(182, 154, 99, 0.8);
    color: #0d182a;
    border-color: rgba(182, 154, 99, 0.9);
  }

  .disaster-btn:disabled,
  .target-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .name {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .cost {
    font-size: 0.8rem;
    color: #fca5a5;
  }

  .disaster-btn.active .cost {
    color: #0d182a;
  }

  .cooldown-info {
    display: grid;
    gap: 8px;
  }

  .months {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(234, 240, 250, 0.9);
  }

  .ready {
    color: #86efac;
    font-weight: 600;
  }

  .waiting {
    color: #fca5a5;
  }

  .cooldown-bar {
    width: 100%;
    height: 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cooldown-fill {
    height: 100%;
    background: linear-gradient(90deg, #fca5a5, #86efac);
    transition: width 200ms;
  }

  .attack-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(252, 165, 165, 0.6));
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 8px;
    color: #fff;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 160ms;
  }

  .attack-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(252, 165, 165, 0.8));
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
  }

  .attack-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .confirm-box {
    background: rgba(239, 68, 68, 0.15);
    border: 2px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    padding: 14px;
    display: grid;
    gap: 12px;
  }

  .warning {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(243, 248, 255, 0.95);
  }

  .cost {
    color: #ef4444;
  }

  .confirm-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .confirm-yes,
  .confirm-no {
    padding: 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 160ms;
  }

  .confirm-yes {
    background: rgba(239, 68, 68, 0.8);
    color: #fff;
  }

  .confirm-yes:hover:not(:disabled) {
    background: rgba(239, 68, 68, 1);
  }

  .confirm-no {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(243, 248, 255, 0.9);
  }

  .confirm-no:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .confirm-yes:disabled,
  .confirm-no:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mono {
    font-family: var(--font-mono);
  }

  :global(--font-mono) {
    font-family: 'Courier New', monospace;
  }
</style>
