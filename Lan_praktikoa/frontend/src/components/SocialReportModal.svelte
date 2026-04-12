<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { EducationResponse, HealthResponse } from '../types/game';

  export let isOpen = false;
  export let education: EducationResponse | null = null;
  export let health: HealthResponse | null = null;
  export let eqSeries: number[] = [];
  export let hqSeries: number[] = [];

  const dispatch = createEventDispatcher<{ close: void }>();

  const chartWidth = 1100;
  const chartHeight = 320;
  const padX = 56;
  const padY = 38;

  function toPoints(values: number[]): Array<{ x: number; y: number }> {
    if (!values.length) return [];

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const span = Math.max(1, maxValue - minValue);
    const innerW = chartWidth - padX * 2;
    const innerH = chartHeight - padY * 2;

    return values.map((value, index) => ({
      x: padX + (index / Math.max(values.length - 1, 1)) * innerW,
      y: chartHeight - padY - ((value - minValue) / span) * innerH
    }));
  }

  function linePath(points: Array<{ x: number; y: number }>): string {
    if (!points.length) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  }

  function areaPath(points: Array<{ x: number; y: number }>, path: string): string {
    if (!points.length || !path) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${path} L${last.x},${chartHeight - padY} L${first.x},${chartHeight - padY} Z`;
  }

  function closeModal(): void {
    dispatch('close');
  }

  function onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  $: eqHistory = eqSeries.slice(-600);
  $: hqHistory = hqSeries.slice(-600);

  $: eqPoints = toPoints(eqHistory);
  $: hqPoints = toPoints(hqHistory);

  $: eqLine = linePath(eqPoints);
  $: hqLine = linePath(hqPoints);

  $: eqArea = areaPath(eqPoints, eqLine);
  $: hqArea = areaPath(hqPoints, hqLine);
</script>

{#if isOpen}
  <div class="report-backdrop" role="button" tabindex="0" on:click={onBackdropClick} on:keydown|stopPropagation={() => {}}>
    <div class="report-modal" role="dialog" aria-modal="true" aria-label="Gizarte txostena">
      <header class="report-header">
        <div>
          <h2>Gizarte Txostena</h2>
          <p>Azken 600 hilabeteetako ikuspegi estrategikoa</p>
        </div>
        <button type="button" class="close-button" on:click={closeModal} aria-label="Itxi modala">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="close-icon">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </button>
      </header>

      <article class="chart-card">
        <div class="chart-head">
          <h3>Hezkuntza Bilakaera</h3>
          <span class="chart-meta">EQ: {education?.eq ?? 0}</span>
        </div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Hezkuntza Bilakaera azken 600 hilabeteak">
          <defs>
            <linearGradient id="eqLineStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#8ed7a6" />
              <stop offset="1" stop-color="#75b4cf" />
            </linearGradient>
            <linearGradient id="eqAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="rgba(116, 203, 155, 0.42)" />
              <stop offset="1" stop-color="rgba(116, 203, 155, 0)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="16" fill="rgba(7, 18, 36, 0.45)" />
          <line x1={padX} y1={chartHeight - padY} x2={chartWidth - padX} y2={chartHeight - padY} stroke="rgba(255,255,255,0.18)" />
          <path d={eqArea} fill="url(#eqAreaFill)" />
          <path d={eqLine} fill="none" stroke="url(#eqLineStroke)" stroke-width="3.2" stroke-linecap="round" />
        </svg>
      </article>

      <article class="chart-card">
        <div class="chart-head">
          <h3>Osasun Egoera</h3>
          <span class="chart-meta">Hilkortasun Tasa: {health?.mortality_rate?.toFixed(1) ?? '0.0'}%</span>
        </div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Osasun Egoera azken 600 hilabeteak">
          <defs>
            <linearGradient id="hqLineStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#8cc8ff" />
              <stop offset="1" stop-color="#90e6cf" />
            </linearGradient>
            <linearGradient id="hqAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="rgba(124, 186, 241, 0.4)" />
              <stop offset="1" stop-color="rgba(124, 186, 241, 0)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="16" fill="rgba(7, 18, 36, 0.45)" />
          <line x1={padX} y1={chartHeight - padY} x2={chartWidth - padX} y2={chartHeight - padY} stroke="rgba(255,255,255,0.18)" />
          <path d={hqArea} fill="url(#hqAreaFill)" />
          <path d={hqLine} fill="none" stroke="url(#hqLineStroke)" stroke-width="3.2" stroke-linecap="round" />
        </svg>
      </article>
    </div>
  </div>
{/if}

<style>
  .report-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(6, 11, 21, 0.58);
    backdrop-filter: blur(8px);
    padding: 24px;
  }

  .report-modal {
    width: min(1440px, 96vw);
    max-height: 92vh;
    overflow: auto;
    border-radius: 22px;
    border: 1px solid rgba(165, 212, 241, 0.22);
    background: linear-gradient(165deg, rgba(14, 30, 52, 0.76), rgba(9, 20, 38, 0.78));
    box-shadow: 0 28px 90px rgba(2, 6, 15, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(22px) saturate(130%);
    padding: 24px;
    display: grid;
    gap: 18px;
  }

  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .report-header h2 {
    margin: 0;
    color: #f2f8ff;
    font-size: 1.72rem;
    letter-spacing: 0.01em;
  }

  .report-header p {
    margin: 4px 0 0;
    color: rgba(218, 235, 255, 0.78);
    font-size: 0.92rem;
  }

  .close-button {
    border: 1px solid rgba(160, 210, 237, 0.42);
    background: rgba(148, 198, 226, 0.12);
    color: #eaf5ff;
    border-radius: 10px;
    width: 38px;
    height: 38px;
    padding: 0;
    font-size: 0.9rem;
    font-weight: 620;
    cursor: pointer;
    transition: background-color 120ms ease, transform 120ms ease;
  }

  .close-icon {
    width: 18px;
    height: 18px;
  }

  .close-button:hover {
    background: rgba(148, 198, 226, 0.2);
    transform: translateY(-1px);
  }

  .chart-card {
    border-radius: 18px;
    border: 1px solid rgba(155, 194, 221, 0.22);
    background: rgba(255, 255, 255, 0.04);
    padding: 16px;
    display: grid;
    gap: 10px;
  }

  .chart-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }

  .chart-head h3 {
    margin: 0;
    color: #eff7ff;
    font-size: 1.05rem;
  }

  .chart-meta {
    color: rgba(210, 227, 247, 0.9);
    font-weight: 540;
    font-size: 0.88rem;
  }

  @media (max-width: 900px) {
    .report-backdrop {
      padding: 10px;
    }

    .report-modal {
      width: 100%;
      max-height: 95vh;
      padding: 14px;
    }

    .report-header {
      flex-wrap: wrap;
    }
  }
</style>
