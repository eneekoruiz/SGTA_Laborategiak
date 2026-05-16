<script lang="ts">
  import { onMount } from 'svelte';
  import { deleteGame, listGames, clearAuthToken } from '../services/apiService';
  import { navigate } from '../services/router';

  let games: any[] = [];
  let loading = true;
  let error = '';
  let deletingId = '';

  async function loadGames(): Promise<void> {
    loading = true;
    error = '';

    try {
      const result = await listGames();
      // API returns {success, message, data: [...games]} or {success, message, data: {games: [...]}}
      games = Array.isArray(result) ? result : (result.games ?? result.data?.games ?? result.data ?? []);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Partidak kargatzeak huts egin du';
    } finally {
      loading = false;
    }
  }

  async function removeGame(gameId: string): Promise<void> {
    if (!window.confirm('Partida hau ezabatu?')) {
      return;
    }

    deletingId = gameId;
    error = '';

    try {
      await deleteGame(gameId);
      await loadGames();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Partida ezabatzeak huts egin du';
    } finally {
      deletingId = '';
    }
  }

  function formatDate(date: { year: number; month: number }): string {
    const monthName = new Intl.DateTimeFormat('en', { month: 'short' }).format(
      new Date(date.year, date.month - 1, 1)
    );
    return `${monthName} ${date.year}`;
  }

  function handleLogout(): void {
    clearAuthToken();
    navigate('/login', true);
  }

  onMount(loadGames);
</script>

<svelte:head>
  <title>SimHiri - Partida-zerrenda</title>
</svelte:head>

<section class="page">
  <header class="hero">
    <div>
      <p class="eyebrow">Gordetako hiriak</p>
      <h1>Zure partida-zerrenda</h1>
      <p class="lede">Berriro hartu hiri bat, hasi eszenatoki berri bat edo kendu gordetze zaharrak.</p>
    </div>

    <div class="hero-actions">
      <button class="primary" on:click={() => navigate('/games/new')}>Partida Berria</button>
      <button class="secondary" on:click={() => navigate('/')}>Hasiera</button>
      <button class="secondary" on:click={loadGames}>Berritu</button>
      <button class="logout" on:click={handleLogout}>Saioa itxi</button>
    </div>
  </header>

  {#if error}
    <div class="alert">{error}</div>
  {/if}

  {#if loading}
    <div class="empty-state">Gordetzeak kargatzen...</div>
  {:else if games.length === 0}
    <div class="empty-state">Oraindik ez dago gordetako partidarik. Hasi berri bat.</div>
  {:else}
    <div class="grid">
      {#each games as game}
        <article class="card">
          <div class="card-top">
            <div>
              <h2>{game.name || game.player_city_name}</h2>
              <p>{game.player_city_name || 'Hiria'} vs {game.ai_city_name || 'AA'}</p>
            </div>
            <span class="badge">{game.victory_status || 'Abian'}</span>
          </div>

          <dl>
            <div>
              <dt>Data</dt>
              <dd>{formatDate(game.current_date || {year: 1900, month: 1})}</dd>
            </div>
            <div>
              <dt>Biztanleria</dt>
              <dd>{(game.player_population || game.player_city?.population || 0).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Azken gordetzea</dt>
              <dd>{new Date(game.last_saved || Date.now()).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Gordetze automatikoa</dt>
              <dd>{game.is_autosave ? 'Bai' : 'Ez'}</dd>
            </div>
          </dl>

          <div class="actions">
            <button class="primary" on:click={() => navigate(`/game/${game.id || game.game_id}`)}>Kargatu</button>
            <button class="secondary" on:click={() => removeGame(game.id || game.game_id)} disabled={deletingId === (game.id || game.game_id)}>
              {deletingId === (game.id || game.game_id) ? 'Ezabatzen...' : 'Ezabatu'}
            </button>
          </div>
        </article>
      {/each}
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

  .hero-actions,
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
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

  .card-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .card p,
  dt,
  dd {
    margin: 0;
    color: rgba(233, 241, 252, 0.75);
  }

  .badge {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(168, 213, 186, 0.14);
    color: #d9f0e1;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  dl div {
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
  }

  dt {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: 6px;
  }

  dd {
    font-weight: 600;
    color: #fff;
  }

  button {
    border: 0;
    border-radius: 999px;
    padding: 10px 16px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .primary {
    background: linear-gradient(135deg, #a8d5ba, #87ceeb);
    color: #0f1b2f;
  }

  .secondary {
    background: rgba(255, 255, 255, 0.08);
    color: #f4f8ff;
  }

  .logout {
    background: rgba(252, 165, 165, 0.16);
    color: #ffd5d5;
    border: 1px solid rgba(252, 165, 165, 0.35);
  }

  .empty-state,
  .alert {
    padding: 18px;
  }

  .alert {
    margin-bottom: 16px;
    background: rgba(252, 165, 165, 0.16);
    border-color: rgba(252, 165, 165, 0.35);
    color: #ffd5d5;
  }

  @media (max-width: 900px) {
    .hero {
      flex-direction: column;
      align-items: start;
    }

    dl {
      grid-template-columns: 1fr;
    }
  }
</style>
