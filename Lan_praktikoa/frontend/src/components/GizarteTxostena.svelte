<script lang="ts">
  /**
   * Gizarte Txostena (Social Report) Modal
   *
   * Full-screen data visualization for Education & Health metrics
   * Shows 50-year trends with professional glassmorphism styling.
   *
   * Props: Data arrays ONLY (no simulation logic inside Svelte)
   */

  import { createEventDispatcher } from 'svelte';
  import type { EducationResponse, HealthResponse } from '../types/game';

  export let isOpen = false;
  export let education: EducationResponse | null = null;
  export let health: HealthResponse | null = null;
  export let eqSeries: number[] = [];
  export let hqSeries: number[] = [];

  const dispatch = createEventDispatcher<{ close: void }>();

  // Chart dimensions
  const chartW = 800;
  const chartH = 300;
  const padX = 40;
  const padY = 40;

  function toPoints(values: number[], maxValue: number): Array<{ x: number; y: number }> {
    if (values.length === 0) return [];
    const innerW = chartW - padX * 2;
    const innerH = chartH - padY * 2;

    return values.map((value, idx) => ({
      x: padX + (idx / Math.max(values.length - 1, 1)) * innerW,
      y: chartH - padY - (value / maxValue) * innerH
    }));
  }

  function splinePath(points: Array<{ x: number; y: number }>, tension = 0.22): string {
    if (!points.length) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;

    let d = `M${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + ((p2.x - p0.x) / 6) * (1 + tension);
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * (1 + tension);
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * (1 + tension);
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * (1 + tension);

      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return d;
  }

  function areaPath(
    points: Array<{ x: number; y: number }>,
    line: string
  ): string {
    if (!points.length || !line) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${line} L${last.x},${chartH - padY} L${first.x},${chartH - padY} Z`;
  }

  function generateYAxisTicks(
    maxValue: number
  ): Array<{ label: string; y: number }> {
    const step = Math.ceil(maxValue / 4);
    const ticks = [];
    for (let v = 0; v <= maxValue; v += step) {
      const y = chartH - padY - (v / maxValue) * (chartH - padY * 2);
      ticks.push({ label: String(v), y });
    }
    return ticks;
  }

  $: eqPoints = toPoints(eqSeries, 200);
  $: eqPath = splinePath(eqPoints);
  $: eqArea = areaPath(eqPoints, eqPath);
  $: eqTicks = generateYAxisTicks(200);

  $: hqPoints = toPoints(hqSeries, 200);
  $: hqPath = splinePath(hqPoints);
  $: hqArea = areaPath(hqPoints, hqPath);
  $: hqTicks = generateYAxisTicks(200);

  $: pollutionPoints = toPoints(health?.pollution_series ?? [], 150);
  $: pollutionPath = splinePath(pollutionPoints);

  function onClose(): void {
    dispatch('close');
  }

  function onBackdropClick(evt: MouseEvent): void {
    if (evt.target === evt.currentTarget) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" role="button" on:click={onBackdropClick} on:keydown|stopPropagation={() => {}} tabindex={0}>
    <div class="modal-content">
      <header class="modal-header">
        <h1>Gizarte Txostena</h1>
        <p>50 urteetako hezkuntza eta osasun datuak</p>
        <button class="close-btn" on:click={onClose} aria-label="Itxi modala">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18" stroke-width="2" stroke-linecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <div class="charts-grid">
        <!-- EQ Chart -->
        <section class="chart-section">
          <h2>Hezkuntza Maila (EQ)</h2>
          <p class="subtitle">Azken 50 urteak, hilabetez</p>

          <svg class="chart" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#7f9a7e" />
                <stop offset="1" stop-color="#b1c2a3" />
              </linearGradient>
              <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="rgba(126, 153, 121, 0.35)" />
                <stop offset="1" stop-color="rgba(126, 153, 121, 0)" />
              </linearGradient>
            </defs>

            <!-- Grid -->
            {#each eqTicks as tick}
              <line
                x1={padX}
                y1={tick.y}
                x2={chartW - padX}
                y2={tick.y}
                stroke="rgba(255,255,255,0.08)"
                stroke-dasharray="4 8"
              />
              <text
                x={padX - 8}
                y={tick.y + 4}
                text-anchor="end"
                font-size="11"
                fill="rgba(200,220,255,0.6)">
                {tick.label}
              </text>
            {/each}

            <!-- Baseline -->
            <line
              x1={padX}
              y1={chartH - padY}
              x2={chartW - padX}
              y2={chartH - padY}
              stroke="rgba(255,255,255,0.16)"
              stroke-width="1"
            />

            <!-- Area fill -->
            <path d={eqArea} fill="url(#eqFill)" />

            <!-- Line -->
            <path d={eqPath} fill="none" stroke="url(#eqStroke)" stroke-width="3" stroke-linecap="round" />

            <!-- End dot -->
            {#if eqPoints.length}
              <circle
                cx={eqPoints[eqPoints.length - 1].x}
                cy={eqPoints[eqPoints.length - 1].y}
                r="5"
                fill="#b7c5aa"
              />
            {/if}
          </svg>

          {#if education}
            <div class="chart-stats">
              <div class="stat">
                <span>Egungoa:</span>
                <strong>{education.eq}</strong>
              </div>
              <div class="stat">
                <span>Joera:</span>
                <strong class:positive={education.eq_trend >= 0}>
                  {education.eq_trend >= 0 ? '+' : ''}{education.eq_trend}
                </strong>
              </div>
              <div class="stat">
                <span>Goi-teknologia:</span>
                <strong>{(education.effects.high_tech_industry_pct * 100).toFixed(0)}%</strong>
              </div>
            </div>
          {/if}
        </section>

        <!-- HQ Chart -->
        <section class="chart-section">
          <h2>Osasun Maila (HQ)</h2>
          <p class="subtitle">Kutsadura eta hilkortasunarekin erkaketa</p>

          <svg class="chart" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="hqStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#6f8ba7" />
                <stop offset="1" stop-color="#9cb2c4" />
              </linearGradient>
              <linearGradient id="hqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="rgba(114, 144, 171, 0.35)" />
                <stop offset="1" stop-color="rgba(114, 144, 171, 0)" />
              </linearGradient>
              <linearGradient id="pollutionStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#a0a0a0" />
                <stop offset="1" stop-color="#606060" />
              </linearGradient>
            </defs>

            <!-- Grid -->
            {#each hqTicks as tick}
              <line
                x1={padX}
                y1={tick.y}
                x2={chartW - padX}
                y2={tick.y}
                stroke="rgba(255,255,255,0.08)"
                stroke-dasharray="4 8"
              />
              <text
                x={padX - 8}
                y={tick.y + 4}
                text-anchor="end"
                font-size="11"
                fill="rgba(200,220,255,0.6)">
                {tick.label}
              </text>
            {/each}

            <!-- Baseline -->
            <line
              x1={padX}
              y1={chartH - padY}
              x2={chartW - padX}
              y2={chartH - padY}
              stroke="rgba(255,255,255,0.16)"
              stroke-width="1"
            />

            <!-- Pollution context line (faded) -->
            {#if pollutionPath}
              <path
                d={pollutionPath}
                fill="none"
                stroke="url(#pollutionStroke)"
                stroke-width="2"
                stroke-linecap="round"
                opacity="0.4"
              />
            {/if}

            <!-- HQ area -->
            <path d={hqArea} fill="url(#hqFill)" />

            <!-- HQ line -->
            <path d={hqPath} fill="none" stroke="url(#hqStroke)" stroke-width="3" stroke-linecap="round" />

            <!-- End dots -->
            {#if hqPoints.length}
              <circle
                cx={hqPoints[hqPoints.length - 1].x}
                cy={hqPoints[hqPoints.length - 1].y}
                r="5"
                fill="#a6b9c8"
              />
            {/if}
          </svg>

          {#if health}
            <div class="chart-stats">
              <div class="stat">
                <span>Osasun maila:</span>
                <strong>{health.hq}</strong>
              </div>
              <div class="stat">
                <span>Bizi-itxaropena:</span>
                <strong>{health.average_lifespan.toFixed(1)} y</strong>
              </div>
              <div class="stat">
                <span>Hilkortasuna:</span>
                <strong>{health.mortality_rate.toFixed(1)}%</strong>
              </div>
            </div>
          {/if}
        </section>
      </div>

      <footer class="modal-footer">
        <p>Datu historiala: Simulazioaren hasieratik gaur arte</p>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-content {
    width: 90%;
    max-width: 1600px;
    max-height: 85vh;
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(12, 23, 44, 0.92), rgba(8, 15, 30, 0.96));
    border: 1px solid rgba(139, 180, 220, 0.25);
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px) saturate(120%);
    padding: 32px;
    overflow-y: auto;
  }

  .modal-header {
    position: relative;
    margin-bottom: 32px;
  }

  .modal-header h1 {
    margin: 0 0 8px 0;
    font-size: 2rem;
    font-weight: 700;
    color: #f8fbff;
    letter-spacing: -0.5px;
  }

  .modal-header p {
    margin: 0;
    font-size: 0.95rem;
    color: rgba(200, 220, 255, 0.75);
  }

  .close-btn {
    position: absolute;
    top: -4px;
    right: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: rgba(200, 220, 255, 0.8);
    transition: color 0.2s ease;
  }

  .close-btn:hover {
    color: #fff;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 24px;
  }

  @media (max-width: 1200px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  .chart-section {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid rgba(139, 180, 220, 0.1);
  }

  .chart-section h2 {
    margin: 0 0 4px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: #eff5ff;
  }

  .subtitle {
    margin: 0 0 16px 0;
    font-size: 0.85rem;
    color: rgba(200, 220, 255, 0.6);
  }

  .chart {
    width: 100%;
    height: auto;
    min-height: 250px;
    margin-bottom: 16px;
  }

  .chart-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat {
    background: rgba(12, 25, 45, 0.4);
    border-radius: 8px;
    padding: 10px;
    font-size: 0.85rem;
  }

  .stat span {
    display: block;
    color: rgba(200, 220, 255, 0.7);
    margin-bottom: 3px;
  }

  .stat strong {
    display: block;
    font-size: 1.2rem;
    color: #f8fbff;
    font-weight: 700;
  }

  .stat strong.positive {
    color: #7fcc7f;
  }

  .modal-footer {
    text-align: center;
    padding-top: 20px;
    border-top: 1px solid rgba(139, 180, 220, 0.1);
    font-size: 0.8rem;
    color: rgba(200, 220, 255, 0.6);
  }

  .modal-footer p {
    margin: 0;
  }
</style>
