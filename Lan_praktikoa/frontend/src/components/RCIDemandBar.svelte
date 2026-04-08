<script lang="ts">
  export let rci: { r: number; c: number; i: number } = { r: 0, c: 0, i: 0 };

  function clamp(value: number): number {
    return Math.max(-200, Math.min(200, value));
  }

  function heightPct(value: number): number {
    return Math.max(6, Math.round((Math.abs(clamp(value)) / 200) * 100));
  }

  function positive(value: number): boolean {
    return clamp(value) >= 0;
  }
</script>

<div class="rci-demand" aria-label="RCI demand bar">
  {#each [
    { key: 'R', value: rci.r, color: '#63d471' },
    { key: 'C', value: rci.c, color: '#5fa8ff' },
    { key: 'I', value: rci.i, color: '#f5d85d' }
  ] as item}
    <div class="col" title={`${item.key}: ${clamp(item.value)}`}>
      <span>{item.key}</span>
      <div class="track">
        <div class="axis"></div>
        <div
          class={`bar ${positive(item.value) ? 'up' : 'down'}`}
          style={`height:${heightPct(item.value)}%; background:${item.color};`}
        ></div>
      </div>
      <small>{clamp(item.value)}</small>
    </div>
  {/each}
</div>

<style>
  .rci-demand {
    display: inline-flex;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(10, 16, 24, 0.55);
    backdrop-filter: blur(10px);
  }

  .col {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-width: 18px;
  }

  .col span {
    font-size: 0.6rem;
    font-weight: 700;
    color: rgba(236, 244, 255, 0.92);
  }

  .track {
    position: relative;
    width: 10px;
    height: 36px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.09);
    overflow: hidden;
  }

  .axis {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.28);
  }

  .bar {
    position: absolute;
    left: 0;
    right: 0;
    border-radius: inherit;
  }

  .bar.up {
    bottom: 50%;
  }

  .bar.down {
    top: 50%;
  }

  .col small {
    font-size: 0.56rem;
    color: rgba(218, 229, 244, 0.82);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
</style>
