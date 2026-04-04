<script lang="ts">
  import { fade } from 'svelte/transition';

  export let activeOverlay: string | null = null;
  export let onOverlayChange: (type: string | null) => void = () => {};

  const overlayTypes = [
    { id: 'crime', label: '🚨 Crime', color: '#ff4757' },
    { id: 'pollution_air', label: '💨 Air Pollution', color: '#ffa502' },
    { id: 'pollution_water', label: '💧 Water Pollution', color: '#8b6914' },
    { id: 'land_value', label: '💎 Land Value', color: '#2ed573' },
    { id: 'traffic', label: '🚗 Traffic', color: '#5f27cd' },
    { id: 'power', label: '⚡ Power', color: '#ffdd00' },
    { id: 'water', label: '💧 Water', color: '#00d2d3' },
    { id: 'fire_coverage', label: '🧯 Fire Coverage', color: '#ff4444' },
    { id: 'police_coverage', label: '👮 Police Coverage', color: '#4488ff' },
    { id: 'health', label: '⚕️ Health', color: '#00d2d3' },
    { id: 'education', label: '🎓 Education', color: '#a29bfe' }
  ];

  function toggleOverlay(type: string): void {
    if (activeOverlay === type) {
      onOverlayChange(null);
    } else {
      onOverlayChange(type);
    }
  }

  function getLegendColor(index: number): string {
    if (!activeOverlay) return 'rgba(100, 100, 100, 0.5)';

    const colorMap: Record<string, [[number, number, number], [number, number, number]]> = {
      crime: [[0, 100, 90], [0, 100, 50]],
      pollution_air: [[280, 70, 85], [280, 70, 40]],
      pollution_water: [[40, 90, 85], [40, 90, 45]],
      land_value: [[120, 100, 90], [120, 100, 50]],
      traffic: [[30, 100, 85], [30, 100, 50]],
      power: [[60, 100, 90], [60, 100, 50]],
      water: [[180, 100, 90], [180, 100, 50]],
      fire_coverage: [[0, 100, 90], [0, 100, 50]],
      police_coverage: [[210, 100, 90], [210, 100, 50]],
      health: [[160, 100, 90], [160, 100, 50]],
      education: [[260, 100, 90], [260, 100, 50]]
    };

    const [lightHSL, darkHSL] = colorMap[activeOverlay] || [[0, 0, 90], [0, 0, 40]];
    const ratio = index / 255;

    const h = Math.round(lightHSL[0] * (1 - ratio) + darkHSL[0] * ratio);
    const s = Math.round(lightHSL[1] * (1 - ratio) + darkHSL[1] * ratio);
    const l = Math.round(lightHSL[2] * (1 - ratio) + darkHSL[2] * ratio);

    return `hsl(${h}, ${s}%, ${l}%)`;
  }
</script>

<div class="overlay-selector" in:fade={{ duration: 200 }}>
  <div class="header">
    <h3>Data Overlays</h3>
    <button
      class="close-btn"
      on:click={() => onOverlayChange(null)}
      aria-label="Close overlay selector"
    >
      ✕
    </button>
  </div>

  <div class="overlay-list">
    {#each overlayTypes as overlay (overlay.id)}
      <button
        class="overlay-btn"
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
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .overlay-selector {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: linear-gradient(135deg, rgba(20, 34, 58, 0.92), rgba(15, 28, 48, 0.88));
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 14px 16px;
    backdrop-filter: blur(20px) saturate(110%);
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.1),
      0 16px 48px rgba(2, 9, 20, 0.4);
    z-index: 1000;
    max-width: 320px;
    color: #f2f6ff;
    font-family: 'Inter', 'Segoe UI', sans-serif;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 10px;
  }

  .header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    font-size: 1rem;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 150ms ease;
  }

  .close-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
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
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.85);
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 150ms ease;
    position: relative;
  }

  .overlay-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .overlay-btn.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    color: #fff;
    box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.1);
  }

  .indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  }

  .legend {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
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
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .legend-swatch {
    flex: 1;
    transition: opacity 150ms ease;
  }

  .legend-scale {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
  }
</style>
