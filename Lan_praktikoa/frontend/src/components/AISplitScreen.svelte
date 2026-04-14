<script lang="ts">
  import IsometricMap from './IsometricMap.Optimized.svelte';
  import type { Tile } from '../types/game';

  export let open = false;
  export let mapWidth = 64;
  export let mapHeight = 64;
  export let playerTiles: Tile[][] = [];
  export let aiTiles: Tile[][] = [];
  export let actionFocus: { x: number; y: number } | null = null;
  export let replayBudgetPing: { id: number; x: number; y: number; amount: number } | null = null;
  export let replayDisasterPulse = 0;
  export let playerLabel = 'Jokalariaren hiria (estatikoa)';
  export let aiLabel = 'AA hiria (dinamikoa)';
</script>

{#if open}
  <section class="split-screen" aria-label="AA ikuspegi zatitua">
    <article class="pane player">
      <header>
        <strong>{playerLabel}</strong>
        <span>Estatikoa</span>
      </header>
      <div class="map-host">
        <IsometricMap
          tiles={playerTiles}
          {mapWidth}
          {mapHeight}
          inputLocked={true}
          showInfrastructure={true}
          showZones={true}
          showStatusIcons={false}
          undergroundMode={false}
          activeOverlay={null}
          selectedBuildingCost={0}
        />
      </div>
    </article>

    <article class="pane ai">
      <header>
        <strong>{aiLabel}</strong>
        <span>Interaktiboa</span>
      </header>
      <div class="map-host">
        <IsometricMap
          tiles={aiTiles}
          {mapWidth}
          {mapHeight}
          inputLocked={false}
          showInfrastructure={true}
          showZones={true}
          showStatusIcons={false}
          undergroundMode={false}
          activeOverlay={null}
          focusTile={actionFocus}
          selectedTile={actionFocus}
          {replayBudgetPing}
          {replayDisasterPulse}
          selectedBuildingCost={0}
        />
      </div>
    </article>
  </section>
{/if}

<style>
  .split-screen {
    position: absolute;
    inset: 0;
    z-index: 92;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px;
    background: rgba(4, 12, 24, 0.34);
    backdrop-filter: blur(4px);
  }

  .pane {
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto 1fr;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(205, 230, 255, 0.24);
    background: rgba(7, 18, 34, 0.78);
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
  }

  .pane header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(214, 233, 255, 0.16);
    background: linear-gradient(180deg, rgba(14, 31, 53, 0.88), rgba(11, 23, 40, 0.84));
    color: rgba(235, 247, 255, 0.96);
  }

  .pane header strong {
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .pane header span {
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(180, 215, 242, 0.84);
  }

  .map-host {
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  @media (max-width: 900px) {
    .split-screen {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
  }
</style>
