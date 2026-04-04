<script lang="ts">
  import type { Budget, StatsResponse } from '../types/game';
  import * as apiService from '../services/apiService';
  import * as gameStore from '../store/game';

  export let budget: Budget | null = null;
  export let gameId: string = 'game-001';

  const taxLabels = {
    residential: 'Residential Tax',
    commercial: 'Commercial Tax',
    industrial: 'Industrial Tax'
  };

  const fundingLabels = {
    transportation: 'Transportation',
    police: 'Police',
    fire: 'Fire Services',
    health: 'Health',
    education: 'Education'
  };

  let loading = false;
  let error = '';

  // Work with local copies to avoid multiple updates
  let localTaxRates = budget?.tax_rates || { residential: 7, commercial: 7, industrial: 7 };
  let localFunding = budget?.funding || {
    transportation: 100,
    police: 100,
    fire: 100,
    health: 100,
    education: 100
  };

  async function handleTaxChange(key: keyof typeof localTaxRates, value: number) {
    localTaxRates[key] = value;
    await submitChanges();
  }

  async function handleFundingChange(key: keyof typeof localFunding, value: number) {
    localFunding[key] = value;
    await submitChanges();
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
      error = err instanceof Error ? err.message : 'Failed to update budget';
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
      error = err instanceof Error ? err.message : 'Failed to issue bond';
    } finally {
      loading = false;
    }
  }

  $: if (budget) {
    localTaxRates = budget.tax_rates;
    localFunding = budget.funding;
  }

  const monthlyBalance = budget
    ? budget.monthly_income - budget.monthly_expenses
    : 0;
  const isNegative = monthlyBalance < 0;
</script>

<div class="budget-panel">
  {#if error}
    <div class="alert error">{error}</div>
  {/if}

  <section class="balance-summary">
    <div class="balance-row">
      <span>Monthly Income</span>
      <span class="mono income">§ {budget?.monthly_income.toLocaleString() || 0}</span>
    </div>
    <div class="balance-row">
      <span>Monthly Expenses</span>
      <span class="mono expense">§ {budget?.monthly_expenses.toLocaleString() || 0}</span>
    </div>
    <div class="balance-row total" class:negative={isNegative}>
      <span>Monthly Balance</span>
      <span class="mono" class:negative={isNegative}>
        § {monthlyBalance.toLocaleString()}
      </span>
    </div>
  </section>

  <section class="tax-section">
    <h3>Tax Rates (%)</h3>
    {#each Object.entries(taxLabels) as [key, label]}
      <div class="slider-row">
        <label>{label}</label>
        <input
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
    <h3>Funding Allocations (%)</h3>
    {#each Object.entries(fundingLabels) as [key, label]}
      <div class="slider-row">
        <label>{label}</label>
        <input
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
    <h3>Bonds</h3>
    {#if budget && budget.bonds.length > 0}
      <div class="bonds-list">
        {#each budget.bonds as bond}
          <div class="bond-item">
            <span>§ {bond.amount.toLocaleString()}</span>
            <span>{bond.months_remaining} months remaining</span>
            <span class="payment">§ {bond.monthly_payment.toFixed(0)}/mo</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">No active bonds.</p>
    {/if}

    <button
      class="request-bond"
      on:click={requestBond}
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Request Bond (§5000)'}
    </button>
  </section>
</div>

<style>
  .budget-panel {
    display: grid;
    gap: 18px;
    padding: 16px;
    background: rgba(13, 24, 42, 0.6);
    border-radius: 12px;
    max-height: 80vh;
    overflow-y: auto;
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

  .balance-summary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px;
    font-size: 0.95rem;
  }

  .balance-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    color: rgba(234, 240, 250, 0.9);
  }

  .balance-row.total {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 8px;
    margin-top: 4px;
    font-weight: 600;
  }

  .balance-row.total.negative {
    color: #ef4444;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: #d4e0f0;
  }

  .mono.negative {
    color: #ef4444;
  }

  .mono.income {
    color: #86efac;
  }

  .mono.expense {
    color: #fca5a5;
  }

  section {
    display: grid;
    gap: 10px;
  }

  h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(243, 248, 255, 0.95);
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
    background: rgba(255, 255, 255, 0.02);
  }

  label {
    font-size: 0.85rem;
    color: rgba(234, 240, 250, 0.85);
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
    color: #b69a63;
    justify-self: end;
    min-width: 40px;
    text-align: right;
  }

  .bonds-section {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 12px;
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
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    font-size: 0.85rem;
    color: rgba(234, 240, 250, 0.8);
  }

  .bond-item .payment {
    justify-self: end;
    font-family: var(--font-mono);
    color: #fca5a5;
  }

  .empty {
    font-size: 0.85rem;
    color: rgba(234, 240, 250, 0.6);
    margin: 0;
    padding: 6px;
  }

  .request-bond {
    cursor: pointer;
    padding: 10px 14px;
    background: rgba(182, 154, 99, 0.8);
    color: #0d182a;
    border: 0;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    transition: background-color 160ms, opacity 160ms;
  }

  .request-bond:hover:not(:disabled) {
    background: rgba(182, 154, 99, 1);
  }

  .request-bond:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(--font-mono) {
    font-family: 'Courier New', monospace;
  }
</style>
