<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Budget, StatsResponse } from '../types/game';
  import * as apiService from '../services/apiService';
  import * as gameStore from '../store/game';

  export let budget: Budget | null = null;
  export let stats: StatsResponse | null = null;
  export let gameId: string = 'game-001';

  const taxLabels = {
    residential: 'Zerga erresidentziala',
    commercial: 'Zerga komertziala',
    industrial: 'Zerga industriala'
  };

  const fundingLabels = {
    transportation: 'Garraioa',
    police: 'Polizia',
    fire: 'Suhiltzaileak',
    health: 'Osasuna',
    education: 'Hezkuntza'
  };

  const statusCards = [
    { label: 'Hileko diru-sarrerak', value: () => Math.floor(budget?.monthly_income ?? 0), tone: 'positive', icon: '◌' },
    { label: 'Hileko gastuak', value: () => Math.floor(budget?.monthly_expenses ?? 0), tone: 'negative', icon: '◌' },
    { label: 'Egonkortasun zibikoa', value: () => Math.round(((stats?.player.approval ?? 0) + (stats?.player.eq ?? 0) + (stats?.player.hq ?? 0)) / 3), tone: 'neutral', icon: '◌' },
    { label: 'Altxorra', value: () => Math.floor(budget?.last_year_income ?? 0), tone: 'accent', icon: '◌' }
  ] as const;

  let loading = false;
  let error = '';
  let submitTimer: ReturnType<typeof setTimeout> | null = null;

  // Work with local copies to avoid multiple updates
  let localTaxRates = budget?.tax_rates || { residential: 7, commercial: 7, industrial: 7 };
  let localFunding = budget?.funding || {
    transportation: 100,
    police: 100,
    fire: 100,
    health: 100,
    education: 100
  };

  function scheduleSubmit() {
    if (submitTimer) {
      clearTimeout(submitTimer);
    }

    submitTimer = setTimeout(() => {
      void submitChanges();
    }, 280);
  }

  async function handleTaxChange(key: keyof typeof localTaxRates, value: number) {
    localTaxRates = {
      ...localTaxRates,
      [key]: value
    };
    scheduleSubmit();
  }

  async function handleFundingChange(key: keyof typeof localFunding, value: number) {
    localFunding = {
      ...localFunding,
      [key]: value
    };
    scheduleSubmit();
  }

  async function submitChanges() {
    if (!budget) return;
    loading = true;
    error = '';

    try {
      const result = await apiService.updateBudget(
        gameId,
        localTaxRates,
        localFunding
      );

      if (result.success && result.game_state) {
        gameStore.setGameState(result.game_state);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Aurrekontua eguneratzeak huts egin du';
    } finally {
      loading = false;
    }
  }

  async function requestBond() {
    const amount = 5000;
    loading = true;
    error = '';

    try {
      const result = await apiService.issueBond(gameId, amount);
      if (result.success && result.game_state) {
        gameStore.setGameState(result.game_state);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Bonua eskatzeak huts egin du';
    } finally {
      loading = false;
    }
  }

  $: if (budget) {
    localTaxRates = { ...budget.tax_rates };
    localFunding = { ...budget.funding };
  }

  onDestroy(() => {
    if (submitTimer) {
      clearTimeout(submitTimer);
      submitTimer = null;
    }
  });

  const monthlyBalance = budget ? budget.monthly_income - budget.monthly_expenses : 0;
  const isNegative = monthlyBalance < 0;
  const yearlyBalance = budget ? budget.last_year_income - budget.last_year_expenses : 0;
  const yearlyNegative = yearlyBalance < 0;
  const cityHealthScore = Math.max(0, Math.min(100, Math.round(((stats?.player.approval ?? 0) + (stats?.player.eq ?? 0) + (stats?.player.hq ?? 0)) / 3)));
  const healthRing = `conic-gradient(#6fae8b ${cityHealthScore}%, rgba(16, 24, 40, 0.08) 0)`;
</script>

<div class="budget-panel">
  {#if error}
    <div class="alert error">{error}</div>
  {/if}

  <section class="status-grid" aria-label="Aurrekontu-egoeraren txartelak">
    {#each statusCards as card}
      <article class={`status-card ${card.tone}`}>
        <div class="status-card__icon">{card.icon}</div>
        <div>
          <p>{card.label}</p>
          <strong>§ {card.value().toLocaleString()}</strong>
        </div>
      </article>
    {/each}
    <article class="status-card health">
      <div class="ring" style={`--ring:${healthRing}`}>
        <span>{cityHealthScore}%</span>
      </div>
      <div>
        <p>Hiriaren osasuna</p>
        <strong>{cityHealthScore >= 80 ? 'Egonkorra' : cityHealthScore >= 50 ? 'Adi' : 'Kritikoa'}</strong>
      </div>
    </article>
  </section>

  <section class="tax-section">
    <h3>Zerga-tasak</h3>
    {#each Object.entries(taxLabels) as [key, label]}
      <div class="slider-row">
        <label for={`tax-${key}`}>{label}</label>
        <input
          id={`tax-${key}`}
          type="range"
          min="0"
          max="20"
          value={localTaxRates[key as keyof typeof localTaxRates] || 0}
          on:input={(e) =>
            handleTaxChange(
              key as keyof typeof localTaxRates,
              Number(e.currentTarget.value)
            )}
          disabled={loading}
        />
        <span class="value">
          {(localTaxRates[key as keyof typeof localTaxRates] || 0).toFixed(1)}%
        </span>
      </div>
    {/each}
  </section>

  <section class="funding-section">
    <h3>Finantzaketa-esleipenak</h3>
    {#each Object.entries(fundingLabels) as [key, label]}
      <div class="slider-row">
        <label for={`funding-${key}`}>{label}</label>
        <input
          id={`funding-${key}`}
          type="range"
          min="0"
          max="120"
          value={localFunding[key as keyof typeof localFunding] || 100}
          on:input={(e) =>
            handleFundingChange(
              key as keyof typeof localFunding,
              Number(e.currentTarget.value)
            )}
          disabled={loading}
        />
        <span class="value">
          {(localFunding[key as keyof typeof localFunding] || 100).toFixed(0)}%
        </span>
      </div>
    {/each}
  </section>

  <section class="bonds-section">
    <div class="section-head">
      <h3>Bonuak</h3>
      <button class="request-bond" on:click={requestBond} disabled={loading}>
        {loading ? 'Prozesatzen...' : 'Eskatu bonua'}
      </button>
    </div>
    {#if budget && budget.bonds.length > 0}
      <div class="bonds-list">
        {#each budget.bonds as bond}
          <div class="bond-item">
            <span>§ {bond.amount.toLocaleString()}</span>
            <span>{bond.months_remaining} hilabete geratzen dira</span>
            <span class="payment">§ {bond.monthly_payment.toFixed(0)}/mo</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">Ez dago bonu aktiborik.</p>
    {/if}
  </section>
</div>

<style>
  .budget-panel {
    display: grid;
    gap: 18px;
    padding: 18px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(245, 248, 252, 0.96));
    border-radius: 20px;
    border: 1px solid rgba(31, 41, 55, 0.08);
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 22px 50px rgba(15, 23, 42, 0.14);
  }

  .alert {
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .alert.error {
    background: rgba(239, 68, 68, 0.12);
    color: #b91c1c;
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .status-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(15, 23, 42, 0.08);
  }

  .status-card__icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: rgba(96, 165, 250, 0.12);
    color: #1d4ed8;
    font-size: 1.2rem;
  }

  .status-card p,
  .status-card strong {
    margin: 0;
  }

  .status-card strong {
    font-size: 1.15rem;
  }

  .status-card.positive .status-card__icon {
    background: rgba(16, 185, 129, 0.12);
    color: #047857;
  }

  .status-card.negative .status-card__icon {
    background: rgba(239, 68, 68, 0.12);
    color: #b91c1c;
  }

  .status-card.accent .status-card__icon {
    background: rgba(245, 158, 11, 0.12);
    color: #b45309;
  }

  .status-card.health {
    justify-content: flex-start;
  }

  .ring {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--ring);
    position: relative;
  }

  .ring::after {
    content: '';
    position: absolute;
    inset: 10px;
    border-radius: 50%;
    background: white;
  }

  .ring span {
    position: relative;
    z-index: 1;
    font-family: var(--font-mono, 'Courier New', monospace);
    font-weight: 700;
  }

  section {
    display: grid;
    gap: 10px;
  }

  h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 700;
    color: #334155;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .slider-row {
    display: grid;
    grid-template-columns: 1fr 2fr 0.5fr;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.03);
  }

  label {
    font-size: 0.85rem;
    color: #475569;
  }

  input[type='range'] {
    width: 100%;
    cursor: pointer;
    accent-color: #b69a63;
  }

  input[type='range']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .value {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: #0f766e;
    justify-self: end;
    min-width: 40px;
    text-align: right;
  }

  .bonds-section {
    border-top: 1px solid rgba(15, 23, 42, 0.08);
    padding-top: 12px;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .bonds-list {
    display: grid;
    gap: 8px;
  }

  .bond-item {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 12px;
    align-items: center;
    padding: 8px;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 6px;
    font-size: 0.85rem;
    color: #334155;
  }

  .bond-item .payment {
    justify-self: end;
    font-family: var(--font-mono);
    color: #b91c1c;
  }

  .empty {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0;
    padding: 6px;
  }

  .request-bond {
    cursor: pointer;
    padding: 10px 14px;
    background: linear-gradient(135deg, #111827, #334155);
    color: white;
    border: 0;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.9rem;
    transition: background-color 160ms, opacity 160ms;
  }

  .request-bond:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .request-bond:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(--font-mono) {
    font-family: 'Courier New', monospace;
  }
</style>
