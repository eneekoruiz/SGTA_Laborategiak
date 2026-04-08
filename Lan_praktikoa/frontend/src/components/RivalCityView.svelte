<script lang="ts">
  import IsometricMap from './IsometricMap.Optimized.svelte';
  import type { CityState, GameState, StatsResponse, Tile } from '../types/game';

  export let gameState: GameState | null = null;
  export let stats: StatsResponse | null = null;
  export let aiTiles: Tile[][] = [];

  function cloneTileGrid(source: Tile[][]): Tile[][] {
    return source.map((row) =>
      row.map((tile) => ({
        ...tile,
        infrastructure: [...tile.infrastructure],
        zone: tile.zone
          ? {
              ...tile.zone,
              position: { ...tile.zone.position },
              size: { ...tile.zone.size }
            }
          : null,
        building: tile.building
          ? {
              ...tile.building,
              position: { ...tile.building.position },
              size: { ...tile.building.size }
            }
          : null
      }))
    );
  }

  function stampCityStateOnGrid(baseTiles: Tile[][], city: CityState | undefined): Tile[][] {
    if (!city || baseTiles.length === 0) return baseTiles;
    const projected = cloneTileGrid(baseTiles);

    for (const row of projected) {
      for (const tile of row) {
        tile.zone = null;
        tile.building = null;
        tile.infrastructure = [];
        tile.road_access = false;
        tile.powered = false;
        tile.watered = false;
      }
    }

    for (const zone of city.zones ?? []) {
      const { x, y } = zone.position;
      if (!projected[y]?.[x]) continue;
      projected[y][x].zone = {
        ...zone,
        position: { ...zone.position },
        size: { ...zone.size }
      };
      projected[y][x].road_access = zone.road_access;
      projected[y][x].powered = zone.powered;
      projected[y][x].watered = zone.watered;
    }

    for (const building of city.buildings ?? []) {
      const { x, y } = building.position;
      if (!projected[y]?.[x]) continue;
      projected[y][x].building = {
        ...building,
        position: { ...building.position },
        size: { ...building.size }
      };
      projected[y][x].powered = building.powered;
    }

    return projected;
  }

  function monthsSinceLastAiAttack(): number {
    if (!gameState?.disaster_attacks?.last_ai_attack_date) return 999;
    const last = gameState.disaster_attacks.last_ai_attack_date;
    const current = gameState.current_date;
    return (current.year - last.year) * 12 + (current.month - last.month);
  }

  function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  $: ai = gameState?.ai_city;
  $: player = gameState?.player_city;
  $: scoreLead = (stats?.comparison?.score_diff ?? 0) * -1;
  $: months = monthsSinceLastAiAttack();
  $: cooldownRemaining = Math.max(0, 6 - months);
  $: cooldownPct = clamp01(months / 6) * 100;
  $: projectedAiTiles = stampCityStateOnGrid(aiTiles, gameState?.ai_city);
</script>

<section class="rival-wrap" role="status" aria-live="polite">
  <div class="rival-map-card">
    <div class="map-head">
      <strong>Rival City Render</strong>
      <span>Same Fidelity Pipeline</span>
    </div>

    <div class="mini-map-shell">
      <IsometricMap
        tiles={projectedAiTiles}
        mapWidth={gameState?.map?.size?.width ?? 64}
        mapHeight={gameState?.map?.size?.height ?? 64}
        tileWidth={36}
        tileHeight={18}
        inputLocked={true}
        showInfrastructure={true}
        showZones={true}
        showStatusIcons={false}
        undergroundMode={false}
        activeOverlay={null}
        playerTreasury={stats?.ai?.treasury ?? 0}
        selectedBuildingCost={0}
      />
    </div>
  </div>

  <div class="intel-card">
    <div class="identity-row">
      <div class="identity">
        <span class="dot"></span>
        <strong>{ai?.name ?? 'Rival City'}</strong>
      </div>
      <span class="badge">Rival Intel</span>
    </div>

    <div class="chips">
      <span>Pop {stats?.ai.population ?? 0}</span>
      <span>Score {stats?.ai.composite_score ?? 0}</span>
      <span>§ {stats?.ai.treasury ?? 0}</span>
      <span>{stats?.ai.approval ?? 0}%</span>
    </div>

    <div class="metrics-grid">
      <div class="metric-row">
        <span class="metric-name">EQ</span>
        <div class="meter"><div class="fill eq" style={`width: ${clamp01((ai?.metrics.eq ?? 0) / 200) * 100}%`}></div></div>
        <span>{ai?.metrics.eq ?? 0}</span>
      </div>
      <div class="metric-row">
        <span class="metric-name">HQ</span>
        <div class="meter"><div class="fill hq" style={`width: ${clamp01((ai?.metrics.hq ?? 0) / 200) * 100}%`}></div></div>
        <span>{ai?.metrics.hq ?? 0}</span>
      </div>
      <div class="metric-row">
        <span class="metric-name">Crime</span>
        <div class="meter"><div class="fill crime" style={`width: ${clamp01((ai?.metrics.crime_rate ?? 0) / 100) * 100}%`}></div></div>
        <span>{ai?.metrics.crime_rate ?? 0}%</span>
      </div>
      <div class="metric-row">
        <span class="metric-name">Pollution</span>
        <div class="meter"><div class="fill pollution" style={`width: ${clamp01((ai?.metrics.pollution_air ?? 0) / 100) * 100}%`}></div></div>
        <span>{ai?.metrics.pollution_air ?? 0}%</span>
      </div>
    </div>

    <div class="comparison-row">
      <span>Score lead:</span>
      <strong class:negative={scoreLead < 0}>{scoreLead >= 0 ? '+' : ''}{scoreLead}</strong>
      <span class="muted">vs {player?.name ?? 'Player'}</span>
    </div>

    <div class="cooldown-block">
      <div class="cooldown-head">
        <span>Last AI Attack</span>
        {#if cooldownRemaining === 0}
          <strong class="ready">Ready</strong>
        {:else}
          <strong>{cooldownRemaining}m cooldown</strong>
        {/if}
      </div>
      <div class="cooldown-track"><div class="cooldown-fill" style={`width: ${cooldownPct}%`}></div></div>
    </div>
  </div>
</section>

<style>
  .rival-wrap {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 12px;
  }

  .rival-map-card,
  .intel-card {
    border-radius: 16px;
    border: 0.5px solid rgba(255, 255, 255, 0.26);
    background: linear-gradient(160deg, rgba(28, 30, 34, 0.76), rgba(18, 20, 24, 0.72));
    backdrop-filter: blur(20px) saturate(115%);
    box-shadow: var(--elev-2);
    color: rgba(245, 248, 252, 0.95);
  }

  .rival-map-card {
    display: grid;
    gap: 8px;
    padding: 10px;
  }

  .map-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 0.75rem;
  }

  .map-head span {
    color: rgba(230, 237, 244, 0.72);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.64rem;
  }

  .mini-map-shell {
    position: relative;
    min-height: 260px;
    border-radius: 12px;
    overflow: hidden;
    border: 0.5px solid rgba(255, 255, 255, 0.18);
    background: #0c1118;
  }

  .intel-card {
    display: grid;
    gap: 10px;
    padding: 12px 14px;
  }

  .identity-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .identity {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #8dc3a3;
    box-shadow: 0 0 0 4px rgba(141, 195, 163, 0.18);
  }

  strong {
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .badge {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 4px 8px;
    border-radius: 999px;
    border: 0.5px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chips {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: center;
    gap: var(--space-1);
    font-size: 0.74rem;
    color: rgba(229, 236, 244, 0.88);
  }

  .chips span {
    padding: 4px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    border: 0.5px solid rgba(255, 255, 255, 0.22);
    text-align: center;
  }

  .metrics-grid {
    display: grid;
    gap: 6px;
  }

  .metric-row {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
  }

  .metric-row .metric-name {
    color: rgba(229, 236, 244, 0.78);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .meter {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .fill {
    height: 100%;
  }

  .fill.eq {
    background: #8eb48f;
  }

  .fill.hq {
    background: #8fb0c6;
  }

  .fill.crime {
    background: #d99595;
  }

  .fill.pollution {
    background: #c2a38b;
  }

  .comparison-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.76rem;
    color: rgba(229, 236, 244, 0.84);
  }

  .comparison-row strong.negative {
    color: #f3b3b3;
  }

  .comparison-row .muted {
    color: rgba(229, 236, 244, 0.64);
  }

  .cooldown-block {
    display: grid;
    gap: 6px;
  }

  .cooldown-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: rgba(229, 236, 244, 0.82);
  }

  .cooldown-head .ready {
    color: #b8dfb9;
  }

  .cooldown-track {
    height: 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .cooldown-fill {
    height: 100%;
    background: linear-gradient(90deg, #e2a7a7, #b5dfb7);
  }

  @media (max-width: 1200px) {
    .rival-wrap {
      grid-template-columns: 1fr;
    }

    .chips {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
