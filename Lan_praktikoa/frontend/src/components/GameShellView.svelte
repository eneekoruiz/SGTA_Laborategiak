<!--
  GameShell owns the live city session.

  Data flow:
  - On mount, it loads the canonical GameState and Stats through SimHiriAPI.
  - It writes authoritative updates into the shared Svelte stores.
  - Child UI events from the map and dock are translated into API calls.
  - Store subscriptions keep the shell, HUD, overlays, and modals synchronized.

  This is the SPECS-aligned game-shell boundary: routing stays in AppRouter/App.svelte,
  while gameplay orchestration, modal state, and replay handling stay here.
-->
<script lang="ts">
  /**
   * GameShell is the gameplay orchestration boundary.
   *
   * Why:
   * - Centralize state transitions and side effects in one SPECS-facing place.
   * - Keep routing entrypoints (`AppRouter`, `App`) minimal and stable.
   *
   * How:
   * - Loads canonical `GameState`/`Stats` through SimHiriAPI.
   * - Pushes authoritative updates into shared Svelte stores.
   * - Maps map/HUD/modal user events to API commands and replay handlers.
   * - Renders UI components from store-backed state, preserving single data flow.
   */
  import { onDestroy, onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade, slide } from 'svelte/transition';
  import IsometricMap from './IsometricMap.Optimized.svelte';
  import GameHUD from './GameHUD.svelte';
  import BudgetPanel from './BudgetPanel.svelte';
  import DataOverlaySelector from './DataOverlaySelector.svelte';
  import DisasterPanel from './DisasterPanel.svelte';
  import AITurnViewer from './AITurnViewer.svelte';
  import NewspaperModal from './NewspaperModal.svelte';
  import EducationHealthPanel from './EducationHealthPanel.svelte';
  import RivalCityView from './RivalCityView.svelte';
  import PerformanceMeter from './PerformanceMeter.svelte';
  import KeyboardLegend from './KeyboardLegend.svelte';
  import CheatConsole from './CheatConsole.svelte';
  import VictoryResultsModal from './VictoryResultsModal.svelte';
  import { SimHiriAPI as apiService } from '../services/apiService';
  import { navigate } from '../services/router';
  import * as gameStore from '../store/game';
  import { soundManager } from '../services/soundManager';
  import { fetchGameConstants, gameConstants } from '../store/gameConstants';

  import { gameSpeed, setGameSpeed, setOverlayStrength } from '../store/ui';
  import {
    clearNotification as dismissStoredNotification,
    cheatConsoleOpen,
    notifications as notificationsStore,
    pushNotification as pushStoredNotification,
    toggleCheatConsole,
    type NotificationPriority,
    type UINotification
  } from '../store/ui';
  import type {
    AITurnAction,
    BuildingType,
    EducationResponse,
    GameState,
    HealthResponse,
    InfrastructureType,
    StatsResponse,
    Tile,
    ZoneType,
    Size
  } from '../types/game';

  type ToolMode = 'zone' | 'infrastructure' | 'building' | null;
  type InfraGroup = 'roads' | 'water' | 'power' | 'transit';
  type ShelfType = 'zones' | 'roads' | 'buildings' | 'budget' | 'stats' | 'eduhealth' | 'rival' | 'newspaper' | null;
  type InfraTypedPoint = { x: number; y: number; type: InfrastructureType };

  let loading = true;
  let error = '';

  let gameId = 'game-001';
  let gameState: GameState | null = null;
  let stats: StatsResponse | null = null;
  let liveTiles: Tile[][] = [];

  $: currentTreasury = stats?.player.treasury ?? gameState?.player_city?.treasury ?? 0;

  let selectedZone: ZoneType | null = null;
  let selectedInfra: InfrastructureType | null = null;
  let selectedBuilding: BuildingType | null = null;
  let toolMode: ToolMode = null;
  let bulldozerActive = false;

  let undergroundMode = false;
  let showStatusIcons = false;
  let activeOverlay: string | null = null;
  let overlayStrength = 72;
  let aiFocusTile: { x: number; y: number; zoom?: number } | null = null;

  let activeShelf: ShelfType = null;
  let activeInfraGroup: InfraGroup = 'roads';

  let endMonthPending = false;
  let savePending = false;
  let resultsVisible = false;
  let gameOverMessage = '';
  let autoAdvance = false;
  let autoAdvanceTimer: ReturnType<typeof setInterval> | null = null;

  let notifications: UINotification[] = [];
  let silentAIDotCount = 0;
  let showPerfMeter = false;
  let aiTurnViewerOpen = false;
  let aiTurnViewerMode: 'panel' | 'split' | 'fullscreen' = 'split';
  let aiTurnViewerActions: Array<{ type: string; label: string; detail?: string }> = [];
  let aiTurnViewerRawActions: any[] = [];
  let aiTurnViewerReasoning = '';
  let aiViewMode: 'player' | 'ai_full' | 'ai_split' = 'player';
  let aiCityTiles: Tile[][] | null = null;
  let newspaperOpen = false;
  let educationMetrics: EducationResponse | null = null;
  let healthMetrics: HealthResponse | null = null;
  let eduHealthFundingPct = 100;
  let eqSeries: number[] = [];
  let hqSeries: number[] = [];
  let eduHealthLabels: string[] = [];
  const buildingPlacementPending = new Set<string>();
  let isActionPending = false;
  let unsubscribeGameState: (() => void) | null = null;
  let unsubscribeStats: (() => void) | null = null;
  let unsubscribeNotifications: (() => void) | null = null;
  let unsubscribeMetricHistory: (() => void) | null = null;
  let metricHistory: gameStore.MetricHistoryPoint[] = [];
  let populationHistory: number[] = [];
  let treasuryHistory: number[] = [];
  let rciHistory: Array<{ r: number; c: number; i: number }> = [];
  const dirtyTileKeys = new Set<string>();
  
  // Mutual exclusivity: tool selection vs data overlays
  $: if (activeOverlay) {
    clearToolSelection();
    bulldozerActive = false;
    activeShelf = null;
  }

  function buildingCostFor(type: BuildingType | null): number {
    if (!type) return 0;
    const entry = buildingTools.find((tool) => tool.value === type) ?? serviceBuildingTools.find((tool) => tool.value === type);
    return entry?.cost ?? 1000;
  }

  /**
   * Check if player can afford a given cost.
   * Uses gameState treasury as the source of truth.
   */
  function canAfford(cost: number): boolean {
    return currentTreasury >= cost;
  }

  function mapAiTurnActions(actions: AITurnAction[]): Array<{ type: string; label: string; detail?: string }> {
    return actions.map((action) => {
      const { x, y } = action.position || { x: 0, y: 0 };
      const posText = action.position ? `[${x}, ${y}]` : '';
      
      let label = action.description || '';
      
      if (!label) {
        switch (action.action_type) {
          case 'zone':
            label = `Gune berria (Mota: ${action.zone_type ?? 'zehaztu gabe'}) ezarri da ${posText} koordenatuetan.`;
            break;
          case 'build':
            const bType = (action.building_type as string) ?? 'zehaztu gabe';
            label = `Eraikin berria (${bType.replace(/_/g, ' ')}) eraiki da ${posText} koordenatuetan.`;
            break;
          case 'infrastructure':
            const iType = action.infrastructure_type || 'road';
            if (iType === 'road' || iType === 'highway') {
              label = `Errepidea eraiki da ${posText} koordenatuetan.`;
            } else {
              label = `Azpiegitura (${iType.replace(/_/g, ' ')}) eraiki da ${posText} koordenatuetan.`;
            }
            break;
          case 'attack':
            label = `Erasoa: ${action.disaster_type ?? 'hondamendia'} jaurti da.`;
            break;
          case 'wait':
            label = 'Itxaroten...';
            break;
          default:
            label = `${action.action_type} ekintza burutu da.`;
        }
      }

      return {
        type: action.action_type,
        subType: action.zone_type || action.infrastructure_type || action.building_type || action.disaster_type,
        label,
        detail: action.position ? `(${x}, ${y})` : undefined,
        position: action.position
      };
    });
  }

  // Reactive state for map interaction locking
  $: inputLocked = Boolean(isGameOver || endMonthPending || savePending || isActionPending);

  // Debug lock state to console to identify stuck states
  $: if (inputLocked) {
    // Log removed for performance
  }

  function isRuinTile(tile: Tile | null): boolean {
    return tile?.building?.type === 'ruin';
  }

  $: zoneTools = [
    { label: 'Erresidentzial arina', value: 'residential_light', accent: '#6fd98f', cost: $gameConstants?.ZONE_COSTS?.residential_light ?? 5 },
    { label: 'Erresidentzial trinkoa', value: 'residential_dense', accent: '#44b26a', cost: $gameConstants?.ZONE_COSTS?.residential_dense ?? 10 },
    { label: 'Komertzial arina', value: 'commercial_light', accent: '#57a7ff', cost: $gameConstants?.ZONE_COSTS?.commercial_light ?? 5 },
    { label: 'Komertzial trinkoa', value: 'commercial_dense', accent: '#3489e5', cost: $gameConstants?.ZONE_COSTS?.commercial_dense ?? 10 },
    { label: 'Industrial arina', value: 'industrial_light', accent: '#e3d360', cost: $gameConstants?.ZONE_COSTS?.industrial_light ?? 5 },
    { label: 'Industrial trinkoa', value: 'industrial_dense', accent: '#c7b849', cost: $gameConstants?.ZONE_COSTS?.industrial_dense ?? 10 }
  ];

  $: ZONE_COST_MAP = $gameConstants?.ZONE_COSTS ?? {};

  const infraGroups: Record<InfraGroup, Array<{ label: string; value: InfrastructureType }>> = {
    roads: [
      { label: 'Errepidea', value: 'road' },
      { label: 'Autobidea', value: 'highway' },
      { label: 'Autobide sarbidea', value: 'highway_ramp' }
    ],
    water: [
      { label: 'Ur-hodia', value: 'water_pipe' },
      { label: 'Metro tunela', value: 'subway_tunnel' }
    ],
    power: [{ label: 'Energia linea', value: 'power_line' }],
    transit: [{ label: 'Trenbidea', value: 'rail' }]
  };

  $: buildingTools = [
    // Module 8 Core: Education & Health
    { label: 'Eskola', value: 'school', cost: $gameConstants?.BUILDING_COSTS?.school ?? 250 },
    { label: 'Unibertsitatea', value: 'college', cost: $gameConstants?.BUILDING_COSTS?.college ?? 1000 },
    { label: 'Liburutegia', value: 'library', cost: $gameConstants?.BUILDING_COSTS?.library ?? 500 },
    { label: 'Museoa', value: 'museum', cost: $gameConstants?.BUILDING_COSTS?.museum ?? 1000 },
    { label: 'Ospitalea', value: 'hospital', cost: $gameConstants?.BUILDING_COSTS?.hospital ?? 500 },
    
    // Public Safety
    { label: 'Polizia etxea', value: 'police_station', cost: $gameConstants?.BUILDING_COSTS?.police_station ?? 500 },
    { label: 'Suhiltzaile etxea', value: 'fire_station', cost: $gameConstants?.BUILDING_COSTS?.fire_station ?? 500 },
    { label: 'Espetxea', value: 'prison', cost: $gameConstants?.BUILDING_COSTS?.prison ?? 3000 },
    
    // Power Plants
    { label: 'Ikatz zentrala', value: 'coal_power', cost: $gameConstants?.BUILDING_COSTS?.coal_power ?? 4000 },
    { label: 'Petrolio zentrala', value: 'oil_power', cost: $gameConstants?.BUILDING_COSTS?.oil_power ?? 6500 },
    { label: 'Gas zentrala', value: 'gas_power', cost: $gameConstants?.BUILDING_COSTS?.gas_power ?? 2000 },
    { label: 'Zentral nuklearra', value: 'nuclear_power', cost: $gameConstants?.BUILDING_COSTS?.nuclear_power ?? 15000 },
    { label: 'Zentral eolikoa', value: 'wind_power', cost: $gameConstants?.BUILDING_COSTS?.wind_power ?? 100 },
    { label: 'Eguzki zentrala', value: 'solar_power', cost: $gameConstants?.BUILDING_COSTS?.solar_power ?? 1300 },
    { label: 'Zentral hidroelektrikoa', value: 'hydro_power', cost: $gameConstants?.BUILDING_COSTS?.hydro_power ?? 400 },
    { label: 'Mikrouhin zentrala', value: 'microwave_power', cost: $gameConstants?.BUILDING_COSTS?.microwave_power ?? 28000 },
    { label: 'Fusio zentrala', value: 'fusion_power', cost: $gameConstants?.BUILDING_COSTS?.fusion_power ?? 40000 },
    
    // Utilities
    { label: 'Ur-ponpa', value: 'water_pump', cost: $gameConstants?.BUILDING_COSTS?.water_pump ?? 100 },
    { label: 'Araztegia', value: 'water_treatment', cost: $gameConstants?.BUILDING_COSTS?.water_treatment ?? 500 },
    
    // Transport
    { label: 'Autobus depot', value: 'bus_depot', cost: $gameConstants?.BUILDING_COSTS?.bus_depot ?? 250 },
    { label: 'Tren geltokia', value: 'rail_station', cost: $gameConstants?.BUILDING_COSTS?.rail_station ?? 500 },
    { label: 'Metro geltokia', value: 'subway_station', cost: $gameConstants?.BUILDING_COSTS?.subway_station ?? 500 },
    { label: 'Aireportua', value: 'airport', cost: $gameConstants?.BUILDING_COSTS?.airport ?? 10000 },
    { label: 'Portua', value: 'seaport', cost: $gameConstants?.BUILDING_COSTS?.seaport ?? 5000 },
    
    // Arcologies
    { label: 'Plymouth Arc.', value: 'arcology_plymouth', cost: $gameConstants?.BUILDING_COSTS?.arcology_plymouth ?? 100000 },
    { label: 'Darco Arc.', value: 'arcology_darco', cost: $gameConstants?.BUILDING_COSTS?.arcology_darco ?? 150000 },
    { label: 'Launch Arc.', value: 'arcology_launch', cost: $gameConstants?.BUILDING_COSTS?.arcology_launch ?? 200000 }
  ];

  const overlayTools = [
    { id: 'crime', label: 'Krimena' },
    { id: 'pollution_air', label: 'Aire-kutsadura' },
    { id: 'pollution_water', label: 'Ur-kutsadura' },
    { id: 'land_value', label: 'Lurraren balioa' },
    { id: 'traffic', label: 'Trafikoa' },
    { id: 'power', label: 'Energia' },
    { id: 'water', label: 'Ura' },
    { id: 'fire_coverage', label: 'Sute-estaldura' },
    { id: 'police_coverage', label: 'Polizia-estaldura' }
  ];

  const SURFACE_INFRA_TYPES = new Set<InfrastructureType>(['road', 'highway', 'highway_ramp', 'power_line', 'rail']);
  const UNDERGROUND_INFRA_TYPES = new Set<InfrastructureType>(['water_pipe', 'subway', 'subway_tunnel']);

  const bottomDockLeftItems: Array<{ id: Exclude<ShelfType, null>; label: string }> = [
    { id: 'zones', label: 'Zonak' },
    { id: 'roads', label: 'Azpiegiturak' },
    { id: 'buildings', label: 'Eraikinak' }
  ];

  const bottomDockRightItems: Array<{ id: Exclude<ShelfType, null>; label: string }> = [
    { id: 'budget', label: 'Aurrekontua' },
    { id: 'eduhealth', label: 'Hezk. / Osasuna' },
    { id: 'rival', label: 'AA aurkaria' },
    { id: 'newspaper', label: 'Egunkaria' }
  ];

  $: serviceBuildingTools = [
    // Public Safety (SPECS.md)
    { label: 'Polizia etxea', value: 'police_station', cost: $gameConstants?.BUILDING_COSTS?.police_station ?? 500 },
    { label: 'Suhiltzaile etxea', value: 'fire_station', cost: $gameConstants?.BUILDING_COSTS?.fire_station ?? 500 },
    // Module 8: Education & Health services
    { label: 'Ospitalea', value: 'hospital', cost: $gameConstants?.BUILDING_COSTS?.hospital ?? 500 },
    { label: 'Eskola', value: 'school', cost: $gameConstants?.BUILDING_COSTS?.school ?? 250 }
  ];

  /**
   * Optimized tile cloning: only clones the top-level array and rows.
   * Does NOT deeply clone every tile object unless necessary.
   * Also ensures basic entity slots are initialized if missing.
   */
  function cloneTiles(data: Tile[][]): Tile[][] {
    if (!data) return [];
    return data.map((row) => [...row]);
  }

  /**
   * Surgical tile update: only clones affected rows and the top-level array.
   * Prevents re-rendering the whole map in Svelte.
   */
  function patchLiveTiles(updates: Array<{ x: number; y: number; tile: Tile }>): void {
    if (updates.length === 0) return;
    
    const nextTiles = [...liveTiles];
    const modifiedRows = new Set<number>();

    for (const { x, y, tile } of updates) {
      if (!nextTiles[y]) continue;
      if (!modifiedRows.has(y)) {
        nextTiles[y] = [...nextTiles[y]];
        modifiedRows.add(y);
      }
      nextTiles[y][x] = tile;
    }
    liveTiles = nextTiles;
  }

  function generateFallbackAiCityTiles(size: number = 64): Tile[][] {
    // Generate a 64x64 grid of empty grass tiles for AI replay fallback
    const tiles: Tile[][] = [];
    for (let y = 0; y < size; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < size; x++) {
        row.push({
          x,
          y,
          elevation: 0,
          terrain_type: 'grass',
          zone: null,
          building: null,
          infrastructure: [],
          tree: false,
          powered: false,
          watered: false,
          road_access: false,
          pollution_air: 0,
          pollution_water: 0,
          crime: 0,
          land_value: 0,
          surfaceEntity: null,
          undergroundEntity: null
        });
      }
      tiles.push(row);
    }
    return tiles;
  }

  function tileKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  function markDirtyTiles(points: Array<{ x: number; y: number }>): void {
    for (const point of points) {
      dirtyTileKeys.add(tileKey(point.x, point.y));
    }
  }

  function clearDirtyTiles(points: Array<{ x: number; y: number }>): void {
    for (const point of points) {
      dirtyTileKeys.delete(tileKey(point.x, point.y));
    }
  }

  /**
   * Optimized merge: O(dirtyTileKeys.size) instead of O(N^2).
   * Only merges tiles that are explicitly marked as dirty (optimistic).
   */
  function mergeTilesPreservingDirty(nextTiles: Tile[][]): Tile[][] {
    if (dirtyTileKeys.size === 0) return [...nextTiles];

    const merged = [...nextTiles];
    const modifiedRows = new Set<number>();

    for (const key of dirtyTileKeys) {
      const [x, y] = key.split(':').map(Number);
      if (merged[y] && liveTiles[y]?.[x]) {
        if (!modifiedRows.has(y)) {
          merged[y] = [...merged[y]];
          modifiedRows.add(y);
        }
        merged[y][x] = liveTiles[y][x];
      }
    }
    return merged;
  }

  function releaseDirtyTiles(points: Array<{ x: number; y: number }>): void {
    clearDirtyTiles(points);
    if (!gameState?.map?.tiles) return;
    liveTiles = mergeTilesPreservingDirty(gameState.map.tiles);
  }

  function syncAutoAdvanceTimer(): void {
    if (autoAdvanceTimer !== null) {
      clearInterval(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    if (!autoAdvance || isGameOver) return;

    const speedIntervals: Record<'normal' | 'fast' | 'instant', number> = {
      normal: 10000,
      fast: 5000,
      instant: 1500
    };

    autoAdvanceTimer = window.setInterval(() => {
      void endMonth();
    }, speedIntervals[$gameSpeed]);
  }

  function setHudSpeedMode(mode: 'manual' | 'normal' | 'fast'): void {
    if (mode === 'manual') {
      autoAdvance = false;
      syncAutoAdvanceTimer();
      return;
    }

    autoAdvance = true;
    setGameSpeed(mode === 'normal' ? 'normal' : 'fast');
    syncAutoAdvanceTimer();
  }

  function tileAt(point: { x: number; y: number }): Tile | null {
    if (!liveTiles[point.y] || !liveTiles[point.y][point.x]) return null;
    return liveTiles[point.y][point.x];
  }

  function isSurfaceOccupied(tile: Tile | null): boolean {
    if (!tile) return false;
    const infra = Array.isArray(tile.infrastructure) ? tile.infrastructure : [];
    return Boolean(tile.building || tile.zone || infra.some((i) => SURFACE_INFRA_TYPES.has(i)));
  }

  function pushNotification(
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    expanded = false,
    options?: { dragOperation?: boolean; isError?: boolean }
  ): void {
    if (priority === 'low') {
      silentAIDotCount += 1;
      return;
    }

    pushStoredNotification(
      { title, message, priority, expanded },
      {
        dragOperation: options?.dragOperation ?? false,
        isError:
          options?.isError ??
          (priority === 'high' || /failed|error|blocked/i.test(title))
      }
    );
  }

  function clearNotification(id: number): void {
    dismissStoredNotification(id);
  }

  function toggleExpandNotification(id: number): void {
    notifications = notifications.map((entry) =>
      entry.id === id ? { ...entry, expanded: !entry.expanded } : entry
    );
  }

  function clearToolSelection(): void {
    selectedZone = null;
    selectedInfra = null;
    selectedBuilding = null;
    toolMode = null;
  }

  function activeToolText(): string | null {
    if (!hasPersistentTool()) return null;

    let base = '';
    let toolLabel = '';

    if (bulldozerActive) {
      base = 'Bulldozerra';
      if (selectedBuilding) {
        const b = [...buildingTools, ...serviceBuildingTools].find(t => t.value === selectedBuilding);
        toolLabel = b ? b.label : selectedBuilding;
      } else if (selectedInfra) {
        let found: any = null;
        Object.values(infraGroups).forEach(g => { if(!found) found = g.find(i => i.value === selectedInfra); });
        toolLabel = found ? found.label : selectedInfra;
      } else if (selectedZone) {
        const z = zoneTools.find(t => t.value === selectedZone);
        toolLabel = z ? z.label : selectedZone;
      }
      return toolLabel ? `${base} + ${toolLabel}` : base;
    }

    if (selectedBuilding) {
      const b = [...buildingTools, ...serviceBuildingTools].find(t => t.value === selectedBuilding);
      return `Eraiki: ${b ? b.label : selectedBuilding}`;
    }
    if (selectedInfra) {
      let found: any = null;
      Object.values(infraGroups).forEach(g => { if(!found) found = g.find(i => i.value === selectedInfra); });
      return `Azpiegitura: ${found ? found.label : selectedInfra}`;
    }
    if (selectedZone) {
      const z = zoneTools.find(t => t.value === selectedZone);
      return `Zona: ${z ? z.label : selectedZone}`;
    }
    return null;
  }

  function hasPersistentTool(): boolean {
    return Boolean(selectedZone || selectedInfra || selectedBuilding || bulldozerActive);
  }

  function isDockItemActive(item: Exclude<ShelfType, null>): boolean {
    if (activeShelf === item) return true;
    if (item === 'zones') return selectedZone !== null;
    if (item === 'roads') return selectedInfra !== null;
    if (item === 'buildings') return selectedBuilding !== null;
    return false;
  }

  function metricPct(value: number, min: number, max: number): number {
    if (max <= min) return 0;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  }

  function cityMoodEmoji(): string {
    const approval = stats?.player.approval ?? gameState?.player_city.metrics.approval ?? 50;
    const crime = stats?.player.crime_rate ?? gameState?.player_city.metrics.crime_rate ?? 0;
    const pollution = stats?.player.pollution ?? gameState?.player_city.metrics.pollution ?? 0;

    if (approval >= 75 && crime < 28 && pollution < 35) return '😁';
    if (approval >= 60 && crime < 40 && pollution < 50) return '😊';
    if (approval >= 45) return '😐';
    if (approval >= 30 || crime > 55 || pollution > 62) return '😟';
    return '😡';
  }

  function sparklinePoints(values: number[], width = 164, height = 34): string {
    if (values.length === 0) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    return values
      .map((value, idx) => {
        const x = values.length === 1 ? width / 2 : (idx / (values.length - 1)) * width;
        const y = height - ((value - min) / span) * height;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  function cycleInfraTool(): void {
    if (!selectedInfra) return;
    const groups = Object.values(infraGroups).flat();
    const values = groups.map((entry) => entry.value);
    const idx = values.findIndex((entry) => entry === selectedInfra);
    if (idx < 0) return;
    const next = values[(idx + 1) % values.length];
    chooseInfrastructure(next);
  }

  function enableInfraBulldozer(): void {
    if (!selectedInfra) return;
    bulldozerActive = true;
    clearToolSelection(); // Ensure mutual exclusivity
    activeShelf = null;
  }

  function closeActiveToolPanel(): void {
    bulldozerActive = false;
    clearToolSelection();
  }

  function chooseZone(zone: ZoneType): void {
    if (isGameOver) return;
    selectedZone = selectedZone === zone ? null : zone;
    selectedInfra = null;
    selectedBuilding = null;
    bulldozerActive = false; // Deselect bulldozer when building
    toolMode = selectedZone ? 'zone' : null;
    if (selectedZone) activeShelf = null;
  }

  function chooseInfrastructure(infra: InfrastructureType): void {
    if (isGameOver) return;
    selectedInfra = selectedInfra === infra ? null : infra;
    selectedZone = null;
    selectedBuilding = null;
    bulldozerActive = false; // Deselect bulldozer when building
    toolMode = selectedInfra ? 'infrastructure' : null;
    
    const underground = infra === 'water_pipe' || infra === 'subway_tunnel';
    if (underground !== undergroundMode) undergroundMode = underground;
    if (selectedInfra) activeShelf = null;
  }

  function toggleBulldozer(): void {
    if (isGameOver) return;
    bulldozerActive = !bulldozerActive;
    if (bulldozerActive) {
      clearToolSelection(); // Deselect construction tools when demolishing
    }
  }

  function chooseBuilding(building: BuildingType): void {
    if (isGameOver) return;
    selectedBuilding = selectedBuilding === building ? null : building;
    selectedZone = null;
    selectedInfra = null;
    bulldozerActive = false; // Deselect bulldozer when building
    toolMode = selectedBuilding ? 'building' : null;
    if (selectedBuilding) activeShelf = null;
  }

  function openShelf(shelf: Exclude<ShelfType, null>): void {
    if (isGameOver) return;
    if (shelf === 'newspaper') {
      newspaperOpen = true;
      activeShelf = null;
      return;
    }
    activeShelf = activeShelf === shelf ? null : shelf;
    if (shelf === 'roads') {
      activeInfraGroup = 'roads';
    }
    if (shelf === 'rival') {
      silentAIDotCount = 0;
    }
    if (shelf === 'eduhealth') {
      void refreshEducationHealth();
    }
  }

  function appendEduHealthHistoryPoint(education: EducationResponse, health: HealthResponse): void {
    const date = gameState?.current_date;
    const label = date
      ? `${String(date.month).padStart(2, '0')}/${date.year}`
      : `T${eduHealthLabels.length + 1}`;

    if (eduHealthLabels.length > 0 && eduHealthLabels[eduHealthLabels.length - 1] === label) {
      eqSeries = [...eqSeries.slice(0, -1), education.eq];
      hqSeries = [...hqSeries.slice(0, -1), health.hq];
      return;
    }

    eqSeries = [...eqSeries, education.eq].slice(-12);
    hqSeries = [...hqSeries, health.hq].slice(-12);
    eduHealthLabels = [...eduHealthLabels, label].slice(-12);
  }

  async function refreshEducationHealth(): Promise<void> {
    try {
      const [education, health] = await Promise.all([apiService.getEducation(gameId), apiService.getHealth(gameId)]);
      educationMetrics = education;
      healthMetrics = health;
      gameStore.setEducation(education);
      gameStore.setHealth(health);
      appendEduHealthHistoryPoint(education, health);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Hezkuntza eta osasun datuak ezin izan dira freskatu';
      pushNotification('Hezk./Osasun errorea', message, 'medium');
    }
  }

  async function handleEduHealthFundingChange(event: CustomEvent<{ value: number }>): Promise<void> {
    if (!gameState) return;
    const nextFunding = Math.max(0, Math.min(120, Math.round(event.detail.value)));
    eduHealthFundingPct = nextFunding;

    const currentFunding = gameState.player_city.budget.funding;
    try {
      const result = await apiService.updateBudget(gameId, undefined, {
        ...currentFunding,
        education: nextFunding,
        health: nextFunding
      });

      if (result.success && result.game_state) {
        gameStore.setGameState(result.game_state);
      }

      await refreshEducationHealth();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Hezkuntza/Osasun finantzaketa ezin izan da eguneratu';
      pushNotification('Finantzaketa errorea', message, 'medium');
    }
  }

  function resolveDemolishCategory(rawType: string): 'zone' | 'building' | 'infrastructure' {
    if (SURFACE_INFRA_TYPES.has(rawType as InfrastructureType) || UNDERGROUND_INFRA_TYPES.has(rawType as InfrastructureType)) {
      return 'infrastructure';
    }

    if (rawType.startsWith('residential_') || rawType.startsWith('commercial_') || rawType.startsWith('industrial_')) {
      return 'zone';
    }

    return 'building';
  }

  async function saveGame(): Promise<void> {
    if (savePending || inputLocked) return;
    savePending = true;
    try {
      await apiService.saveGame(gameId);
      pushNotification('Gordeta', 'Partidaren egoera ondo gorde da.', 'medium');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ezin izan da partida gorde';
      pushNotification('Gordetze errorea', message, 'high', true);
    } finally {
      savePending = false;
      isActionPending = false;
    }
  }

  async function endMonth(): Promise<void> {
    if (endMonthPending || inputLocked || isGameOver) return;
    endMonthPending = true;

    try {
      const result = await apiService.endMonth(gameId);
      
      // CRITICAL: Backend returns {success, message, data: {game_state, ...}}
      // Extract game_state from data wrapper
      const gameStateFromResponse = result.data?.game_state || result.game_state;
      
      if (result.success && gameStateFromResponse) {
        gameStore.setGameState(gameStateFromResponse);
      }

      const maybeStats = (result as unknown as { stats?: StatsResponse }).stats;
      if (maybeStats) {
        stats = maybeStats;
      } else {
        stats = await apiService.getStats(gameId);
      }
      if (stats) {
        gameStore.setStats(stats);
      }
      await refreshEducationHealth();

      gameStore.setAiTurn(result.data?.ai_turn ?? result.ai_turn ?? null);

      const shouldReplayAiActions = Boolean(result.data?.ai_turn?.requires_client_replay || result.ai_turn?.requires_client_replay);
      const replayActions = Array.isArray(result.data?.ai_turn?.actions)
        ? (result.data.ai_turn.actions as AITurnAction[])
        : Array.isArray(result.ai_turn?.actions)
          ? (result.ai_turn.actions as AITurnAction[])
          : [];

      if (shouldReplayAiActions && replayActions.length > 0) {
        await apiService.executeAiTurnActions(gameId, replayActions);
        const [postReplayGame, postReplayStats] = await Promise.all([
          apiService.getGame(gameId),
          apiService.getStats(gameId)
        ]);
        gameStore.setGameState(postReplayGame.game_state);
        gameStore.setStats(postReplayStats);
      }

      if (result.data?.victory_check?.status === 'player_bankrupt' || result.victory_check?.status === 'player_bankrupt') {
        pushNotification('Porrota', 'Altxorra -100,000 azpitik egon da 12 hilabetez jarraian. Administrazioa desegin da.', 'high', true);
      }

      const aiTurnData = result.data?.ai_turn ?? result.ai_turn;
      const aiActions = Array.isArray(aiTurnData?.actions) ? aiTurnData.actions.length : 0;
      const aiReasoning = typeof aiTurnData?.reasoning === 'string' ? aiTurnData.reasoning : '';
      aiTurnViewerReasoning = aiReasoning;
      
      const newActions = Array.isArray(aiTurnData?.actions)
        ? mapAiTurnActions(aiTurnData.actions as AITurnAction[])
        : [];
      
      if (newActions.length > 0) {
        const monthHeader = {
          type: 'time',
          label: `--- ${gameState?.current_date.year}/${gameState?.current_date.month} txanda ---`,
          detail: 'Denbora zigilua'
        };
        aiTurnViewerActions = [monthHeader, ...newActions, ...aiTurnViewerActions].slice(0, 500);
      }
      
      // Set fullscreen mode for cinematic AI replay
      const rawActions = Array.isArray(aiTurnData?.actions) ? aiTurnData.actions : [];
      aiTurnViewerRawActions = rawActions;
      
      if (rawActions.length > 0) {
        aiTurnViewerOpen = true;
        aiTurnViewerMode = 'fullscreen';
        aiViewMode = 'ai_full';
      } else {
        aiTurnViewerOpen = aiTurnViewerReasoning.length > 0;
        aiViewMode = 'player';
      }
      
      // Get AI city tiles or generate fallback if not available
      const aiCityTilesFromResponse = gameStateFromResponse?.ai_city?.map?.tiles;
      aiCityTiles = aiCityTilesFromResponse && aiCityTilesFromResponse.length > 0 
        ? aiCityTilesFromResponse 
        : generateFallbackAiCityTiles(64);

      // Debug: Log AI city data for troubleshooting
      // Logs removed for performance

      // Replay state removed as per decision to eliminate spectator mode

      // Open newspaper on new year (month 1)
      const newDate = gameStateFromResponse?.current_date || gameState?.current_date;
      if (newDate?.month === 1) {
        newspaperOpen = true;
      }

      pushNotification(
        'AA txanda osatuta',
        aiActions > 0 ? `${aiActions} AA ekintza exekutatu dira.` : 'AAk txanda osatu du.',
        'low'
      );

      if (aiReasoning) {
        pushNotification('Aholkulariaren mezua', aiReasoning.slice(0, 140), 'medium');
      }

      const focusCandidate = aiTurnData?.actions?.find(
        (action: { position?: { x: number; y: number } }) =>
          action?.position && typeof action.position.x === 'number' && typeof action.position.y === 'number'
      );
      if (focusCandidate?.position) {
        aiFocusTile = { x: focusCandidate.position.x, y: focusCandidate.position.y, zoom: 1.3 };
      }

      await refreshEducationHealth();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ezin izan da hilabetea amaitu';
      pushNotification('Simulazio errorea', message, 'high', true);
    } finally {
      endMonthPending = false;
      isActionPending = false;
    }
  }

  async function handleBuildingPlacement(event: CustomEvent<{ x: number; y: number }>): Promise<void> {
    if (!selectedBuilding || !gameState || inputLocked || isGameOver) return;
    isActionPending = true;

    const { x, y } = event.detail;
    const key = `${x}:${y}`;
    if (buildingPlacementPending.has(key)) return;

    const cost = buildingCostFor(selectedBuilding);
    if (currentTreasury < cost) {
      pushNotification('Blokeatuta', 'Ez dago altxor nahikorik eraikin honetarako.', 'high', true);
      soundManager.playSFX('error');
      return;
    }

    const tile = tileAt({ x, y });
    if (isRuinTile(tile)) {
      pushNotification('Eraikuntza blokeatuta', 'Hondakinak Bulldozerrarekin garbitu behar dira berreraiki aurretik.', 'high', true);
      soundManager.playSFX('error');
      return;
    }
    if (!bulldozerActive && isSurfaceOccupied(tile)) {
      pushNotification('Eraikuntza blokeatuta', 'Azaleko laukia okupatuta dago. Aktibatu Bulldozer ordezkatzeko.', 'medium');
      soundManager.playSFX('error');
      return;
    }

    const previousTile = tile
      ? {
          ...tile,
          infrastructure: Array.isArray(tile.infrastructure) ? [...tile.infrastructure] : [],
          zone: tile.zone
            ? {
                ...tile.zone,
                position: { ...tile.zone.position },
                size: { ...tile.zone.size }
              }
            : null,
          building: tile.building
            ? {
                ...tile.building,
                position: { ...tile.building.position },
                size: { ...tile.building.size }
              }
            : null,
          surfaceEntity: tile.surfaceEntity ? { ...tile.surfaceEntity } : null,
          undergroundEntity: tile.undergroundEntity ? { ...tile.undergroundEntity } : null
        }
      : null;

    if (tile) {
      const now = new Date();
      // Create a fresh tile object for the optimistic update
      const updatedTile = {
        ...tile,
        infrastructure: Array.isArray(tile.infrastructure) ? [...tile.infrastructure] : [],
        zone: null,
        building: {
          id: `optimistic-${x}-${y}-${now.getTime()}`,
          type: selectedBuilding,
          position: { x, y },
          size: { w: 1, h: 1 },
          built_year: now.getFullYear(),
          built_month: now.getMonth() + 1,
          age_months: 0,
          powered: tile.powered,
          funding_pct: 100,
          active: true
        },
        surfaceEntity: { type: 'building', value: selectedBuilding }
      };

      markDirtyTiles([{ x, y }]);
      soundManager.playSFX('build');
      
      // FORCED REACTIVITY: Directly mutate the row and reassign the main array 
      // reference to force Svelte to trigger a map redraw instantly.
      if (liveTiles[y]) {
        liveTiles[y][x] = updatedTile;
        liveTiles[y] = [...liveTiles[y]];
        liveTiles = [...liveTiles]; // CRITICAL REACTIVITY TRIGGER
      }

      // OPTIMISTIC TREASURY UPDATE: Deduct the cost immediately in the UI.
      // We update both gameState and stats because different UI components might read from either.
      gameStore.deductTreasury(cost);
      
      if (gameState) {
        gameState.player_city.treasury -= cost;
        gameState = { ...gameState }; 
      }

      if (stats) {
        // Stats is often the source for the top-bar HUD
        stats.player.treasury -= cost;
        stats = { ...stats };
        gameStore.setStats(stats); // Force store update to notify HUD
      }
    }

    buildingPlacementPending.add(key);
    try {
      const bSize = selectedBuilding.startsWith('arcology_') ? { w: 4, h: 4 } : { w: 1, h: 1 };
      const result = await apiService.placeBuilding(gameId, selectedBuilding, { x, y }, bSize);
      
      if (result.success) {
        // Rehydrate from server state — never trust local mutation
        const nextState = result.game_state || (await apiService.getGame(gameId)).game_state;
        
        // Authoritative update: Sync store and local variable immediately
        gameStore.setGameState(nextState);
        gameState = nextState;
        
        // Authoritative stats update
        const freshStats = await apiService.getStats(gameId);
        stats = freshStats;
        gameStore.setStats(freshStats); // CRITICAL: Notify HUD of final balance
        
        // Force an immediate sync of liveTiles from the authoritative state.
        // The reassignment below is critical to force Svelte's redraw.
        clearDirtyTiles([{ x, y }]);
        liveTiles = [...nextState.map.tiles]; // CRITICAL REACTIVITY TRIGGER

        // Auto-save after placement
        await apiService.saveGame(gameId).catch(() => {});
      }
    } catch (e) {
      // Rollback optimistic UI
      if (previousTile) {
        patchLiveTiles([{ x, y, tile: previousTile }]);
      }

      // Detect budget-related errors and show a clean notification
      const errorMessage = e instanceof Error ? e.message : '';
      const isBudgetError = errorMessage.includes('diru nahikorik') ||
                            errorMessage.includes('Diru nahikoa ez') ||
                            errorMessage.includes('Ez dago diru') ||
                            (e as any)?.statusCode === 400;

      if (isBudgetError) {
        const cost = buildingCostFor(selectedBuilding);
        pushNotification(
          'Ez dago diru nahikorik',
          `Eraikin honek §${cost.toLocaleString()} kostatzen du, baina §${currentTreasury.toLocaleString()} dituzu.`,
          'high',
          true
        );
      } else {
        const message = e instanceof Error ? e.message : 'Ezin izan da eraikina kokatu';
        pushNotification('Eraikuntza errorea', message, 'high', true);
      }
      soundManager.playSFX('error');
    } finally {
      releaseDirtyTiles([{ x, y }]);
      buildingPlacementPending.delete(key);
      isActionPending = false;
    }
  }

  function handleOccupiedAttempt(event: CustomEvent<{ x: number; y: number; message: string }>): void {
    if (isGameOver) return;
    const details = event.detail;
    if (!details?.message) return;
    pushNotification('Kokapena blokeatuta', details.message, 'medium');
    soundManager.playSFX('error');
  }

  async function handleBulldozerCleared(
    event: CustomEvent<{
      updatedTiles: Array<{ x: number; y: number }>;
      tilesSnapshot: Tile[][];
      cost: number;
      demolitions: Array<{ x: number; y: number; type: string }>;
    }>
  ): Promise<void> {
    if (inputLocked || isGameOver) return;
    isActionPending = true;
    
    // Already patched in IsometricMap for visuals, but we ensure consistency here
    // event.detail.tilesSnapshot is usually already updated
    liveTiles = event.detail.tilesSnapshot; 
    if (!gameState || event.detail.demolitions.length === 0) return;

    const requests = event.detail.demolitions.map((demolition) =>
      apiService.demolish(gameId, { x: demolition.x, y: demolition.y }, resolveDemolishCategory(demolition.type))
    );

    const results = await Promise.allSettled(requests);
    const latest = [...results].reverse().find((result) => result.status === 'fulfilled');

    let totalRefund = 0;
    let totalCost = 0;
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      totalRefund += result.value?.refund ?? 0;
      totalCost += result.value?.cost ?? 10;
    }

    if (latest && latest.status === 'fulfilled' && latest.value?.game_state) {
      gameState = latest.value.game_state;
      // Autorun subscription will handle the merge efficiently now
      gameStore.setGameState(latest.value.game_state);
      soundManager.playSFX('demolish');
    }

    const net = totalRefund - totalCost;
    pushNotification(
      'Eraispena osatuta',
      `Itzulketa §${Math.round(totalRefund).toLocaleString()} | Tasak §${Math.round(totalCost).toLocaleString()} | Garbia §${Math.round(net).toLocaleString()}`,
      'medium'
    );
    if (totalRefund > 0) {
      soundManager.playSFX('money');
    }

    try {
      stats = await apiService.getStats(gameId);
    } catch {
      pushNotification('Estatistikak atzeratuta', 'Eraispena aplikatu da, baina estatistiken freskapenak huts egin du.', 'medium');
    } finally {
      isActionPending = false;
    }
  }

  async function handleZonePaint(
    event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }>; tilesSnapshot: Tile[][] }>
  ): Promise<void> {
    if (inputLocked || isGameOver) return;
    liveTiles = event.detail.tilesSnapshot;
    if (event.detail.updatedTiles.length === 0) return;

    // Final paint event keeps optimistic snapshot local; authoritative sync is handled in buffered flow.
    markDirtyTiles(event.detail.updatedTiles);
  }

  async function handleZoneBuffered(
    event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }>; tilesSnapshot: Tile[][] }>
  ): Promise<void> {
    if (inputLocked || isGameOver) return;
    if (!selectedZone || event.detail.updatedTiles.length === 0) return;
    
    isActionPending = true;

    // Budget validation: check total cost before sending any requests
    const costPerTile = ZONE_COST_MAP[selectedZone as ZoneType] ?? 5;
    const totalCost = costPerTile * event.detail.updatedTiles.length;
    if (currentTreasury < totalCost) {
      pushNotification(
        'Ez dago diru nahikorik',
        `Zona honek §${totalCost.toLocaleString()} kostatzen du (${event.detail.updatedTiles.length} lauki × §${costPerTile}), baina §${currentTreasury.toLocaleString()} dituzu.`,
        'high',
        true
      );
      soundManager.playSFX('error');
      releaseDirtyTiles(event.detail.updatedTiles);
      return;
    }

    markDirtyTiles(event.detail.updatedTiles);

    try {
      const chunkSize = 20;
      const points = event.detail.updatedTiles;
      let hadFailure = false;

      for (let start = 0; start < points.length; start += chunkSize) {
        const chunk = points.slice(start, start + chunkSize);
        const requests = chunk.map((point) => apiService.placeZone(gameId, selectedZone as ZoneType, point, { w: 1, h: 1 }));
        const settled = await Promise.allSettled(requests);
        if (settled.some((result) => result.status === 'rejected')) {
          hadFailure = true;
        }
      }

      if (hadFailure) {
        pushNotification(
          'Zonen margoketa atzeratuta',
          'Zonaren lauki batzuk oraindik ezin izan dira zerbitzarian baieztatu.',
          'high',
          false,
          { dragOperation: true, isError: true }
        );
        const [fresh, freshStats] = await Promise.all([
          apiService.getGame(gameId),
          apiService.getStats(gameId)
        ]);
        if (fresh.game_state) {
          gameStore.setGameState(fresh.game_state);
        }
        if (freshStats) {
          stats = freshStats;
          gameStore.setStats(freshStats);
        }
        releaseDirtyTiles(event.detail.updatedTiles);
        isActionPending = false;
        return;
      }

      const [fresh, freshStats] = await Promise.all([
        apiService.getGame(gameId),
        apiService.getStats(gameId)
      ]);
      gameState = fresh.game_state;
      gameStore.setGameState(fresh.game_state);
      stats = freshStats;
      gameStore.setStats(freshStats);
      soundManager.playSFX('zone');

      // Auto-save after zone placement
      await apiService.saveGame(gameId).catch(() => {});

      releaseDirtyTiles(event.detail.updatedTiles);
    } finally {
      // Dirty tiles are released only after confirmation/fallback above.
      isActionPending = false;
    }
  }

  async function handleInfraDraw(
    event: CustomEvent<{
      updatedTiles: Array<{ x: number; y: number }>;
      tilesSnapshot: Tile[][];
      typedUpdates?: InfraTypedPoint[];
    }>
  ): Promise<void> {
    if (isGameOver) return;
    liveTiles = event.detail.tilesSnapshot;
    if (event.detail.updatedTiles.length === 0) return;

    // Final draw event keeps optimistic snapshot local; authoritative sync is handled in buffered flow.
    markDirtyTiles(event.detail.updatedTiles);
  }

  async function handleInfraBuffered(
    event: CustomEvent<{
      updatedTiles: Array<{ x: number; y: number }>;
      tilesSnapshot: Tile[][];
      typedUpdates?: InfraTypedPoint[];
    }>
  ): Promise<void> {
    if (inputLocked || isGameOver) return;
    if (event.detail.updatedTiles.length === 0) return;
    
    isActionPending = true;

    // Budget validation: check total cost before sending any requests
    const INFRA_COST_MAP = $gameConstants?.INFRA_COSTS ?? {};

    const costPerTile = INFRA_COST_MAP[selectedInfra ?? ''] ?? 10;
    const totalCost = costPerTile * event.detail.updatedTiles.length;

    if (currentTreasury < totalCost) {
      pushNotification(
        'Ez dago diru nahikorik',
        `Azpiegitura honek §${totalCost.toLocaleString()} kostatzen du (${event.detail.updatedTiles.length} lauki × §${costPerTile}), baina §${currentTreasury.toLocaleString()} dituzu.`,
        'high',
        true
      );
      soundManager.playSFX('error');
      releaseDirtyTiles(event.detail.updatedTiles);
      isActionPending = false;
      return;
    }

    markDirtyTiles(event.detail.updatedTiles);

    try {
      const grouped = groupInfraByType(event.detail.updatedTiles, event.detail.typedUpdates, selectedInfra);
      if (grouped.size === 0) return;

      const chunkSize = 20;
      let hadFailure = false;

      for (const [infraType, points] of grouped.entries()) {
        for (let start = 0; start < points.length; start += chunkSize) {
          const chunk = points.slice(start, start + chunkSize);
          const segments = chunk.map((point) => ({ from: point, to: point }));
          try {
            await apiService.placeInfrastructure(gameId, infraType, segments);
          } catch {
            hadFailure = true;
          }
        }
      }

      if (hadFailure) {
        throw new Error('Azpiegitura trazuaren segmentu batzuk ezin izan dira baieztatu.');
      }

      const [fresh, freshStats] = await Promise.all([
        apiService.getGame(gameId),
        apiService.getStats(gameId)
      ]);
      gameState = fresh.game_state;
      gameStore.setGameState(fresh.game_state);
      stats = freshStats;
      gameStore.setStats(freshStats);
      // liveTiles update handled by store subscription

      try {
        const freshStats = await apiService.getStats(gameId);
        stats = freshStats;
        gameStore.setStats(freshStats);
        soundManager.playSFX('infrastructure');
      } catch {
        pushNotification('Estatistikak atzeratuta', 'Azpiegiturak baieztatu dira, baina estatistikak ezin izan dira une honetan freskatu.', 'low');
      }

      // Auto-save after infrastructure placement
      await apiService.saveGame(gameId).catch(() => {});

      releaseDirtyTiles(event.detail.updatedTiles);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Azpiegitura trazua ezin izan da baieztatu.';
      pushNotification('Azpiegitura atzeratuta', message, 'high', false, { dragOperation: true, isError: true });
      const fresh = await apiService.getGame(gameId);
      if (fresh.game_state) {
        gameStore.setGameState(fresh.game_state);
      }
      releaseDirtyTiles(event.detail.updatedTiles);
    } finally {
      isActionPending = false;
    }
  }

  async function handleCheatSubmitted(event: CustomEvent): Promise<void> {
    const result = event.detail;
    if (result && result.data && result.data.player_city) {
      // Direct state injection for immediate UI feedback
      if (gameState && gameState.player_city) {
        gameState = {
          ...gameState,
          player_city: {
            ...gameState.player_city,
            ...result.data.player_city
          }
        };
      }
      
      // Refresh stats to ensure buying power is updated
      try {
        const freshStats = await apiService.getStats(gameId);
        stats = freshStats;
        gameStore.setStats(freshStats);
      } catch (e) {
        console.warn("Could not refresh stats after cheat:", e);
      }
      
      soundManager.playSFX('money');
      
      pushNotification({
        title: 'Trikimailua aplikatuta',
        message: result.message || 'Hiriaren egoera eguneratu da',
        priority: 'high'
      });
    }
  }

  function backToGames(): void {
    navigate('/games', true);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return; // Prevent rapid toggling when holding keys
    
    if (event.key === 'Escape') {
      newspaperOpen = false;
      aiTurnViewerOpen = false;
      activeShelf = null;
      bulldozerActive = false;
      clearToolSelection();
      return;
    }

    if (event.key.toLowerCase() === 'u') {
      undergroundMode = !undergroundMode;
    }

    if (event.key.toLowerCase() === 'b') {
      toggleBulldozer();
    }

    if (event.ctrlKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      showPerfMeter = !showPerfMeter;
    }

    if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyK') {
      event.preventDefault();
      event.stopPropagation();
      toggleCheatConsole();
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    void event;
  }

  function closeShelfOnMapInteraction(): void {
    if (isGameOver) return;
    newspaperOpen = false;
    // Also clear active shelf on map interaction to ensure UI responsiveness
    activeShelf = null;
  }

  function handleToolCancelRequest(): void {
    if (inputLocked || isGameOver) return;
    activeShelf = null;
    bulldozerActive = false;
    clearToolSelection();
  }

  function groupInfraByType(
    updatedTiles: Array<{ x: number; y: number }>,
    typedUpdates: InfraTypedPoint[] | undefined,
    fallbackType: InfrastructureType | null
  ): Map<InfrastructureType, Array<{ x: number; y: number }>> {
    const grouped = new Map<InfrastructureType, Array<{ x: number; y: number }>>();

    if (typedUpdates && typedUpdates.length > 0) {
      for (const point of typedUpdates) {
        const bucket = grouped.get(point.type) ?? [];
        bucket.push({ x: point.x, y: point.y });
        grouped.set(point.type, bucket);
      }
      return grouped;
    }

    if (fallbackType && updatedTiles.length > 0) {
      grouped.set(fallbackType, updatedTiles);
    }

    return grouped;
  }

  $: populationHistory = metricHistory.map((entry) => entry.population);
  $: treasuryHistory = metricHistory.map((entry) => entry.treasury);
  $: rciHistory = metricHistory.map((entry) => entry.rci);

  // The reactive sync is now handled by the store subscription in onMount.

  $: isGameOver = Boolean(
    gameState && (
      gameState.player_city.months_bankrupt >= ($gameConstants?.VICTORY_CONDITIONS?.max_months_bankrupt ?? 12) || 
      (gameState.victory_status && gameState.victory_status !== 'ongoing')
    )
  );

  $: if (isGameOver && !resultsVisible && gameState && gameState.victory_status !== 'ongoing') {
    resultsVisible = true;
  }

  $: gameOverMessage = isGameOver
    ? `Partida amaituta: altxorra §${($gameConstants?.TREASURY_THRESHOLDS?.bankrupt_limit ?? -100000).toLocaleString()} azpitik egon da ${$gameConstants?.VICTORY_CONDITIONS?.max_months_bankrupt ?? 12} hilabetez jarraian. Hiri tresna guztiak blokeatuta daude.`
    : '';

  onMount(async () => {
    const routeMatch = window.location.pathname.match(/^\/game\/([^/]+)$/);
    if (routeMatch) gameId = decodeURIComponent(routeMatch[1]);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Audio Initialization Logic
    const unsubscribeAudio = soundManager.subscribe((state) => {
      if (state.userUnlocked && !audioInitialized) {
        audioInitialized = true;
        soundManager.playSFX('money'); // Startup chime
        pushNotification('Audioa aktibatuta', 'Soinu sistema profesionala prest dago.', 'low');
      }
    });

    unsubscribeGameState = gameStore.gameState.subscribe((value) => {
      if (!value) return;
      gameState = value;
      liveTiles = mergeTilesPreservingDirty(value.map.tiles);
    });

    unsubscribeStats = gameStore.stats.subscribe((value) => {
      if (!value) return;
      stats = value;
    });

    unsubscribeNotifications = notificationsStore.subscribe((value) => {
      notifications = value;
    });

    unsubscribeMetricHistory = gameStore.metricHistory.subscribe((value) => {
      metricHistory = value;
    });

    try {
      const [gameRes, statsRes] = await Promise.all([apiService.getGame(gameId), apiService.getStats(gameId)]);
      gameStore.setGameState(gameRes.game_state);
      gameStore.setStats(statsRes);
      gameStore.setAiTurn(null);

      pushNotification('Saioa kargatuta', `Ongi etorri berriro, Alkate ${gameRes.game_state.player_city.name}.`, 'medium');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Errorea partida kargatzean';
    } finally {
      loading = false;
    }

    return () => {
      unsubscribeAudio();
      unsubscribeGameState?.();
      unsubscribeStats?.();
      unsubscribeNotifications?.();
      unsubscribeMetricHistory?.();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  let audioInitialized = false;
</script>

<main class="app-shell">
  {#if loading}
    <div class="state">Hiri simulazioa kargatzen...</div>
  {:else if error}
    <div class="state error">{error}</div>
  {:else if gameState && stats}
    <section class="viewport">
      <IsometricMap
        tiles={liveTiles}
        mapWidth={gameState.map.size.width}
        mapHeight={gameState.map.size.height}
        zoneTool={selectedZone}
        infrastructureTool={selectedInfra}
        buildingTool={selectedBuilding}
        activeTool={bulldozerActive ? 'bulldozer' : toolMode}
        inputLocked={inputLocked || isActionPending}
        playerTreasury={currentTreasury}
        selectedBuildingCost={buildingCostFor(selectedBuilding)}
        undergroundMode={undergroundMode}
        showInfrastructure={true}
        showZones={true}
        showStatusIcons={showStatusIcons}
        activeOverlay={activeOverlay}
        focusTile={aiFocusTile}
        aiViewMode={aiViewMode}
        aiCity={aiCityTiles ? { name: 'AI Hiria', tiles: aiCityTiles, actions: [], treasury: 0 } : null}
        on:zonePainted={handleZonePaint}
        on:zoneBuffered={handleZoneBuffered}
        on:infrastructureDrawn={handleInfraDraw}
        on:infrastructureBuffered={handleInfraBuffered}
        on:bulldozerCleared={handleBulldozerCleared}
        on:tileClicked={handleBuildingPlacement}
        on:occupiedAttempt={handleOccupiedAttempt}
        on:mapClicked={closeShelfOnMapInteraction}
        on:toolCancelRequested={handleToolCancelRequest}
      />

      <DataOverlaySelector
        activeOverlay={activeOverlay}
        isActive={activeOverlay !== null}
        overlayStrength={overlayStrength}
        overlayTiles={liveTiles}
        onOverlayChange={(type) => {
          activeOverlay = type;
        }}
        onToggle={() => {
          // No longer automatically opening stats shelf to avoid cluttering the UI
        }}
        onStrengthChange={(value) => {
          overlayStrength = value;
          setOverlayStrength(value);
        }}
      />

      {#if resultsVisible && gameState && stats}
        <VictoryResultsModal
          {gameState}
          {stats}
          on:close={() => (resultsVisible = false)}
          on:exit={backToGames}
        />
      {/if}

      {#if activeShelf === 'newspaper'}
        <div
          class="map-interaction-blocker"
          role="button"
          tabindex="0"
          aria-label="Panela itxi"
          on:click={closeShelfOnMapInteraction}
          on:keydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              closeShelfOnMapInteraction();
            }
          }}
        ></div>
      {/if}

      <div class="spec-hud-layer">
          <GameHUD
            isGameOver={isGameOver}
            savePending={savePending}
            disabled={isActionPending}
            onBack={backToGames}
            onSave={() => void saveGame()}
          />

          <section class="top-status-bar" aria-label="Goiko HUD kontrolak">
            <div class="rci-cluster" aria-label="RCI eskaria">
              <div class="rci-item r">
                <span class="rci-label">R</span>
                <div class="rci-track"><div class="rci-fill" style={`width: ${metricPct(stats?.player.rci_demand?.r ?? 0, -100, 100)}%`}></div></div>
                <strong>{Math.round(stats?.player.rci_demand?.r ?? 0)}</strong>
              </div>
              <div class="rci-item c">
                <span class="rci-label">C</span>
                <div class="rci-track"><div class="rci-fill" style={`width: ${metricPct(stats?.player.rci_demand?.c ?? 0, -100, 100)}%`}></div></div>
                <strong>{Math.round(stats?.player.rci_demand?.c ?? 0)}</strong>
              </div>
              <div class="rci-item i">
                <span class="rci-label">I</span>
                <div class="rci-track"><div class="rci-fill" style={`width: ${metricPct(stats?.player.rci_demand?.i ?? 0, -100, 100)}%`}></div></div>
                <strong>{Math.round(stats?.player.rci_demand?.i ?? 0)}</strong>
              </div>
            </div>

            <div class="speed-cluster" aria-label="Abiadura hautatzailea">
              <button class="chip speed-chip" class:active-chip={activeShelf === 'stats'} on:click={() => openShelf('stats')} disabled={isGameOver}>Estat.</button>
              <button class="chip speed-chip" class:active-chip={!autoAdvance} on:click={() => setHudSpeedMode('manual')} disabled={isGameOver}>Manual</button>
              <button class="chip speed-chip" class:active-chip={autoAdvance && $gameSpeed === 'normal'} on:click={() => setHudSpeedMode('normal')} disabled={isGameOver}>Normal</button>
              <button class="chip speed-chip" class:active-chip={autoAdvance && ($gameSpeed === 'fast' || $gameSpeed === 'instant')} on:click={() => setHudSpeedMode('fast')} disabled={isGameOver}>Azkarra</button>
            </div>
          </section>
        </div>

      {#if activeToolText()}
        <div class="active-tool-indicator" in:fade={{ duration: 180 }}>
          <span class="pulse-dot" aria-hidden="true"></span>
          <span>Tresna aktiboa</span>
          <strong>{activeToolText()}</strong>
        </div>
      {/if}

      {#if activeShelf}
        <section class="context-shelf" in:slide={{ axis: 'y', duration: 260, easing: cubicOut }} out:fade={{ duration: 140 }}>
          {#if activeShelf === 'zones'}
            <div class="shelf-head"><h3>Zonak</h3></div>
            <div class="shelf-grid">
              {#each zoneTools as tool, idx}
                <button class="stagger-item" style={`--stagger:${idx};`} class:selected={selectedZone === tool.value} on:click={() => chooseZone(tool.value)} disabled={isGameOver}>
                  <strong>{tool.label}</strong>
                  <small>{tool.value}</small>
                </button>
              {/each}
            </div>
          {/if}

          {#if activeShelf === 'roads'}
            <div class="shelf-head"><h3>Azpiegiturak</h3></div>
            <div class="accordion-tabs segmented">
              <button class:active={activeInfraGroup === 'roads'} on:click={() => (activeInfraGroup = 'roads')}>Errepideak</button>
              <button class:active={activeInfraGroup === 'water'} on:click={() => (activeInfraGroup = 'water')}>Ura</button>
              <button class:active={activeInfraGroup === 'power'} on:click={() => (activeInfraGroup = 'power')}>Energia</button>
              <button class:active={activeInfraGroup === 'transit'} on:click={() => (activeInfraGroup = 'transit')}>Garraioa</button>
            </div>
            <div class={`shelf-grid tool-card-grid ${infraGroups[activeInfraGroup].length <= 3 ? 'three-up' : ''}`}>
              {#each infraGroups[activeInfraGroup] as tool, idx}
                <button class="tool-card stagger-item" style={`--stagger:${idx};`} class:selected={selectedInfra === tool.value} on:click={() => chooseInfrastructure(tool.value)} disabled={isGameOver}>
                  <span class="tool-icon" aria-hidden="true">
                    {#if tool.value === 'road' || tool.value === 'highway' || tool.value === 'highway_ramp'}
                      <svg viewBox="0 0 24 24"><path d="M8 2v20M16 2v20M8 7h8M8 17h8"/></svg>
                    {:else if tool.value === 'water_pipe'}
                      <svg viewBox="0 0 24 24"><path d="M12 3v18M5 10c3 0 3 4 6 4s3-4 6-4 3 4 6 4"/></svg>
                    {:else if tool.value === 'subway_tunnel' || tool.value === 'subway'}
                      <svg viewBox="0 0 24 24"><path d="M5 18V8a7 7 0 0 1 14 0v10M8 18h8M9 21l1-3M15 21l-1-3"/></svg>
                    {:else if tool.value === 'power_line'}
                      <svg viewBox="0 0 24 24"><path d="M12 3v9l-3 0 3 9 3-9h-3V3"/></svg>
                    {:else}
                      <svg viewBox="0 0 24 24"><path d="M4 18h16M4 12h16M4 6h16"/></svg>
                    {/if}
                  </span>
                  <strong>{tool.label}</strong>
                  <small>{tool.value.replace(/_/g, ' ')}</small>
                </button>
              {/each}
            </div>
          {/if}

          {#if activeShelf === 'buildings'}
            <div class="shelf-head"><h3>Eraiki</h3></div>
            <div class="mini-title">Energia</div>
            <div class="shelf-grid">
              {#each buildingTools.filter((b) => b.value.includes('power')) as tool, idx}
                <button
                  class="stagger-item"
                  class:unaffordable={!canAfford(tool.cost) && !isGameOver}
                  style={`--stagger:${idx};`}
                  class:selected={selectedBuilding === tool.value}
                  on:click={() => chooseBuilding(tool.value)}
                  disabled={isGameOver || !canAfford(tool.cost)}
                  title={!canAfford(tool.cost) ? `§${tool.cost.toLocaleString()} behar dira – ez dago diru nahikorik` : ''}
                >
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>
            
            <div class="mini-title">Segurtasuna eta Osasuna</div>
            <div class="shelf-grid">
              {#each buildingTools.filter((b) => b.value === 'police_station' || b.value === 'fire_station' || b.value === 'hospital' || b.value === 'prison') as tool, idx}
                <button
                  class="stagger-item"
                  class:unaffordable={!canAfford(tool.cost) && !isGameOver}
                  style={`--stagger:${idx + 10};`}
                  class:selected={selectedBuilding === tool.value}
                  on:click={() => chooseBuilding(tool.value)}
                  disabled={isGameOver || !canAfford(tool.cost)}
                  title={!canAfford(tool.cost) ? `§${tool.cost.toLocaleString()} behar dira – ez dago diru nahikorik` : ''}
                >
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>

            <div class="mini-title">Hezkuntza</div>
            <div class="shelf-grid">
              {#each buildingTools.filter((b) => b.value === 'school' || b.value === 'college' || b.value === 'library' || b.value === 'museum') as tool, idx}
                <button
                  class="stagger-item"
                  class:unaffordable={!canAfford(tool.cost) && !isGameOver}
                  style={`--stagger:${idx + 15};`}
                  class:selected={selectedBuilding === tool.value}
                  on:click={() => chooseBuilding(tool.value)}
                  disabled={isGameOver || !canAfford(tool.cost)}
                  title={!canAfford(tool.cost) ? `§${tool.cost.toLocaleString()} behar dira – ez dago diru nahikorik` : ''}
                >
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>

            <div class="mini-title">Garraioa eta Ura</div>
            <div class="shelf-grid">
              {#each buildingTools.filter((b) => b.value === 'bus_depot' || b.value === 'rail_station' || b.value === 'subway_station' || b.value === 'airport' || b.value === 'seaport' || b.value === 'water_pump' || b.value === 'water_treatment') as tool, idx}
                <button
                  class="stagger-item"
                  class:unaffordable={!canAfford(tool.cost) && !isGameOver}
                  style={`--stagger:${idx + 20};`}
                  class:selected={selectedBuilding === tool.value}
                  on:click={() => chooseBuilding(tool.value)}
                  disabled={isGameOver || !canAfford(tool.cost)}
                  title={!canAfford(tool.cost) ? `§${tool.cost.toLocaleString()} behar dira – ez dago diru nahikorik` : ''}
                >
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>

            <div class="mini-title">Arkologiak (Garaipena)</div>
            <div class="shelf-grid">
              {#each buildingTools.filter((b) => b.value.includes('arcology')) as tool, idx}
                <button
                  class="stagger-item arcology-tool"
                  class:unaffordable={!canAfford(tool.cost) && !isGameOver}
                  style={`--stagger:${idx + 30};`}
                  class:selected={selectedBuilding === tool.value}
                  on:click={() => chooseBuilding(tool.value)}
                  disabled={isGameOver || !canAfford(tool.cost)}
                  title={!canAfford(tool.cost) ? `§${tool.cost.toLocaleString()} behar dira – ez dago diru nahikorik` : ''}
                >
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>
          {/if}

          {#if activeShelf === 'budget'}
            <div class="shelf-head"><h3>Aurrekontua</h3></div>
            <BudgetPanel budget={gameState.player_city.budget} stats={stats} {gameId} />
          {/if}

          {#if activeShelf === 'stats'}
            <div class="shelf-head"><h3>Estatistikak</h3></div>
            {#if educationMetrics && healthMetrics}
              <section class="stats-unique-grid">
                <article class="data-card wide compact-card">
                  <header>
                    <span>Module 8</span>
                    <strong>EQ / HQ joera</strong>
                  </header>
                  <div class="compact-metrics">
                    <div>
                      <span>EQ</span>
                      <strong>{educationMetrics.eq} ({educationMetrics.eq_trend >= 0 ? '+' : ''}{educationMetrics.eq_trend})</strong>
                    </div>
                    <div>
                      <span>HQ</span>
                      <strong>{healthMetrics.hq} ({healthMetrics.hq_trend >= 0 ? '+' : ''}{healthMetrics.hq_trend})</strong>
                    </div>
                    <div>
                      <span>Bizi-itxaropena</span>
                      <strong>{healthMetrics.average_lifespan.toFixed(1)} urte</strong>
                    </div>
                    <div>
                      <span>High-tech</span>
                      <strong>{(() => { const e = educationMetrics?.effects; return e ? (e.high_tech_industry_pct ?? 0) * 100 : 0; })().toFixed(0)}%</strong>
                    </div>
                  </div>
                </article>

                <article class="data-card wide compact-card">
                  <header>
                    <span>EQ / HQ</span>
                    <strong>Azken 12 hilabeteak</strong>
                  </header>
                  <svg viewBox="0 0 164 34" preserveAspectRatio="none" aria-label="EQ HQ mini grafikoa">
                    <polyline points={sparklinePoints(eqSeries)} />
                    <polyline class="hq-line" points={sparklinePoints(hqSeries)} />
                  </svg>
                </article>

                <article class="data-card wide compact-card">
                  <header>
                    <span>RCI hazkundea</span>
                    <strong>Eskariaren joera</strong>
                  </header>
                  <svg viewBox="0 0 164 34" preserveAspectRatio="none" aria-label="RCI growth mini grafikoa">
                    <polyline class="r" points={sparklinePoints(rciHistory.map((entry) => entry.r))} />
                    <polyline class="c" points={sparklinePoints(rciHistory.map((entry) => entry.c))} />
                    <polyline class="i" points={sparklinePoints(rciHistory.map((entry) => entry.i))} />
                  </svg>
                </article>
              </section>
            {:else}
              <section class="stats-unique-grid">
                <article class="data-card wide compact-card">
                  <header>
                    <span>Module 8</span>
                    <strong>Datuak kargatzen...</strong>
                  </header>
                </article>
              </section>
            {/if}
            <div class="chips-wrap overlay-chips">
              {#each overlayTools as overlay, idx}
                <button class="chip mini stagger-item" style={`--stagger:${idx};`} class:active={activeOverlay === overlay.id} on:click={() => (activeOverlay = activeOverlay === overlay.id ? null : overlay.id)} disabled={isGameOver}>{overlay.label}</button>
              {/each}
            </div>
          {/if}

          {#if activeShelf === 'rival'}
            <div class="shelf-head"><h3>AA aurkaria</h3></div>
            <RivalCityView gameState={gameState} stats={stats} aiTiles={gameState.map.tiles} />
            <section class="spec-disaster-wrap">
              <DisasterPanel {gameState} {gameId} />
            </section>
          {/if}

          {#if activeShelf === 'eduhealth'}
            <div class="shelf-head"><h3>Hezkuntza &amp; Osasuna</h3></div>
            {#if educationMetrics && healthMetrics}
              <EducationHealthPanel
                education={educationMetrics}
                health={healthMetrics}
                eqSeries={eqSeries}
                hqSeries={hqSeries}
                labels={eduHealthLabels}
                fundingPct={eduHealthFundingPct}
                on:fundingChange={handleEduHealthFundingChange}
              />
            {:else}
              <div class="newspaper-card">
                <strong>Hezkuntza &amp; Osasuna</strong>
                <p>Datuak kargatzen...</p>
              </div>
            {/if}
          {/if}

        </section>
      {/if}

      <footer class="bottom-dock" class:tool-focused={hasPersistentTool()} in:fade={{ duration: 180 }}>
        <!-- LEFT SECTION: Construction Tools -->
        <div class="dock-section dock-construction">
          <div class="dock-block dock-player-info">
            <div class="info-metric readonly" title="Onarpena">
              <span class="emoji">{cityMoodEmoji()}</span>
            </div>
            <div class="info-metric readonly" title="Data">
              <small>Data</small>
              <strong>{gameState?.current_date.year ?? 2050}/{String(gameState?.current_date.month ?? 1).padStart(2, '0')}</strong>
            </div>
            <div class="info-metric readonly" title="Biztanleria">
              <small>Bizt.</small>
              <strong>{stats?.player.population?.toLocaleString('eu-ES') ?? 0}</strong>
            </div>
            <div class="info-metric readonly" title="Osasuna / Hezkuntza">
              <small>HQ</small>
              <strong>{Math.round(stats?.player.hq ?? 0)}</strong>
            </div>
            <div class="info-metric readonly treasury-value" title="Altxorra">
              <small>Altxorra</small>
              <strong>§{Math.round(stats?.player.treasury ?? 0).toLocaleString('eu-ES')}</strong>
            </div>
          </div>

          <div class="dock-divider" aria-hidden="true"></div>

          <div class="dock-block dock-tools">
            {#each bottomDockLeftItems as item}
              <button class="dock-item" class:active={isDockItemActive(item.id)} on:click|stopPropagation={() => openShelf(item.id)} disabled={inputLocked}>
                <span class="icon" aria-hidden="true">
                  {#if item.id === 'roads'}
                    <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M8 2v20M16 2v20M8 7h8M8 17h8"/></svg>
                  {:else if item.id === 'zones'}
                    <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M12 2 21 12 12 22 3 12 12 2zm0 5v10M7 12h10"/></svg>
                  {:else if item.id === 'buildings'}
                    <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M4 21V9l8-5 8 5v12M9 21v-6h6v6"/></svg>
                  {/if}
                </span>
                <span class="label">{item.label}</span>
                <span class="active-pill" aria-hidden="true"></span>
              </button>
            {/each}
            <button class="dock-item" class:active={bulldozerActive} on:click|stopPropagation={toggleBulldozer} disabled={inputLocked}>
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M3 15h6v4H3zM9 16l4-4h8v6H9zM14 12V8h4M5 15l2-5h5"/></svg>
              </span>
              <span class="label">Eraitsi</span>
              <span class="active-pill" aria-hidden="true"></span>
            </button>
          </div>
        </div>

        <!-- RIGHT SECTION: Management & Reports -->
        <div class="dock-section dock-management">
          <div class="dock-block dock-mgmt-tools">
            {#each bottomDockRightItems as item}
              <button class="dock-item action-btn" class:active={isDockItemActive(item.id)} on:click|stopPropagation={() => openShelf(item.id)} disabled={inputLocked}>
                <span class="icon" aria-hidden="true">
                  {#if item.id === 'budget'}
                    💰
                  {:else if item.id === 'stats'}
                    📈
                  {:else if item.id === 'eduhealth'}
                    🏥
                  {:else if item.id === 'newspaper'}
                    📰
                  {:else if item.id === 'rival'}
                    🏙️
                  {/if}
                </span>
                <span class="label">{item.label}</span>
                <span class="active-pill" aria-hidden="true"></span>
              </button>
            {/each}
          </div>

          <div class="dock-divider" aria-hidden="true"></div>

          <div class="dock-block dock-time-state">
            <button class="dock-item action-btn highlight" on:click|stopPropagation={() => endMonth()} disabled={inputLocked}>
              <span class="icon">⏭️</span>
              <span class="label">Hilabetea</span>
            </button>
            <button class="dock-item action-btn" class:active={aiTurnViewerOpen} on:click|stopPropagation={() => { aiTurnViewerOpen = !aiTurnViewerOpen; }}>
              <span class="icon">🤖</span>
              <span class="label">AA Txanda</span>
              <span class="active-pill" aria-hidden="true"></span>
            </button>
            {#if aiTurnViewerOpen}
              <button class="dock-item action-btn mini" on:click|stopPropagation={() => { aiTurnViewerMode = aiTurnViewerMode === 'fullscreen' ? 'split' : 'fullscreen'; }} title={aiTurnViewerMode === 'fullscreen' ? 'AA Split view' : 'AA Full view'}>
                <span class="icon">{aiTurnViewerMode === 'fullscreen' ? '🔲' : '◩'}</span>
              </button>
              <span class="replay-chip" title="Erreprodukzio kontrolak AA txandan soilik agertzen dira">⏮️ ️ ⏭️</span>
            {/if}
          </div>
        </div>
      </footer>

      {#if hasPersistentTool()}
        <aside class="tool-options-panel" in:fade={{ duration: 160 }}>
          <header>
            <span>Tresna aukerak</span>
            <strong>{activeToolText()}</strong>
          </header>
          <div class="tool-options-actions">
            {#if selectedInfra}
              <button class="chip mini" on:click={cycleInfraTool} disabled={inputLocked}>Errepide mota aldatu</button>
              <button class="chip mini" on:click={enableInfraBulldozer} disabled={inputLocked}>Errepidea eraitsi</button>
            {:else}
              <button class="chip mini" on:click={toggleBulldozer} disabled={inputLocked}>
                {bulldozerActive ? 'Bulldozer desgaitu' : 'Bulldozer gaitu'}
              </button>
            {/if}
            <button class="chip mini" on:click={closeActiveToolPanel} disabled={inputLocked}>Tresna itxi</button>
          </div>
        </aside>
      {/if}

      {#if isGameOver}
        <section class="game-over-overlay" in:fade={{ duration: 160 }}>
          <div class="game-over-card">
            <h2>Partida amaituta</h2>
            <p>{gameOverMessage}</p>
            <button class="chip" on:click={backToGames}>Partiden zerrendara itzuli</button>
          </div>
        </section>
      {/if}

      <PerformanceMeter visible={showPerfMeter} />
      <KeyboardLegend />

      <AITurnViewer
        open={aiTurnViewerOpen}
        mode={aiTurnViewerMode}
        actions={aiTurnViewerActions}
        aiActionsRaw={aiTurnViewerRawActions}
        reasoning={aiTurnViewerReasoning}
        aiCityTiles={aiCityTiles}
        {gameState}
        {stats}
        on:close={() => {
          aiTurnViewerOpen = false;
          aiViewMode = 'player';
        }}
      />

      <NewspaperModal
        open={newspaperOpen}
        {gameState}
        {stats}
        on:close={() => {
          newspaperOpen = false;
        }}
      />

      {#if notifications.length > 0}
        <aside class="notifications-layer" aria-live="polite" aria-label="Jakinarazpenak">
          {#each notifications as entry (entry.id)}
            <article class={`notice ${entry.priority} ${entry.title === 'Porrota' ? 'bankruptcy' : ''}`}>
              <div class="notice-head">
                <strong>{entry.title}</strong>
                <button class="chip mini" on:click={() => clearNotification(entry.id)}>Itxi</button>
              </div>
              <p>{entry.message}</p>
            </article>
          {/each}
        </aside>
      {/if}
    </section>
  {/if}
  <CheatConsole {gameId} on:cheatSubmitted={handleCheatSubmitted} />
  
  {#if endMonthPending || savePending}
    <div class="global-loader-overlay" in:fade={{ duration: 150 }} out:fade={{ duration: 120 }}>
      <div class="loader-content">
        <div class="spinner"></div>
        <span>
          {#if endMonthPending}
            Simulazioa eta AAren txanda kalkulatzen...
          {:else if savePending}
            Gordetzen...
          {:else}
            Prozesatzen...
          {/if}
        </span>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(:root) {
    --bg-0: #090e14;
    --bg-1: rgba(18, 23, 31, 0.64);
    --bg-2: rgba(26, 34, 45, 0.68);
    --line: rgba(255, 255, 255, 0.14);
    --line-soft: rgba(255, 255, 255, 0.08);
    --txt: #edf4ff;
    --txt-dim: rgba(237, 244, 255, 0.66);
    --accent: #3a9cff;
    --accent-soft: rgba(58, 156, 255, 0.24);
    --glass-panel-bg: linear-gradient(145deg, rgba(17, 24, 35, 0.56), rgba(23, 32, 44, 0.32));
    --glass-panel-border: rgba(255, 255, 255, 0.2);
    --glass-panel-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  .app-shell {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-0);
    font-family: 'SF Pro Display', 'SF Pro Text', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: 0.02em;
    color: var(--txt);
  }

  .viewport {
    position: absolute;
    inset: 0;
  }

  .state {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    padding: 14px 18px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: rgba(17, 23, 31, 0.72);
    backdrop-filter: blur(24px);
  }

  .state.error {
    color: #ffd79c;
  }

  .spec-hud-layer {
    position: absolute;
    z-index: 39;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    width: min(1120px, calc(100vw - 420px));
    min-width: 760px;
  }

  .spec-hud-layer :global(.hud-shell) {
    pointer-events: auto;
  }

  .top-status-bar {
    margin: 10px auto 0;
    width: fit-content;
    max-width: min(1000px, calc(100vw - 40px));
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    padding: 6px 12px;
    border-radius: 16px;
    border: 1px solid var(--glass-panel-border);
    background: linear-gradient(155deg, rgba(14, 20, 30, 0.82), rgba(16, 24, 36, 0.62));
    backdrop-filter: blur(12px) saturate(140%);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28), var(--glass-panel-shadow);
  }

  .rci-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rci-item {
    display: grid;
    grid-template-columns: auto 54px auto;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    min-width: 90px;
    flex-shrink: 1;
  }

  .rci-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .rci-track {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.14);
  }

  .rci-fill {
    height: 100%;
    border-radius: 999px;
    width: 0;
    transition: width 220ms ease;
  }

  .rci-item strong {
    font-size: 0.72rem;
    font-family: var(--font-mono, monospace);
    color: rgba(235, 245, 255, 0.96);
    min-width: 28px;
    text-align: right;
  }

  .rci-item.r .rci-fill {
    background: linear-gradient(90deg, rgba(92, 221, 132, 0.7), rgba(78, 204, 115, 1));
  }

  .rci-item.c .rci-fill {
    background: linear-gradient(90deg, rgba(88, 177, 255, 0.72), rgba(52, 141, 230, 1));
  }

  .rci-item.i .rci-fill {
    background: linear-gradient(90deg, rgba(242, 216, 108, 0.72), rgba(224, 193, 70, 1));
  }

  .speed-cluster {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 4px;
  }

  .speed-chip {
    min-width: 82px;
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .hud-group {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--glass-panel-border);
    border-radius: 16px;
    background: var(--glass-panel-bg);
    backdrop-filter: blur(20px) saturate(170%);
    box-shadow: var(--glass-panel-shadow);
  }

  .hud-item {
    padding: 4px 7px;
    border-radius: 11px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.015));
    min-width: 0;
    overflow: hidden;
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 5px;
    align-items: center;
    min-height: 30px;
  }

  .hud-item.compact strong {
    font-size: 0.68rem;
  }

  .hud-item strong {
    display: inline;
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    font-weight: 600;
  }

  .hud-meta {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .hud-icon {
    width: 19px;
    height: 19px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    background: rgba(58, 156, 255, 0.14);
    border: 1px solid rgba(98, 174, 255, 0.3);
  }

  .hud-icon svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: rgba(220, 238, 255, 0.98);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .label {
    display: inline;
    font-size: 0.58rem;
    color: var(--txt-dim);
    text-transform: uppercase;
    letter-spacing: 0.11em;
    margin-bottom: 0;
  }

  .chip {
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg-2);
    color: var(--txt);
    padding: 7px 11px;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    cursor: pointer;
    backdrop-filter: blur(12px) saturate(180%);
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 220ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .chip:hover {
    transform: scale(1.05);
  }

  .chip.accent {
    background: linear-gradient(180deg, rgba(58, 156, 255, 0.44), rgba(58, 156, 255, 0.2));
    border-color: rgba(58, 156, 255, 0.66);
  }

  .chip.active-chip {
    background: linear-gradient(180deg, rgba(255, 120, 90, 0.38), rgba(255, 120, 90, 0.16));
    border-color: rgba(255, 140, 110, 0.7);
  }

  .top-actions {
    display: flex;
    gap: 6px;
  }

  .button-group {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .auto-toggle {
    background: linear-gradient(180deg, rgba(100, 200, 150, 0.22), rgba(80, 180, 120, 0.08));
    border-color: rgba(100, 180, 150, 0.44);
    color: var(--txt);
    font-size: 0.68rem;
    padding: 6px 9px;
  }

  .auto-toggle.active {
    background: linear-gradient(180deg, rgba(100, 220, 150, 0.38), rgba(80, 200, 130, 0.18));
    border-color: rgba(100, 220, 150, 0.8);
    color: #b0ffe8;
    font-weight: 600;
  }

  .auto-toggle:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .auto-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ai-chip {
    position: relative;
    padding-right: 18px;
  }

  .dot {
    position: absolute;
    right: 9px;
    top: 50%;
    transform: translateY(-50%);
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--accent);
    box-shadow: 0 0 10px rgba(58, 156, 255, 0.95);
  }

  .active-tool-indicator {
    position: absolute;
    z-index: 41;
    top: 86px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 11px;
    border: 1px solid rgba(114, 176, 255, 0.22);
    border-radius: 999px;
    background: rgba(7, 13, 20, 0.78);
    backdrop-filter: blur(12px) saturate(180%);
    color: var(--txt);
    font-size: 0.76rem;
    letter-spacing: 0.04em;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 8px 18px rgba(0, 0, 0, 0.24);
    pointer-events: none;
    display: inline-flex;
    gap: 7px;
    align-items: center;
    contain: layout size;
  }

  .active-tool-indicator strong {
    font-weight: 600;
    color: #d4e9ff;
  }

  .pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #64b2ff;
    box-shadow: 0 0 10px rgba(100, 178, 255, 0.92);
  }

  .context-shelf {
    position: absolute;
    z-index: 75;
    left: 50%;
    transform: translateX(-50%);
    bottom: 100px;
    width: min(860px, calc(100vw - 24px));
    min-height: 30vh;
    max-height: min(68vh, 620px);
    overflow-y: auto;
    overflow-x: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    background: rgba(12, 20, 35, 0.6);
    backdrop-filter: blur(28px) saturate(170%);
    -webkit-backdrop-filter: blur(28px) saturate(170%);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    padding: 14px 14px 12px;
    contain: layout size;
    animation: shelf-fade 280ms cubic-bezier(0.22, 1, 0.36, 1);
    scrollbar-width: thin;
    scrollbar-color: rgba(140, 197, 255, 0.5) rgba(255, 255, 255, 0.06);
  }

  .context-shelf::-webkit-scrollbar {
    width: 10px;
  }

  .context-shelf::-webkit-scrollbar-track {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
  }

  .context-shelf::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(157, 208, 255, 0.82), rgba(84, 163, 248, 0.7));
  }

  .map-interaction-blocker {
    position: absolute;
    inset: 0;
    z-index: 81;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(2px);
  }

  .shelf-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding: 4px 6px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
  }

  .shelf-head h3 {
    margin: 0;
    font-size: 0.84rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--txt-dim);
  }

  .shelf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }

  .tool-card-grid {
    margin-top: 10px;
    grid-auto-rows: minmax(132px, auto);
  }

  .tool-card-grid.three-up {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .tool-card {
    min-height: 132px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.03));
    text-align: center;
    align-content: center;
    justify-items: center;
    padding: 10px;
  }

  .tool-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    margin-bottom: 8px;
    background: rgba(58, 156, 255, 0.14);
    border: 1px solid rgba(98, 174, 255, 0.32);
  }

  .tool-icon svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: rgba(227, 241, 255, 0.96);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .shelf-grid button {
    border: 1px solid var(--line-soft);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03));
    color: var(--txt);
    padding: 11px;
    min-height: 92px;
    text-align: left;
    display: grid;
    gap: 4px;
    cursor: pointer;
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .shelf-grid button:hover {
    transform: translateY(-2px);
    border-color: rgba(137, 198, 255, 0.62);
    background: linear-gradient(180deg, rgba(132, 194, 255, 0.2), rgba(255, 255, 255, 0.04));
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.26);
  }

  .shelf-grid button.selected {
    border-color: rgba(58, 156, 255, 0.66);
    background: linear-gradient(180deg, rgba(58, 156, 255, 0.35), rgba(58, 156, 255, 0.16));
    box-shadow: 0 0 0 1px rgba(109, 185, 255, 0.42), 0 12px 28px rgba(25, 82, 140, 0.3);
  }

  .shelf-grid strong {
    font-size: 0.82rem;
    font-weight: 600;
  }

  .shelf-grid small {
    font-size: 0.74rem;
    color: var(--txt-dim);
  }

  .newspaper-card {
    border: 1px solid var(--line-soft);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    padding: 10px;
  }

  .newspaper-card strong,
  .newspaper-card p {
    margin: 0;
  }

  .newspaper-card p {
    font-size: 0.78rem;
    color: var(--txt-dim);
    margin-top: 3px;
  }

  .bottom-dock {
    position: fixed;
    z-index: 50;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(16px + env(safe-area-inset-bottom));
    width: min(1500px, calc(100vw - 20px));
    min-height: 74px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 24px;
    background: rgba(15, 25, 40, 0.62);
    backdrop-filter: blur(40px) saturate(190%);
    -webkit-backdrop-filter: blur(40px) saturate(190%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    contain: layout size;
    transition: opacity 220ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    pointer-events: auto;
  }

  .bottom-dock::-webkit-scrollbar {
    display: none;
  }

  .bottom-dock.tool-focused {
    opacity: 0.92;
  }

  /* Split sections: construction left, management right */
  .dock-section {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .dock-construction {
    flex: 1;
    justify-content: flex-start;
  }

  .dock-management {
    flex: 0 0 auto;
    justify-content: flex-end;
  }

  .dock-divider {
    width: 1px;
    align-self: stretch;
    background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.14), transparent);
    min-height: 40px;
  }

  .dock-block {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .dock-player-info {
    gap: 6px;
  }

  .dock-tools {
    gap: 4px;
  }

  .dock-mgmt-tools {
    gap: 4px;
  }

  .dock-time-state {
    gap: 6px;
  }

  /* Glassmorphism info metrics */
  .info-metric {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: var(--txt);
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    min-width: 50px;
    flex-shrink: 0;
  }

  .info-metric.readonly {
      cursor: default;
      pointer-events: none;
    }
    
    .info-metric small {
      font-size: 0.65rem;
      color: var(--txt-dim);
      text-transform: uppercase;
    }
    
    .info-metric strong {
      font-size: 0.85rem;
      font-family: var(--font-mono, monospace);
    }
    
    .info-metric .emoji {
      font-size: 1.5rem;
    }
    
    /* Make buttons align */
    .action-btn {
      padding: 6px 12px;
    }

    .replay-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      min-height: 38px;
      padding: 0 10px;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      color: var(--txt-dim);
      background: rgba(0, 0, 0, 0.16);
      white-space: nowrap;
    }
    
    /* AA Replay view mode toggle button */
    .dock-item.mini {
      min-width: 38px;
      padding: 0 12px;
    }
    
    .dock-item.mini .icon {
      font-size: 1.1rem;
    }

    .notifications-layer {
    position: absolute;
    z-index: 90;
    right: 14px;
    bottom: 114px;
    width: min(360px, calc(100vw - 28px));
    display: grid;
    gap: 8px;
    contain: layout size;
  }

  .notice {
    border: 0.5px solid rgba(255, 255, 255, 0.34);
    border-radius: 12px;
    background: rgba(10, 16, 24, 0.82);
    backdrop-filter: blur(20px) saturate(138%);
    padding: 10px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
  }

  .notice.high {
    border-color: rgba(255, 120, 90, 0.72);
  }

  .notice.bankruptcy {
    border-color: rgba(255, 196, 120, 0.9);
    background: linear-gradient(180deg, rgba(32, 20, 14, 0.95), rgba(15, 11, 10, 0.92));
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 236, 214, 0.09);
  }

  .notice.bankruptcy .notice-head strong {
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #ffd8ac;
  }

  .notice.medium {
    border-color: rgba(88, 171, 255, 0.56);
  }

  .notice.low {
    border-color: rgba(148, 176, 202, 0.42);
  }

  .notice-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .notice p {
    margin: 0;
    font-size: 0.78rem;
    color: var(--txt-dim);
    line-height: 1.35;
  }

  .dock-item {
    border: 0;
    border-radius: 18px;
    background: transparent;
    color: var(--txt);
    padding: 0;
    width: auto;
    height: 64px;
    min-width: 74px;
    padding: 4px 6px 5px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 220ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 220ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    flex: 1 1 0;
  }

  .dock-item:hover {
    transform: translateY(-1px) scale(1.03);
    filter: brightness(1.07);
    background: rgba(86, 160, 230, 0.12);
    box-shadow: inset 0 0 0 1px rgba(139, 200, 255, 0.3), 0 10px 22px rgba(0, 0, 0, 0.26);
  }

  .dock-item:active {
    transform: scale(0.98);
  }

  .dock-item.active {
    filter: brightness(1.08);
  }

  .dock-item .icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    transition: box-shadow 180ms ease, background-color 180ms ease;
  }

  .dock-item .icon svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: rgba(237, 244, 255, 0.92);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 150ms ease, stroke 160ms ease, filter 180ms ease;
  }

  .dock-item:hover .icon svg {
    transform: scale(1.05);
    stroke: rgba(255, 255, 255, 0.98);
    filter: drop-shadow(0 0 7px rgba(58, 156, 255, 0.35));
  }

  .dock-item:active .icon svg {
    transform: scale(0.96);
  }

  .dock-item .label {
    font-size: 10.5px;
    line-height: 1.1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(237, 244, 255, 0.92);
    position: static;
    transform: none;
    white-space: nowrap;
    opacity: 0.92;
    pointer-events: none;
    transition: opacity 160ms ease;
  }

  .active-pill {
    position: absolute;
    left: 50%;
    transform: translateX(-50%) scale(0.85);
    bottom: 2px;
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: rgba(147, 208, 255, 0.95);
    opacity: 0;
    transition: opacity 180ms ease, transform 180ms ease;
  }

  .dock-item.active .active-pill {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }

  .dock-item:hover .label,
  .dock-item.active .label {
    opacity: 1;
  }

  .dock-item.active .icon svg {
    fill: rgba(112, 187, 255, 0.14);
    stroke: rgba(216, 238, 255, 0.98);
    filter: drop-shadow(0 0 10px rgba(82, 167, 255, 0.5));
  }

  .dock-item.active .icon {
    background: rgba(58, 156, 255, 0.12);
    box-shadow: 0 0 0 1px rgba(111, 186, 255, 0.45), 0 0 20px rgba(58, 156, 255, 0.4);
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    padding: 6px;
    margin-bottom: 8px;
  }

  .segmented button {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--txt-dim);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .segmented button.active {
    color: #e4f1ff;
    border-color: rgba(108, 182, 255, 0.45);
    background: rgba(58, 156, 255, 0.2);
  }

  .stats-unique-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }

  .spec-panels-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }

  .spec-disaster-wrap {
    margin-top: 10px;
  }

  .data-card {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: linear-gradient(175deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.01));
    padding: 8px;
    min-height: 78px;
    display: grid;
    gap: 8px;
  }

  .data-card.wide {
    grid-column: span 2;
  }

  .compact-card {
    min-height: 0;
  }

  .compact-card header strong {
    font-size: 0.8rem;
  }

  .compact-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .compact-metrics div {
    display: grid;
    gap: 2px;
    padding: 8px 9px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .compact-metrics span {
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--txt-dim);
  }

  .compact-metrics strong {
    font-size: 0.8rem;
    color: #edf6ff;
  }

  .data-card header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .data-card header span {
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--txt-dim);
  }

  .data-card header strong {
    font-size: 0.86rem;
    color: #edf6ff;
  }

  .data-card svg {
    width: 100%;
    height: 34px;
  }

  .data-card polyline {
    fill: none;
    stroke: rgba(134, 199, 255, 0.95);
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .data-card polyline.r {
    stroke: rgba(102, 204, 126, 0.94);
  }

  .data-card polyline.c {
    stroke: rgba(111, 180, 255, 0.94);
  }

  .data-card polyline.i {
    stroke: rgba(243, 221, 94, 0.95);
  }

  .data-card polyline.hq-line {
    stroke: rgba(207, 224, 255, 0.94);
  }

  .meter {
    height: 8px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .meter span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(123, 209, 255, 0.72), rgba(123, 209, 255, 0.98));
  }

  .meter.warning span {
    background: linear-gradient(90deg, rgba(250, 208, 117, 0.68), rgba(247, 168, 81, 0.94));
  }

  .meter.danger span {
    background: linear-gradient(90deg, rgba(255, 131, 131, 0.68), rgba(251, 91, 91, 0.94));
  }

  .overlay-chips {
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .tool-options-panel {
    position: absolute;
    z-index: 70;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(104px + env(safe-area-inset-bottom));
    width: min(360px, calc(100vw - 32px));
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 14px;
    background: linear-gradient(175deg, rgba(13, 21, 30, 0.84), rgba(8, 14, 21, 0.74));
    backdrop-filter: blur(12px) saturate(180%);
    padding: 8px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 10px 22px rgba(0, 0, 0, 0.28);
    contain: layout size;
    animation: shelf-fade 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .tool-options-panel header {
    display: grid;
    gap: 3px;
    margin-bottom: 10px;
  }

  .tool-options-panel header span {
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--txt-dim);
  }

  .tool-options-panel header strong {
    font-size: 0.86rem;
    color: #edf6ff;
  }

  .tool-options-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .stagger-item {
    opacity: 0;
    transform: translateY(6px) scale(0.985);
    animation: item-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: calc(var(--stagger, 0) * 10ms);
  }

  /* Unaffordable building button styling */
  .stagger-item.unaffordable {
    opacity: 0.35 !important;
    filter: grayscale(80%);
    cursor: not-allowed;
    position: relative;
  }
  .stagger-item.unaffordable::after {
    content: '🔒';
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 0.7rem;
    opacity: 0.7;
  }
  .stagger-item.unaffordable small {
    color: #ff6b6b;
    font-weight: 700;
  }

  .stats-unique-grid .data-card {
    opacity: 0;
    transform: translateY(6px) scale(0.985);
    animation: item-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .stats-unique-grid .data-card:nth-child(1) { animation-delay: 0ms; }
  .stats-unique-grid .data-card:nth-child(2) { animation-delay: 50ms; }
  .stats-unique-grid .data-card:nth-child(3) { animation-delay: 100ms; }

  @keyframes shelf-fade {
    from {
      opacity: 0;
      filter: saturate(90%);
    }
    to {
      opacity: 1;
      filter: saturate(100%);
    }
  }

  @keyframes item-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .game-over-overlay {
    position: absolute;
    inset: 0;
    z-index: 120;
    background: rgba(5, 8, 12, 0.6);
    backdrop-filter: blur(6px);
    display: grid;
    place-items: center;
  }

  .game-over-card {
    width: min(520px, calc(100vw - 24px));
    border: 0.5px solid rgba(255, 255, 255, 0.36);
    border-radius: 18px;
    background: rgba(11, 16, 24, 0.9);
    backdrop-filter: blur(20px) saturate(132%);
    padding: 18px;
    box-shadow: 0 22px 52px rgba(0, 0, 0, 0.34);
    display: grid;
    gap: 10px;
  }

  .game-over-card h2 {
    margin: 0;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #ffd8ac;
  }

  .game-over-card p {
    margin: 0;
    color: var(--txt-dim);
    line-height: 1.45;
    font-size: 0.84rem;
  }

  .accordion-tabs button,
  .chip.mini {
    border: 1px solid var(--line-soft);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--txt);
    cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease, transform 120ms ease;
  }

  .mini-title {
    margin-top: 10px;
    font-size: 0.74rem;
    color: var(--txt-dim);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .chip.mini {
    border-radius: 999px;
    padding: 6px 9px;
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  @media (max-width: 1180px) {
    .bottom-dock {
      width: min(100vw - 16px, 1100px);
      justify-content: flex-start;
      gap: 16px;
      padding: 10px 14px;
    }

    .dock-section {
      flex-shrink: 0;
    }

    .dock-divider {
      display: none;
    }

    .context-shelf {
      bottom: 132px;
      min-height: 34vh;
      max-height: 66vh;
    }

    .spec-panels-grid {
      grid-template-columns: 1fr;
    }

    .stats-unique-grid {
      grid-template-columns: 1fr;
    }

    .compact-metrics {
      grid-template-columns: 1fr;
    }

  }

  @media (max-width: 740px) {
    .bottom-dock {
      width: calc(100vw - 12px);
      height: 64px;
      min-height: auto;
      padding: 0 12px;
      gap: 14px;
      border-radius: 18px;
      justify-content: flex-start;
    }

    .dock-block {
      flex-shrink: 0;
    }

    .dock-item {
      min-width: 64px;
      height: 52px;
      border-radius: 14px;
      padding: 2px 4px;
    }

    .dock-item .icon {
      width: 32px;
      height: 32px;
      font-size: 1.25rem;
    }

    .dock-item .icon svg {
      width: 22px;
      height: 22px;
    }

    .dock-item .label {
      font-size: 8px;
      letter-spacing: 0.04em;
    }

    .info-metric {
      min-width: 42px;
      padding: 2px 6px;
      border-radius: 10px;
    }

    .info-metric strong {
      font-size: 0.72rem;
    }

    .info-metric small {
      font-size: 0.55rem;
    }

    .active-tool-indicator {
      top: 110px;
      font-size: 0.72rem;
      padding: 8px 12px;
      max-width: calc(100vw - 22px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .context-shelf {
      width: calc(100vw - 18px);
      left: 9px;
      transform: none;
      min-height: 38vh;
      max-height: 62vh;
      padding-bottom: 14px;
    }

    .tool-options-panel {
      left: 50%;
      transform: translateX(-50%);
      bottom: 102px;
      width: calc(100vw - 18px);
    }

  }

  .global-loader-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000; /* Higher than everything else */
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(12px) saturate(160%);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .loader-content {
    background: linear-gradient(155deg, rgba(17, 24, 35, 0.94), rgba(23, 32, 44, 0.88));
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 28px;
    padding: 36px 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    box-shadow: 0 32px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    animation: loader-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes loader-pop {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .spinner {
    width: 44px;
    height: 44px;
    border: 3.5px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loader-content span {
    font-size: 1rem;
    font-weight: 600;
    color: var(--txt);
    letter-spacing: 0.03em;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }
</style>
// force reload 1776247233
