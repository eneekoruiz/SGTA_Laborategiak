<script lang="ts">
  import * as apiService from '../services/apiService';
  import * as gameStore from '../store/game';

  export let activeOrdinances: string[] = [];
  export let gameId: string = 'game-001';

  // Ordinance definitions from SPECS.md
  const ordinances = [
    { id: 'sales_tax', name: 'Sales Tax', annualCost: -200, type: 'income' },
    { id: 'income_tax', name: 'Income Tax', annualCost: -200, type: 'income' },
    { id: 'legalized_gambling', name: 'Legalized Gambling', annualCost: -150, type: 'income' },
    { id: 'parking_fines', name: 'Parking Fines', annualCost: -50, type: 'income' },
    { id: 'tax_breaks', name: 'Tax Breaks', annualCost: 100, type: 'cost' },
    { id: 'free_clinics', name: 'Free Clinics', annualCost: 50, type: 'cost' },
    { id: 'junior_sports', name: 'Junior Sports', annualCost: 50, type: 'cost' },
    { id: 'pro_reading', name: 'Pro Reading', annualCost: 50, type: 'cost' },
    { id: 'anti_drug', name: 'Anti-Drug Campaign', annualCost: 50, type: 'cost' },
    { id: 'pollution_controls', name: 'Pollution Controls', annualCost: 50, type: 'cost' },
    { id: 'green_city', name: 'Green City', annualCost: 75, type: 'cost' },
    { id: 'digital_id', name: 'Digital ID', annualCost: 25, type: 'income' },
    { id: 'transit_subsidy', name: 'Transit Subsidy', annualCost: 60, type: 'cost' },
    { id: 'tourist_promotion', name: 'Tourist Promotion', annualCost: 100, type: 'cost' },
    { id: 'nuclear_free', name: 'Nuclear-Free Zone', annualCost: 0, type: 'cost' },
    { id: 'neighborhood_watch', name: 'Neighborhood Watch', annualCost: 25, type: 'cost' },
    { id: 'bike_lanes', name: 'Bike Lanes', annualCost: 40, type: 'cost' },
    { id: 'park_renewal', name: 'Park Renewal', annualCost: 40, type: 'cost' },
    { id: 'noise_control', name: 'Noise Control', annualCost: 35, type: 'cost' },
    { id: 'smoke_restrictions', name: 'Smoke Restrictions', annualCost: 45, type: 'cost' },
    { id: 'open_data', name: 'Open Data', annualCost: 20, type: 'income' },
    { id: 'water_conservation', name: 'Water Conservation', annualCost: 35, type: 'cost' },
    { id: 'recycling', name: 'Recycling', annualCost: 30, type: 'cost' },
    { id: 'low_emission_zone', name: 'Low Emission Zone', annualCost: 80, type: 'cost' },
    { id: 'farming_support', name: 'Farming Support', annualCost: 30, type: 'cost' },
    { id: 'high_tech_grants', name: 'High-Tech Grants', annualCost: 90, type: 'cost' },
    { id: 'historic_preservation', name: 'Historic Preservation', annualCost: 30, type: 'cost' },
    { id: 'public_wifi', name: 'Public Wi-Fi', annualCost: 35, type: 'cost' },
    { id: 'rent_control', name: 'Rent Control', annualCost: 60, type: 'cost' },
    { id: 'climate_action', name: 'Climate Action', annualCost: 85, type: 'cost' }
  ];

  const effectsMap: Record<string, string> = {
    sales_tax: 'C demand -5%',
    income_tax: 'R demand -5%',
    legalized_gambling: 'Crime +10%',
    parking_fines: 'Traffic -3%',
    tax_breaks: 'Taxes -10%',
    free_clinics: 'Health +5%',
    junior_sports: 'Crime -5%',
    pro_reading: 'Education +5%',
    anti_drug: 'Crime -5%',
    pollution_controls: 'Pollution -15%',
    green_city: 'Pollution -20%',
    digital_id: 'Admin efficiency +',
    transit_subsidy: 'Transit use +10%',
    tourist_promotion: 'C demand +10%',
    nuclear_free: 'No nuclear plants',
    neighborhood_watch: 'Crime -3%',
    bike_lanes: 'Traffic -5%',
    park_renewal: 'Land value +',
    noise_control: 'Happiness +',
    smoke_restrictions: 'Health +',
    open_data: 'Transparency +',
    water_conservation: 'Water use -10%',
    recycling: 'Pollution -8%',
    low_emission_zone: 'Traffic -8%',
    farming_support: 'Industrial pressure -',
    high_tech_grants: 'EQ +, tech industry +',
    historic_preservation: 'Tourism +',
    public_wifi: 'Commercial demand +',
    rent_control: 'Residential pressure -',
    climate_action: 'Pollution -25%'
  };

  let loading = false;
  let error = '';
  let hoveredOrdinance: string | null = null;

  function isActive(ordinanceId: string): boolean {
    return activeOrdinances.includes(ordinanceId);
  }

  async function toggleOrdinance(ordinanceId: string) {
    const currentlyActive = isActive(ordinanceId);
    const action = currentlyActive ? 'repeal' : 'enact';

    loading = true;
    error = '';

    try {
      const result = await apiService.toggleOrdinance(gameId, ordinanceId, action);
      if (result.success && result.game_state) {
        gameStore.setGameState(result.game_state);
      } else if (result.success) {
        const nextOrdinances = currentlyActive
          ? activeOrdinances.filter((id) => id !== ordinanceId)
          : [...activeOrdinances, ordinanceId];
        gameStore.updatePlayerCity({ ordinances: nextOrdinances as any });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to toggle ordinance';
    } finally {
      loading = false;
    }
  }
</script>

<div class="ordinance-panel">
  {#if error}
    <div class="alert error">{error}</div>
  {/if}

  <p class="instructions">Click to enact or repeal ordinances. Income ordinances (green) generate funds. Costs (red) reduce budget.</p>

  <div class="ordinances-table">
    <div class="table-header">
      <span>Ordinance</span>
      <span>Annual Impact</span>
      <span>Status</span>
    </div>

    {#each ordinances as ordinance (ordinance.id)}
      <div
        class="ordinance-row"
        class:income={ordinance.type === 'income'}
        class:cost={ordinance.type === 'cost'}
        class:active={isActive(ordinance.id)}
        on:mouseenter={() => (hoveredOrdinance = ordinance.id)}
        on:mouseleave={() => (hoveredOrdinance = null)}
        role="listitem"
      >
        <span class="name">{ordinance.name}</span>

        <span class="impact" class:negative={ordinance.annualCost > 0}>
          {ordinance.annualCost < 0 ? '+' : ''}§ {Math.abs(ordinance.annualCost).toLocaleString()}
        </span>

        <button
          class="toggle"
          on:click={() => toggleOrdinance(ordinance.id)}
          disabled={loading}
          title={effectsMap[ordinance.id] || 'No effects'}
          aria-label={`${isActive(ordinance.id) ? 'Repeal' : 'Enact'} ${
            ordinance.name
          }`}
        >
          {isActive(ordinance.id) ? 'ACTIVE' : 'OFF'}
        </button>

        {#if hoveredOrdinance === ordinance.id}
          <div class="tooltip" role="tooltip">{effectsMap[ordinance.id]}</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .ordinance-panel {
    display: grid;
    gap: 14px;
    padding: 16px;
    background: rgba(13, 24, 42, 0.6);
    border-radius: 12px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .instructions {
    font-size: 0.85rem;
    color: rgba(234, 240, 250, 0.7);
    margin: 0;
    padding: 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
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

  .ordinances-table {
    display: grid;
    gap: 1px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 1.5fr 1fr 0.8fr;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.08);
    border-bottom: 2px solid rgba(182, 154, 99, 0.4);
    font-weight: 600;
    font-size: 0.8rem;
    color: rgba(243, 248, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .ordinance-row {
    display: grid;
    grid-template-columns: 1.5fr 1fr 0.8fr;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(0, 0, 0, 0.2);
    transition: background-color 160ms;
    position: relative;
  }

  .ordinance-row:last-child {
    border-bottom: none;
  }

  .ordinance-row.active {
    background: rgba(182, 154, 99, 0.15);
  }

  .ordinance-row.income {
    border-left: 3px solid rgba(134, 239, 172, 0.6);
  }

  .ordinance-row.cost {
    border-left: 3px solid rgba(252, 165, 165, 0.6);
  }

  .ordinance-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .name {
    color: rgba(243, 248, 255, 0.95);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .impact {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: #86efac;
  }

  .impact.negative {
    color: #fca5a5;
  }

  .toggle {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: rgba(243, 248, 255, 0.85);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 160ms;
    white-space: nowrap;
  }

  .toggle:hover:not(:disabled) {
    background: rgba(182, 154, 99, 0.7);
    color: #0d182a;
    border-color: rgba(182, 154, 99, 0.9);
  }

  .toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ordinance-row.active .toggle {
    background: rgba(182, 154, 99, 0.8);
    color: #0d182a;
  }

  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: #f5f5f5;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    white-space: nowrap;
    z-index: 100;
    margin-bottom: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    pointer-events: none;
  }

  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }

  :global(--font-mono) {
    font-family: 'Courier New', monospace;
  }
</style>
