<script lang="ts">
  /**
   * MiniSparkline — Tiny trend visualization for shelf headers
   *
   * Shows last 12 months of a metric (tiny inline chart).
   * Used in RCI bar, HEZ/OSA shelf, etc.
   */

  export let data: number[] = [];
  export let label = '';
  export let color = '#4caf50';
  export let minHeight = 16; // px, for tiny chips on shelf

  const width = 48; // Very small
  const height = minHeight;
  const padding = 2;

  function sparklinePoints(): Array<{ x: number; y: number }> {
    if (data.length === 0) return [];
    if (data.length === 1) return [{ x: padding, y: height - padding }];

    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data.map((value, idx) => ({
      x: padding + (idx / (data.length - 1)) * innerW,
      y: height - padding - ((value - min) / range) * innerH
    }));
  }

  function sparklinePath(): string {
    const points = sparklinePoints();
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;

    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i].x},${points[i].y}`;
    }
    return d;
  }

  $: path = sparklinePath();
</script>

<span class="sparkline" title={label}>
  <svg {width} {height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
    <path d={path} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</span>

<style>
  .sparkline {
    display: inline-block;
    vertical-align: middle;
    margin-left: 6px;
    opacity: 0.82;
  }

  svg {
    width: 100%;
    height: 100%;
  }

  :global(.sparkline svg path) {
    vector-effect: non-scaling-stroke;
  }
</style>
