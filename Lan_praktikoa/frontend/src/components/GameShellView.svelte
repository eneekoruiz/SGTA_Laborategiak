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
  import RivalCityView from './RivalCityView.svelte';
  import PerformanceMeter from './PerformanceMeter.svelte';
  import KeyboardLegend from './KeyboardLegend.svelte';
  import CheatConsole from './CheatConsole.svelte';
  import { SimHiriAPI as apiService } from '../services/apiService';
  import { navigate } from '../services/router';
  import * as gameStore from '../store/game';
  import {
    clearNotification as dismissStoredNotification,
    notifications as notificationsStore,
    pushNotification as pushStoredNotification,
    toggleCheatConsole,
    type NotificationPriority,
    type UINotification
  } from '../store/ui';
  import { formatGameDate } from '../lib/utils/date';
  import type {
    AITurnAction,
    BuildingType,
    GameState,
    InfrastructureType,
    StatsResponse,
    Tile,
    ZoneType
  } from '../types/game';

  type ToolMode = 'zone' | 'infrastructure' | 'building' | null;
  type InfraGroup = 'roads' | 'water' | 'power' | 'transit';
  type ShelfType = 'zones' | 'roads' | 'buildings' | 'stats' | 'rival' | 'newspaper' | null;

  let loading = true;
  let error = '';

  let gameId = 'game-001';
  let gameState: GameState | null = null;
  let stats: StatsResponse | null = null;
  let liveTiles: Tile[][] = [];

  let selectedZone: ZoneType | null = null;
  let selectedInfra: InfrastructureType | null = null;
  let selectedBuilding: BuildingType | null = null;
  let toolMode: ToolMode = null;
  let bulldozerActive = false;

  let undergroundMode = false;
  let showStatusIcons = false;
  let activeOverlay: string | null = null;
  let aiFocusTile: { x: number; y: number; zoom?: number } | null = null;

  let activeShelf: ShelfType = null;
  let activeInfraGroup: InfraGroup = 'roads';

  let endMonthPending = false;
  let savePending = false;
  let isGameOver = false;
  let gameOverMessage = '';
  let autoAdvance = false;
  let autoAdvanceTimer: ReturnType<typeof setInterval> | null = null;

  let notifications: UINotification[] = [];
  let silentAIDotCount = 0;
  let showPerfMeter = false;
  const buildingPlacementPending = new Set<string>();
  let unsubscribeGameState: (() => void) | null = null;
  let unsubscribeStats: (() => void) | null = null;
  let unsubscribeNotifications: (() => void) | null = null;
  let unsubscribeMetricHistory: (() => void) | null = null;
  let metricHistory: gameStore.MetricHistoryPoint[] = [];
  let populationHistory: number[] = [];
  let treasuryHistory: number[] = [];
  let rciHistory: Array<{ r: number; c: number; i: number }> = [];
  const dirtyTileKeys = new Set<string>();

  function buildingCostFor(type: BuildingType | null): number {
    if (!type) return 0;
    const entry = buildingTools.find((tool) => tool.value === type) ?? serviceBuildingTools.find((tool) => tool.value === type);
    return entry?.cost ?? 1000;
  }

  function isInteractionLocked(): boolean {
    return isGameOver || activeShelf !== null || endMonthPending || savePending;
  }

  function isRuinTile(tile: Tile | null): boolean {
    return tile?.building?.type === 'ruin';
  }

  const zoneTools: Array<{ label: string; value: ZoneType; accent: string }> = [
    { label: 'Erresidentzial arina', value: 'residential_light', accent: '#6fd98f' },
    { label: 'Erresidentzial trinkoa', value: 'residential_dense', accent: '#44b26a' },
    { label: 'Komertzial arina', value: 'commercial_light', accent: '#57a7ff' },
    { label: 'Komertzial trinkoa', value: 'commercial_dense', accent: '#3489e5' },
    { label: 'Industrial arina', value: 'industrial_light', accent: '#e3d360' },
    { label: 'Industrial trinkoa', value: 'industrial_dense', accent: '#c7b849' }
  ];

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

  const buildingTools: Array<{ label: string; value: BuildingType; cost: number }> = [
    { label: 'Ikatz zentrala', value: 'coal_power', cost: 4000 },
    { label: 'Zentral nuklearra', value: 'nuclear_power', cost: 15000 },
    { label: 'Polizia etxea', value: 'police_station', cost: 500 },
    { label: 'Suhiltzaile etxea', value: 'fire_station', cost: 500 },
    { label: 'Ospitalea', value: 'hospital', cost: 500 },
    { label: 'Eskola', value: 'school', cost: 250 },
    { label: 'Bus geltokia', value: 'bus_depot', cost: 250 },
    { label: 'Ur-ponpa', value: 'water_pump', cost: 100 }
  ];

  const overlayTools = [
    'crime',
    'pollution_air',
    'pollution_water',
    'land_value',
    'traffic',
    'power',
    'water',
    'fire_coverage',
    'police_coverage'
  ];

  const SURFACE_INFRA_TYPES = new Set<InfrastructureType>(['road', 'highway', 'highway_ramp', 'power_line', 'rail']);
  const UNDERGROUND_INFRA_TYPES = new Set<InfrastructureType>(['water_pipe', 'subway', 'subway_tunnel']);

  const bottomDockItems: Array<{ id: Exclude<ShelfType, null>; label: string }> = [
    { id: 'zones', label: 'Zonak' },
    { id: 'roads', label: 'Azpiegiturak' },
    { id: 'buildings', label: 'Eraikinak' },
    { id: 'stats', label: 'Estatistikak' },
    { id: 'rival', label: 'AA aurkaria' },
    { id: 'newspaper', label: 'Egunkaria' }
  ];

  const serviceBuildingTools: Array<{ label: string; value: BuildingType; cost: number }> = [
    { label: 'Polizia', value: 'police_station', cost: 500 },
    { label: 'Suhiltzaileak', value: 'fire_station', cost: 500 },
    { label: 'Ospitalea', value: 'hospital', cost: 500 },
    { label: 'Eskola', value: 'school', cost: 250 }
  ];

  function cloneTiles(data: Tile[][]): Tile[][] {
    return data.map((row) =>
      row.map((tile) => ({
        ...tile,
        infrastructure: [...tile.infrastructure],
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
        surfaceEntity:
          tile.building
            ? { type: 'building', value: String(tile.building.type) }
            : tile.zone
              ? { type: 'zone', value: tile.zone.type }
              : tile.infrastructure.find((infra) => SURFACE_INFRA_TYPES.has(infra))
                ? {
                    type: 'infrastructure',
                    value: String(tile.infrastructure.find((infra) => SURFACE_INFRA_TYPES.has(infra)))
                  }
                : null,
        undergroundEntity: tile.infrastructure.find((infra) => UNDERGROUND_INFRA_TYPES.has(infra))
          ? {
              type: 'infrastructure',
              value: String(tile.infrastructure.find((infra) => UNDERGROUND_INFRA_TYPES.has(infra)))
            }
          : null
      }))
    );
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

  function mergeTilesPreservingDirty(nextTiles: Tile[][]): Tile[][] {
    if (dirtyTileKeys.size === 0) return cloneTiles(nextTiles);

    return nextTiles.map((row, y) =>
      row.map((tile, x) => {
        if (!dirtyTileKeys.has(tileKey(x, y))) {
          return {
            ...tile,
            infrastructure: [...tile.infrastructure],
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
              : null
          };
        }

        const currentTile = liveTiles[y]?.[x] ?? tile;
        return {
          ...currentTile,
          infrastructure: [...currentTile.infrastructure],
          zone: currentTile.zone
            ? {
                ...currentTile.zone,
                position: { ...currentTile.zone.position },
                size: { ...currentTile.zone.size }
              }
            : null,
          building: currentTile.building
            ? {
                ...currentTile.building,
                position: { ...currentTile.building.position },
                size: { ...currentTile.building.size }
              }
            : null
        };
      })
    );
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

    autoAdvanceTimer = window.setInterval(() => {
      void endMonth();
    }, 10000);
  }

  function tileAt(point: { x: number; y: number }): Tile | null {
    if (!liveTiles[point.y] || !liveTiles[point.y][point.x]) return null;
    return liveTiles[point.y][point.x];
  }

  function isSurfaceOccupied(tile: Tile | null): boolean {
    if (!tile) return false;
    return Boolean(tile.building || tile.zone || tile.infrastructure.some((infra) => SURFACE_INFRA_TYPES.has(infra)));
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
    if (bulldozerActive && selectedBuilding) return `Bulldozer + ${selectedBuilding.replace(/_/g, ' ')}`;
    if (bulldozerActive && selectedInfra) return `Bulldozer + ${selectedInfra.replace(/_/g, ' ')}`;
    if (bulldozerActive && selectedZone) return `Bulldozer + ${selectedZone.replace(/_/g, ' ')}`;
    if (bulldozerActive) return 'Bulldozer active';
    if (selectedBuilding) return `Building: ${selectedBuilding.replace(/_/g, ' ')}`;
    if (selectedInfra) return `Infrastructure: ${selectedInfra.replace(/_/g, ' ')}`;
    if (selectedZone) return `Zone: ${selectedZone.replace(/_/g, ' ')}`;
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
    toolMode = selectedZone ? 'zone' : null;
    if (selectedZone) activeShelf = null;
  }

  function chooseInfrastructure(infra: InfrastructureType): void {
    if (isGameOver) return;
    selectedInfra = selectedInfra === infra ? null : infra;
    selectedZone = null;
    selectedBuilding = null;
    toolMode = selectedInfra ? 'infrastructure' : null;

    const underground = infra === 'water_pipe' || infra === 'subway_tunnel';
    if (underground !== undergroundMode) undergroundMode = underground;
    if (selectedInfra) activeShelf = null;
  }

  function toggleBulldozer(): void {
    if (isGameOver) return;
    bulldozerActive = !bulldozerActive;
  }

  function chooseBuilding(building: BuildingType): void {
    if (isGameOver) return;
    selectedBuilding = selectedBuilding === building ? null : building;
    selectedZone = null;
    selectedInfra = null;
    toolMode = selectedBuilding ? 'building' : null;
    if (selectedBuilding) activeShelf = null;
  }

  function openShelf(shelf: Exclude<ShelfType, null>): void {
    if (isGameOver) return;
    activeShelf = activeShelf === shelf ? null : shelf;
    if (shelf === 'roads') {
      activeInfraGroup = 'roads';
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
    if (savePending) return;
    savePending = true;
    try {
      await apiService.saveGame(gameId);
      pushNotification('Gordeta', 'Partidaren egoera ondo gorde da.', 'medium');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ezin izan da partida gorde';
      pushNotification('Gordetze errorea', message, 'high', true);
    } finally {
      savePending = false;
    }
  }

  async function endMonth(): Promise<void> {
    if (endMonthPending || isGameOver) return;
    endMonthPending = true;

    try {
      const result = await apiService.endMonth(gameId);
      if (result.success && result.game_state) {
        gameState = result.game_state;
        liveTiles = cloneTiles(result.game_state.map.tiles);
        gameStore.setGameState(result.game_state);
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

      gameStore.setAiTurn(result.ai_turn ?? null);

      const shouldReplayAiActions = Boolean(result.ai_turn?.requires_client_replay);
      const replayActions = Array.isArray(result.ai_turn?.actions)
        ? (result.ai_turn.actions as AITurnAction[])
        : [];

      if (shouldReplayAiActions && replayActions.length > 0) {
        await apiService.executeAiTurnActions(gameId, replayActions);
        const [postReplayGame, postReplayStats] = await Promise.all([
          apiService.getGame(gameId),
          apiService.getStats(gameId)
        ]);
        gameState = postReplayGame.game_state;
        liveTiles = cloneTiles(postReplayGame.game_state.map.tiles);
        stats = postReplayStats;
        gameStore.setGameState(postReplayGame.game_state);
        gameStore.setStats(postReplayStats);
      }

      if (result.victory_check?.status === 'player_bankrupt') {
        pushNotification('Porrota', 'Altxorra -100,000 azpitik egon da 12 hilabetez jarraian. Administrazioa desegin da.', 'high', true);
      }

      const aiActions = Array.isArray(result.ai_turn?.actions) ? result.ai_turn.actions.length : 0;
      const aiReasoning = typeof result.ai_turn?.reasoning === 'string' ? result.ai_turn.reasoning : '';
      pushNotification(
        'AA txanda osatuta',
        aiActions > 0 ? `${aiActions} AA ekintza exekutatu dira.` : 'AAk txanda osatu du.',
        'low'
      );

      if (aiReasoning) {
        pushNotification('Aholkulariaren mezua', aiReasoning.slice(0, 140), 'medium');
      }

      const focusCandidate = result.ai_turn?.actions?.find(
        (action: { position?: { x: number; y: number } }) =>
          action?.position && typeof action.position.x === 'number' && typeof action.position.y === 'number'
      );
      if (focusCandidate?.position) {
        aiFocusTile = { x: focusCandidate.position.x, y: focusCandidate.position.y, zoom: 1.3 };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ezin izan da hilabetea amaitu';
      pushNotification('Simulazio errorea', message, 'high', true);
    } finally {
      endMonthPending = false;
    }
  }

  async function handleBuildingPlacement(event: CustomEvent<{ x: number; y: number }>): Promise<void> {
    if (!selectedBuilding || !gameState || isGameOver) return;

    const { x, y } = event.detail;
    const key = `${x}:${y}`;
    if (buildingPlacementPending.has(key)) return;

    const cost = buildingCostFor(selectedBuilding);
    if (gameState.player_city.treasury < cost) {
      pushNotification('Blokeatuta', 'Ez dago altxor nahikorik eraikin honetarako.', 'high', true);
      return;
    }

    const tile = tileAt({ x, y });
    if (isRuinTile(tile)) {
      pushNotification('Eraikuntza blokeatuta', 'Hondakinak Bulldozerrarekin garbitu behar dira berreraiki aurretik.', 'high', true);
      return;
    }
    if (!bulldozerActive && isSurfaceOccupied(tile)) {
      pushNotification('Eraikuntza blokeatuta', 'Azaleko laukia okupatuta dago. Aktibatu Bulldozer ordezkatzeko.', 'medium');
      return;
    }

    const previousTile = tile
      ? {
          ...tile,
          infrastructure: [...tile.infrastructure],
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
      tile.zone = null;
      tile.building = {
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
      };
      tile.surfaceEntity = { type: 'building', value: selectedBuilding };
      liveTiles = cloneTiles(liveTiles);
    }

    buildingPlacementPending.add(key);
    try {
      const result = await apiService.placeBuilding(gameId, selectedBuilding, { x, y });
      if (result.success && result.game_state) {
        gameState = result.game_state;
        liveTiles = cloneTiles(result.game_state.map.tiles);
        stats = await apiService.getStats(gameId);
      }
    } catch (e) {
      if (previousTile && liveTiles[y]?.[x]) {
        liveTiles[y][x] = previousTile;
        liveTiles = cloneTiles(liveTiles);
      }
      const message = e instanceof Error ? e.message : 'Ezin izan da eraikina kokatu';
      pushNotification('Eraikuntza errorea', message, 'high', true);
    } finally {
      buildingPlacementPending.delete(key);
    }
  }

  function handleOccupiedAttempt(event: CustomEvent<{ x: number; y: number; message: string }>): void {
    if (isGameOver) return;
    const details = event.detail;
    if (!details?.message) return;
    pushNotification('Kokapena blokeatuta', details.message, 'medium');
  }

  async function handleBulldozerCleared(
    event: CustomEvent<{
      updatedTiles: Array<{ x: number; y: number }>;
      tilesSnapshot: Tile[][];
      cost: number;
      demolitions: Array<{ x: number; y: number; type: string }>;
    }>
  ): Promise<void> {
    liveTiles = cloneTiles(event.detail.tilesSnapshot);
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
      liveTiles = cloneTiles(latest.value.game_state.map.tiles);
    }

    const net = totalRefund - totalCost;
    pushNotification(
      'Eraispena osatuta',
      `Itzulketa §${Math.round(totalRefund).toLocaleString()} | Tasak §${Math.round(totalCost).toLocaleString()} | Garbia §${Math.round(net).toLocaleString()}`,
      'medium'
    );

    try {
      stats = await apiService.getStats(gameId);
    } catch {
      pushNotification('Estatistikak atzeratuta', 'Eraispena aplikatu da, baina estatistiken freskapenak huts egin du.', 'medium');
    }
  }

  async function handleZonePaint(
    event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }>; tilesSnapshot: Tile[][] }>
  ): Promise<void> {
    if (isGameOver) return;
    liveTiles = cloneTiles(event.detail.tilesSnapshot);
    if (!selectedZone || event.detail.updatedTiles.length === 0) return;

    const requests = event.detail.updatedTiles.map((point) =>
      apiService.placeZone(gameId, selectedZone as ZoneType, point, { w: 1, h: 1 })
    );

    const results = await Promise.allSettled(requests);
    const latest = [...results].reverse().find((result) => result.status === 'fulfilled');

    if (latest && latest.status === 'fulfilled' && latest.value?.game_state) {
      gameState = latest.value.game_state;
      liveTiles = cloneTiles(latest.value.game_state.map.tiles);
      stats = await apiService.getStats(gameId);
    }
  }

  async function handleZoneBuffered(
    event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }>; tilesSnapshot: Tile[][] }>
  ): Promise<void> {
    if (isGameOver) return;
    if (!selectedZone || event.detail.updatedTiles.length === 0) return;

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
        const fresh = await apiService.getGame(gameId);
        gameState = fresh.game_state;
      }
    } finally {
      releaseDirtyTiles(event.detail.updatedTiles);
    }
  }

  async function handleInfraDraw(
    event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }>; tilesSnapshot: Tile[][] }>
  ): Promise<void> {
    if (isGameOver) return;
    liveTiles = cloneTiles(event.detail.tilesSnapshot);
    if (!selectedInfra || event.detail.updatedTiles.length === 0) return;

    try {
      const segments = event.detail.updatedTiles.map((point) => ({ from: point, to: point }));
      const result = await apiService.placeInfrastructure(gameId, selectedInfra, segments);
      if (result.success && result.game_state) {
        gameState = result.game_state;
        liveTiles = cloneTiles(result.game_state.map.tiles);
        stats = await apiService.getStats(gameId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ezin izan da azpiegitura kokatu';
      pushNotification('Azpiegitura errorea', message, 'high', true);
    }
  }

  async function handleInfraBuffered(
    event: CustomEvent<{ updatedTiles: Array<{ x: number; y: number }>; tilesSnapshot: Tile[][] }>
  ): Promise<void> {
    if (isGameOver) return;
    if (!selectedInfra || event.detail.updatedTiles.length === 0) return;

    markDirtyTiles(event.detail.updatedTiles);

    try {
      const segments = event.detail.updatedTiles.map((point) => ({ from: point, to: point }));
      await apiService.placeInfrastructure(gameId, selectedInfra, segments);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Azpiegitura trazua ezin izan da baieztatu.';
      pushNotification('Azpiegitura atzeratuta', message, 'high', false, { dragOperation: true, isError: true });
      const fresh = await apiService.getGame(gameId);
      gameState = fresh.game_state;
    } finally {
      releaseDirtyTiles(event.detail.updatedTiles);
    }
  }

  function backToGames(): void {
    navigate('/games', true);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      activeShelf = null;
      bulldozerActive = false;
      clearToolSelection();
      return;
    }

    if (event.key.toLowerCase() === 'u') {
      undergroundMode = !undergroundMode;
    }

    if (event.ctrlKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      showPerfMeter = !showPerfMeter;
    }

    if (event.ctrlKey && event.key === 'Tab') {
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
    if (activeShelf === 'newspaper') activeShelf = null;
  }

  $: populationHistory = metricHistory.map((entry) => entry.population);
  $: treasuryHistory = metricHistory.map((entry) => entry.treasury);
  $: rciHistory = metricHistory.map((entry) => entry.rci);

  $: if (gameState?.map?.tiles && gameState.map.tiles !== liveTiles) {
    liveTiles = cloneTiles(gameState.map.tiles);
  }

  $: isGameOver = Boolean(
    gameState && (gameState.player_city.months_bankrupt >= 12 || gameState.victory_status === 'player_bankrupt')
  );

  $: gameOverMessage = isGameOver
    ? 'Partida amaituta: altxorra -100,000 azpitik egon da 12 hilabetez jarraian. Hiri tresna guztiak blokeatuta daude.'
    : '';

  onMount(async () => {
    const routeMatch = window.location.pathname.match(/^\/game\/([^/]+)$/);
    if (routeMatch) gameId = decodeURIComponent(routeMatch[1]);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    try {
      const [gameRes, statsRes] = await Promise.all([apiService.getGame(gameId), apiService.getStats(gameId)]);
      gameState = gameRes.game_state;
      stats = statsRes;
      liveTiles = cloneTiles(gameRes.game_state.map.tiles);
      gameStore.setGameState(gameRes.game_state);
      gameStore.setStats(statsRes);
      gameStore.setAiTurn(null);

      unsubscribeGameState = gameStore.gameState.subscribe((value) => {
        if (!value) return;
        gameState = value;
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

      pushNotification('Saioa kargatuta', `Ongi etorri berriro, Alkate ${gameRes.game_state.player_city.name}.`, 'medium');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Errorea partida kargatzean';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    unsubscribeGameState?.();
    unsubscribeStats?.();
    unsubscribeNotifications?.();
    unsubscribeMetricHistory?.();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });
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
        inputLocked={isInteractionLocked()}
        playerTreasury={gameState.player_city.treasury}
        selectedBuildingCost={buildingCostFor(selectedBuilding)}
        undergroundMode={undergroundMode}
        showInfrastructure={true}
        showZones={true}
        showStatusIcons={showStatusIcons}
        activeOverlay={activeOverlay}
        focusTile={aiFocusTile}
        on:zonePainted={handleZonePaint}
        on:zoneBuffered={handleZoneBuffered}
        on:infrastructureDrawn={handleInfraDraw}
        on:infrastructureBuffered={handleInfraBuffered}
        on:bulldozerCleared={handleBulldozerCleared}
        on:tileClicked={handleBuildingPlacement}
        on:occupiedAttempt={handleOccupiedAttempt}
        on:mapClicked={closeShelfOnMapInteraction}
      />

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

      <header class="topbar" in:fade={{ duration: 220 }}>
        <button class="chip back" on:click={backToGames}>Atzera</button>

        <div class="hud-group">
          <div class="hud-item">
            <span class="hud-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 10h16M6 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>
            </span>
            <div class="hud-meta">
              <span class="label">Data</span>
              <strong>{gameState.current_date.year}/{String(gameState.current_date.month).padStart(2, '0')}</strong>
            </div>
          </div>
          <div class="hud-item">
            <span class="hud-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 20v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>
            </span>
            <div class="hud-meta">
              <span class="label">Biztanleria</span>
              <strong>{stats.player.population.toLocaleString()}</strong>
            </div>
          </div>
          <div class="hud-item">
            <span class="hud-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16M6.5 6.5c1.4-1.4 3.4-2.3 5.5-2.3s4.1.9 5.5 2.3M6.5 17.5c1.4 1.4 3.4 2.3 5.5 2.3s4.1-.9 5.5-2.3"/></svg>
            </span>
            <div class="hud-meta">
              <span class="label">Altxorra</span>
              <strong>§{Math.round(stats.player.treasury).toLocaleString()}</strong>
            </div>
          </div>
          <div class="hud-item compact">
            <span class="hud-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 19V9M12 19V5M19 19v-8"/></svg>
            </span>
            <div class="hud-meta">
              <span class="label">RCI</span>
              <strong>
                R {stats.player.rci_demand.r} / C {stats.player.rci_demand.c} / I {stats.player.rci_demand.i}
              </strong>
            </div>
          </div>
        </div>

        <div class="top-actions">
          <button class="chip" class:active-chip={bulldozerActive} on:click={toggleBulldozer} disabled={isGameOver}>
            {bulldozerActive ? 'Bulldozer aktibo' : 'Bulldozer itzalita'}
          </button>
          <button class="chip" disabled={savePending || isGameOver} on:click={() => void saveGame()}>
            {savePending ? 'Gordetzen...' : 'Gorde'}
          </button>
          <div class="button-group">
            <button class="chip accent" disabled={endMonthPending || isGameOver} on:click={() => void endMonth()}>
              {endMonthPending ? 'Simulatzen...' : 'Hilabetea amaitu'}
            </button>
            <button 
              class="chip auto-toggle" 
              class:active={autoAdvance}
              disabled={isGameOver}
              on:click={() => {
                autoAdvance = !autoAdvance;
                syncAutoAdvanceTimer();
              }}
              title="Auto-aurrerapena hilero (10s)"
            >
              {autoAdvance ? 'Auto: Piztuta' : 'Auto: Itzalita'}
            </button>
          </div>
          <button
            class="chip ai-chip"
            on:click={() => {
              activeShelf = 'rival';
              silentAIDotCount = 0;
            }}
            aria-label="AA jakinarazpenak"
            disabled={isGameOver}
          >
            AI
            {#if silentAIDotCount > 0}
              <span class="dot"></span>
            {/if}
          </button>
        </div>
      </header>

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
                <button class="stagger-item" style={`--stagger:${idx};`} class:selected={selectedBuilding === tool.value} on:click={() => chooseBuilding(tool.value)} disabled={isGameOver}>
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>
            <div class="mini-title">Zerbitzuak</div>
            <div class="shelf-grid">
              {#each serviceBuildingTools as tool, idx}
                <button class="stagger-item" style={`--stagger:${idx + 3};`} class:selected={selectedBuilding === tool.value} on:click={() => chooseBuilding(tool.value)} disabled={isGameOver}>
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>
            <div class="mini-title">Hezkuntza</div>
            <div class="shelf-grid">
              {#each buildingTools.filter((b) => b.value === 'school') as tool, idx}
                <button class="stagger-item" style={`--stagger:${idx + 6};`} class:selected={selectedBuilding === tool.value} on:click={() => chooseBuilding(tool.value)} disabled={isGameOver}>
                  <strong>{tool.label}</strong>
                  <small>§{tool.cost.toLocaleString()}</small>
                </button>
              {/each}
            </div>
          {/if}

          {#if activeShelf === 'stats'}
            <div class="shelf-head"><h3>Estatistikak</h3></div>
            <section class="stats-dashboard">
              <article class="data-card wide">
                <header>
                  <span>Biztanleriaren joera</span>
                  <strong>{stats.player.population.toLocaleString()}</strong>
                </header>
                <svg viewBox="0 0 164 34" preserveAspectRatio="none" aria-label="Biztanleriaren mini grafikoa">
                  <polyline points={sparklinePoints(populationHistory)} />
                </svg>
              </article>

              <article class="data-card wide">
                <header>
                  <span>Altxorraren joera</span>
                  <strong>§{Math.round(stats.player.treasury).toLocaleString()}</strong>
                </header>
                <svg viewBox="0 0 164 34" preserveAspectRatio="none" aria-label="Altxorraren mini grafikoa">
                  <polyline class="treasury" points={sparklinePoints(treasuryHistory)} />
                </svg>
              </article>

              <article class="data-card">
                <header>
                  <span>Onarpena</span>
                  <strong>{Math.round(stats.player.approval)}%</strong>
                </header>
                <div class="meter"><span style={`width:${metricPct(stats.player.approval, 0, 100)}%`}></span></div>
              </article>

              <article class="data-card">
                <header>
                  <span>Krimen presioa</span>
                  <strong>{Math.round(stats.player.crime_rate)}</strong>
                </header>
                <div class="meter danger"><span style={`width:${metricPct(stats.player.crime_rate, 0, 100)}%`}></span></div>
              </article>

              <article class="data-card">
                <header>
                  <span>Kutsadura</span>
                  <strong>{Math.round(stats.player.pollution)}</strong>
                </header>
                <div class="meter warning"><span style={`width:${metricPct(stats.player.pollution, 0, 100)}%`}></span></div>
              </article>

              <article class="data-card wide">
                <header>
                  <span>RCI momentua</span>
                  <strong>R {stats.player.rci_demand.r} · C {stats.player.rci_demand.c} · I {stats.player.rci_demand.i}</strong>
                </header>
                <svg viewBox="0 0 164 34" preserveAspectRatio="none" aria-label="RCI mini grafikoa">
                  <polyline class="r" points={sparklinePoints(rciHistory.map((entry) => entry.r))} />
                  <polyline class="c" points={sparklinePoints(rciHistory.map((entry) => entry.c))} />
                  <polyline class="i" points={sparklinePoints(rciHistory.map((entry) => entry.i))} />
                </svg>
              </article>
            </section>
            <div class="chips-wrap overlay-chips">
              {#each overlayTools as overlay, idx}
                <button class="chip mini stagger-item" style={`--stagger:${idx};`} class:active={activeOverlay === overlay} on:click={() => (activeOverlay = activeOverlay === overlay ? null : overlay)} disabled={isGameOver}>{overlay}</button>
              {/each}
            </div>
          {/if}

          {#if activeShelf === 'rival'}
            <div class="shelf-head"><h3>AA aurkaria</h3></div>
            <RivalCityView gameState={gameState} stats={stats} aiTiles={gameState.map.tiles} />
          {/if}

          {#if activeShelf === 'newspaper'}
            <div class="shelf-head"><h3>Egunkaria</h3></div>
            <div class="newspaper-card">
              <strong>SimHiri Times</strong>
              <p>{formatGameDate(gameState.current_date)} alea</p>
              <p>Hiriaren biztanleria: {stats.player.population.toLocaleString()}</p>
              <p>Aurkariaren laburpena: {stats.ai.population.toLocaleString()} biztanle</p>
            </div>
          {/if}
        </section>
      {/if}

      <footer class="bottom-dock" class:tool-focused={hasPersistentTool()} in:fade={{ duration: 180 }}>
        {#each bottomDockItems as item}
          <button class="dock-item" class:active={isDockItemActive(item.id)} on:click|stopPropagation={() => openShelf(item.id)} disabled={isGameOver}>
            <span class="icon" aria-hidden="true">
              {#if item.id === 'roads'}
                <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M8 2v20M16 2v20M8 7h8M8 17h8"/></svg>
              {:else if item.id === 'zones'}
                <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M12 2 21 12 12 22 3 12 12 2zm0 5v10M7 12h10"/></svg>
              {:else if item.id === 'buildings'}
                <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M4 21V9l8-5 8 5v12M9 21v-6h6v6"/></svg>
              {:else if item.id === 'stats'}
                <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M5 19V9M12 19V5M19 19v-7"/></svg>
              {:else if item.id === 'rival'}
                <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M5 19V5M5 19h14M10 16v-4M14 16V8M18 16v-6"/></svg>
              {:else}
                <svg viewBox="0 0 24 24"><path vector-effect="non-scaling-stroke" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v3m0 12v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m10-10 2.1-2.1"/></svg>
              {/if}
            </span>
            <span class="label">{item.label}</span>
            <span class="active-pill" aria-hidden="true"></span>
          </button>
        {/each}
      </footer>

      {#if hasPersistentTool()}
        <aside class="tool-options-panel" in:fade={{ duration: 160 }}>
          <header>
            <span>Tresna aukerak</span>
            <strong>{activeToolText()}</strong>
          </header>
          <div class="tool-options-actions">
            {#if selectedInfra}
              <button class="chip mini" on:click={cycleInfraTool} disabled={isGameOver}>Errepide mota aldatu</button>
              <button class="chip mini" on:click={enableInfraBulldozer} disabled={isGameOver}>Errepidea eraitsi</button>
            {:else}
              <button class="chip mini" on:click={toggleBulldozer} disabled={isGameOver}>
                {bulldozerActive ? 'Bulldozer desgaitu' : 'Bulldozer gaitu'}
              </button>
            {/if}
            <button class="chip mini" on:click={closeActiveToolPanel} disabled={isGameOver}>Tresna itxi</button>
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
  <CheatConsole {gameId} on:cheatSubmitted />
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

  .topbar {
    position: absolute;
    z-index: 40;
    left: 14px;
    right: 14px;
    top: 12px;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: center;
    contain: layout size;
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
    z-index: 82;
    left: 50%;
    transform: translateX(-50%);
    bottom: 92px;
    width: min(860px, calc(100vw - 24px));
    min-height: 30vh;
    max-height: min(68vh, 620px);
    overflow-y: auto;
    overflow-x: hidden;
    border: 1px solid var(--glass-panel-border);
    border-radius: 24px;
    background: var(--glass-panel-bg);
    backdrop-filter: blur(24px) saturate(178%);
    box-shadow: 0 22px 52px rgba(0, 0, 0, 0.36), var(--glass-panel-shadow);
    padding: 14px 14px 12px;
    contain: layout size;
    animation: shelf-fade 280ms cubic-bezier(0.22, 1, 0.36, 1);
    scrollbar-width: thin;
    scrollbar-color: rgba(140, 197, 255, 0.6) rgba(255, 255, 255, 0.08);
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
    z-index: 65;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(24px + env(safe-area-inset-bottom));
    width: min(620px, calc(100vw - 24px));
    height: 74px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    padding: 0 18px;
    border: 1px solid var(--glass-panel-border);
    border-radius: 36px;
    background: var(--glass-panel-bg);
    backdrop-filter: blur(24px) saturate(200%);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42), var(--glass-panel-shadow);
    contain: layout size;
    transition: opacity 220ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: visible;
    pointer-events: auto;
  }

  .bottom-dock.tool-focused {
    opacity: 0.96;
    transform: translateX(-50%);
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

  .stats-dashboard {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
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

  .data-card polyline.treasury {
    stroke: rgba(255, 212, 112, 0.95);
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
    z-index: 66;
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

  .stats-dashboard .data-card {
    opacity: 0;
    transform: translateY(6px) scale(0.985);
    animation: item-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .stats-dashboard .data-card:nth-child(1) { animation-delay: 0ms; }
  .stats-dashboard .data-card:nth-child(2) { animation-delay: 50ms; }
  .stats-dashboard .data-card:nth-child(3) { animation-delay: 100ms; }
  .stats-dashboard .data-card:nth-child(4) { animation-delay: 150ms; }
  .stats-dashboard .data-card:nth-child(5) { animation-delay: 200ms; }
  .stats-dashboard .data-card:nth-child(6) { animation-delay: 250ms; }

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
    .topbar {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .hud-group {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .bottom-dock {
      width: min(94vw, 620px);
      gap: 4px;
      bottom: 8px;
      border-radius: 20px;
    }

    .context-shelf {
      bottom: 132px;
      min-height: 34vh;
      max-height: 66vh;
    }

    .stats-dashboard {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .data-card.wide {
      grid-column: span 2;
    }

  }

  @media (max-width: 740px) {
    .bottom-dock {
      width: calc(100vw - 12px);
      height: 68px;
      padding: 0 8px;
      gap: 2px;
    }

    .dock-item {
      min-width: 0;
      height: 58px;
      border-radius: 14px;
      padding: 2px 3px;
    }

    .dock-item .icon {
      width: 42px;
      height: 42px;
    }

    .dock-item .label {
      font-size: 9px;
      letter-spacing: 0.045em;
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
</style>
