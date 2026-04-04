<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let date: { year: number; month: number } = { year: 2050, month: 1 };
  export let population = 0;
  export let treasury = 0;
  export let score = 0;
  export let rci = { r: 0, c: 0, i: 0 };
  export let speed: 'normal' | 'fast' | 'instant' = 'normal';
  export let onSpeedChange: (next: 'normal' | 'fast' | 'instant') => void = () => {};

  const dispatch = createEventDispatcher<{ menu: { panel: string } }>();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function currency(n: number): string {
    return new Intl.NumberFormat('eu-ES', { maximumFractionDigits: 0 }).format(n);
  }

  function openPanel(panel: string): void {
    dispatch('menu', { panel });
  }

  function rciPath(value: number, idx: number): string {
    const safe = Math.max(-100, Math.min(100, value));
    const x = 18 + idx * 18;
    const y0 = 26;
    const y1 = y0 - safe * 0.17;
    return `M${x},${y0} C${x + 3},${(y0 + y1) / 2} ${x + 5},${y1} ${x + 8},${y1}`;
  }
</script>

<header class="hud">
  <div class="stats">
    <div class="metric"><span>Date</span><strong>{monthNames[date.month - 1]} {date.year}</strong></div>
    <div class="metric"><span>Population</span><strong class="mono">{currency(population)}</strong></div>
    <div class="metric"><span>Treasury</span><strong class="mono">§ {currency(treasury)}</strong></div>
    <div class="metric"><span>Score</span><strong class="mono">{currency(score)}</strong></div>
  </div>

  <div class="rci" aria-label="RCI Demand">
    <svg viewBox="0 0 70 32" role="img" aria-label="RCI sparkline">
      <line x1="14" y1="26" x2="64" y2="26" />
      <path class="r" d={rciPath(rci.r, 0)} />
      <path class="c" d={rciPath(rci.c, 1)} />
      <path class="i" d={rciPath(rci.i, 2)} />
      <circle cx="18" cy={26 - (Math.max(-100, Math.min(100, rci.r)) * 0.17)} r="1.5" class="r" />
      <circle cx="36" cy={26 - (Math.max(-100, Math.min(100, rci.c)) * 0.17)} r="1.5" class="c" />
      <circle cx="54" cy={26 - (Math.max(-100, Math.min(100, rci.i)) * 0.17)} r="1.5" class="i" />
    </svg>
    <div class="rci-nums mono">
      <span>R {rci.r}</span>
      <span>C {rci.c}</span>
      <span>I {rci.i}</span>
    </div>
  </div>

  <div class="actions">
    <div class="speed" aria-label="AA Turn Speed">
      <button class:active={speed === 'normal'} on:click={() => onSpeedChange('normal')}>Normal</button>
      <button class:active={speed === 'fast'} on:click={() => onSpeedChange('fast')}>Fast</button>
      <button class:active={speed === 'instant'} on:click={() => onSpeedChange('instant')}>Instant</button>
    </div>
    <div class="menu-icons">
      <button aria-label="Budget" on:click={() => openPanel('budget')}>$</button>
      <button aria-label="Ordinances" on:click={() => openPanel('ordinance')}>O</button>
      <button aria-label="Rival City" on:click={() => openPanel('rival')}>R</button>
      <button aria-label="Disaster" on:click={() => openPanel('disaster')}>D</button>
      <button aria-label="Education and Health" on:click={() => openPanel('edu-health')}>EH</button>
    </div>
  </div>
</header>

<style>
  .hud {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: 12px;
    width: min(1320px, calc(100vw - 32px));
    padding: 8px 10px;
    border-radius: 16px;
    background: linear-gradient(170deg, rgba(17, 31, 53, 0.76), rgba(13, 24, 42, 0.68));
    border: 1px solid rgba(248, 252, 255, 0.16);
    backdrop-filter: blur(24px) saturate(110%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 18px 56px rgba(2, 9, 20, 0.42);
  }

  .stats {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .metric {
    display: grid;
    gap: 1px;
    padding: 6px 9px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
  }

  .metric span {
    font-size: 0.64rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: rgba(218, 227, 240, 0.7);
  }

  .metric strong {
    font-size: 0.83rem;
    color: rgba(246, 250, 255, 0.98);
  }

  .mono {
    font-family: var(--font-mono);
    letter-spacing: 0.01em;
    font-weight: 520;
  }

  .rci {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.035);
  }

  svg {
    width: 76px;
    height: 30px;
  }

  svg line {
    stroke: rgba(231, 238, 248, 0.28);
    stroke-width: 1;
  }

  svg path {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .r {
    stroke: #8ea88c;
    fill: #8ea88c;
  }

  .c {
    stroke: #88a0b8;
    fill: #88a0b8;
  }

  .i {
    stroke: #b69a63;
    fill: #b69a63;
  }

  .rci-nums {
    display: grid;
    gap: 2px;
    font-size: 0.68rem;
    color: rgba(228, 236, 247, 0.85);
  }

  .actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    border: 0;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(243, 248, 255, 0.95);
    border-radius: 9px;
    height: 32px;
    padding: 0 11px;
    cursor: pointer;
    transition: transform 180ms ease, background-color 180ms ease;
  }

  button:hover {
    transform: scale(1.03);
    background: rgba(255, 255, 255, 0.14);
  }

  .speed {
    display: inline-flex;
    border-radius: 9px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.06);
  }

  .speed button {
    border: 0;
    border-radius: 0;
    min-width: 64px;
    height: 32px;
    font-size: 0.76rem;
  }

  .speed button.active {
    background: rgba(182, 154, 99, 0.86);
    color: #14243e;
    font-weight: 600;
  }

  .menu-icons {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .menu-icons button {
    width: 34px;
    padding: 0;
    font-size: 0.72rem;
    letter-spacing: 0.02em;
  }

  @media (max-width: 980px) {
    .hud {
      grid-template-columns: 1fr;
      width: calc(100vw - 24px);
    }

    .stats {
      flex-wrap: wrap;
    }

    .actions {
      justify-content: space-between;
      width: 100%;
    }
  }
</style>
