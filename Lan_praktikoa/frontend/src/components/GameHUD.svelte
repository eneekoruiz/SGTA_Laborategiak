<script lang="ts">
  import { formatMoney } from '../lib/utils/formatting';

  type AITurnViewerMode = 'panel' | 'split' | 'fullscreen';

  export let date: { year: number; month: number } = { year: 2050, month: 1 };
  export let population = 0;
  export let treasury = 0;
  export let score = 0;
  export let rci = { r: 0, c: 0, i: 0 };
  export let autoTickEnabled = false;
  export let savePending = false;
  export let isGameOver = false;
  export let bulldozerActive = false;
  export let showEmoticons = false;
  export let aiTurnViewerMode: AITurnViewerMode = 'split';
  export let onBack: () => void = () => {};
  export let onNextMonth: () => void = () => {};
  export let onSave: () => void = () => {};
  export let onToggleBulldozer: () => void = () => {};
  export let onToggleAutoTick: () => void = () => {};
  export let onToggleEmoticons: () => void = () => {};
  export let onAIModeChange: (mode: AITurnViewerMode) => void = () => {};

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function currency(n: number): string {
    return formatMoney(n);
  }

  function clampDemand(value: number): number {
    return Math.max(-200, Math.min(200, value));
  }

  function demandStyle(value: number): string {
    const safe = clampDemand(value);
    const magnitude = Math.abs(safe) / 200;
    return `height: ${Math.max(4, Math.round(magnitude * 100))}%;`;
  }

  function isPositive(value: number): boolean {
    return clampDemand(value) >= 0;
  }

  $: peakDemand = Math.max(Math.abs(clampDemand(rci.r)), Math.abs(clampDemand(rci.c)), Math.abs(clampDemand(rci.i))) >= 170;
</script>

<header class="hud-shell" class:game-over={isGameOver}>
  <button class="back-button control-chip" type="button" on:click={onBack} disabled={isGameOver}>Atzera</button>

  <div class="stats-strip" aria-label="Game HUD stats">
    <div class="metric date">
      <span>Data</span>
      <strong>{monthNames[date.month - 1]} {date.year}</strong>
    </div>
    <div class="metric">
      <span>Biztanleria</span>
      <strong class="mono">{currency(population)}</strong>
    </div>
    <div class="metric">
      <span>Altxorra</span>
      <strong class="mono">{currency(treasury)}</strong>
    </div>
    <div class="metric score">
      <span>Puntuazioa</span>
      <strong class="mono">{currency(score)}</strong>
    </div>
    <div class="metric rci" class:peak={peakDemand} aria-label="RCI Demand">
      <span>RCI</span>
      <div class="rci-bars" role="img" aria-label="RCI vertical demand bars">
        <div class="bar-col" title={`Residential demand: ${clampDemand(rci.r)}`}>
          <strong>R</strong>
          <div class="bar-track">
            <div class="axis"></div>
            <div class="bar r" class:pos={isPositive(rci.r)} class:neg={!isPositive(rci.r)} style={demandStyle(rci.r)}></div>
          </div>
        </div>
        <div class="bar-col" title={`Commercial demand: ${clampDemand(rci.c)}`}>
          <strong>C</strong>
          <div class="bar-track">
            <div class="axis"></div>
            <div class="bar c" class:pos={isPositive(rci.c)} class:neg={!isPositive(rci.c)} style={demandStyle(rci.c)}></div>
          </div>
        </div>
        <div class="bar-col" title={`Industrial demand: ${clampDemand(rci.i)}`}>
          <strong>I</strong>
          <div class="bar-track">
            <div class="axis"></div>
            <div class="bar i" class:pos={isPositive(rci.i)} class:neg={!isPositive(rci.i)} style={demandStyle(rci.i)}></div>
          </div>
        </div>
      </div>
      <div class="rci-nums mono">
        <span>R {rci.r}</span>
        <span>C {rci.c}</span>
        <span>I {rci.i}</span>
      </div>
    </div>
  </div>

  <div class="control-strip">
    <button class="control-chip toggle" type="button" on:click={onToggleEmoticons} disabled={isGameOver} aria-label="Emotikonoak piztu edo itzali">
      <span class="chip-icon" aria-hidden="true">☺</span>
      <span>Emotikonoak: {showEmoticons ? 'ON' : 'OFF'}</span>
    </button>

    <button class="control-chip toggle bulldozer" type="button" on:click={onToggleBulldozer} disabled={isGameOver} aria-label="Bulldozer toggle">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M4 16h10l2-4h4v4M7 16l-1 4m10-4 1 4M6 20h12" /></svg>
      <span>Bulldozer: {bulldozerActive ? 'ON' : 'OFF'}</span>
    </button>

    <div class="mode-switch" role="group" aria-label="AA turn viewer mode">
      <button class:active={aiTurnViewerMode === 'split'} type="button" on:click={() => onAIModeChange('split')} disabled={isGameOver}>Split</button>
      <button class:active={aiTurnViewerMode === 'fullscreen'} type="button" on:click={() => onAIModeChange('fullscreen')} disabled={isGameOver}>Fullscreen</button>
    </div>

    <button class="control-chip save" type="button" on:click={onSave} disabled={savePending || isGameOver}>
      {savePending ? 'Gordetzen...' : 'Gorde'}
    </button>

    <button class="control-chip next-month" type="button" on:click={onNextMonth} disabled={isGameOver}>
      Hilabetea amaitu
    </button>

    <button class="control-chip auto" type="button" class:active={autoTickEnabled} on:click={onToggleAutoTick} disabled={isGameOver}>
      Auto-Tick: {autoTickEnabled ? 'ON' : 'OFF'}
    </button>
  </div>
</header>

<style>
  .hud-shell {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 14px 16px;
    border-radius: 22px;
    background: linear-gradient(175deg, rgba(19, 24, 32, 0.66), rgba(19, 24, 32, 0.42));
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px) saturate(132%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 40px rgba(2, 8, 16, 0.34);
  }

  .back-button {
    min-width: 92px;
    justify-self: start;
  }

  .stats-strip {
    display: grid;
    grid-template-columns: minmax(112px, 1.1fr) minmax(112px, 0.9fr) minmax(112px, 0.9fr) minmax(112px, 0.9fr) minmax(172px, 1.2fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .metric {
    display: grid;
    gap: 2px;
    padding: 7px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 0;
  }

  .metric span,
  .rci > span {
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(218, 227, 240, 0.7);
  }

  .metric strong {
    font-size: 0.8rem;
    color: rgba(246, 250, 255, 0.98);
  }

  .mono {
    font-family: var(--font-mono);
    letter-spacing: 0.01em;
    font-weight: 520;
  }

  .rci {
    display: grid;
    gap: 4px;
  }

  .rci.peak {
    box-shadow: 0 0 0 1px rgba(140, 188, 255, 0.18), 0 0 16px rgba(123, 174, 255, 0.28);
  }

  .rci-bars {
    display: flex;
    align-items: flex-end;
    gap: 7px;
    height: 30px;
  }

  .bar-col {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-width: 11px;
  }

  .bar-col strong {
    font-size: 0.56rem;
    color: rgba(228, 236, 247, 0.82);
    font-weight: 700;
  }

  .bar-track {
    position: relative;
    width: 8px;
    height: 22px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .axis {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: rgba(231, 238, 248, 0.3);
    transform: translateY(-0.5px);
  }

  .bar {
    position: absolute;
    left: 0;
    right: 0;
    border-radius: 999px;
  }

  .bar.pos {
    bottom: 50%;
  }

  .bar.neg {
    top: 50%;
  }

  .r {
    stroke: #8ea88c;
    fill: #8ea88c;
    background: #8ea88c;
  }

  .c {
    stroke: #88a0b8;
    fill: #88a0b8;
    background: #88a0b8;
  }

  .i {
    stroke: #b69a63;
    fill: #b69a63;
    background: #b69a63;
  }

  .rci-nums {
    display: grid;
    gap: 2px;
    font-size: 0.56rem;
    color: rgba(228, 236, 247, 0.85);
  }

  .control-strip {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .control-chip,
  .mode-switch button {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(243, 248, 255, 0.95);
    border-radius: 999px;
    height: 34px;
    padding: 0 12px;
    cursor: pointer;
    transition: transform var(--dur-fast) var(--ease-standard), background-color var(--dur-mid) var(--ease-standard), border-color var(--dur-mid) var(--ease-standard), box-shadow var(--dur-mid) var(--ease-standard);
  }

  .control-chip:hover,
  .mode-switch button:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.14);
  }

  .control-chip:active,
  .mode-switch button:active {
    transform: translateY(0);
  }

  .control-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
  }

  .chip-icon {
    font-size: 0.92rem;
    line-height: 1;
  }

  .bulldozer svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .mode-switch {
    display: inline-flex;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .mode-switch button {
    border: 0;
    border-radius: 0;
    min-width: 90px;
    padding: 0 12px;
    background: transparent;
  }

  .mode-switch button.active {
    background: rgba(182, 154, 99, 0.86);
    color: #14243e;
    font-weight: 700;
  }

  .next-month {
    background: rgba(144, 188, 145, 0.12);
    border-color: rgba(144, 188, 145, 0.3);
    color: #b8e5ba;
    font-weight: 500;
    animation: pulse-glow 1.2s ease-in-out infinite;
  }

  .next-month:hover {
    background: rgba(144, 188, 145, 0.22);
    border-color: rgba(144, 188, 145, 0.5);
  }

  .save {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.4);
    color: #f5f8fc;
    font-weight: 600;
  }

  .save:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .auto.active {
    background: rgba(144, 188, 145, 0.2);
    color: #cbf1cf;
    box-shadow: 0 0 0 1px rgba(144, 188, 145, 0.16);
  }

  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(144, 188, 145, 0.3);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(144, 188, 145, 0.1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hud-shell,
    .control-chip,
    .mode-switch button {
      animation: none;
    }
  }
</style>
