<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { GameState, StatsResponse, Tile } from '../types/game';

  import IsometricMap from './IsometricMap.Optimized.svelte';
  import { soundManager } from '../services/soundManager';

  interface AITurnAction {
    type: string;
    subType?: string;
    label: string;
    detail?: string;
  }

  export let open = false;
  export let mode: 'fullscreen' | 'split' | 'panel' = 'panel';
  export let actions: AITurnAction[] = [];
  export let reasoning = '';
  export let gameState: GameState | null = null;
  export let stats: StatsResponse | null = null;
  export let aiCityTiles: Tile[][] | null = null;
  export let aiActionsRaw: any[] = [];

  const dispatch = createEventDispatcher<{ close: void }>();
  let mappedTiles: Tile[][] = [];
  let focusTile: { x: number; y: number } | null = null;
  let markers: Array<{ x: number; y: number; color: string; label?: string }> = [];
  let activeActionIndex: number | null = null;

  function clampPct(value: number, max = 100): number {
    return Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  }

  function closeViewer(): void {
    dispatch('close');
  }



  $: {
    if (aiCityTiles) {
      // 1. Empezar con el grid base (usualmente hierba vacía si es el fallback)
      mappedTiles = JSON.parse(JSON.stringify(aiCityTiles));

      const aiCity = gameState?.ai_city;
      
      // 2. Estampar el estado PERMANENTE de la ciudad de la IA (zonas, edificios, infra)
      if (aiCity) {
        // Estampar Zonas
        if (aiCity.zones) {
          aiCity.zones.forEach(z => {
            const { x, y } = z.position;
            if (mappedTiles[y] && mappedTiles[y][x]) {
              mappedTiles[y][x].zone = { ...z };
              mappedTiles[y][x].surfaceEntity = { type: 'zone', value: z.type };
            }
          });
        }
        
        // Estampar Edificios
        if (aiCity.buildings) {
          aiCity.buildings.forEach(b => {
            const { x, y } = b.position;
            if (mappedTiles[y] && mappedTiles[y][x]) {
              mappedTiles[y][x].building = { ...b };
              mappedTiles[y][x].surfaceEntity = { type: 'building', value: b.type };
              mappedTiles[y][x].road_access = true;
            }
          });
        }

        // Estampar Infraestructura
        if (aiCity.infrastructure) {
            const infraMap = {
                roads: 'road',
                highways: 'highway',
                power_lines: 'power_line',
                rail: 'rail',
                water_pipes: 'water_pipe',
                subway: 'subway'
            };

            Object.entries(aiCity.infrastructure).forEach(([key, segments]) => {
                const type = infraMap[key as keyof typeof infraMap];
                if (!type || !Array.isArray(segments)) return;

                segments.forEach((seg: any) => {
                    const tiles = seg.tiles_covered || [];
                    tiles.forEach((p: any) => {
                        if (mappedTiles[p.y] && mappedTiles[p.y][p.x]) {
                            const tile = mappedTiles[p.y][p.x];
                            if (!Array.isArray(tile.infrastructure)) tile.infrastructure = [];
                            if (!tile.infrastructure.includes(type)) {
                                tile.infrastructure.push(type);
                            }
                            if (type === 'road' || type === 'highway') tile.road_access = true;
                            
                            // Actualizar entidad visual
                            if (['road', 'highway', 'rail', 'power_line'].includes(type)) {
                                tile.surfaceEntity = { type: 'infrastructure', value: type };
                            } else {
                                tile.undergroundEntity = { type: 'infrastructure', value: type };
                            }
                        }
                    });
                });
            });
        }
      }

      // 3. Estampar las ACCIONES DEL TURNO ACTUAL (vienen del aiActionsRaw)
      if (aiActionsRaw && Array.isArray(aiActionsRaw)) {
        for (let i = 0; i < aiActionsRaw.length; i++) {
          const action = aiActionsRaw[i];
          const pos = action.position || { x: action.x, y: action.y };
          if (!pos || pos.x === undefined || pos.y === undefined) continue;

          const { x, y } = pos;
          if (mappedTiles[y] && mappedTiles[y][x]) {
            const tile = mappedTiles[y][x];
            
            // CANDADO INVIOLABLE (SEGURIDAD IA)
            const targetTile = tile; 
            const isStructurePresent = !!(targetTile.building || targetTile.zone);
            const actionType = action.type || action.action_type;
            const actionIsInfrastructure = actionType === 'road' || actionType === 'infrastructure';

            // Bloqueo de asfalto sobre zonas/edificios
            if (isStructurePresent && actionIsInfrastructure) {
                console.error(`DETENIDO: La IA intentó asfaltar la zona/edificio en [${x}, ${y}]. Acción abortada.`);
                if (actions[i] && !actions[i].label.includes('Ezeztatua')) {
                    actions[i].label += " (Ezeztatua: Gainjartze debekatua)";
                }
                continue; 
            }

            // Validación de 'Destructive Actions': La IA no puede demoler estructuras
            if (actionType === 'demolish' && isStructurePresent) {
                console.error(`SEGURIDAD: Intento de demolición de la IA bloqueado en [${x}, ${y}].`);
                if (actions[i] && !actions[i].label.includes('Ezeztatua')) {
                    actions[i].label += " (Ezeztatua: Demolizio debekatua)";
                }
                continue;
            }

            // Bloqueo general de sobrescritura
            const isConstructionAction = ['zone', 'build', 'building', 'infrastructure'].includes(actionType);
            const isOccupied = isStructurePresent || (targetTile.infrastructure && targetTile.infrastructure.length > 0);

            if (isOccupied && isConstructionAction) {
                console.warn(`IA ignorada: Intento de sobrescribir el tile [${x}, ${y}] ocupado.`);
                if (actions[i] && !actions[i].label.includes('Ezeztatua')) {
                    actions[i].label += " (Ezeztatua: Lekua beteta)";
                }
                continue;
            }

            if (type === 'zone') {
              tile.zone = { 
                type: action.zone_type || action.mota || 'residential_light', 
                development_level: 1, 
                position: { x, y },
                size: { w: 1, h: 1 },
                abandoned: false, powered: true, watered: true, road_access: true
              };
              tile.surfaceEntity = { type: 'zone', value: tile.zone.type };
              soundManager.playSFX('zone');
            } else if (type === 'build' || type === 'building') {
              tile.building = { 
                  id: `ai-new-${x}-${y}`, 
                  type: action.building_type || action.mota || 'school', 
                  position: { x, y }, 
                  size: { w: 1, h: 1 }, 
                  powered: true, active: true 
              };
              tile.surfaceEntity = { type: 'building', value: tile.building.type };
              tile.road_access = true;
              soundManager.playSFX('build');
            } else if (type === 'infrastructure') {
              const infraType = action.infrastructure_type || action.infra_type || 'road';
              if (!Array.isArray(tile.infrastructure)) tile.infrastructure = [];
              if (!tile.infrastructure.includes(infraType)) tile.infrastructure.push(infraType);
              tile.surfaceEntity = { type: 'infrastructure', value: infraType };
              tile.road_access = true;
              soundManager.playSFX('infrastructure');
            }
          }
        }
      }
      
      // 4. Generate Markers for current turn
      if (aiActionsRaw && Array.isArray(aiActionsRaw)) {
        markers = aiActionsRaw.map((action, i) => {
          const pos = action.position || { x: action.x, y: action.y };
          return {
            x: pos.x,
            y: pos.y,
            color: getIndicatorColor({ type: action.type || action.action_type, subType: action.zone_type || action.building_type || action.infrastructure_type }),
            label: (i + 1).toString()
          };
        }).filter(m => m.x !== undefined && m.y !== undefined);
      } else {
        markers = [];
      }
      
      console.log("🟢 MAPA DE LA IA RECONSTRUIDO CON ÉXITO");
    } else {
        mappedTiles = aiCityTiles ?? [];
        markers = [];
    }
  }

  function handleActionClick(action: any, index: number): void {
    const rawAction = aiActionsRaw[index];
    if (rawAction) {
      const pos = rawAction.position || { x: rawAction.x, y: rawAction.y };
      if (pos && pos.x !== undefined) {
        focusTile = { x: pos.x, y: pos.y };
        activeActionIndex = index;
        soundManager.playSFX('click');
      }
    }
  }

  onMount(() => {
    if (mode === 'fullscreen' && aiCityTiles) {
      const event = new CustomEvent('map-init', { detail: { mode: 'fullscreen' } });
      document.dispatchEvent(event);
    }
  });

  function getIndicatorColor(action: any) {
    const type = action.type;
    const sub = (action.subType || '').toLowerCase();
    
    if (type === 'zone') {
      if (sub.includes('residential')) return '#4ade80'; // Green
      if (sub.includes('commercial')) return '#60a5fa'; // Blue
      if (sub.includes('industrial')) return '#facc15'; // Yellow/Orange
    }
    if (type === 'infrastructure') {
      if (sub.includes('road') || sub.includes('highway')) return '#94a3b8'; // Slate/Gray
      if (sub.includes('water')) return '#3b82f6'; // Blue
      if (sub.includes('power')) return '#eab308'; // Amber/Yellow
    }
    if (type === 'build') return '#f87171'; // Red
    if (type === 'attack') return '#ef4444'; // Bright Red
    return 'rgba(255, 255, 255, 0.15)';
  }
</script>

{#if open}
  <div class={`replay ${mode}`} role="region" aria-label="AA hiria">
    <header class="topbar">
      <div>
        <p>IA-ren Hiria</p>
        <h3>Hilabete Amaiera</h3>
      </div>
      <button on:click={closeViewer}>Itxi</button>
    </header>

    <div class="layout" class:compare-mode={mode !== 'panel'}>
      {#if mode !== 'panel'}
        <section class="panel city-state">
          <h4>Jokalariaren hiriaren egoera</h4>
          <div class="city-grid">
            <article>
              <span class="card-label">Biztanleria</span>
              <strong>{stats?.player.population ?? gameState?.player_city.population ?? 0}</strong>
            </article>
            <article>
              <span class="card-label">Altxorra</span>
              <strong>§ {Math.floor(stats?.player.treasury ?? gameState?.player_city.treasury ?? 0)}</strong>
            </article>
            <article>
              <span class="card-label">Puntuazioa</span>
              <strong>{Math.round(stats?.player.composite_score ?? gameState?.player_city.metrics.composite_score ?? 0)}</strong>
            </article>
            <article>
              <span class="card-label">Onarpena</span>
              <strong>{Math.round(stats?.player.approval ?? gameState?.player_city.metrics.approval ?? 0)}%</strong>
            </article>
          </div>

          <div class="city-meters">
            <div class="meter-row">
              <span>Energia</span>
              <div class="meter"><div class="fill power" style={`width: ${clampPct(stats?.player.power_coverage ?? gameState?.player_city.power_grid.coverage_pct ?? 0)}%`}></div></div>
              <span>{Math.round(stats?.player.power_coverage ?? gameState?.player_city.power_grid.coverage_pct ?? 0)}%</span>
            </div>
            <div class="meter-row">
              <span>Ura</span>
              <div class="meter"><div class="fill water" style={`width: ${clampPct(stats?.player.water_coverage ?? gameState?.player_city.water_system.coverage_pct ?? 0)}%`}></div></div>
              <span>{Math.round(stats?.player.water_coverage ?? gameState?.player_city.water_system.coverage_pct ?? 0)}%</span>
            </div>
            <div class="meter-row">
              <span>Krimena</span>
              <div class="meter"><div class="fill crime" style={`width: ${clampPct(stats?.player.crime_rate ?? gameState?.player_city.metrics.crime_rate ?? 0)}%`}></div></div>
              <span>{Math.round(stats?.player.crime_rate ?? gameState?.player_city.metrics.crime_rate ?? 0)}%</span>
            </div>
          </div>
        </section>
      {/if}

      {#if mode === 'fullscreen' && aiCityTiles}
        <section class="panel replay-map-panel">
          <div class="map-container">
            <IsometricMap
              tiles={mappedTiles}
              mapWidth={aiCityTiles[0]?.length || 64}
              mapHeight={aiCityTiles.length || 64}
              tileWidth={96}
              tileHeight={48}
              inputLocked={false} 
              showInfrastructure={true}
              showZones={true}
              {markers}
              {focusTile}
            />
          </div>
        </section>
      {/if}

      <aside class="panel summary">
        <h4>AA ekintzen jarioa</h4>
        {#if actions.length > 0}
         <div class="log-container">
            {#each actions as action}
              {#if action.type === 'time'}
                <div class="feed-header">
                  {action.label}
                </div>
              {:else}
                <article 
                  class="log-entry" 
                  class:active={activeActionIndex === (actions.indexOf(action) - 1)}
                  style={`--indicator: ${getIndicatorColor(action)}`}
                  on:click={() => handleActionClick(action, actions.indexOf(action) - 1)}
                >
                  <div class="type-indicator"></div>
                  <div class="entry-index">{actions.indexOf(action)}</div>
                  <div class="entry-body">
                    <div class="entry-main">
                      <span class="entry-label">{action.label}</span>
                      <span class="entry-badge">{action.subType || action.type}</span>
                    </div>
                    {#if action.detail}
                      <span class="entry-detail">{action.detail}</span>
                    {/if}
                  </div>
                  <button class="view-btn">Ikusi</button>
                </article>
              {/if}
            {/each}
          </div>
        {:else}
          <p>Ez dago ekintzarik erakusteko.</p>
        {/if}

        <h4>Txandaren laburpena</h4>
        <p>{reasoning || 'Ez dago txanda honetarako arrazoiketa erabilgarririk.'}</p>
        <div class="meta">
          <span>{actions.length} ekintza</span>
        </div>
      </aside>
    </div>
  </div>
{/if}

<style>
  .replay {
    position: fixed;
    z-index: 36;
    display: grid;
    gap: 16px;
    padding: 14px;
    border-radius: 20px;
    background: radial-gradient(circle at top, rgba(136, 160, 184, 0.15), transparent 28%), rgba(6, 12, 22, 0.92);
    backdrop-filter: blur(14px) saturate(120%);
    color: rgba(243, 248, 255, 0.96);
    border: 1px solid rgba(248, 252, 255, 0.12);
    box-shadow: 0 24px 48px rgba(2, 9, 20, 0.28);
  }

  .replay.fullscreen {
    top: 0;
    left: 0;
    transform: none;
    bottom: 0;
    right: 0;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    max-width: 100vw;
    border-radius: 0;
    z-index: 9999;
  }

  .topbar,
  .panel {
    border: 1px solid rgba(248, 252, 255, 0.12);
    background: rgba(13, 24, 42, 0.62);
    box-shadow: 0 24px 48px rgba(2, 9, 20, 0.24);
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 18px;
    padding: 14px 16px;
  }

  .topbar p,
  .topbar h3 {
    margin: 0;
  }

  .topbar p {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.7rem;
    color: rgba(218, 227, 240, 0.68);
  }

  .topbar h3 {
    font-size: 1rem;
  }

  .topbar button {
    border: 0;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    padding: 10px 12px;
    font: inherit;
    cursor: pointer;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    min-height: 0;
    flex: 1;
  }

  .city-state {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .replay.fullscreen .city-state {
    display: none;
  }

  .city-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .city-grid article {
    display: grid;
    gap: 3px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .city-grid .card-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(218, 227, 240, 0.7);
  }

  .city-grid strong {
    font-size: 0.95rem;
  }

  .city-meters {
    display: grid;
    gap: 8px;
  }

  .meter-row {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: rgba(233, 241, 252, 0.86);
  }

  .meter {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .meter .fill {
    height: 100%;
  }

  .meter .fill.power {
    background: #b9c087;
  }

  .meter .fill.water {
    background: #8ab8d3;
  }

  .meter .fill.crime {
    background: #d79a9a;
  }

  .panel {
    border-radius: 20px;
    padding: 16px;
    min-height: 0;
  }

  .replay-map-panel {
    grid-column: 1 / -1;
    min-height: 70vh;
    height: 70vh;
    padding: 0;
    overflow: hidden;
    display: block !important;
    visibility: visible !important;
  }

  .map-container {
    width: 100%;
    height: 70vh;
    min-height: 70vh;
    background: #1a2635;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    visibility: visible !important;
    contain: content;
  }

  .map-container :global(canvas) {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain;
    transform: scale(1.1);
    transform-origin: center center;
    opacity: 1 !important;
    visibility: visible !important;
  }

  .map-container :global(.map-shell) {
    width: 100% !important;
    height: 100% !important;
    opacity: 1 !important;
    visibility: visible !important;
  }

  .summary {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .summary h4 {
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: rgba(218, 227, 240, 0.72);
    margin: 0;
  }

  .summary p {
    color: rgba(233, 241, 252, 0.78);
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .log-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 380px;
    overflow-y: auto;
    padding-right: 8px;
    margin-bottom: 16px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .log-container::-webkit-scrollbar {
    width: 4px;
  }

  .log-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }

  .log-entry {
    display: flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    overflow: hidden;
    transition: background 0.2s ease;
    flex-shrink: 0;
  }

  .log-entry:hover, .log-entry.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(100, 180, 255, 0.3);
    transform: translateX(4px);
  }

  .entry-index {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    font-size: 0.65rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.3);
    border-right: 1px solid rgba(255, 255, 255, 0.05);
  }

  .log-entry.active .entry-index {
    color: var(--accent, #60a5fa);
  }

  .view-btn {
    opacity: 0;
    background: rgba(100, 180, 255, 0.2);
    border: none;
    color: #60a5fa;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0 12px;
    text-transform: uppercase;
    transition: all 0.2s;
    cursor: pointer;
  }

  .log-entry:hover .view-btn {
    opacity: 1;
  }

  .type-indicator {
    width: 4px;
    background: var(--indicator);
    flex-shrink: 0;
  }

  .entry-body {
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-grow: 1;
  }

  .entry-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .entry-label {
    font-size: 0.88rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.95);
    line-height: 1.4;
  }

  .entry-badge {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
  }

  .entry-detail {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.45);
    font-family: monospace;
  }

  .feed-header {
    margin: 20px 0 10px;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--accent);
    text-align: center;
    background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.04), transparent);
    padding: 8px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .meta span {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 0.8rem;
    color: rgba(233, 241, 252, 0.78);
  }

  @media (max-width: 980px) {
    .replay.fullscreen {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      bottom: auto;
      right: auto;
      width: calc(100vw - 24px);
      max-height: 80vh;
    }

    .layout {
      grid-template-columns: 1fr;
    }

    .city-grid {
      grid-template-columns: 1fr;
    }
  }
</style>