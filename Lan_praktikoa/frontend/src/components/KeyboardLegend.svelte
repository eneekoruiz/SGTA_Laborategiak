<script lang="ts">
  import { fade } from 'svelte/transition';

  let isExpanded = true;
  
  // Draggable state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelLeft = 20;
  let panelTop = 100;
  let hasMoved = false;

  const shortcuts = [
    { key: 'R', action: 'Mapa biratu (90°)' },
    { key: 'U', action: 'Lurpeko/Gaine bista' },
    { key: 'Space', action: 'Mugitu (Pan) eutsi' },
    { key: 'B', action: 'Eraitsi (Bulldozer)' },
    { key: 'Esc', action: 'Utzi tresna' },
    { key: 'Ctrl + P', action: 'Erendimendu-metra' },
    { key: 'Alt + K', action: 'Trikimailu Kontsola' }
  ];

  function toggleExpand(): void {
    if (hasMoved) {
      hasMoved = false;
      return;
    }
    isExpanded = !isExpanded;
  }

  function handleMouseLeave(): void {
    if (!isDragging) {
      isExpanded = false;
    }
  }

  function onDragStart(e: MouseEvent): void {
    isDragging = true;
    hasMoved = false;
    dragStartX = e.clientX - panelLeft;
    dragStartY = e.clientY - panelTop;
    
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    e.preventDefault();
    e.stopPropagation();
  }

  function onDragMove(e: MouseEvent): void {
    if (!isDragging) return;
    hasMoved = true;
    
    panelLeft = Math.max(0, e.clientX - dragStartX);
    panelTop = Math.max(0, e.clientY - dragStartY);
    
    // Keep panel within viewport bounds
    const panelWidth = 240;
    const panelHeight = 250;
    panelLeft = Math.min(window.innerWidth - panelWidth, Math.max(0, panelLeft));
    panelTop = Math.min(window.innerHeight - panelHeight, Math.max(0, panelTop));
  }

  function onDragEnd(): void {
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }
</script>

<div 
  class="keyboard-legend" 
  role="region" 
  aria-label="Teklatu-lasterbideak" 
  on:mouseenter={() => (isExpanded = true)} 
  on:mouseleave={handleMouseLeave}
  style="left: {panelLeft}px; top: {panelTop}px;"
>
  <button 
    class="legend-pill" 
    class:dragging={isDragging}
    on:mousedown={onDragStart} 
    on:click={toggleExpand} 
    aria-label="Teklatu-lasterbideak"
  >
    <span class="icon">⌨</span>
    {#if isExpanded}
      <span class="label">Lasterbideak</span>
    {/if}
  </button>

  {#if isExpanded}
    <div class="legend-panel" in:fade={{ duration: 180 }}>
      <div class="panel-header" on:mousedown={onDragStart}>
        <div class="legend-title">Teklatu-lasterbideak</div>
        <div class="drag-handle">⠿</div>
      </div>
      <div class="legend-grid">
        {#each shortcuts as shortcut, idx}
          <div class="shortcut-item">
            <kbd class="key">{shortcut.key}</kbd>
            <span class="action">{shortcut.action}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .keyboard-legend {
    position: fixed;
    top: 72px;
    left: 16px;
    z-index: 100;
    font-family: inherit;
    transition: none;
  }

  .legend-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(15, 25, 40, 0.5);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    color: rgba(180, 220, 255, 0.85);
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .legend-pill:hover, .legend-pill.dragging {
    border-color: rgba(120, 220, 255, 0.5);
    background: rgba(20, 35, 55, 0.65);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15), 0 8px 20px rgba(100, 180, 255, 0.15);
  }

  .legend-pill.dragging {
    cursor: grabbing;
    transform: scale(0.96);
  }

  .icon {
    font-size: 1.1rem;
  }

  .label {
    font-weight: 500;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .legend-panel {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 12px;
    padding: 0;
    width: auto;
    min-width: 220px;
    border-radius: 14px;
    border: 1px solid rgba(100, 200, 255, 0.3);
    background: linear-gradient(135deg, rgba(12, 20, 32, 0.92), rgba(18, 32, 50, 0.88));
    backdrop-filter: blur(20px) saturate(160%);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    cursor: grab;
    user-select: none;
    border-bottom: 1px solid rgba(100, 180, 255, 0.2);
    transition: background 0.2s;
  }

  .panel-header:hover {
    background: rgba(100, 180, 255, 0.05);
  }

  .panel-header:active {
    cursor: grabbing;
  }

  .drag-handle {
    font-size: 1rem;
    color: rgba(180, 220, 255, 0.5);
    opacity: 0.7;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  .panel-header:hover .drag-handle {
    opacity: 1;
    color: rgba(180, 220, 255, 0.8);
  }

  .legend-title {
    font-size: 0.68rem;
    font-weight: 600;
    color: rgba(180, 220, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    pointer-events: none;
  }

  .legend-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 10px 16px 14px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.7rem;
  }

  .key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid rgba(100, 200, 255, 0.5);
    background: linear-gradient(180deg, rgba(100, 180, 255, 0.25), rgba(80, 160, 255, 0.1));
    color: rgba(220, 240, 255, 0.95);
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.65rem;
    font-weight: 500;
    text-align: center;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1);
  }

  .action {
    color: rgba(180, 220, 255, 0.8);
    font-weight: 400;
  }
</style>
