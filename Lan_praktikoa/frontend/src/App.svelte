<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import IsometricMap from './components/IsometricMap.svelte';
  import GameHUD from './components/GameHUD.svelte';
  import EducationHealthPanel from './components/EducationHealthPanel.svelte';
  import FloatingModal from './components/FloatingModal.svelte';
  import SlidingDrawer from './components/SlidingDrawer.svelte';
  import * as apiService from './services/apiService';
  import { recomputeAllRoads } from './services/autoTiling';
  import * as gameStore from './store/game';
  import * as uiStore from './store/ui';
  import type {
    EducationResponse,
    GameState,
    HealthResponse,
    InfrastructureType,
    StatsResponse,
    Tile,
    ZoneType
  } from './types/game';

  // Subscribe to stores directly (Svelte will auto-unsubscribe on unmount)
  let gameState = gameStore.gameState;
  let stats = gameStore.stats;
  let education = gameStore.education;
  let health = gameStore.health;

  let selectedZone = uiStore.selectedZone;
  let selectedInfra = uiStore.selectedInfra;
  let activeModal = uiStore.activeModal;
  let educationDrawerOpen = uiStore.educationDrawerOpen;
  let cheatConsoleOpen = uiStore.cheatConsoleOpen;
  let undergroundMode = uiStore.undergroundMode;
  let gameSpeed = uiStore.gameSpeed;
  let fundingPct = uiStore.fundingPct;

  const gameId = 'game-001';

  // ===== Local UI state =====
  let series: { eq: number[]; hq: number[]; labels: string[] } = { eq: [], hq: [], labels: [] };
  const speedIntervals = {
    normal: 2200,
    fast: 1200,
    instant: 550
  } as const;
  let cheatInput = '';
  let liveTiles: Tile[][] = [];
  let loading = true;
  let error = '';
  let mounted = false;
  let tickTimer: number | null = null;
  let rafId: number | null = null;

  const zoneTools: Array<{ label: string; value: ZoneType }> = [
    { label: 'R Light', value: 'residential_light' },
    { label: 'R Dense', value: 'residential_dense' },
    { label: 'C Light', value: 'commercial_light' },
    { label: 'C Dense', value: 'commercial_dense' },
    { label: 'I Light', value: 'industrial_light' },
    { label: 'I Dense', value: 'industrial_dense' }
  ];

  const infraTools: Array<{ label: string; value: InfrastructureType }> = [
    { label: 'Roads', value: 'road' },
    { label: 'Power', value: 'power_line' },
    { label: 'Water', value: 'water_pipe' }
  ];

  function createSeries(current: number, trend: number): number[] {
    const points = 12;
    const start = current - trend;
    const data: number[] = [];
    for (let i = 0; i < points; i += 1) {
      const t = i / (points - 1);
      const eased = 1 - Math.pow(1 - t, 2.2);
      const wave = Math.sin(i * 0.8) * Math.max(0.4, Math.abs(trend) * 0.08);
      const value = Math.round((start + (current - start) * eased + wave) * 10) / 10;
      data.push(value);
    }
    data[points - 1] = current;
    return data;
  }

  function monthLabels(points: number): string[] {
    return Array.from({ length: points }, (_, idx) => {
      const offset = points - idx - 1;
      return offset === 0 ? 'Now' : `-${offset}`;
    });
  }

  function handleMenu(panel: string): void {
    if (panel === 'edu-health') {
      uiStore.toggleEducationDrawer();
      return;
    }

    if (panel === 'budget' || panel === 'ordinance' || panel === 'rival' || panel === 'disaster') {
      uiStore.openModal(panel as any);
    }
  }

  function cloneTiles(data: Tile[][]): Tile[][] {
    return data.map((row) =>
      row.map((tile) => ({
        ...tile,
        infrastructure: [...tile.infrastructure],
        zone: tile.zone ? { ...tile.zone, position: { ...tile.zone.position }, size: { ...tile.zone.size } } : null,
        building: tile.building
          ? { ...tile.building, position: { ...tile.building.position }, size: { ...tile.building.size } }
          : null
      }))
    );
  }

  function setTool(tool: InfrastructureType): void {
    uiStore.setSelectedInfra($selectedInfra === tool ? null : tool);
  }

  function setZoneTool(tool: ZoneType): void {
    uiStore.setSelectedZone($selectedZone === tool ? null : tool);
  }

  function isDevelopableZone(type: string): boolean {
    return type.startsWith('residential') || type.startsWith('commercial') || type.startsWith('industrial');
  }

  function updateStatsFromTiles(): void {
    if (!$stats) return;
    let pop = 0;
    for (const row of liveTiles) {
      for (const tile of row) {
        if (tile.zone) pop += tile.zone.population;
      }
    }
    gameStore.setStats({
      ...$stats,
      player: {
        ...$stats.player,
        population: Math.max(0, Math.round(pop))
      }
    });
  }

  async function applyConnectivityAndDevelopment(targetTiles?: Array<{ x: number; y: number }>): Promise<void> {
    if (!liveTiles.length) return;
    const positions: Array<{ x: number; y: number }> = [];

    if (targetTiles && targetTiles.length > 0) {
      positions.push(...targetTiles);
    } else {
      for (let y = 0; y < liveTiles.length; y += 1) {
        for (let x = 0; x < liveTiles[y].length; x += 1) positions.push({ x, y });
      }
    }

    const tasks = positions.map(async ({ x, y }) => {
      const tile = liveTiles[y]?.[x];
      if (!tile || !tile.zone || !isDevelopableZone(tile.zone.type)) return;

      const service = await apiService.getTileServiceConnection(gameId, x, y, liveTiles);
      tile.road_access = service.road_connected;
      tile.powered = service.power_connected;
      tile.watered = service.water_connected;
      tile.zone.road_access = service.road_connected;
      tile.zone.powered = service.power_connected;
      tile.zone.watered = service.water_connected;

      const canDevelop = service.road_connected && service.power_connected && service.water_connected;
      if (canDevelop) {
        tile.zone.development_level = Math.min(3, tile.zone.development_level + 1);
        tile.zone.population = Math.min(850, tile.zone.population + 8);
      } else {
        tile.zone.development_level = Math.max(0, tile.zone.development_level - 1);
        tile.zone.population = Math.max(0, tile.zone.population - 6);
      }
    });

    await Promise.all(tasks);
    updateStatsFromTiles();
    liveTiles = [...liveTiles];
  }

  async function handleZonePaint(event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }> }>): Promise<void> {
    await applyConnectivityAndDevelopment(event.detail.updatedTiles);
  }

  async function handleInfraDraw(event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }> }>): Promise<void> {
    void event;
    await applyConnectivityAndDevelopment();
  }

  function toggleUnderground(): void {
    uiStore.toggleUndergroundMode();
  }

  function applyEducationHealthFunding(value: number): void {
    uiStore.setFundingPct(value);
    if (!$education || !$health) return;
    const factor = value / 100;
    const eqTrend = Math.round($education.eq_trend * factor);
    const hqTrend = Math.round($health.hq_trend * factor);

    gameStore.setEducation({
      ...$education,
      eq: Math.max(0, Math.min(200, Math.round(($education.eq + eqTrend * 0.25) * 10) / 10)),
      eq_trend: eqTrend,
      facilities: $education.facilities.map((f) => ({
        ...f,
        funding_pct: Math.max(60, Math.min(140, Math.round((f.funding_pct + value) / 2)))
      }))
    });

    gameStore.setHealth({
      ...$health,
      hq: Math.max(0, Math.min(200, Math.round(($health.hq + hqTrend * 0.25) * 10) / 10)),
      hq_trend: hqTrend
    });

    series = {
      eq: createSeries($education.eq, $education.eq_trend),
      hq: createSeries($health.hq, $health.hq_trend),
      labels: monthLabels(12)
    };
  }

  function applyCheat(command: string): void {
    if (!$stats || !$gameState) return;
    const trimmed = command.trim();
    if (!trimmed) return;
    const [action, amountRaw] = trimmed.split(/\s+/, 2);
    const amount = Number(amountRaw);

    if (action?.toLowerCase() === 'money' && Number.isFinite(amount)) {
      gameStore.setStats({
        ...$stats,
        player: {
          ...$stats.player,
          treasury: $stats.player.treasury + amount
        }
      });
      gameStore.setGameState({
        ...$gameState,
        player_city: {
          ...$gameState.player_city,
          treasury: $gameState.player_city.treasury + amount
        }
      });
      uiStore.addCheatToHistory(`money ${amount}`);
    } else {
      uiStore.addCheatToHistory(`invalid: ${trimmed}`);
    }
  }

  function submitCheat(): void {
    const value = cheatInput.trim();
    if (!value) return;
    applyCheat(value);
    cheatInput = '';
  }

  function simulationTick(): void {
    if (!$gameState || !$stats || !$education || !$health) return;

    // Apply monthly simulation using the new centralized function
    gameStore.applyMonthlySimulation((updatedState) => {
      // Update stats based on new state
      const newTreasury = updatedState.player_city.treasury;
      gameStore.setStats({
        ...$stats,
        player: {
          ...$stats.player,
          treasury: newTreasury
        }
      });
    });

    // Apply connectivity and zone development
    void applyConnectivityAndDevelopment();

    // Update education and health trends
    gameStore.setEducation({
      ...$education,
      eq: Math.max(0, Math.min(200, Math.round(($education.eq + $education.eq_trend * 0.08) * 10) / 10))
    });
    gameStore.setHealth({
      ...$health,
      hq: Math.max(0, Math.min(200, Math.round(($health.hq + $health.hq_trend * 0.08) * 10) / 10))
    });

    // Update UI series
    series = {
      eq: createSeries($education.eq, $education.eq_trend),
      hq: createSeries($health.hq, $health.hq_trend),
      labels: monthLabels(12)
    };
  }

  function resetTickTimer(): void {
    if (!mounted) return;

    // Clean up existing timers
    if (tickTimer !== null) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    const interval = gameStore.getTickInterval($gameSpeed);

    if (interval > 0) {
      // Normal or fast mode: use setInterval
      tickTimer = window.setInterval(() => {
        simulationTick();
      }, interval);
    } else {
      // Instant mode: run via RAF with minimum 50ms throttle
      let lastInstantTick = 0;
      const checkInstantTick = () => {
        const now = performance.now();
        if (now - lastInstantTick > 50) {
          simulationTick();
          lastInstantTick = now;
        }
        rafId = requestAnimationFrame(checkInstantTick);
      };
      rafId = requestAnimationFrame(checkInstantTick);
    }
  }

  // Watch gameSpeed and reset timer when it changes
  $: if (mounted) {
    resetTickTimer();
  }


  onMount(async () => {
    try {
      const [gameRes, statsRes, educationRes, healthRes] = await Promise.all([
        apiService.getGame(gameId),
        apiService.getStats(gameId),
        apiService.getEducation(gameId),
        apiService.getHealth(gameId)
      ]);

      gameStore.setGameState(gameRes.game_state);
      gameStore.setStats(statsRes);
      gameStore.setEducation(educationRes);
      gameStore.setHealth(healthRes);
      liveTiles = cloneTiles(gameRes.game_state.map.tiles);

      // Compute road variants for all existing roads
      recomputeAllRoads(liveTiles);

      series = {
        eq: createSeries(educationRes.eq, educationRes.eq_trend),
        hq: createSeries(healthRes.hq, healthRes.hq_trend),
        labels: monthLabels(12)
      };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed loading game data';
      uiStore.showError(error);
    } finally {
      loading = false;
    }
  });

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'u') toggleUnderground();
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        uiStore.toggleCheatConsole();
      }
      if (event.key === 'Escape' && $cheatConsoleOpen) {
        uiStore.toggleCheatConsole();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  onMount(() => {
    mounted = true;
    return () => {
      mounted = false;
      if (tickTimer !== null) {
        window.clearInterval(tickTimer);
        tickTimer = null;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  });

  $: if (mounted) {
    $gameSpeed;
    resetTickTimer();
  }
</script>

<main class="stage">
  {#if loading}
    <p class="state" in:fade={{ duration: 280 }}>Loading game data...</p>
  {:else if error}
    <p class="state error" in:fade={{ duration: 280 }}>{error}</p>
  {:else if $gameState && $stats && $education && $health}
    <section class="map-shell" in:fade={{ duration: 560, easing: quintOut }}>
      <div class="hud-floating" in:fly={{ y: -12, duration: 420, easing: quintOut }}>
        <GameHUD
          date={$gameState.current_date}
          population={$stats.player.population}
          treasury={$stats.player.treasury}
          score={$stats.player.composite_score}
          rci={$stats.player.rci_demand}
          speed={$gameSpeed}
          onSpeedChange={(next) => uiStore.setGameSpeed(next)}
          onNextMonth={simulationTick}
          on:menu={(event) => handleMenu(event.detail.panel)}
        />
      </div>

      <IsometricMap
        tiles={liveTiles}
        mapWidth={$gameState.map.size.width}
        mapHeight={$gameState.map.size.height}
        month={$gameState.current_date.month}
        zoneTool={$selectedZone}
        infrastructureTool={$selectedInfra}
        undergroundMode={$undergroundMode}
        on:zonePainted={handleZonePaint}
        on:infrastructureDrawn={handleInfraDraw}
      />

      <div class="zone-toolbar" in:fly={{ y: 8, duration: 260, easing: quintOut }}>
        {#each zoneTools as tool}
          <button
            class:active={$selectedZone === tool.value}
            on:click={() => setZoneTool(tool.value)}
          >
            {tool.label}
          </button>
        {/each}
      </div>

      <div class="infra-toolbar" in:fly={{ y: 8, duration: 260, easing: quintOut }}>
        {#each infraTools as tool}
          <button
            class:active={$selectedInfra === tool.value}
            on:click={() => setTool(tool.value)}
          >
            {tool.label}
          </button>
        {/each}
        <button class:active={$undergroundMode} on:click={toggleUnderground}>Underground (U)</button>
      </div>

      <SlidingDrawer
        open={$educationDrawerOpen}
        title="Hezkuntza & Osasuna Monitor"
        side="right"
        width={620}
        on:close={() => uiStore.toggleEducationDrawer()}
      >
        <EducationHealthPanel
          education={$education}
          health={$health}
          eqSeries={series.eq}
          hqSeries={series.hq}
          labels={series.labels}
          fundingPct={$fundingPct}
          on:fundingChange={(event) => applyEducationHealthFunding(event.detail.value)}
        />
      </SlidingDrawer>

      <FloatingModal
        open={$activeModal === 'budget'}
        title="Budget"
        size="md"
        on:close={() => uiStore.closeModal()}
      >
        <p>Residential, Commercial, and Industrial tax tuning controls are staged here.</p>
        <p>Funding sliders for transportation, police, fire, health, and education open in this modal.</p>
      </FloatingModal>

      <FloatingModal
        open={$activeModal === 'ordinance'}
        title="Ordinances"
        size="md"
        on:close={() => uiStore.closeModal()}
      >
        <p>Ordinance toggles and annual fiscal impact will appear here with clean table controls.</p>
        <p>The panel remains hidden until explicitly requested from HUD.</p>
      </FloatingModal>

      <FloatingModal
        open={$activeModal === 'rival'}
        title="Rival City"
        size="sm"
        on:close={() => uiStore.closeModal()}
      >
        <p class="mono">{$gameState.ai_city.name}</p>
        <p>Population {$stats.ai.population} | Treasury § {$stats.ai.treasury}</p>
        <p>Score {$stats.ai.composite_score} | Approval {$stats.ai.approval}%</p>
      </FloatingModal>

      <FloatingModal
        open={$activeModal === 'disaster'}
        title="Disaster Panel"
        size="sm"
        on:close={() => uiStore.closeModal()}
      >
        <p>Launch controls for Fire, Flood, Tornado, and Earthquake are placed here.</p>
        <p>Cooldown and attack cost confirmation stay hidden until panel open.</p>
      </FloatingModal>

      <FloatingModal
        open={$cheatConsoleOpen}
        title="Cheat Console"
        size="sm"
        on:close={() => uiStore.toggleCheatConsole()}
      >
        <div class="cheat-console">
          <input
            class="cheat-input"
            placeholder="money 9999"
            bind:value={cheatInput}
            on:keydown={(event) => event.key === 'Enter' && submitCheat()}
          />
          <button class="cheat-apply" on:click={submitCheat}>Apply</button>
        </div>
      </FloatingModal>
    </section>
  {/if}
</main>

<style>
  .stage {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .map-shell {
    position: absolute;
    inset: 0;
  }

  .hud-floating {
    position: absolute;
    z-index: 12;
    top: 14px;
    left: 0;
    right: 0;
    display: grid;
    justify-content: center;
  }

  .zone-toolbar,
  .infra-toolbar {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    display: flex;
    gap: 8px;
    padding: 8px;
    border-radius: 14px;
    background: rgba(13, 24, 42, 0.58);
    border: 1px solid rgba(248, 252, 255, 0.1);
    backdrop-filter: blur(14px);
  }

  .zone-toolbar {
    top: 78px;
    flex-wrap: wrap;
    width: min(980px, calc(100vw - 20px));
    justify-content: center;
  }

  .infra-toolbar {
    top: 128px;
  }

  .zone-toolbar button,
  .infra-toolbar button {
    border: 0;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(243, 248, 255, 0.94);
    padding: 8px 12px;
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    transition: transform 160ms ease, background-color 160ms ease;
  }

  .zone-toolbar button:hover,
  .infra-toolbar button:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.14);
  }

  .zone-toolbar button.active,
  .infra-toolbar button.active {
    background: rgba(182, 154, 99, 0.86);
    color: #13233c;
    font-weight: 600;
  }

  .cheat-console {
    display: grid;
    gap: 10px;
  }

  .cheat-input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(6, 14, 26, 0.45);
    color: #f4f8ff;
    padding: 10px 12px;
    font-family: var(--font-mono);
  }

  .cheat-apply {
    justify-self: start;
    border: 0;
    border-radius: 10px;
    background: rgba(182, 154, 99, 0.85);
    color: #10223b;
    padding: 8px 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .cheat-console ul {
    margin: 0;
    padding-left: 16px;
    max-height: 150px;
    overflow: auto;
    color: rgba(234, 240, 250, 0.88);
  }

  .state {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    color: rgba(231, 238, 248, 0.92);
    padding: 14px 18px;
    border-radius: 12px;
    background: rgba(14, 25, 44, 0.7);
    backdrop-filter: blur(12px);
  }

  .error {
    color: #e4bb76;
  }

  .mono {
    font-family: var(--font-mono);
  }

  @media (max-width: 980px) {
    .hud-floating {
      top: 8px;
    }

    .infra-toolbar {
      top: 146px;
      width: calc(100vw - 16px);
      justify-content: center;
      flex-wrap: wrap;
    }
  }
</style>
