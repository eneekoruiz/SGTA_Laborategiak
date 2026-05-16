<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Tile } from '../types/game';

  export let activeOverlay: string | null = null;
  export let isActive = false;
  export let overlayStrength = 72;
  export let overlayTiles: Tile[][] = [];
  export let onOverlayChange: (type: string | null) => void = () => {};
  export let onStrengthChange: (value: number) => void = () => {};
  export let onToggle: () => void = () => {};

  let expanded = false;

  // Calculate coverage percentage for service overlays
  $: coveragePct = calculateCoverage();
  
  function calculateCoverage(): number {
    if (!activeOverlay || !overlayTiles.length) return 0;
    
    const serviceMap: Record<string, string[]> = {
      'police_coverage': ['police_station'],
      'fire_coverage': ['fire_station'],
      'health': ['hospital'],
      'education': ['school', 'college']
    };
    
    const services = serviceMap[activeOverlay];
    if (!services) return 0;
    
    let totalTiles = 0;
    let coveredTiles = 0;
    const SERVICE_RADIUS = 18;
    
    for (let y = 0; y < overlayTiles.length; y++) {
      for (let x = 0; x < overlayTiles[y].length; x++) {
        totalTiles++;
        const tile = overlayTiles[y][x];
        
        // Check if tile has service building
        if (tile.building && services.includes(tile.building.type)) {
          coveredTiles++;
          continue;
        }
        
        // Check if tile is within radius of any service building
        for (let sy = 0; sy < overlayTiles.length; sy++) {
          for (let sx = 0; sx < overlayTiles[sy].length; sx++) {
            const neighbor = overlayTiles[sy][sx];
            if (neighbor.building && services.includes(neighbor.building.type)) {
              const dist = Math.sqrt(Math.pow(x - sx, 2) + Math.pow(y - sy, 2));
              if (dist <= SERVICE_RADIUS) {
                coveredTiles++;
                break;
              }
            }
          }
          if (coveredTiles % totalTiles !== (coveredTiles - 1) % totalTiles) break;
        }
      }
    }
    
    return totalTiles > 0 ? Math.round((coveredTiles / totalTiles) * 100) : 0;
  }

  const overlayTypes = [
    { id: 'crime', label: 'Krimena', color: '#d27f7f' },
    { id: 'pollution_air', label: 'Aire-kutsadura', color: '#a78f84' },
    { id: 'pollution_water', label: 'Ur-kutsadura', color: '#8a7e73' },
    { id: 'land_value', label: 'Lurraren balioa', color: '#8cad8f' },
    { id: 'traffic', label: 'Trafikoa', color: '#b89470' },
    { id: 'power', label: 'Energia', color: '#b8aa83' },
    { id: 'water', label: 'Ura', color: '#80a8b9' },
    { id: 'fire_coverage', label: 'Sute-estaldura', color: '#c78f80' },
    { id: 'police_coverage', label: 'Polizia-estaldura', color: '#8ea5bf' },
    { id: 'health', label: 'Osasuna', color: '#8eb9b2' },
    { id: 'education', label: 'Hezkuntza', color: '#9d9fc2' }
  ];

  function toggleOverlay(type: string): void {
    if (activeOverlay === type) {
      onOverlayChange(null);
      return;
    }
    onOverlayChange(type);
  }

  function openPanel(): void {
    expanded = true;
    if (!isActive) onToggle();
  }

  function closePanel(): void {
    expanded = false;
  }

  function closeEverything(): void {
    onOverlayChange(null);
    if (isActive) onToggle();
    closePanel();
  }

  function getLegendColor(intensity: number): string {
    if (!activeOverlay) return 'rgba(100, 100, 100, 0.3)';

    const colorMap: Record<
      string,
      { hue: number; satLight: number; satDark: number; lightLight: number; lightDark: number }
    > = {
      crime: { hue: 0, satLight: 80, satDark: 100, lightLight: 85, lightDark: 35 },
      pollution_air: { hue: 280, satLight: 60, satDark: 100, lightLight: 80, lightDark: 30 },
      pollution_water: { hue: 40, satLight: 80, satDark: 100, lightLight: 80, lightDark: 35 },
      land_value: { hue: 120, satLight: 70, satDark: 100, lightLight: 80, lightDark: 40 },
      traffic: { hue: 30, satLight: 75, satDark: 100, lightLight: 80, lightDark: 35 },
      power: { hue: 60, satLight: 80, satDark: 100, lightLight: 85, lightDark: 30 },
      water: { hue: 180, satLight: 70, satDark: 100, lightLight: 85, lightDark: 35 },
      fire_coverage: { hue: 0, satLight: 80, satDark: 100, lightLight: 85, lightDark: 35 },
      police_coverage: { hue: 210, satLight: 70, satDark: 100, lightLight: 85, lightDark: 35 },
      health: { hue: 160, satLight: 80, satDark: 100, lightLight: 85, lightDark: 35 },
      education: { hue: 260, satLight: 75, satDark: 100, lightLight: 80, lightDark: 35 }
    };

    const config = colorMap[activeOverlay];
    if (!config) return 'rgba(100, 100, 100, 0.3)';

    const ratio = intensity / 255;
    const s = config.satLight * (1 - ratio) + config.satDark * ratio;
    const l = config.lightLight * (1 - ratio) + config.lightDark * ratio;

    return `hsl(${Math.round(config.hue)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }

  function handleStrengthInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    onStrengthChange(Number(target.value));
  }
</script>

<aside
  class="overlay-rail"
  class:expanded={expanded}
  on:mouseenter={openPanel}
  on:mouseleave={closePanel}
  in:fade={{ duration: 200 }}
>
  <button class="premium-btn rail-trigger" aria-label="Datu-geruzak ireki edo itxi" on:click={openPanel}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c4.5 0 8 3.2 9 8-1 4.8-4.5 8-9 8s-8-3.2-9-8c1-4.8 4.5-8 9-8zm0 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" /></svg>
  </button>

  <div class="overlay-panel">
    <div class="header">
      <h3>Datu-geruzak</h3>
      <button class="close-btn" on:click={closeEverything} aria-label="Datu-geruza itxi">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <div class="overlay-list">
      {#each overlayTypes as overlay (overlay.id)}
        <button
          class="premium-btn overlay-btn"
          class:active={activeOverlay === overlay.id}
          on:click={() => toggleOverlay(overlay.id)}
        >
          <span class="indicator" style="background-color: {overlay.color}"></span>
          {overlay.label}
        </button>
      {/each}
    </div>

    {#if activeOverlay}
      <div class="legend" in:fade={{ duration: 150 }}>
        <div class="legend-title">
          {overlayTypes.find((o) => o.id === activeOverlay)?.label || activeOverlay}
        </div>
        <div class="legend-bar">
          {#each Array(32) as _, i}
            <div
              class="legend-swatch"
              style="background-color: {getLegendColor(Math.round((i / 31) * 255))}"
            ></div>
          {/each}
        </div>
        <div class="legend-scale">
          <span>Baxua</span>
          <span>Altua</span>
        </div>
        
        {#if ['police_coverage', 'fire_coverage', 'health', 'education'].includes(activeOverlay)}
          <div class="coverage-stat">
            <span class="coverage-label">Estaldura:</span>
            <span class="coverage-value">{coveragePct}%</span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="strength-box">
      <label for="overlay-strength">Intentsitatea</label>
      <div class="strength-row">
        <input
          id="overlay-strength"
          type="range"
          min="0"
          max="100"
          step="1"
          value={overlayStrength}
          on:input={handleStrengthInput}
          aria-label="Datu-geruzen intentsitatea"
        />
        <strong>{overlayStrength}%</strong>
      </div>
    </div>
  </div>
</aside>

{#if expanded}
  <button class="dismiss-overlay" aria-label="Datu-geruzen panela itxi" on:click={closePanel}></button>
{/if}

<style>
  .overlay-rail {
    position: fixed;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 60;
    display: grid;
    grid-template-columns: 46px 0;
    align-items: stretch;
    border-radius: 26px;
    background: rgba(27, 29, 33, 0.24);
    border: 0.5px solid rgba(255, 255, 255, 0.35);
    backdrop-filter: blur(20px) saturate(112%);
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.14), 0 20px 40px rgba(4, 6, 10, 0.28);
    overflow: hidden;
    transition: grid-template-columns var(--dur-mid) var(--ease-standard), box-shadow var(--dur-mid) var(--ease-standard), transform var(--dur-mid) var(--ease-standard);
  }

  .overlay-rail.expanded {
    grid-template-columns: 46px minmax(260px, 290px);
  }

  .rail-trigger {
    border: 0;
    border-right: 0.5px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(241, 245, 251, 0.9);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .rail-trigger svg,
  .close-btn svg {
    width: 16px;
    height: 16px;
    stroke: rgba(245, 248, 252, 0.95);
    fill: none;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .overlay-panel {
    width: 100%;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-mid) var(--ease-standard);
    padding: 14px;
    color: rgba(240, 244, 250, 0.95);
  }

  .overlay-rail.expanded .overlay-panel {
    opacity: 1;
    pointer-events: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.26);
    padding-bottom: 10px;
  }

  .header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.03);
    border: 0.5px solid rgba(255, 255, 255, 0.28);
    cursor: pointer;
    padding: 4px;
    border-radius: 10px;
    transition: background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard);
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.09);
  }

  .overlay-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }

  .overlay-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 0.5px solid rgba(255, 255, 255, 0.26);
    color: rgba(255, 255, 255, 0.85);
    padding: 8px 12px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: transform var(--dur-fast) var(--ease-standard), background-color var(--dur-mid) var(--ease-standard), border-color var(--dur-mid) var(--ease-standard);
  }

  .overlay-btn:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.32);
    color: #fff;
  }

  .overlay-btn.active {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.42);
    color: #fff;
  }

  .indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 0.5px solid rgba(255, 255, 255, 0.2);
  }

  .legend-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .legend-bar {
    display: flex;
    height: 18px;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 6px;
    border: 0.5px solid rgba(255, 255, 255, 0.28);
  }

  .legend-swatch {
    flex: 1;
  }

  .legend-scale {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
  }

  .coverage-stat {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 0.5px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .coverage-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }

  .coverage-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .dismiss-overlay {
    position: fixed;
    inset: 0;
    border: 0;
    background: transparent;
    z-index: 55;
  }

  @media (max-width: 980px) {
    .overlay-rail {
      left: 10px;
      top: auto;
      bottom: 86px;
      transform: none;
      border-radius: 22px;
      grid-template-columns: 40px 0;
    }

    .overlay-rail.expanded {
      grid-template-columns: 40px minmax(220px, 260px);
    }

    .overlay-panel {
      padding: 10px;
    }
  }
</style>
