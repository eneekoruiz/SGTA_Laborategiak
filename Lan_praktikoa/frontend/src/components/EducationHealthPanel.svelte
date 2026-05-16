<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { EducationResponse, HealthResponse } from '../types/game';

  export let education: EducationResponse;
  export let health: HealthResponse;
  export let eqSeries: number[] = [];
  export let hqSeries: number[] = [];
  export let labels: string[] = [];
  export let fundingPct = 100;

  const dispatch = createEventDispatcher<{ fundingChange: { value: number } }>();

  const chartWidth = 760;
  const chartHeight = 220;
  const chartPaddingX = 26;
  const chartPaddingY = 24;

  function toPoints(values: number[]): Array<{ x: number; y: number }> {
    if (values.length === 0) return [];
    const innerW = chartWidth - chartPaddingX * 2;
    const innerH = chartHeight - chartPaddingY * 2;

    return values.map((value, index) => ({
      x: chartPaddingX + (index / Math.max(values.length - 1, 1)) * innerW,
      y: chartHeight - chartPaddingY - (value / 200) * innerH
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

  function areaPath(points: Array<{ x: number; y: number }>, line: string): string {
    if (!points.length || !line) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${line} L${last.x},${chartHeight - chartPaddingY} L${first.x},${chartHeight - chartPaddingY} Z`;
  }

  $: eqPoints = toPoints(eqSeries);
  $: hqPoints = toPoints(hqSeries);
  $: eqPath = splinePath(eqPoints);
  $: hqPath = splinePath(hqPoints);
  $: eqArea = areaPath(eqPoints, eqPath);
  $: hqArea = areaPath(hqPoints, hqPath);
  $: eqStatus = education.eq >= 120 ? 'Altua' : education.eq >= 95 ? 'Egonkorra' : 'Hauskorra';
  $: hqStatus = health.hq >= 110 ? 'Indartsua' : health.hq >= 90 ? 'Egonkorra' : 'Ahula';
  $: tickerItems = [
    `EDU // EQ ${Math.round(education.eq)} (${eqStatus})`,
    `OSASUNA // HQ ${Math.round(health.hq)} (${hqStatus})`,
    `BIZI-ITXAROPENA // ${health.average_lifespan.toFixed(1)} urte`,
    `INDUSTRIA // Goi-teknologia ${(education.effects.high_tech_industry_pct * 100).toFixed(0)}%`,
    `ARRISKUA // Kutsaduraren eragina ${health.pollution_health_impact}`,
    `HERRITAR // Krimen murrizketa ${education.effects.crime_reduction.toFixed(1)}`
  ];
  $: tickY = [0, 50, 100, 150, 200].map((value) => {
    const innerH = chartHeight - chartPaddingY * 2;
    return {
      value,
      y: chartHeight - chartPaddingY - (value / 200) * innerH
    };
  });

  function onFundingInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const value = Number(target.value);
    dispatch('fundingChange', { value });
  }
</script>

<section class="panel">
  <header class="topline">
    <h2>Hezkuntza &amp; Osasuna</h2>
    <p>Hezkuntza eta Osasun adierazleen monitorizazio operatiboa</p>
  </header>

  <div class="metrics-grid">
    <article>
      <h3>EQ</h3>
      <p class="value mono">{Math.round(education.eq)}</p>
      <p class="trend" class:up={education.eq_trend >= 0}>Joera: {education.eq_trend >= 0 ? '+' : ''}{education.eq_trend.toFixed(1)}</p>
    </article>
    <article>
      <h3>HQ</h3>
      <p class="value mono">{Math.round(health.hq)}</p>
      <p class="trend" class:up={health.hq_trend >= 0}>Joera: {health.hq_trend >= 0 ? '+' : ''}{health.hq_trend.toFixed(1)}</p>
    </article>
    <article>
      <h3>Bizi-itxaropena</h3>
      <p class="value mono">{health.average_lifespan.toFixed(1)} y</p>
      <p class="sub">Hilkortasuna: {health.mortality_rate.toFixed(1)}%</p>
    </article>
    <article>
      <h3>Teknologia handiko industria</h3>
      <p class="value mono">{(education.effects.high_tech_industry_pct * 100).toFixed(0)}%</p>
      <p class="sub">Krimen murrizketa: {education.effects.crime_reduction.toFixed(1)}</p>
    </article>
  </div>

  <div class="funding-card">
    <div class="funding-head">
      <h3>Finantzaketa biderkatzailea</h3>
      <p class="mono">{fundingPct}%</p>
    </div>
    <input
      type="range"
      min="60"
      max="140"
      step="1"
      value={fundingPct}
      on:input={onFundingInput}
      aria-label="Hezkuntza eta osasun finantzaketa"
    />
    <p class="sub">Finantzaketa handiagoak EQ/HQ joeren eguneraketa azkartzen du.</p>
  </div>

  <div class="chart-card">
    <h3>EQ / HQ azken 12 hilabeteak</h3>
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="EQ HQ joera grafikoa">
      <defs>
        <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#7f9a7e" />
          <stop offset="1" stop-color="#b1c2a3" />
        </linearGradient>
        <linearGradient id="hqStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#6f8ba7" />
          <stop offset="1" stop-color="#9cb2c4" />
        </linearGradient>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(126, 153, 121, 0.55)" />
          <stop offset="1" stop-color="rgba(126, 153, 121, 0)" />
        </linearGradient>
        <linearGradient id="hqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(114, 144, 171, 0.48)" />
          <stop offset="1" stop-color="rgba(114, 144, 171, 0)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="14" fill="rgba(12, 25, 45, 0.48)" />
      {#each tickY as t}
        <line
          x1={chartPaddingX}
          y1={t.y}
          x2={chartWidth - chartPaddingX}
          y2={t.y}
          stroke="rgba(255,255,255,0.08)"
          stroke-dasharray="3 9"
        />
      {/each}
      <line
        x1={chartPaddingX}
        y1={chartHeight - chartPaddingY}
        x2={chartWidth - chartPaddingX}
        y2={chartHeight - chartPaddingY}
        stroke="rgba(255,255,255,0.16)"
      />

      <path d={eqArea} fill="url(#eqFill)" />
      <path d={hqArea} fill="url(#hqFill)" />
      <path d={eqPath} fill="none" stroke="url(#eqStroke)" stroke-width="3.5" stroke-linecap="round" />
      <path d={hqPath} fill="none" stroke="url(#hqStroke)" stroke-width="3.5" stroke-linecap="round" />

      {#if eqPoints.length}
        <circle cx={eqPoints[eqPoints.length - 1].x} cy={eqPoints[eqPoints.length - 1].y} r="4.5" fill="#b7c5aa" />
      {/if}
      {#if hqPoints.length}
        <circle cx={hqPoints[hqPoints.length - 1].x} cy={hqPoints[hqPoints.length - 1].y} r="4.5" fill="#a6b9c8" />
      {/if}
    </svg>
    <div class="legend">
      <span><i class="eq"></i>EQ</span>
      <span><i class="hq"></i>HQ</span>
      <span>Azkena: {labels[labels.length - 1] ?? 'Orain'}</span>
    </div>
  </div>

  <div class="ticker" aria-label="Hezkuntza eta osasun tikerra">
    <div class="ticker-track">
      {#each [...tickerItems, ...tickerItems] as item}
        <span>{item}</span>
      {/each}
    </div>
  </div>

  <div class="tables">
    <article>
      <h3>Hezkuntza azpiegiturak</h3>
      <table>
        <thead>
          <tr>
            <th>Mota</th>
            <th>Kopurua</th>
            <th>Finantzaketa %</th>
            <th>Estaldura %</th>
          </tr>
        </thead>
        <tbody>
          {#each education.facilities as f}
            <tr>
              <td>{f.type}</td>
              <td>{f.count}</td>
              <td>{f.funding_pct}</td>
              <td>{f.coverage}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </article>

    <article>
      <h3>Osasun laburpena</h3>
      <ul>
        <li>Ospitaleak: {health.hospitals}</li>
        <li>Kutsaduraren eragina: {health.pollution_health_impact}</li>
        <li>Lurzoru balioaren hobaria (EQ): {education.effects.land_value_bonus.toFixed(1)}</li>
      </ul>
    </article>
  </div>
</section>

<style>
  .panel {
    margin-top: 12px;
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(12, 23, 44, 0.68), rgba(12, 23, 44, 0.56));
    padding: 16px;
    box-shadow: 0 22px 40px rgba(0, 9, 24, 0.32);
    backdrop-filter: blur(18px) saturate(105%);
  }

  .topline {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .topline p {
    margin: 0;
    font-size: 0.84rem;
    color: rgba(223, 233, 247, 0.78);
  }

  h2 {
    margin: 0;
    color: #f4f8ff;
    font-weight: 580;
    letter-spacing: 0.01em;
  }

  h3 {
    margin: 0 0 8px;
    color: #eff5ff;
    font-weight: 520;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .metrics-grid article {
    border-radius: 12px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
  }

  .value {
    font-size: 1.4rem;
    margin: 4px 0;
    font-weight: 700;
    color: #f8fbff;
  }

  .mono {
    font-family: var(--font-mono);
    letter-spacing: 0.01em;
  }

  .trend,
  .sub {
    margin: 0;
    color: rgba(218, 228, 243, 0.78);
    font-size: 0.84rem;
  }

  .up {
    color: #b8caa9;
  }

  .chart-card {
    margin-top: 12px;
    border-radius: 12px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
  }

  .funding-card {
    margin-top: 12px;
    border-radius: 12px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
  }

  .funding-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .funding-head p {
    margin: 0;
    font-size: 0.9rem;
    color: #eff4ff;
  }

  input[type='range'] {
    width: 100%;
    accent-color: #b69a63;
  }

  .ticker {
    margin-top: 10px;
    overflow: hidden;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    white-space: nowrap;
  }

  .ticker-track {
    display: inline-flex;
    align-items: center;
    gap: 28px;
    min-width: 100%;
    padding: 8px 12px;
    animation: ticker 36s linear infinite;
  }

  .ticker-track span {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    letter-spacing: 0.04em;
    color: rgba(232, 239, 249, 0.84);
  }

  svg {
    width: 100%;
    max-width: 100%;
    height: auto;
    display: block;
  }

  .legend {
    margin-top: 6px;
    display: flex;
    gap: 14px;
    color: rgba(223, 232, 246, 0.84);
    font-size: 0.82rem;
  }

  .legend i {
    width: 12px;
    height: 3px;
    display: inline-block;
    margin-right: 6px;
    vertical-align: middle;
  }

  .legend .eq {
    background: #93ab8b;
  }

  .legend .hq {
    background: #8da5ba;
  }

  .tables {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    text-align: left;
    padding: 8px;
    font-size: 0.86rem;
    color: #ecf3ff;
  }

  @keyframes ticker {
    0% {
      transform: translateX(0%);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  ul {
    margin: 0;
    padding-left: 18px;
    line-height: 1.7;
    color: #e5eefc;
  }

  @media (max-width: 980px) {
    .metrics-grid {
      grid-template-columns: 1fr 1fr;
    }

    .tables {
      grid-template-columns: 1fr;
    }
  }
</style>
