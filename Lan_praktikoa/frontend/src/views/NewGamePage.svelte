<script lang="ts">
  import { onMount } from 'svelte';
  import { createGame, getScenarios } from '../services/apiService';
  import { navigate } from '../services/router';

  interface ScenarioSummary {
    id: string;
    name: string;
    description: string;
    difficulty_options: string[];
    map_size: { width: number; height: number };
  }

  let scenarios: ScenarioSummary[] = [];
  let loading = true;
  let creating = false;
  let error = '';

  let name = 'New City';
  let scenarioId = '';
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  let aiPersonality: 'expansionist' | 'ecologist' | 'industrialist' | 'balanced' | 'tax_collector' = 'balanced';
  let disastersEnabled = true;
  let selectedScenario: ScenarioSummary | undefined;

  async function loadScenarios(): Promise<void> {
    loading = true;
    error = '';

    try {
      const result = await getScenarios();
      scenarios = result.scenarios ?? [];
      scenarioId = scenarios[0]?.id ?? '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load scenarios';
    } finally {
      loading = false;
    }
  }

  async function submitNewGame(): Promise<void> {
    if (!scenarioId) {
      error = 'Select a scenario first.';
      return;
    }

    creating = true;
    error = '';

    try {
      const result = await createGame({
        name: name.trim() || 'New City',
        scenario_id: scenarioId,
        difficulty,
        player_city_name: name.trim() || 'New City',
        ai_personality: aiPersonality,
        disasters_enabled: disastersEnabled
      });

      const gameId = result.game_id || result.game_state?._id;
      if (gameId) {
        navigate(`/game/${gameId}`, true);
      } else {
        navigate('/games', true);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create game';
    } finally {
      creating = false;
    }
  }

  $: selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId);

  onMount(loadScenarios);
</script>

<svelte:head>
  <title>SimHiri - New Game</title>
</svelte:head>

<section class="page">
  <header class="hero">
    <div>
      <p class="eyebrow">New campaign</p>
      <h1>Start a new city</h1>
      <p class="lede">Choose a scenario, difficulty, and AI personality before launching a fresh save.</p>
    </div>
    <div class="hero-actions">
      <button class="secondary" on:click={() => navigate('/games')}>Back to saves</button>
      <button class="secondary" on:click={() => navigate('/')}>Landing</button>
    </div>
  </header>

  {#if error}
    <div class="alert">{error}</div>
  {/if}

  {#if loading}
    <div class="empty-state">Loading scenarios...</div>
  {:else}
    <div class="layout">
      <form class="form card" on:submit|preventDefault={submitNewGame}>
        <label>
          <span>City name</span>
          <input bind:value={name} maxlength="48" required />
        </label>

        <label>
          <span>Scenario</span>
          <select bind:value={scenarioId} required>
            {#each scenarios as scenario}
              <option value={scenario.id}>{scenario.name} ({scenario.map_size.width}x{scenario.map_size.height})</option>
            {/each}
          </select>
        </label>

        <label>
          <span>Difficulty</span>
          <div class="segmented">
            {#each ['easy', 'medium', 'hard'] as level}
              <button
                type="button"
                class:active={difficulty === level}
                on:click={() => (difficulty = level as 'easy' | 'medium' | 'hard')}
              >
                {level}
              </button>
            {/each}
          </div>
        </label>

        <label>
          <span>AI personality</span>
          <select bind:value={aiPersonality}>
            <option value="expansionist">Expansionist</option>
            <option value="ecologist">Ecologist</option>
            <option value="industrialist">Industrialist</option>
            <option value="balanced">Balanced</option>
            <option value="tax_collector">Tax collector</option>
          </select>
        </label>

        <label class="toggle-row">
          <input type="checkbox" bind:checked={disastersEnabled} />
          <span>Enable disasters</span>
        </label>

        <button class="primary" type="submit" disabled={creating}>
          {creating ? 'Creating...' : 'Jokoa Hasi'}
        </button>
      </form>

      <aside class="card">
        <h2>Scenario preview</h2>
        {#if selectedScenario}
          <p>{selectedScenario.description}</p>
          <dl>
            <div>
              <dt>Map size</dt>
              <dd>{selectedScenario.map_size.width} x {selectedScenario.map_size.height}</dd>
            </div>
            <div>
              <dt>Difficulty options</dt>
              <dd>{selectedScenario.difficulty_options.join(', ')}</dd>
            </div>
          </dl>
        {/if}
      </aside>
    </div>
  {/if}
</section>

<style>
  .page {
    min-height: 100vh;
    padding: 28px;
    background:
      radial-gradient(circle at top left, rgba(168, 213, 186, 0.18), transparent 28%),
      linear-gradient(160deg, #0f1b2f 0%, #13233c 52%, #1d3559 100%);
    color: #f4f8ff;
  }

  .hero {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: end;
    margin-bottom: 22px;
  }

  .eyebrow {
    margin: 0 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
    color: rgba(233, 241, 252, 0.65);
  }

  h1 {
    margin: 0;
    font-size: clamp(2.2rem, 4vw, 3.8rem);
    line-height: 1;
  }

  .lede {
    margin: 10px 0 0;
    color: rgba(233, 241, 252, 0.78);
    max-width: 60ch;
  }

  .hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(260px, 420px);
    gap: 16px;
    align-items: start;
  }

  .card,
  .empty-state,
  .alert {
    border-radius: 22px;
    background: rgba(9, 19, 34, 0.64);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(18px);
    box-shadow: 0 24px 52px rgba(0, 0, 0, 0.22);
  }

  .card {
    padding: 18px;
    display: grid;
    gap: 14px;
  }

  .form {
    display: grid;
    gap: 14px;
  }

  label {
    display: grid;
    gap: 8px;
    color: rgba(233, 241, 252, 0.88);
  }

  input:not([type]),
  select {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.06);
    color: #f4f8ff;
    padding: 13px 14px;
    font: inherit;
  }

  .segmented {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .segmented button,
  .primary,
  .secondary {
    border: 0;
    border-radius: 999px;
    padding: 10px 16px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .segmented button {
    background: rgba(255, 255, 255, 0.08);
    color: #f4f8ff;
  }

  .segmented button.active {
    background: linear-gradient(135deg, #a8d5ba, #87ceeb);
    color: #0f1b2f;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .primary {
    background: linear-gradient(135deg, #a8d5ba, #87ceeb);
    color: #0f1b2f;
  }

  .secondary {
    background: rgba(255, 255, 255, 0.08);
    color: #f4f8ff;
  }

  .empty-state,
  .alert {
    padding: 18px;
    margin-bottom: 16px;
  }

  .alert {
    background: rgba(252, 165, 165, 0.16);
    border-color: rgba(252, 165, 165, 0.35);
    color: #ffd5d5;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  dl div {
    padding: 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
  }

  dt {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: 6px;
    color: rgba(233, 241, 252, 0.68);
  }

  dd {
    margin: 0;
    font-weight: 700;
  }

  @media (max-width: 980px) {
    .hero,
    .layout {
      grid-template-columns: 1fr;
      display: grid;
    }
  }
</style>
