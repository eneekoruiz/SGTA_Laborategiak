<script lang="ts">
  import { onMount } from 'svelte';
  import { performanceMetrics, type PerformanceSnapshot } from '../services/performanceMetrics';

  export let visible = false;

  let snapshot: PerformanceSnapshot = {
    currentFps: 60,
    avgFps: 60,
    frameTimeMs: 16.7,
    lastStroke: null,
    strokeThroughputAvg: 0
  };

  let updateInterval: ReturnType<typeof setInterval> | null = null;

  function updateMetrics(): void {
    snapshot = performanceMetrics.getSnapshot();
  }

  onMount(() => {
    updateInterval = setInterval(updateMetrics, 250);
    return () => {
      if (updateInterval) clearInterval(updateInterval);
    };
  });
</script>

{#if visible}
  <div class="perf-meter" role="status" aria-label="Performance metrics">
    <header>
      <strong>Perf Stats</strong>
      <button type="button" on:click={() => performanceMetrics.reset()}>Reset</button>
    </header>

    <div class="metrics">
      <div class="metric">
        <span class="label">FPS</span>
        <span class="value" class:good={snapshot.currentFps >= 55} class:warning={snapshot.currentFps < 55 && snapshot.currentFps >= 45} class:bad={snapshot.currentFps < 45}>
          {snapshot.currentFps}
        </span>
      </div>

      <div class="metric">
        <span class="label">Frame</span>
        <span class="value" class:good={snapshot.frameTimeMs < 17} class:warning={snapshot.frameTimeMs < 20} class:bad={snapshot.frameTimeMs >= 20}>
          {snapshot.frameTimeMs}ms
        </span>
      </div>

      <div class="metric">
        <span class="label">Avg FPS</span>
        <span class="value">{snapshot.avgFps}</span>
      </div>

      <div class="metric">
        <span class="label">Stroke Throughput</span>
        <span class="value" class:good={snapshot.strokeThroughputAvg >= 100} class:warning={snapshot.strokeThroughputAvg < 100 && snapshot.strokeThroughputAvg >= 80} class:bad={snapshot.strokeThroughputAvg < 80}>
          {snapshot.strokeThroughputAvg} tiles/s
        </span>
      </div>
    </div>

    {#if snapshot.lastStroke}
      <div class="stroke-info">
        <span class="label">Last Stroke: {snapshot.lastStroke.tilesCompleted} tiles in {Math.round(snapshot.lastStroke.durationMs)}ms</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .perf-meter {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 40;
    padding: 12px;
    border-radius: 16px;
    background: rgba(2, 9, 20, 0.92);
    border: 1px solid rgba(136, 172, 96, 0.48);
    backdrop-filter: blur(12px);
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.42);
    color: #e9f1fc;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.78rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(136, 172, 96, 0.24);
  }

  header strong {
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  header button {
    border: 0;
    background: rgba(136, 172, 96, 0.18);
    color: #8fac60;
    padding: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.7rem;
  }

  .metrics {
    display: grid;
    gap: 6px;
  }

  .metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .label {
    color: rgba(233, 241, 252, 0.72);
    min-width: 80px;
  }

  .value {
    font-weight: 700;
    letter-spacing: 0.05em;
    min-width: 60px;
    text-align: right;
  }

  .value.good {
    color: #b8d896;
  }

  .value.warning {
    color: #f5d76e;
  }

  .value.bad {
    color: #f5a5a5;
  }

  .stroke-info {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(136, 172, 96, 0.24);
    font-size: 0.73rem;
    color: rgba(233, 241, 252, 0.68);
  }
</style>
