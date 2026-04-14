<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { BuildingType, InfrastructureType, Tile, ZoneType } from '../types/game';
  import { performanceMetrics } from '../services/performanceMetrics';
  import { overlayStrength as overlayStrengthStore } from '../store/ui';

  export let tiles: Tile[][] = [];
  export let mapWidth = 64;
  export let mapHeight = 64;
  export let tileWidth = 64;
  export let tileHeight = 32;
  export let selectedTile: { x: number; y: number } | null = null;
  export let zoneTool: ZoneType | null = null;
  export let infrastructureTool: InfrastructureType | null = null;
  export let buildingTool: BuildingType | null = null;
  export let activeTool: 'zone' | 'infrastructure' | 'building' | 'bulldozer' | null = null;
  export let inputLocked = false;
  export let playerTreasury = 0;
  export let selectedBuildingCost = 0;
  export let undergroundMode = false;
  export let showInfrastructure = true;
  export let showZones = true;
  export let showStatusIcons = false;
  export let activeOverlay: string | null = null;
  export let focusTile: { x: number; y: number; zoom?: number } | null = null;
  export let replayBudgetPing: { id: number; x: number; y: number; amount: number } | null = null;
  export let replayDisasterPulse = 0;

  $: void replayBudgetPing;
  $: void replayDisasterPulse;

  type Point = { x: number; y: number };
  type GridPoint = { x: number; y: number };
  type InfraTypedTile = GridPoint & { type: InfrastructureType };
  type StrokeEvent = { updatedTiles: GridPoint[]; tilesSnapshot: Tile[][]; typedUpdates?: InfraTypedTile[] };
  type BulldozeEvent = {
    updatedTiles: GridPoint[];
    tilesSnapshot: Tile[][];
    cost: number;
    demolitions: Array<{ x: number; y: number; type: string }>;
  };
  type Camera = { x: number; y: number; zoom: number };
  type BuildingArchetype =
    | 'residential_house'
    | 'residential_apartment'
    | 'commercial_kiosk'
    | 'commercial_tower'
    | 'industrial_warehouse'
    | 'industrial_factory'
    | 'power_plant_coal'
    | 'power_plant_nuclear'
    | 'utility_water'
    | 'utility_transport'
    | 'service_police'
    | 'service_hospital'
    | 'service_fire'
    | 'service_school'
    | 'service_prison'
    | 'service_education'
    | 'ruin'
    | 'generic';

  type BuildingCacheEntry = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    width: number;
    height: number;
    anchorX: number;
    anchorY: number;
    archetype: BuildingArchetype;
  };

  type EconomyParticle = {
    id: number;
    worldX: number;
    worldY: number;
    value: number;
    color: string;
    createdAt: number;
    ttlMs: number;
    driftY: number;
    size: number;
  };

  type RenderEntry = {
    x: number;
    y: number;
    depth: number;
    tile: Tile;
    c: Point;
  };

  const dispatch = createEventDispatcher<{
    zonePainted: StrokeEvent;
    infrastructureDrawn: StrokeEvent;
    zoneBuffered: StrokeEvent;
    infrastructureBuffered: StrokeEvent;
    bulldozerCleared: BulldozeEvent;
    tileClicked: GridPoint;
    occupiedAttempt: { x: number; y: number; message: string };
    mapClicked: GridPoint | null;
    toolCancelRequested: null;
  }>();

  const MIN_ZOOM = 0.45;
  const MAX_ZOOM = 2.6;
  const ZOOM_LINEAR_SENSITIVITY = 0.0012;
  const PINCH_LINEAR_SENSITIVITY = 0.0032;
  const CAMERA_LERP = 0.22;
  const PAN_INERTIA_FRICTION = 0.88;
  const PAN_INERTIA_EPSILON = 0.03;
  const CAMERA_MARGIN = 120;
  const ROTATION_DURATION_MS = 320;
  const ROTATION_OVERSCAN_PAD_PX = 8;
  const ROTATION_SCALE_START = 1;
  const ROTATION_SCALE_END = 1;
  const ROTATION_SNAPSHOT_ALPHA_MIN = 0.9;
  const SPATIAL_CELL = 8;
  const TARGET_FRAME_MS = 16.67;
  const MIN_PROCESS_BUDGET_MS = 2;
  const MAX_PROCESS_BUDGET_MS = 8;
  const IMMEDIATE_STROKE_BUDGET_MS = 1.4;
  const IMMEDIATE_STROKE_MAX_TILES = 32;
  const BUILDING_CACHE_DPR = 3;
  const BUILDING_VISUAL_SCALE = 1.12;
  const PROXY_SILHOUETTE_SCALE = 1.18;
  const ECONOMY_PARTICLE_TTL_MS = 760;

  let wrapEl: HTMLDivElement;
  let staticCanvasEl: HTMLCanvasElement;
  let dynamicCanvasEl: HTMLCanvasElement;
  let rotationCanvasEl: HTMLCanvasElement;
  let strokeCanvasEl: HTMLCanvasElement;

  let dpr = 1;
  let raf = 0;

  let dynamicCtx: CanvasRenderingContext2D | null = null;
  let staticCtx: CanvasRenderingContext2D | null = null;
  let strokeCtx: CanvasRenderingContext2D | null = null;

  let offscreen: OffscreenCanvas | HTMLCanvasElement | null = null;
  let offscreenCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  let rotationSnapshotCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let rotationSnapshotCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  let rotationCtx: CanvasRenderingContext2D | null = null;
  let rotationVisualActive = false;
  const buildingCache = new Map<string, BuildingCacheEntry>();

  let worldTiles: Tile[][] = [];
  let worldCenters: Point[][] = [];

  let worldOriginX = 0;
  let worldOriginY = 0;
  let worldWidth = 0;
  let worldHeight = 0;

  let staticDirty = true;
  let prevTilesRef: Tile[][] | null = null;

  // Performance: Viewport culling
  let lastCulledRange: { x0: number; y0: number; x1: number; y1: number } | null = null;
  let lastCameraPos = { x: 0, y: 0, zoom: 1 };
  let cullingDirty = true;
  
  // Performance: Overlay debouncing (render every 5 frames)
  let overlayFrameCounter = 0;
  let cachedOverlayFrame = -1;
  let cachedOverlayType: string | null = null;
  let overlayDebounceCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;

  // Dynamic Lighting: Mouse flashlight effect
  let mouseScreenX = 0;
  let mouseScreenY = 0;
  const FLASHLIGHT_INNER_RADIUS = 24;
  const FLASHLIGHT_OUTER_RADIUS = 200;


  const camera: Camera = { x: 0, y: 0, zoom: 1 };
  const cameraTarget: Camera = { x: 0, y: 0, zoom: 1 };

  let isPanning = false;
  let panAnchor: Point | null = null;
  let panVelocity: Point = { x: 0, y: 0 };
  let lastPanMoveTime = 0;
  let isSpacePressed = false;
  let isPinching = false;
  let lastPinchDistance = 0;
  let rotationIndex = 0;
  let rotationFromIndex = 0;
  let rotationToIndex = 0;
  let rotationStartedAt = 0;
  let compassDegrees = 0;
  let rotationSnapshotOffsetX = 0;
  let rotationSnapshotOffsetY = 0;
  let rotationPivotScreenX = 0;
  let rotationPivotScreenY = 0;
  let rotationPivotSnapshotX = 0;
  let rotationPivotSnapshotY = 0;
  let rotationFrozenCamera: Camera = { x: 0, y: 0, zoom: 1 };

  let hoverTile: { x: number; y: number; tile: Tile } | null = null;
  let localSelected: GridPoint | null = null;

  let isZoneStroke = false;
  let isInfraStroke = false;
  let isBulldozeStroke = false;
  let lastZonePoint: GridPoint | null = null;
  let lastInfraPoint: GridPoint | null = null;
  let lastBulldozePoint: GridPoint | null = null;
  let zoneStrokeKeys = new Set<string>();
  let infraStrokeKeys = new Set<string>();
  let bulldozeStrokeKeys = new Set<string>();

  // Performance instrumentation
  let strokeStartTime = 0;
  let strokeTileCount = 0;
  const FRAME_TIME_BUDGET = 10; // ms, leave headroom for other tasks
  let pendingZoneTiles: GridPoint[] = [];
  let pendingInfraTiles: GridPoint[] = [];
  let pendingBulldozeTiles: GridPoint[] = [];
  let queuedZoneKeys = new Set<string>();
  let queuedInfraKeys = new Set<string>();
  let queuedBulldozeKeys = new Set<string>();
  let ghostZoneKeys = new Set<string>();
  let ghostInfraKeys = new Set<string>();
  let ghostBulldozeKeys = new Set<string>();
  let blockedGhostZoneKeys = new Set<string>();
  let blockedGhostInfraKeys = new Set<string>();
  let bulldozeDemolitions: Array<{ x: number; y: number; type: string }> = [];
  let demolitionEffects: Array<{ x: number; y: number; startedAt: number }> = [];
  let economyParticles: EconomyParticle[] = [];
  let strokeSpendTotal = 0;
  let strokeRefundTotal = 0;
  let strokeAnchor: GridPoint | null = null;
  let bufferedZoneKeys = new Set<string>();
  let bufferedInfraKeys = new Set<string>();
  let infraStrokeTypeByKey = new Map<string, InfrastructureType>();
  let strokeFrameTicker = 0;
  let smoothedFrameMs = TARGET_FRAME_MS;
  let lastFrameTimestamp = performance.now();

  const spatialIndex = new Map<string, Set<string>>();

  const zoneTint: Record<string, string> = {
    residential_light: '#4caf50',
    residential_dense: '#419845',
    commercial_light: '#2196f3',
    commercial_dense: '#1f86d8',
    industrial_light: '#ffeb3b',
    industrial_dense: '#f5d522'
  };

  const zonePlacementCost: Record<ZoneType, number> = {
    residential_light: 5,
    residential_dense: 10,
    commercial_light: 5,
    commercial_dense: 10,
    industrial_light: 5,
    industrial_dense: 10
  };

  const ART_PALETTE = {
    asphaltDark: 'rgba(86, 93, 103, 0.92)',
    asphaltMid: 'rgba(112, 120, 132, 0.88)',
    asphaltLight: 'rgba(146, 156, 170, 0.82)',
    metallicA: 'rgba(174, 188, 204, 0.72)',
    metallicB: 'rgba(102, 118, 136, 0.76)',
    railWood: 'rgba(122, 98, 73, 0.86)',
    warning: 'rgba(245, 214, 112, 0.86)',
    electricGlow: 'rgba(255, 232, 117, 0.86)',
    waterGlow: 'rgba(116, 215, 255, 0.88)',
    neonBlue: 'rgba(140, 222, 255, 0.94)',
    lineHighlight: 'rgba(236, 242, 250, 0.22)',
    edgeDark: 'rgba(36, 43, 54, 0.44)',
    edgeLight: 'rgba(242, 248, 255, 0.20)',
    contactShadow: 'rgba(8, 12, 20, 0.26)'
  };

  const infrastructurePlacementCost: Record<InfrastructureType, number> = {
    road: 10,
    highway: 25,
    highway_ramp: 25,
    power_line: 2,
    rail: 3,
    water_pipe: 1,
    subway_tunnel: 5,
    subway: 5
  };

  const SURFACE_INFRA_TYPES = new Set<InfrastructureType>(['road', 'highway', 'highway_ramp', 'power_line', 'rail']);
  const UNDERGROUND_INFRA_TYPES = new Set<InfrastructureType>(['water_pipe', 'subway', 'subway_tunnel']);

  function tileKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  function isUndergroundInfrastructure(type: InfrastructureType): boolean {
    return UNDERGROUND_INFRA_TYPES.has(type);
  }

  function isSurfaceInfrastructure(type: InfrastructureType): boolean {
    return SURFACE_INFRA_TYPES.has(type);
  }

  function getSurfaceInfrastructure(tile: Tile): InfrastructureType | null {
    const infra = Array.isArray(tile.infrastructure) ? tile.infrastructure : [];
    return infra.find((i) => isSurfaceInfrastructure(i)) ?? null;
  }

  function getUndergroundInfrastructure(tile: Tile): InfrastructureType | null {
    const infra = Array.isArray(tile.infrastructure) ? tile.infrastructure : [];
    return infra.find((i) => isUndergroundInfrastructure(i)) ?? null;
  }

  function getSurfaceEntity(tile: Tile): { type: 'zone' | 'building' | 'infrastructure'; value: string } | null {
    if (tile.building) return { type: 'building', value: String(tile.building.type) };
    if (tile.zone) return { type: 'zone', value: tile.zone.type };
    const infra = getSurfaceInfrastructure(tile);
    return infra ? { type: 'infrastructure', value: infra } : null;
  }

  function getUndergroundEntity(tile: Tile): { type: 'infrastructure'; value: string } | null {
    const infra = getUndergroundInfrastructure(tile);
    return infra ? { type: 'infrastructure', value: infra } : null;
  }

  function syncTileOccupancySlots(tile: Tile): void {
    tile.surfaceEntity = getSurfaceEntity(tile);
    tile.undergroundEntity = getUndergroundEntity(tile);
  }

  function clearSurfaceSlot(tile: Tile): void {
    tile.zone = null;
    tile.building = null;
    tile.infrastructure = tile.infrastructure.filter((infra) => isUndergroundInfrastructure(infra));
    tile.road_access = false;
    syncTileOccupancySlots(tile);
  }

  function clearUndergroundSlot(tile: Tile): void {
    tile.infrastructure = tile.infrastructure.filter((infra) => !isUndergroundInfrastructure(infra));
    syncTileOccupancySlots(tile);
  }

  function canPlaceZoneAt(tile: Tile): boolean {
    if (tile.terrain_type === 'water') return false;
    if (tile.building?.type === 'ruin') return false;
    return getSurfaceEntity(tile) === null;
  }

  function canPlaceBuildingAt(tile: Tile): boolean {
    if (tile.terrain_type === 'water') return false;
    if (tile.building?.type === 'ruin') return false;
    return getSurfaceEntity(tile) === null;
  }

  function canPlaceInfrastructureAt(tile: Tile, type: InfrastructureType): boolean {
    if (tile.terrain_type === 'water') return false;

    if (isUndergroundInfrastructure(type)) {
      const undergroundEntity = getUndergroundEntity(tile);
      if (!undergroundEntity) return true;
      return undergroundEntity.value === type;
    }

    const surfaceEntity = getSurfaceEntity(tile);
    if (!surfaceEntity) return true;
    return surfaceEntity.type === 'infrastructure' && surfaceEntity.value === type;
  }

  function isOccupiedForSelectedTool(tile: Tile): boolean {
    if (activeTool === 'bulldozer') return false;

    if (zoneTool || buildingTool) {
      return getSurfaceEntity(tile) !== null;
    }

    if (infrastructureTool) {
      if (isUndergroundInfrastructure(infrastructureTool)) {
        return getUndergroundEntity(tile) !== null;
      }
      return getSurfaceEntity(tile) !== null;
    }

    return false;
  }

  function canSilentlySkipPickedTile(tile: Tile | null): boolean {
    if (!tile) return false;
    if (activeTool === 'bulldozer') return false;
    return isOccupiedForSelectedTool(tile);
  }

  function clearTileWithBulldozer(point: GridPoint): { cleared: boolean; demolitionType: string | null; hadBuilding: boolean } {
    const tile = worldTiles[point.y]?.[point.x];
    if (!tile) return { cleared: false, demolitionType: null, hadBuilding: false };

    if (undergroundMode) {
      const undergroundEntity = getUndergroundEntity(tile);
      if (!undergroundEntity) return { cleared: false, demolitionType: null, hadBuilding: false };
      clearUndergroundSlot(tile);
      strokeRefundTotal += 50;
      strokeAnchor = point;
      return { cleared: true, demolitionType: undergroundEntity.value, hadBuilding: false };
    }

    const surfaceEntity = getSurfaceEntity(tile);
    if (!surfaceEntity) return { cleared: false, demolitionType: null, hadBuilding: false };
    const hadBuilding = surfaceEntity.type === 'building';
    clearSurfaceSlot(tile);
    strokeRefundTotal += 50;
    strokeAnchor = point;
    return { cleared: true, demolitionType: surfaceEntity.value, hadBuilding };
  }

  function parseTileKey(key: string): GridPoint {
    const [sx, sy] = key.split(':');
    return { x: Number(sx), y: Number(sy) };
  }

  function isoToWorld(x: number, y: number): Point {
    const transformed = projectGridPoint(x, y);
    return {
      x: (transformed.x - transformed.y) * (tileWidth / 2),
      y: (transformed.x + transformed.y) * (tileHeight / 2)
    };
  }

  function worldToGrid(world: Point): Point {
    const dx = world.x - worldOriginX;
    const dy = world.y - worldOriginY;
    const projected = {
      x: (dy / (tileHeight / 2) + dx / (tileWidth / 2)) / 2,
      y: (dy / (tileHeight / 2) - dx / (tileWidth / 2)) / 2
    };
    return unprojectGridPoint(projected.x, projected.y);
  }

  function hasActivePaintTool(): boolean {
    return Boolean(zoneTool || infrastructureTool || buildingTool || activeTool === 'bulldozer');
  }

  function getRotatedGridCoords(x: number, y: number, index: number): Point {
    const normalized = ((index % 4) + 4) % 4;
    if (normalized === 1) return { x: mapHeight - 1 - y, y: x };
    if (normalized === 2) return { x: mapWidth - 1 - x, y: mapHeight - 1 - y };
    if (normalized === 3) return { x: y, y: mapWidth - 1 - x };
    return { x, y };
  }

  function getUnrotatedGridCoords(x: number, y: number, index: number): Point {
    const normalized = ((index % 4) + 4) % 4;
    if (normalized === 1) return { x: y, y: mapHeight - 1 - x };
    if (normalized === 2) return { x: mapWidth - 1 - x, y: mapHeight - 1 - y };
    if (normalized === 3) return { x: mapWidth - 1 - y, y: x };
    return { x, y };
  }

  // Premium animation easing functions (senior-level smoothness)
  function easeInOutQuart(t: number): number {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  function easeInOutExpo(t: number): number {
    return t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  }

  function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  function rotationProgress(now = performance.now()): number {
    if (rotationFromIndex === rotationToIndex) return 1;
    const raw = Math.max(0, Math.min(1, (now - rotationStartedAt) / ROTATION_DURATION_MS));
    // InOutQuart provides superior smoothness vs InOutCubic; smoother acceleration curve.
    return easeInOutQuart(raw);
  }

  function isRotationAnimating(now = performance.now()): boolean {
    if (rotationFromIndex === rotationToIndex) return false;
    return now - rotationStartedAt < ROTATION_DURATION_MS;
  }

  function projectGridPoint(x: number, y: number): Point {
    if (!isRotationAnimating()) {
      return getRotatedGridCoords(x, y, rotationIndex);
    }

    // Keep geometry stable during tween; the visual tween is rendered from a snapshot layer.
    return getRotatedGridCoords(x, y, rotationFromIndex);
  }

  function unprojectGridPoint(x: number, y: number): Point {
     const targetIndex = isRotationAnimating() ? rotationFromIndex : rotationIndex;
    return getUnrotatedGridCoords(x, y, targetIndex);
  }

  function ensureRotationSnapshotCanvas(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    if (!rotationSnapshotCanvas || rotationSnapshotCanvas.width !== width || rotationSnapshotCanvas.height !== height) {
      rotationSnapshotCanvas = createCacheCanvas(width, height);
      rotationSnapshotCtx = rotationSnapshotCanvas.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null;
    }
  }

  function captureRotationSnapshot(): void {
    if (!dynamicCanvasEl) return;
    const width = dynamicCanvasEl.width;
    const height = dynamicCanvasEl.height;
    if (width <= 0 || height <= 0) return;

    const diagonal = Math.ceil(Math.sqrt(width * width + height * height)) + Math.ceil(ROTATION_OVERSCAN_PAD_PX * dpr * 2);
    ensureRotationSnapshotCanvas(diagonal, diagonal);
    if (!rotationSnapshotCtx || !rotationSnapshotCanvas) return;

    rotationSnapshotOffsetX = (rotationSnapshotCanvas.width - width) * 0.5;
    rotationSnapshotOffsetY = (rotationSnapshotCanvas.height - height) * 0.5;

    const pivotWorldX = worldWidth * 0.5;
    const pivotWorldY = worldHeight * 0.5;
    rotationPivotScreenX = dpr * (pivotWorldX * rotationFrozenCamera.zoom + rotationFrozenCamera.x);
    rotationPivotScreenY = dpr * (pivotWorldY * rotationFrozenCamera.zoom + rotationFrozenCamera.y);
    rotationPivotSnapshotX = rotationSnapshotOffsetX + rotationPivotScreenX;
    rotationPivotSnapshotY = rotationSnapshotOffsetY + rotationPivotScreenY;

    rotationSnapshotCtx.setTransform(1, 0, 0, 1, 0, 0);
    rotationSnapshotCtx.clearRect(0, 0, rotationSnapshotCanvas.width, rotationSnapshotCanvas.height);
    const ox = Math.round(rotationSnapshotOffsetX);
    const oy = Math.round(rotationSnapshotOffsetY);
    rotationSnapshotCtx.drawImage(dynamicCanvasEl, ox, oy, Math.round(width), Math.round(height));
    rotationSnapshotCtx.drawImage(strokeCanvasEl, ox, oy, Math.round(width), Math.round(height));
  }

  function clearRotationLayer(): void {
    if (!rotationCtx || !rotationCanvasEl) return;
    rotationCtx.setTransform(1, 0, 0, 1, 0, 0);
    rotationCtx.clearRect(0, 0, rotationCanvasEl.width, rotationCanvasEl.height);
    rotationSnapshotOffsetX = 0;
    rotationSnapshotOffsetY = 0;
  }

  function drawRotationTweenFrame(now = performance.now()): void {
    // SNAPSHOT & SPIN ROTATION SYSTEM (Zero-Distortion Cinematic Tween)
    // When rotation is triggered, the grid is captured as a static snapshot.
    // During the tween, only this pre-rendered snapshot is displayed, rotated
    // around the canvas center with premium easing and smooth zoom pulse.
    // After the tween completes, the snapshot is discarded and the grid resumes
    // rendering at the new, perfectly-calculated orthogonal rotation angle.
    // This ensures zero visual distortion, preserving the 2:1 rhombus ratio.
    if (!rotationCtx || !rotationCanvasEl || !rotationSnapshotCanvas) return;

    const width = rotationCanvasEl.width;
    const height = rotationCanvasEl.height;
    const t = rotationProgress(now);
    let quarterTurns = (rotationToIndex - rotationFromIndex + 4) % 4;
    if (quarterTurns === 3) quarterTurns = -1;

    // Apply easing to angle rotation for smooth acceleration throughout
    const angle = (quarterTurns * Math.PI * 0.5) * easeInOutQuart(t);
    
    // Smooth fade pulse (stays visible for full duration with subtle breathing effect)
    const fadePulse = Math.sin(Math.PI * t);
    const fade = ROTATION_SNAPSHOT_ALPHA_MIN + (1 - ROTATION_SNAPSHOT_ALPHA_MIN) * fadePulse;
    
    // Eased scale interpolation for cinematic zoom effect
    const easedT = easeInOutQuart(t);
    const baseScale = ROTATION_SCALE_START + (ROTATION_SCALE_END - ROTATION_SCALE_START) * easedT;
    // Subtle pulse centered at midpoint, dampened for elegance
    const pulse = 0.006 * Math.sin(Math.PI * t);
    const scale = baseScale + pulse;

    rotationCtx.setTransform(1, 0, 0, 1, 0, 0);
    rotationCtx.imageSmoothingEnabled = true;
    rotationCtx.imageSmoothingQuality = 'high';
    rotationCtx.clearRect(0, 0, width, height);

    rotationCtx.save();
    rotationCtx.globalAlpha = fade;
    rotationCtx.translate(rotationPivotScreenX, rotationPivotScreenY);
    rotationCtx.rotate(angle);
    rotationCtx.scale(scale, scale);
    rotationCtx.translate(-rotationPivotSnapshotX, -rotationPivotSnapshotY);
    rotationCtx.drawImage(rotationSnapshotCanvas as CanvasImageSource, 0, 0);
    rotationCtx.restore();
  }

  function triggerRotationStep(step = 1): void {
    const now = performance.now();
    // Prevent chained rotations while tweening to avoid visual deterioration.
    if (isRotationAnimating(now)) return;

    if (!rotationVisualActive) {
      rotationFrozenCamera = {
        x: cameraTarget.x,
        y: cameraTarget.y,
        zoom: cameraTarget.zoom
      };
      camera.x = rotationFrozenCamera.x;
      camera.y = rotationFrozenCamera.y;
      camera.zoom = rotationFrozenCamera.zoom;
      cameraTarget.x = rotationFrozenCamera.x;
      cameraTarget.y = rotationFrozenCamera.y;
      cameraTarget.zoom = rotationFrozenCamera.zoom;
      drawDynamicLayer();
      drawStrokeBufferLayer();
      captureRotationSnapshot();
    }

    rotationFromIndex = rotationIndex;
    rotationToIndex = (rotationIndex + step + 4) % 4;
    rotationIndex = rotationToIndex;
    rotationStartedAt = now;
    rotationVisualActive = true;
    isPanning = false;
    panAnchor = null;
    panVelocity = { x: 0, y: 0 };
  }

  function triggerRotationToIndex(targetIndex: number): void {
    const normalizedTarget = ((targetIndex % 4) + 4) % 4;
    const current = ((rotationIndex % 4) + 4) % 4;
    if (normalizedTarget === current) return;

    const forward = (normalizedTarget - current + 4) % 4;
    const backward = (current - normalizedTarget + 4) % 4;
    const step = forward <= backward ? forward : -backward;
    triggerRotationStep(step);
  }

  function activeRotationDegrees(now = performance.now()): number {
    if (!isRotationAnimating(now)) {
      return ((rotationIndex % 4) + 4) % 4 * 90;
    }

    const start = ((rotationFromIndex % 4) + 4) % 4;
    const end = ((rotationToIndex % 4) + 4) % 4;
    const steps = ((end - start + 4) % 4);
    return (start + steps * rotationProgress(now)) * 90;
  }

  function onRotateControlClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    triggerRotationStep(1);
  }

  function onRotatePresetClick(event: MouseEvent, targetIndex: number): void {
    event.stopPropagation();
    event.preventDefault();
    triggerRotationToIndex(targetIndex);
  }

  function canvasPoint(event: MouseEvent | WheelEvent | PointerEvent): Point {
    const rect = dynamicCanvasEl.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * dynamicCanvasEl.width) / Math.max(1, rect.width) / dpr,
      y: ((event.clientY - rect.top) * dynamicCanvasEl.height) / Math.max(1, rect.height) / dpr
    };
  }

  function canvasPointFromClient(clientX: number, clientY: number): Point {
    const rect = dynamicCanvasEl.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * dynamicCanvasEl.width) / Math.max(1, rect.width) / dpr,
      y: ((clientY - rect.top) * dynamicCanvasEl.height) / Math.max(1, rect.height) / dpr
    };
  }

  function screenToWorld(screen: Point): Point {
    return {
      x: (screen.x - camera.x) / camera.zoom,
      y: (screen.y - camera.y) / camera.zoom
    };
  }

  function worldCenter(x: number, y: number): Point {
    return worldCenters[y]?.[x] ?? { x: 0, y: 0 };
  }

  function diamondHit(world: Point, center: Point): boolean {
    const nx = Math.abs(world.x - center.x) / (tileWidth / 2);
    const ny = Math.abs(world.y - center.y) / (tileHeight / 2);
    return nx + ny <= 1;
  }

  function getSpatialCell(x: number, y: number): string {
    const cx = Math.floor(x / SPATIAL_CELL);
    const cy = Math.floor(y / SPATIAL_CELL);
    return `${cx}:${cy}`;
  }

  function buildSpatialIndex(): void {
    spatialIndex.clear();
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const cell = getSpatialCell(x, y);
        const bucket = spatialIndex.get(cell) ?? new Set<string>();
        bucket.add(tileKey(x, y));
        spatialIndex.set(cell, bucket);
      }
    }
  }

  function querySpatialCandidates(center: GridPoint, radius = 2): GridPoint[] {
    const minX = Math.max(0, center.x - radius);
    const maxX = Math.min(mapWidth - 1, center.x + radius);
    const minY = Math.max(0, center.y - radius);
    const maxY = Math.min(mapHeight - 1, center.y + radius);

    const minCellX = Math.floor(minX / SPATIAL_CELL);
    const maxCellX = Math.floor(maxX / SPATIAL_CELL);
    const minCellY = Math.floor(minY / SPATIAL_CELL);
    const maxCellY = Math.floor(maxY / SPATIAL_CELL);

    const out: GridPoint[] = [];
    for (let cy = minCellY; cy <= maxCellY; cy += 1) {
      for (let cx = minCellX; cx <= maxCellX; cx += 1) {
        const bucket = spatialIndex.get(`${cx}:${cy}`);
        if (!bucket) continue;
        for (const key of bucket) {
          const point = parseTileKey(key);
          if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) out.push(point);
        }
      }
    }

    return out;
  }

  function pickTileFromPoint(screen: Point): GridPoint | null {
    const world = screenToWorld(screen);
    const approx = worldToGrid(world);
    const seed = { x: Math.round(approx.x), y: Math.round(approx.y) };

    if (seed.x < 0 || seed.y < 0 || seed.x >= mapWidth || seed.y >= mapHeight) return null;

    const candidates = querySpatialCandidates(seed, 2);
    let best: GridPoint | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const center = worldCenter(candidate.x, candidate.y);
      if (!diamondHit(world, center)) continue;
      const score = Math.hypot(world.x - center.x, world.y - center.y) + (candidate.x + candidate.y) * 0.001;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  function pickTileFromEvent(event: MouseEvent | WheelEvent | PointerEvent): GridPoint | null {
    return pickTileFromPoint(canvasPoint(event));
  }

  function rebuildWorldGeometry(): void {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const p = isoToWorld(x, y);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }

    const padX = tileWidth * 3;
    const padY = tileHeight * 4;

    worldOriginX = -minX + padX;
    worldOriginY = -minY + padY;
    worldWidth = Math.ceil(maxX - minX + padX * 2 + tileWidth);
    worldHeight = Math.ceil(maxY - minY + padY * 2 + tileHeight * 2);

    worldCenters = Array.from({ length: mapHeight }, (_, y) =>
      Array.from({ length: mapWidth }, (_, x) => {
        const p = isoToWorld(x, y);
        return { x: worldOriginX + p.x, y: worldOriginY + p.y };
      })
    );

    staticDirty = true;
  }

  function ensureOffscreen(): void {
    const w = Math.max(1, Math.ceil(worldWidth));
    const h = Math.max(1, Math.ceil(worldHeight));

    if (!offscreen || offscreen.width !== w || offscreen.height !== h) {
      if (typeof OffscreenCanvas !== 'undefined') {
        offscreen = new OffscreenCanvas(w, h);
      } else {
        const fallback = document.createElement('canvas');
        fallback.width = w;
        fallback.height = h;
        offscreen = fallback;
      }
      offscreenCtx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
      staticDirty = true;
    }
  }

  function drawDiamond(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w = tileWidth,
    h = tileHeight
  ): void {
    const hw = w / 2;
    const hh = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  }

  function terrainColor(tile: Tile): string {
    if (tile.terrain_type === 'water') return '#2a5974';
    if (tile.terrain_type === 'forest') return '#3a6a42';
    if (tile.terrain_type === 'sand') return '#927c55';
    if (tile.terrain_type === 'rock') return '#57616f';
    return '#466b46';
  }

  function drawBlueprintHatch(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ): void {
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x - hw, y);
    ctx.closePath();
    ctx.clip();

    const pattern = ctx.createLinearGradient(x - hw, y - hh, x + hw, y + hh);
    pattern.addColorStop(0, color.replace(/[0-9.]+\)$/, '0.15)'));
    pattern.addColorStop(0.5, color.replace(/[0-9.]+\)$/, '0.08)'));
    pattern.addColorStop(1, color.replace(/[0-9.]+\)$/, '0.15)'));
    ctx.fillStyle = pattern;

    ctx.fillRect(x - hw - 2, y - hh - 2, w + 4, h + 4);

    ctx.strokeStyle = color.replace(/[0-9.]+\)$/, '0.19)');
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const step = 4;
    const lineOffset = Math.round((x + y) * 0.5) % step;

    for (let i = -hh * 2.5 + lineOffset; i < hh * 2.5 + lineOffset; i += step) {
      ctx.beginPath();
      ctx.moveTo(x - hw + i, y - hh - 1);
      ctx.lineTo(x + hw + i, y + hh + 1);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawRoadWithRealismEffects(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.clip();

    drawDiamond(ctx, cx, cy, w, h);
    const roadGrad = ctx.createLinearGradient(cx - hw, cy - hh * 0.4, cx + hw, cy + hh * 0.4);
    roadGrad.addColorStop(0, ART_PALETTE.asphaltLight);
    roadGrad.addColorStop(0.55, ART_PALETTE.asphaltMid);
    roadGrad.addColorStop(1, ART_PALETTE.asphaltDark);
    ctx.fillStyle = roadGrad;
    ctx.fill();

    const bevelGrad = ctx.createLinearGradient(cx - hw, cy, cx + hw, cy);
    bevelGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
    bevelGrad.addColorStop(0.5, 'rgba(0,0,0,0.08)');
    bevelGrad.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = bevelGrad;
    ctx.fill();

    ctx.strokeStyle = ART_PALETTE.lineHighlight;
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(238, 244, 250, 0.30)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.65, cy - hh * 0.4);
    ctx.lineTo(cx + hw * 0.65, cy + hh * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.65, cy + hh * 0.4);
    ctx.lineTo(cx + hw * 0.65, cy - hh * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  function drawHighwayWithRealism(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.clip();

    drawDiamond(ctx, cx, cy, w, h);
    const highwayGrad = ctx.createLinearGradient(cx - hw, cy - hh * 0.4, cx + hw, cy + hh * 0.4);
    highwayGrad.addColorStop(0, 'rgba(132, 138, 148, 0.94)');
    highwayGrad.addColorStop(0.5, 'rgba(102, 110, 121, 0.92)');
    highwayGrad.addColorStop(1, 'rgba(78, 84, 93, 0.92)');
    ctx.fillStyle = highwayGrad;
    ctx.fill();

    const bevelGrad = ctx.createLinearGradient(cx - hw, cy, cx + hw, cy);
    bevelGrad.addColorStop(0, 'rgba(255,255,255,0.16)');
    bevelGrad.addColorStop(0.5, 'rgba(0,0,0,0.12)');
    bevelGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = bevelGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.setLineDash([8, 3]);
    ctx.strokeStyle = ART_PALETTE.warning;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.65, cy - hh * 0.4);
    ctx.lineTo(cx + hw * 0.65, cy + hh * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.65, cy + hh * 0.4);
    ctx.lineTo(cx + hw * 0.65, cy - hh * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  function drawRailWithRealism(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.clip();

    drawDiamond(ctx, cx, cy, w, h);
    ctx.fillStyle = ART_PALETTE.railWood;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(208, 214, 222, 0.62)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.6, cy - hh * 0.35);
    ctx.lineTo(cx + hw * 0.6, cy + hh * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.6, cy + hh * 0.35);
    ctx.lineTo(cx + hw * 0.6, cy - hh * 0.35);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = ART_PALETTE.metallicA;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.52, cy - hh * 0.28);
    ctx.lineTo(cx + hw * 0.52, cy + hh * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.52, cy + hh * 0.28);
    ctx.lineTo(cx + hw * 0.52, cy - hh * 0.28);
    ctx.stroke();

    ctx.restore();
  }

  function drawPowerLineWithRealism(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.clip();

    drawDiamond(ctx, cx, cy, w, h);
    const poleBase = ctx.createLinearGradient(cx - hw, cy - hh * 0.3, cx + hw, cy + hh * 0.3);
    poleBase.addColorStop(0, 'rgba(127, 104, 74, 0.74)');
    poleBase.addColorStop(1, 'rgba(96, 78, 56, 0.76)');
    ctx.fillStyle = poleBase;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.shadowColor = ART_PALETTE.electricGlow;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = ART_PALETTE.electricGlow;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.7, cy - hh * 0.1);
    ctx.quadraticCurveTo(cx, cy - hh * 0.25, cx + hw * 0.7, cy - hh * 0.1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.7, cy + hh * 0.1);
    ctx.quadraticCurveTo(cx, cy + hh * 0.25, cx + hw * 0.7, cy + hh * 0.1);
    ctx.stroke();

    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(206, 168, 106, 0.9)';
    for (let i = -2; i <= 2; i++) {
      const px = cx + (hw * 0.35 * i);
      ctx.beginPath();
      ctx.arc(px, cy - hh * 0.15, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, cy + hh * 0.15, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawWaterPipeWithRealism(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.clip();

    drawDiamond(ctx, cx, cy, w, h);
    const pipeBase = ctx.createLinearGradient(cx - hw, cy - hh * 0.3, cx + hw, cy + hh * 0.3);
    pipeBase.addColorStop(0, 'rgba(95, 118, 138, 0.78)');
    pipeBase.addColorStop(1, 'rgba(72, 93, 113, 0.82)');
    ctx.fillStyle = pipeBase;
    ctx.fill();

    ctx.shadowColor = ART_PALETTE.waterGlow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = ART_PALETTE.waterGlow;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.5, cy - hh * 0.4);
    ctx.lineTo(cx - hw * 0.5, cy + hh * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + hw * 0.5, cy - hh * 0.4);
    ctx.lineTo(cx + hw * 0.5, cy + hh * 0.4);
    ctx.stroke();

    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  }

  function drawSubwayTunnelWithRealism(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.clip();

    const grad = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh);
    grad.addColorStop(0, 'rgba(128, 186, 226, 0.72)');
    grad.addColorStop(0.5, 'rgba(86, 146, 194, 0.62)');
    grad.addColorStop(1, 'rgba(64, 118, 166, 0.72)');
    ctx.fillStyle = grad;
    drawDiamond(ctx, cx, cy, w, h);
    ctx.fill();

    ctx.shadowColor = ART_PALETTE.neonBlue;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = ART_PALETTE.neonBlue;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawInfrastructureTile(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    c: Point,
    type: InfrastructureType,
    isUnderground: boolean
  ): void {
    const width = tileWidth * (isUnderground ? 0.8 : 0.88);
    const height = tileHeight * (isUnderground ? 0.76 : 0.84);

    if (isUnderground) {
      ctx.save();
      const metallic = ctx.createLinearGradient(c.x - width * 0.5, c.y - height * 0.5, c.x + width * 0.5, c.y + height * 0.5);
      metallic.addColorStop(0, 'rgba(136, 152, 166, 0.36)');
      metallic.addColorStop(0.5, 'rgba(88, 101, 114, 0.18)');
      metallic.addColorStop(1, 'rgba(169, 184, 196, 0.34)');
      drawDiamond(ctx, c.x, c.y, tileWidth * 0.78, tileHeight * 0.72);
      ctx.fillStyle = metallic;
      ctx.fill();
      ctx.shadowColor = type === 'power_line'
        ? 'rgba(255, 232, 117, 0.9)'
        : 'rgba(94, 204, 255, 0.88)';
      ctx.shadowBlur = 15;

      if (type === 'water_pipe') {
        drawWaterPipeWithRealism(ctx, c.x, c.y, width, height);
        ctx.restore();
        return;
      }
      if (type === 'subway' || type === 'subway_tunnel') {
        drawSubwayTunnelWithRealism(ctx, c.x, c.y, width, height);
        ctx.restore();
        return;
      }
      if (type === 'power_line') {
        drawPowerLineWithRealism(ctx, c.x, c.y, width, height);
        ctx.restore();
        return;
      }

      ctx.strokeStyle = 'rgba(210, 226, 241, 0.8)';
      ctx.lineWidth = 1.6;
      drawDiamond(ctx, c.x, c.y, tileWidth * 0.7, tileHeight * 0.62);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (type === 'road') {
      drawRoadWithRealismEffects(ctx, c.x, c.y, width, height);
      return;
    }
    if (type === 'highway' || type === 'highway_ramp') {
      drawHighwayWithRealism(ctx, c.x, c.y, width, height);
      return;
    }
    if (type === 'rail') {
      drawRailWithRealism(ctx, c.x, c.y, width, height);
      return;
    }
    if (type === 'power_line') {
      drawPowerLineWithRealism(ctx, c.x, c.y, width, height);
      return;
    }
  }

  function drawUndergroundSchematicBackdrop(ctx: CanvasRenderingContext2D): void {
    const left = -worldWidth;
    const top = -worldHeight;
    const spanW = worldWidth * 3;
    const spanH = worldHeight * 3;

    // Refined Midnight Charcoal background instead of pure black
    ctx.fillStyle = '#10121a';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(left, top, spanW, spanH);
    ctx.globalAlpha = 1;

    // Grid pattern for underground schematic aesthetic
    ctx.strokeStyle = 'rgba(110, 146, 190, 0.14)';
    ctx.lineWidth = 0.8;
    const grid = Math.max(16, Math.round(tileHeight * 0.7));
    for (let gx = left; gx <= left + spanW; gx += grid) {
      ctx.beginPath();
      ctx.moveTo(gx, top);
      ctx.lineTo(gx, top + spanH);
      ctx.stroke();
    }
    for (let gy = top; gy <= top + spanH; gy += grid) {
      ctx.beginPath();
      ctx.moveTo(left, gy);
      ctx.lineTo(left + spanW, gy);
      ctx.stroke();
    }

    // Underground hover tile glow - dramatic focused lamp effect
    const glowCenter = hoverTile
      ? worldCenter(hoverTile.x, hoverTile.y)
      : screenToWorld({ x: dynamicCanvasEl.clientWidth * 0.5, y: dynamicCanvasEl.clientHeight * 0.5 });
    const glow = ctx.createRadialGradient(glowCenter.x, glowCenter.y, tileWidth * 0.8, glowCenter.x, glowCenter.y, tileWidth * 6);
    glow.addColorStop(0, 'rgba(88, 176, 255, 0.5)');
    glow.addColorStop(0.4, 'rgba(58, 125, 206, 0.24)');
    glow.addColorStop(1, 'rgba(18, 18, 18, 0.0)');
    ctx.fillStyle = glow;
    ctx.fillRect(left, top, spanW, spanH);

    // Subtle dark overlay gradient for depth
    const darkOverlay = ctx.createLinearGradient(0, 0, worldWidth, worldHeight);
    darkOverlay.addColorStop(0, 'rgba(8, 11, 15, 0.58)');
    darkOverlay.addColorStop(1, 'rgba(4, 6, 10, 0.7)');
    ctx.fillStyle = darkOverlay;
    ctx.fillRect(-worldWidth, -worldHeight, worldWidth * 3, worldHeight * 3);

    // Tile schematic borders
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const c = worldCenter(x, y);
        drawDiamond(ctx, c.x, c.y, tileWidth * 0.94, tileHeight * 0.9);
        ctx.fillStyle = 'rgba(10, 16, 24, 0.86)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(103, 146, 190, 0.24)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }
  }

  function drawMouseFlashlight(ctx: CanvasRenderingContext2D): void {
    if (!undergroundMode) return;

    // Dynamic flashlight centered on mouse cursor
    // Only draw if mouse is within canvas bounds
    const cw = dynamicCanvasEl?.width ?? 0;
    const ch = dynamicCanvasEl?.height ?? 0;
    const centerX = mouseScreenX * dpr;
    const centerY = mouseScreenY * dpr;
    
    if (centerX < 0 || centerX > cw || centerY < 0 || centerY > ch) {
      return;
    }

    // Create radial gradient centered at mouse position
    // Inner radius: bright white, Outer radius: fully transparent
    const flashlight = ctx.createRadialGradient(
      centerX, centerY, FLASHLIGHT_INNER_RADIUS * dpr,
      centerX, centerY, FLASHLIGHT_OUTER_RADIUS * dpr
    );
    
    // Gradient stops: white center fading to transparent
    flashlight.addColorStop(0, 'rgba(255, 248, 220, 0.18)');    // Inner: warm white glow
    flashlight.addColorStop(0.3, 'rgba(200, 220, 255, 0.12)');  // Mid: blue-shift
    flashlight.addColorStop(0.7, 'rgba(100, 150, 200, 0.04)');  // Outer falloff
    flashlight.addColorStop(1, 'rgba(0, 0, 0, 0)');             // Edge: transparent

    // Save context state
    ctx.save();
    
    // Use 'lighter' composite to add light to the scene
    // This creates the effect of illuminating the frozen darkness
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = flashlight;
    
    // Draw a circle encompassing the flashlight effect
    ctx.fillRect(
      Math.round(centerX - FLASHLIGHT_OUTER_RADIUS * dpr),
      Math.round(centerY - FLASHLIGHT_OUTER_RADIUS * dpr),
      Math.round(FLASHLIGHT_OUTER_RADIUS * 2 * dpr),
      Math.round(FLASHLIGHT_OUTER_RADIUS * 2 * dpr)
    );
    
    ctx.restore();
  }

  function buildDepthSortedEntries(range?: { minX: number; minY: number; maxX: number; maxY: number }): RenderEntry[] {
    const minX = range?.minX ?? 0;
    const minY = range?.minY ?? 0;
    const maxX = range?.maxX ?? (mapWidth - 1);
    const maxY = range?.maxY ?? (mapHeight - 1);
    const entries: RenderEntry[] = [];

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const tile = worldTiles[y]?.[x];
        if (!tile) continue;
        entries.push({ x, y, depth: x + y, tile, c: worldCenter(x, y) });
      }
    }

    entries.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    return entries;
  }

  function sortTileKeysByDepth(keys: Set<string>): Array<{ x: number; y: number }> {
    const points = Array.from(keys, (key) => parseTileKey(key));
    points.sort((a, b) => {
      const da = a.x + a.y;
      const db = b.x + b.y;
      if (da !== db) return da - db;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    return points;
  }

  function createCacheCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    const fallback = document.createElement('canvas');
    fallback.width = width;
    fallback.height = height;
    return fallback;
  }

  function buildingArchetypeFor(tile: Tile): BuildingArchetype {
    const type = String(tile.building?.type ?? '');

    // Zone proxy tiles must always resolve from zone density/type first.
    // This prevents proxy building types (e.g. school/university placeholders)
    // from being interpreted as service buildings.
    const isZoneProxy = Boolean(tile.zone) && (!tile.building || tile.building.id.startsWith('proxy-'));
    if (isZoneProxy && tile.zone) {
      if (tile.zone.type.startsWith('residential_dense')) return 'residential_apartment';
      if (tile.zone.type.startsWith('residential')) return 'residential_house';
      if (tile.zone.type.startsWith('commercial_dense')) return 'commercial_tower';
      if (tile.zone.type.startsWith('commercial')) return 'commercial_kiosk';
      if (tile.zone.type.startsWith('industrial_dense')) return 'industrial_factory';
      if (tile.zone.type.startsWith('industrial')) return 'industrial_factory';
    }

    if (type === 'ruin') return 'ruin';
    if (type === 'police_station') return 'service_police';
    if (type === 'hospital') return 'service_hospital';
    if (type === 'fire_station') return 'service_fire';
    if (type === 'prison') return 'service_prison';
    if (type === 'school' || type === 'college' || type === 'library' || type === 'museum' || type === 'university') return 'service_education';
    if (type === 'water_pump' || type === 'water_treatment') return 'utility_water';
    if (type === 'bus_depot' || type === 'rail_station' || type === 'subway_station' || type === 'airport' || type === 'seaport') return 'utility_transport';
    if (type === 'coal_power') return 'power_plant_coal';
    if (type === 'nuclear_power') return 'power_plant_nuclear';
    if (type.includes('power')) return 'power_plant_coal';
    
    // Zone mapping fallback (non-proxy edge cases)
    if (tile.zone) {
      if (tile.zone.type.startsWith('residential_dense')) return 'residential_apartment';
      if (tile.zone.type.startsWith('residential')) return 'residential_house';
      if (tile.zone.type.startsWith('commercial_dense')) return 'commercial_tower';
      if (tile.zone.type.startsWith('commercial')) return 'commercial_kiosk';
      if (tile.zone.type.startsWith('industrial_dense')) return 'industrial_factory';
      if (tile.zone.type.startsWith('industrial')) return 'industrial_factory';
    }
    
    return 'generic';
  }

  function buildingBaseColor(tile: Tile): string {
    const type = String(tile.building?.type ?? '');
    // Handle zone-based colors first
    if (type === 'residential_apartment' || type === 'residential_house') return '#4caf50';
    if (type === 'commercial_tower' || type === 'commercial') return '#2196f3';
    if (type === 'industrial_factory' || type === 'industrial') return '#ffeb3b';
    if (tile.zone?.type.startsWith('residential')) return '#4caf50';
    if (tile.zone?.type.startsWith('commercial')) return '#2196f3';
    if (tile.zone?.type.startsWith('industrial')) return '#ffeb3b';
    if (type === 'coal_power') return '#c95f5f';
    if (type === 'nuclear_power') return '#8ed7c5';
    if (type.includes('power')) return '#c95f5f';
    if (type === 'police_station') return '#3f72c8';
    if (type === 'hospital') return '#d84b4b';
    if (type === 'fire_station') return '#ff8a3d';
    if (type === 'prison') return '#8d99a6';
    if (type === 'school' || type === 'college' || type === 'library' || type === 'museum' || type === 'university') return '#9a87d2';
    if (type === 'water_pump' || type === 'water_treatment') return '#55c7ff';
    if (type === 'bus_depot' || type === 'rail_station' || type === 'subway_station' || type === 'airport' || type === 'seaport') return '#7ec0d9';
    if (type === 'ruin') return '#7e8491';
    return '#95a8be';
  }

  function shadeHex(hex: string, amount: number): string {
    const normalized = hex.replace('#', '');
    const raw = normalized.length === 3
      ? normalized.split('').map((ch) => `${ch}${ch}`).join('')
      : normalized;
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(parseInt(raw.slice(0, 2), 16) + amount);
    const g = clamp(parseInt(raw.slice(2, 4), 16) + amount);
    const b = clamp(parseInt(raw.slice(4, 6), 16) + amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawIsoPrism(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    depth: number,
    top: string,
    left: string,
    right: string
  ): void {
    const hw = w / 2;
    const hh = h / 2;
    const topY = cy - depth;

    ctx.beginPath();
    ctx.moveTo(cx, topY - hh);
    ctx.lineTo(cx + hw, topY);
    ctx.lineTo(cx, topY + hh);
    ctx.lineTo(cx - hw, topY);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - hw, topY);
    ctx.lineTo(cx, topY + hh);
    ctx.lineTo(cx, cy + hh * 0.5);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + hw, topY);
    ctx.lineTo(cx, topY + hh);
    ctx.lineTo(cx, cy + hh * 0.5);
    ctx.lineTo(cx + hw, cy);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();

    // Unified edge treatment so buildings and infrastructure share the same artistic language.
    const edgeScale = Math.max(0.75, Math.min(1.3, w / 36));
    ctx.strokeStyle = ART_PALETTE.edgeDark;
    ctx.lineWidth = Math.max(1, 0.9 * edgeScale);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - hw, topY);
    ctx.lineTo(cx, topY + hh);
    ctx.lineTo(cx + hw, topY);
    ctx.stroke();

    ctx.strokeStyle = ART_PALETTE.edgeLight;
    ctx.lineWidth = Math.max(0.8, 0.7 * edgeScale);
    ctx.beginPath();
    ctx.moveTo(cx, topY - hh);
    ctx.lineTo(cx + hw, topY);
    ctx.stroke();
  }

  function drawContactShadow(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    alpha = 1
  ): void {
    ctx.save();
    ctx.fillStyle = ART_PALETTE.contactShadow.replace(/0\.[0-9]+\)$/, `${(0.26 * alpha).toFixed(3)})`);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Construction site for undeveloped zones
  function drawConstructionSite(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number
  ): void {
    // Draw fenced plot with warning tape
    ctx.strokeStyle = '#c85a17';
    ctx.lineWidth = 1.2 * scale;
    ctx.setLineDash([3 * scale, 2 * scale]);
    ctx.strokeRect(cx - 18 * scale, cy - 10 * scale, 36 * scale, 20 * scale);
    ctx.setLineDash([]);

    // Draw construction crane
    const craneBaseX = cx - 8 * scale;
    const craneBaseY = cy + 4 * scale;

    // Crane base
    ctx.fillStyle = '#666666';
    ctx.fillRect(craneBaseX - 3 * scale, craneBaseY, 6 * scale, 3 * scale);

    // Crane boom
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(craneBaseX, craneBaseY);
    ctx.lineTo(craneBaseX + 20 * scale, craneBaseY - 12 * scale);
    ctx.stroke();

    // Crane hook
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(craneBaseX + 16 * scale, craneBaseY - 10 * scale);
    ctx.lineTo(craneBaseX + 16 * scale, craneBaseY - 4 * scale);
    ctx.stroke();

    // Warning tape X pattern
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * scale, cy - 8 * scale);
    ctx.lineTo(cx + 12 * scale, cy + 6 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 12 * scale, cy - 8 * scale);
    ctx.lineTo(cx - 12 * scale, cy + 6 * scale);
    ctx.stroke();
  }

  function drawResidentialHouse(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    // Single-story house with pitched roof, window detailing, and chimney
    drawIsoPrism(ctx, cx, cy, 32 * scale, 18 * scale, 10 * scale, shadeHex(base, 16), shadeHex(base, -18), shadeHex(base, -30));

    // Pitched roof (light residential)
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18 * scale);
    ctx.lineTo(cx + 18 * scale, cy - 5 * scale);
    ctx.lineTo(cx, cy + 3 * scale);
    ctx.lineTo(cx - 18 * scale, cy - 5 * scale);
    ctx.closePath();
    ctx.fillStyle = shadeHex(base, 34);
    ctx.fill();

    // Roof detail
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18 * scale);
    ctx.lineTo(cx + 18 * scale, cy - 5 * scale);
    ctx.lineTo(cx + 18 * scale, cy - 2 * scale);
    ctx.lineTo(cx, cy - 14 * scale);
    ctx.lineTo(cx - 18 * scale, cy - 2 * scale);
    ctx.lineTo(cx - 18 * scale, cy - 5 * scale);
    ctx.closePath();
    ctx.fillStyle = shadeHex(base, 48);
    ctx.fill();

    // Roof ridge shading
    ctx.strokeStyle = 'rgba(32, 38, 46, 0.48)';
    ctx.lineWidth = Math.max(1, 1 * scale);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18 * scale);
    ctx.lineTo(cx, cy - 5.5 * scale);
    ctx.stroke();

    // Windows - small residential
    ctx.fillStyle = 'rgba(245, 239, 227, 0.85)';
    ctx.fillRect(cx - 9 * scale, cy + 0.5 * scale, 5 * scale, 5 * scale);
    ctx.fillRect(cx + 3 * scale, cy - 2 * scale, 5.5 * scale, 4 * scale);
    ctx.fillStyle = 'rgba(40, 52, 64, 0.55)';
    ctx.fillRect(cx - 6 * scale, cy + 2.5 * scale, 1.8 * scale, 1.8 * scale);
    ctx.fillRect(cx + 5 * scale, cy + 0.5 * scale, 2 * scale, 2 * scale);

    // Small chimney
    drawIsoPrism(
      ctx,
      cx + 8 * scale,
      cy - 9 * scale,
      4.5 * scale,
      3.5 * scale,
      6 * scale,
      '#c9a694',
      '#9c7f70',
      '#82695d'
    );
  }


  function drawResidentialApartment(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    // Multi-story apartment building (dense residential) - 3-4 floors with clear window rows
    drawIsoPrism(ctx, cx, cy, 44 * scale, 22 * scale, 28 * scale, shadeHex(base, 20), shadeHex(base, -16), shadeHex(base, -32));
    drawIsoPrism(ctx, cx - 1 * scale, cy - 8 * scale, 36 * scale, 18 * scale, 16 * scale, shadeHex(base, 32), shadeHex(base, -6), shadeHex(base, -20));
    drawIsoPrism(ctx, cx + 3 * scale, cy - 16 * scale, 28 * scale, 14 * scale, 12 * scale, shadeHex(base, 40), shadeHex(base, 4), shadeHex(base, -10));

    // Window grid - 4 rows x 4 columns showing density
    ctx.fillStyle = 'rgba(249, 251, 255, 0.70)';
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        ctx.fillRect(cx - 16 * scale + col * 8.5 * scale, cy - 18 * scale + row * 7 * scale, 3.5 * scale, 4 * scale);
      }
    }

    // Window shadows for depth
    ctx.fillStyle = 'rgba(30, 40, 50, 0.3)';
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        ctx.fillRect(cx - 14 * scale + col * 8.5 * scale, cy - 16 * scale + row * 7 * scale, 1.5 * scale, 2.5 * scale);
      }
    }

    // Balcony banding for clearer dense identity
    ctx.fillStyle = 'rgba(225, 232, 238, 0.34)';
    ctx.fillRect(cx - 18 * scale, cy - 12 * scale, 36 * scale, 1.6 * scale);
    ctx.fillRect(cx - 16 * scale, cy - 5 * scale, 32 * scale, 1.4 * scale);

    // Small rooftop utilities
    ctx.fillStyle = 'rgba(146, 156, 168, 0.95)';
    ctx.fillRect(cx - 8 * scale, cy - 29 * scale, 5 * scale, 2.6 * scale);
    ctx.fillRect(cx + 2 * scale, cy - 30 * scale, 6 * scale, 2.6 * scale);
  }

  function drawCommercialTower(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    // High-rise office tower (dense commercial) - tall with glass facade
    const top = '#d4f5ff';
    const left = '#9ce0ff';
    const right = '#5c9fd5';
    drawIsoPrism(ctx, cx, cy, 38 * scale, 20 * scale, 44 * scale, top, left, right);

    // Glass facade gradient
    const facade = ctx.createLinearGradient(cx - 20 * scale, cy - 42 * scale, cx + 20 * scale, cy + 12 * scale);
    facade.addColorStop(0, 'rgba(255,255,255,0.35)');
    facade.addColorStop(0.4, 'rgba(120, 210, 255, 0.18)');
    facade.addColorStop(1, 'rgba(20, 55, 85, 0.25)');
    ctx.fillStyle = facade;
    ctx.fillRect(cx - 18 * scale, cy - 41 * scale, 36 * scale, 50 * scale);

    // Cyan reflection strip
    const highlight = ctx.createLinearGradient(cx - 14 * scale, cy - 40 * scale, cx - 2 * scale, cy + 6 * scale);
    highlight.addColorStop(0, 'rgba(220, 250, 255, 0.45)');
    highlight.addColorStop(1, 'rgba(120, 210, 255, 0.0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(cx - 14 * scale, cy - 40 * scale, 8 * scale, 44 * scale);

    // Dense window grid - 6 rows x 3 columns showing height and density
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        ctx.fillRect(cx - 12 * scale + col * 8.5 * scale, cy - 35 * scale + row * 6.5 * scale, 3.5 * scale, 4 * scale);
      }
    }

    // Antenna spire
    ctx.strokeStyle = 'rgba(180, 180, 200, 0.8)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx + 2 * scale, cy - 45 * scale);
    ctx.lineTo(cx + 2 * scale, cy - 63 * scale);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 100, 100, 0.6)';
    ctx.beginPath();
    ctx.arc(cx + 2 * scale, cy - 63 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Rooftop AC units
    ctx.fillStyle = 'rgba(185, 196, 207, 0.95)';
    ctx.fillRect(cx - 9 * scale, cy - 44 * scale, 7 * scale, 3.5 * scale);
    ctx.fillRect(cx + 3 * scale, cy - 44 * scale, 6 * scale, 3.5 * scale);
    ctx.fillStyle = 'rgba(105, 122, 138, 0.9)';
    ctx.fillRect(cx - 8 * scale, cy - 43 * scale, 5 * scale, 1.2 * scale);
    ctx.fillRect(cx + 4 * scale, cy - 43 * scale, 4 * scale, 1.2 * scale);
  }

  function drawCommercialKiosk(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    drawIsoPrism(ctx, cx, cy, 34 * scale, 18 * scale, 12 * scale, shadeHex(base, 22), shadeHex(base, -12), shadeHex(base, -24));
    ctx.fillStyle = 'rgba(175, 235, 255, 0.42)';
    ctx.fillRect(cx - 11 * scale, cy - 12 * scale, 22 * scale, 5.5 * scale);
    ctx.fillStyle = 'rgba(236, 242, 247, 0.95)';
    ctx.fillRect(cx - 13 * scale, cy - 16 * scale, 26 * scale, 2.8 * scale);
    ctx.fillStyle = 'rgba(150, 160, 172, 0.9)';
    ctx.fillRect(cx - 8 * scale, cy - 17 * scale, 5 * scale, 2.2 * scale);
    ctx.fillRect(cx + 3 * scale, cy - 17 * scale, 5 * scale, 2.2 * scale);

    // Storefront awning + display front
    ctx.fillStyle = 'rgba(86, 164, 215, 0.92)';
    ctx.fillRect(cx - 12 * scale, cy - 9 * scale, 24 * scale, 2.6 * scale);
    ctx.fillStyle = 'rgba(210, 244, 255, 0.36)';
    ctx.fillRect(cx - 10 * scale, cy - 6 * scale, 20 * scale, 5 * scale);
  }

  function drawIndustrialWarehouse(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    // Light industrial: compact factory with soft sawtooth roof and single small chimney
    drawIsoPrism(ctx, cx, cy, 38 * scale, 20 * scale, 12 * scale, shadeHex(base, 10), shadeHex(base, -16), shadeHex(base, -28));

    // Small sawtooth roof profile
    ctx.beginPath();
    ctx.moveTo(cx - 19 * scale, cy - 18 * scale);
    for (let i = 0; i < 4; i += 1) {
      const px = cx - 19 * scale + i * 9.5 * scale;
      ctx.lineTo(px + 4.5 * scale, cy - 14 * scale);
      ctx.lineTo(px + 9.5 * scale, cy - 18 * scale);
    }
    ctx.lineTo(cx + 19 * scale, cy - 14 * scale);
    ctx.lineTo(cx - 19 * scale, cy - 14 * scale);
    ctx.closePath();
    ctx.fillStyle = shadeHex(base, 22);
    ctx.fill();

    // Single small stack
    drawIsoPrism(ctx, cx + 8 * scale, cy - 8 * scale, 6 * scale, 5 * scale, 12 * scale, '#8f939b', '#70747b', '#60656e');

    // Doors/windows strip
    ctx.fillStyle = 'rgba(96, 88, 60, 0.78)';
    ctx.fillRect(cx + 9 * scale, cy - 7 * scale, 8 * scale, 6 * scale);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let i = 0; i < 2; i += 1) {
      ctx.fillRect(cx - 11 * scale + i * 9 * scale, cy - 7 * scale, 4.5 * scale, 2.8 * scale);
    }

    // Warning stripe accent (light industrial still clearly industrial)
    ctx.fillStyle = 'rgba(230, 189, 74, 0.58)';
    ctx.fillRect(cx - 14 * scale, cy - 2.2 * scale, 28 * scale, 1.8 * scale);
  }

  function drawIndustrialFactory(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    // Large factory building (dense industrial) - warehouse with sawtooth roof and smokestacks
    drawIsoPrism(ctx, cx, cy, 52 * scale, 26 * scale, 18 * scale, shadeHex(base, 12), shadeHex(base, -22), shadeHex(base, -34));

    // Sawtooth roof pattern for industrial appeal
    ctx.beginPath();
    ctx.moveTo(cx - 26 * scale, cy - 26 * scale);
    for (let i = 0; i < 7; i += 1) {
      const px = cx - 26 * scale + i * 7.5 * scale;
      ctx.lineTo(px + 3.75 * scale, cy - 20 * scale);
      ctx.lineTo(px + 7.5 * scale, cy - 26 * scale);
    }
    ctx.lineTo(cx + 26 * scale, cy - 26 * scale);
    ctx.lineTo(cx + 26 * scale, cy - 20 * scale);
    ctx.lineTo(cx - 26 * scale, cy - 20 * scale);
    ctx.closePath();
    ctx.fillStyle = shadeHex(base, 28);
    ctx.fill();

    // Large smokestacks - multiple for emphasis on density
    for (let i = 0; i < 4; i += 1) {
      const stackX = cx - 16 * scale + i * 10 * scale;
      const stackHeight = 20 * scale + (i % 2) * 4 * scale; // Vary heights
      drawIsoPrism(ctx, stackX, cy - 8 * scale, 8 * scale, 6 * scale, stackHeight, '#888888', '#696969', '#505050');

      // Smoke effect
      ctx.fillStyle = 'rgba(140, 140, 140, 0.3)';
      ctx.beginPath();
      ctx.arc(stackX, cy - stackHeight - 8 * scale, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(stackX + 1 * scale, cy - stackHeight - 12 * scale, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Factory wall details
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(cx - 20 * scale, cy - 10 * scale, 40 * scale, 5 * scale);

    // Loading dock door
    ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
    ctx.fillRect(cx + 16 * scale, cy - 8 * scale, 8 * scale, 6 * scale);

    // Dense industrial hazard striping for stronger silhouette identity
    ctx.fillStyle = 'rgba(250, 214, 95, 0.56)';
    ctx.fillRect(cx - 22 * scale, cy - 1.8 * scale, 44 * scale, 2 * scale);
  }

  function drawCivicBlock(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number,
    variant: 'education' | 'police' | 'fire' | 'hospital' | 'prison'
  ): void {
    drawIsoPrism(ctx, cx, cy, 42 * scale, 22 * scale, 20 * scale, shadeHex(base, 18), shadeHex(base, -16), shadeHex(base, -30));

    ctx.fillStyle = 'rgba(244, 248, 252, 0.22)';
    for (let row = 0; row < 3; row += 1) {
      ctx.fillRect(cx - 15 * scale, cy - 18 * scale + row * 6.5 * scale, 30 * scale, 1.3 * scale);
    }

    ctx.fillStyle = 'rgba(245, 250, 255, 0.65)';
    for (let col = 0; col < 3; col += 1) {
      ctx.fillRect(cx - 13 * scale + col * 10 * scale, cy - 11 * scale, 5 * scale, 4.8 * scale);
    }

    const accent = variant === 'education'
      ? 'rgba(165, 142, 220, 0.86)'
      : variant === 'police'
        ? 'rgba(99, 142, 220, 0.86)'
        : variant === 'fire'
          ? 'rgba(234, 124, 72, 0.9)'
          : variant === 'hospital'
            ? 'rgba(221, 82, 82, 0.9)'
            : 'rgba(138, 151, 166, 0.88)';

    ctx.fillStyle = accent;
    ctx.fillRect(cx - 16 * scale, cy - 2.4 * scale, 32 * scale, 2.4 * scale);

    // Keep civic identity without switching to iconographic/cartoon style.
    if (variant === 'education') {
      ctx.beginPath();
      ctx.moveTo(cx - 14 * scale, cy - 18.5 * scale);
      ctx.lineTo(cx, cy - 25 * scale);
      ctx.lineTo(cx + 14 * scale, cy - 18.5 * scale);
      ctx.closePath();
      ctx.fillStyle = shadeHex(base, 30);
      ctx.fill();
    } else if (variant === 'hospital') {
      ctx.fillStyle = 'rgba(246, 248, 252, 0.94)';
      ctx.fillRect(cx - 1.3 * scale, cy - 17 * scale, 2.6 * scale, 10 * scale);
      ctx.fillRect(cx - 6 * scale, cy - 13 * scale, 12 * scale, 2.6 * scale);
    } else if (variant === 'prison') {
      ctx.fillStyle = 'rgba(52, 63, 77, 0.52)';
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(cx - 14 * scale + i * 7 * scale, cy - 13 * scale, 1.3 * scale, 11 * scale);
      }
    }
  }

  function drawUtilityWater(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    ctx.fillStyle = shadeHex(base, 18);
    ctx.fillRect(cx - 6 * scale, cy - 24 * scale, 12 * scale, 18 * scale);
    ctx.beginPath();
    ctx.ellipse(cx, cy - 26 * scale, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadeHex(base, 34);
    ctx.fill();
    ctx.fillStyle = shadeHex(base, -10);
    ctx.fillRect(cx - 3 * scale, cy - 6 * scale, 6 * scale, 16 * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 5 * scale, cy - 14 * scale);
    ctx.lineTo(cx + 5 * scale, cy - 14 * scale);
    ctx.stroke();
  }

  function drawUtilityTransport(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    drawIsoPrism(ctx, cx, cy, 42 * scale, 20 * scale, 16 * scale, shadeHex(base, 20), shadeHex(base, -14), shadeHex(base, -28));
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    ctx.fillRect(cx - 14 * scale, cy - 11 * scale, 28 * scale, 3 * scale);
    ctx.fillRect(cx - 8 * scale, cy - 17 * scale, 16 * scale, 6 * scale);
    ctx.strokeStyle = 'rgba(34, 59, 76, 0.65)';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 16 * scale, cy + 2 * scale);
    ctx.lineTo(cx + 16 * scale, cy + 2 * scale);
    ctx.stroke();
  }

  function drawPowerPlant(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    drawIsoPrism(ctx, cx, cy, 48 * scale, 24 * scale, 26 * scale, shadeHex(base, 22), shadeHex(base, -18), shadeHex(base, -32));
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let row = 0; row < 4; row += 1) {
      ctx.fillRect(cx - 18 * scale, cy - 22 * scale + row * 6 * scale, 36 * scale, 1.2 * scale);
    }
    for (let col = 0; col < 4; col += 1) {
      ctx.fillRect(cx - 18 * scale + col * 12 * scale, cy - 22 * scale, 1.2 * scale, 22 * scale);
    }
    ctx.fillStyle = 'rgba(87, 97, 110, 0.92)';
    ctx.fillRect(cx - 10 * scale, cy - 28 * scale, 8 * scale, 10 * scale);
    ctx.fillRect(cx + 2 * scale, cy - 24 * scale, 8 * scale, 8 * scale);
    ctx.beginPath();
    ctx.arc(cx - 2 * scale, cy - 8 * scale, 8 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(171, 184, 201, 0.86)';
    ctx.fill();
  }

  function drawNuclearPlant(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    drawIsoPrism(ctx, cx, cy, 50 * scale, 24 * scale, 18 * scale, shadeHex(base, 24), shadeHex(base, -16), shadeHex(base, -28));

    ctx.fillStyle = 'rgba(206, 232, 246, 0.9)';
    ctx.beginPath();
    ctx.ellipse(cx - 12 * scale, cy - 17 * scale, 7 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 12 * scale, cy - 17 * scale, 7 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(74, 102, 118, 0.8)';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * scale, cy - 29 * scale);
    ctx.lineTo(cx - 12 * scale, cy - 5 * scale);
    ctx.moveTo(cx + 12 * scale, cy - 29 * scale);
    ctx.lineTo(cx + 12 * scale, cy - 5 * scale);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 243, 181, 0.95)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 32 * scale);
    ctx.lineTo(cx + 3 * scale, cy - 26 * scale);
    ctx.lineTo(cx + 1 * scale, cy - 26 * scale);
    ctx.lineTo(cx + 4 * scale, cy - 20 * scale);
    ctx.lineTo(cx - 1 * scale, cy - 25 * scale);
    ctx.lineTo(cx + 1 * scale, cy - 25 * scale);
    ctx.closePath();
    ctx.fill();
  }

  function drawBuildingTemplate(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    archetype: BuildingArchetype,
    baseColor: string,
    width: number,
    height: number,
    scale: number
  ): void {
    const cx = width / 2;
    const cy = height * 0.78;

    if (archetype === 'residential_house') {
      drawResidentialHouse(ctx, cx, cy, baseColor, scale);
      return;
    }
    if (archetype === 'residential_apartment') {
      drawResidentialApartment(ctx, cx, cy, baseColor, scale);
      return;
    }
    if (archetype === 'commercial_tower') {
      drawCommercialTower(ctx, cx, cy, baseColor, scale);
      return;
    }
    if (archetype === 'commercial_kiosk') {
      drawCommercialKiosk(ctx, cx, cy, baseColor, scale);
      return;
    }
    if (archetype === 'industrial_warehouse') {
      drawIndustrialWarehouse(ctx, cx, cy, baseColor, scale);
      return;
    }
    if (archetype === 'industrial_factory') {
      drawIndustrialFactory(ctx, cx, cy, baseColor, scale);
      return;
    }

    if (archetype === 'utility_water') {
      drawUtilityWater(ctx, cx, cy, baseColor, scale);
      return;
    }

    if (archetype === 'utility_transport') {
      drawUtilityTransport(ctx, cx, cy, baseColor, scale);
      return;
    }

    if (archetype === 'power_plant_coal') {
      drawPowerPlant(ctx, cx, cy, baseColor, scale);
      return;
    }

    if (archetype === 'power_plant_nuclear') {
      drawNuclearPlant(ctx, cx, cy, baseColor, scale);
      return;
    }

    if (archetype === 'service_education') {
      drawCivicBlock(ctx, cx, cy, baseColor, scale, 'education');
      return;
    }
    if (archetype === 'service_police') {
      drawCivicBlock(ctx, cx, cy, baseColor, scale, 'police');
      return;
    }
    if (archetype === 'service_fire') {
      drawCivicBlock(ctx, cx, cy, baseColor, scale, 'fire');
      return;
    }
    if (archetype === 'service_hospital') {
      drawCivicBlock(ctx, cx, cy, baseColor, scale, 'hospital');
      return;
    }
    if (archetype === 'service_prison') {
      drawCivicBlock(ctx, cx, cy, baseColor, scale, 'prison');
      return;
    }

    drawIsoPrism(ctx, cx, cy, 42 * scale, 22 * scale, 20 * scale, shadeHex(baseColor, 20), shadeHex(baseColor, -18), shadeHex(baseColor, -33));
  }

  function getBuildingCacheEntry(tile: Tile, baseColorOverride?: string): BuildingCacheEntry {
    const archetype = buildingArchetypeFor(tile);
    const baseColor = baseColorOverride ?? buildingBaseColor(tile);
    const key = `${archetype}:${baseColor}:${BUILDING_CACHE_DPR}`;
    const cached = buildingCache.get(key);
    if (cached) return cached;

    const width = Math.ceil(tileWidth * 1.9 * BUILDING_CACHE_DPR);
    const height = Math.ceil(tileHeight * 2.5 * BUILDING_CACHE_DPR);
    const canvas = createCacheCanvas(width, height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) {
      const fallback: BuildingCacheEntry = {
        canvas,
        width,
        height,
        anchorX: width / 2,
        anchorY: height * 0.78,
        archetype
      };
      buildingCache.set(key, fallback);
      return fallback;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    drawBuildingTemplate(ctx, archetype, baseColor, width, height, BUILDING_CACHE_DPR);

    const entry: BuildingCacheEntry = {
      canvas,
      width,
      height,
      anchorX: width / 2,
      anchorY: height * 0.78,
      archetype
    };
    buildingCache.set(key, entry);
    return entry;
  }

  function drawCachedBuilding(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    cx: number,
    cy: number,
    baseColorOverride?: string
  ): void {
    const entry = getBuildingCacheEntry(tile, baseColorOverride);
    const scale = 1 / BUILDING_CACHE_DPR;
    const drawX = Math.round(cx - entry.anchorX * scale);
    const drawY = Math.round(cy - entry.anchorY * scale);
    const drawW = Math.round(entry.width * scale);
    const drawH = Math.round(entry.height * scale);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(BUILDING_VISUAL_SCALE, BUILDING_VISUAL_SCALE);
    ctx.translate(-cx, -cy);
    ctx.drawImage(entry.canvas as CanvasImageSource, drawX, drawY, drawW, drawH);
    ctx.restore();

    if (entry.archetype === 'industrial_factory' || entry.archetype === 'industrial_warehouse') {
      const phase = performance.now() * 0.002 + (tile.x + tile.y) * 0.15;
      const puffCount = entry.archetype === 'industrial_factory' ? 2 : 1;
      ctx.fillStyle = entry.archetype === 'industrial_factory' ? 'rgba(189, 194, 200, 0.42)' : 'rgba(175, 180, 188, 0.26)';
      for (let i = 0; i < puffCount; i += 1) {
        const puff = 4 + Math.sin(phase + i) * 1.7;
        ctx.beginPath();
        ctx.arc(cx + 6 + i * 7, cy - 33 - i * 8 - Math.sin(phase + i * 0.7) * 2, puff, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: worldX * camera.zoom + camera.x,
      y: worldY * camera.zoom + camera.y
    };
  }

  function clampCameraTarget(): void {
    if (!dynamicCanvasEl) return;

    const viewportWidth = dynamicCanvasEl.clientWidth;
    const viewportHeight = dynamicCanvasEl.clientHeight;
    const scaledWidth = worldWidth * cameraTarget.zoom;
    const scaledHeight = worldHeight * cameraTarget.zoom;

    if (scaledWidth + CAMERA_MARGIN * 2 <= viewportWidth) {
      cameraTarget.x = (viewportWidth - scaledWidth) / 2;
    } else {
      const maxX = CAMERA_MARGIN;
      const minX = viewportWidth - scaledWidth - CAMERA_MARGIN;
      cameraTarget.x = Math.max(minX, Math.min(maxX, cameraTarget.x));
    }

    if (scaledHeight + CAMERA_MARGIN * 2 <= viewportHeight) {
      cameraTarget.y = (viewportHeight - scaledHeight) / 2;
    } else {
      const maxY = CAMERA_MARGIN;
      const minY = viewportHeight - scaledHeight - CAMERA_MARGIN;
      cameraTarget.y = Math.max(minY, Math.min(maxY, cameraTarget.y));
    }
  }

  function clampCameraCurrent(): void {
    if (!dynamicCanvasEl) return;

    const viewportWidth = dynamicCanvasEl.clientWidth;
    const viewportHeight = dynamicCanvasEl.clientHeight;
    const scaledWidth = worldWidth * camera.zoom;
    const scaledHeight = worldHeight * camera.zoom;

    if (scaledWidth + CAMERA_MARGIN * 2 <= viewportWidth) {
      camera.x = (viewportWidth - scaledWidth) / 2;
    } else {
      const maxX = CAMERA_MARGIN;
      const minX = viewportWidth - scaledWidth - CAMERA_MARGIN;
      camera.x = Math.max(minX, Math.min(maxX, camera.x));
    }

    if (scaledHeight + CAMERA_MARGIN * 2 <= viewportHeight) {
      camera.y = (viewportHeight - scaledHeight) / 2;
    } else {
      const maxY = CAMERA_MARGIN;
      const minY = viewportHeight - scaledHeight - CAMERA_MARGIN;
      camera.y = Math.max(minY, Math.min(maxY, camera.y));
    }
  }

  function shouldPanByShortcut(event: MouseEvent): boolean {
    if (event.button === 1 || event.button === 2) return true;
    return event.button === 0 && isSpacePressed;
  }

  function beginPan(anchor: Point): void {
    isPanning = true;
    panAnchor = anchor;
    panVelocity = { x: 0, y: 0 };
    lastPanMoveTime = performance.now();
  }

  function updatePan(next: Point): void {
    if (!panAnchor) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastPanMoveTime);
    const dx = next.x - panAnchor.x;
    const dy = next.y - panAnchor.y;

    cameraTarget.x += dx;
    cameraTarget.y += dy;
    clampCameraTarget();

    panVelocity.x = dx / dt;
    panVelocity.y = dy / dt;
    panAnchor = next;
    lastPanMoveTime = now;
  }

  function pinchDistance(t0: Touch, t1: Touch): number {
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.hypot(dx, dy);
  }

  function pinchMidpoint(t0: Touch, t1: Touch): Point {
    return canvasPointFromClient((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2);
  }

  function emitEconomyParticle(worldX: number, worldY: number, value: number): void {
    const color = value >= 0 ? '#7FE08D' : '#FF7E7E';
    economyParticles = [
      ...economyParticles,
      {
        id: Date.now() + Math.floor(Math.random() * 10000),
        worldX,
        worldY,
        value,
        color,
        createdAt: performance.now(),
        ttlMs: ECONOMY_PARTICLE_TTL_MS,
        driftY: 28 + Math.random() * 20,
        size: 12 + Math.random() * 4
      }
    ].slice(-80);
  }

  function drawEconomyParticles(ctx: CanvasRenderingContext2D): void {
    if (economyParticles.length === 0) return;
    const now = performance.now();
    const next: EconomyParticle[] = [];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const particle of economyParticles) {
      const age = now - particle.createdAt;
      if (age >= particle.ttlMs) continue;
      next.push(particle);

      const t = age / particle.ttlMs;
      const alpha = 1 - t;
      const screen = worldToScreen(particle.worldX, particle.worldY);
      const screenY = screen.y - particle.driftY * t;

      ctx.font = `700 ${particle.size}px "Segoe UI", sans-serif`;
      ctx.fillStyle = `rgba(5, 8, 12, ${(0.5 * alpha).toFixed(3)})`;
      ctx.fillText(`${particle.value >= 0 ? '+' : '-'}§${Math.abs(Math.round(particle.value))}`, screen.x + 1, screenY + 1);

      ctx.fillStyle = particle.value >= 0
        ? `rgba(127, 224, 141, ${alpha.toFixed(3)})`
        : `rgba(255, 126, 126, ${alpha.toFixed(3)})`;
      ctx.fillText(`${particle.value >= 0 ? '+' : '-'}§${Math.abs(Math.round(particle.value))}`, screen.x, screenY);
    }

    economyParticles = next;
  }

  function renderStaticTerrain(): void {
    if (!offscreenCtx || !offscreen) return;

    offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    offscreenCtx.imageSmoothingEnabled = false;
    offscreenCtx.clearRect(0, 0, offscreen.width, offscreen.height);

    const grd = offscreenCtx.createLinearGradient(0, 0, 0, offscreen.height);
    grd.addColorStop(0, '#111922');
    grd.addColorStop(1, '#0b1016');
    offscreenCtx.fillStyle = grd;
    offscreenCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    const entries = buildDepthSortedEntries();
    for (const entry of entries) {
      const { tile, c, x, y } = entry;

      drawDiamond(offscreenCtx, c.x, c.y);
      offscreenCtx.fillStyle = terrainColor(tile);
      offscreenCtx.fill();

      const gloss = offscreenCtx.createLinearGradient(c.x, c.y - tileHeight / 2, c.x, c.y + tileHeight / 2);
      gloss.addColorStop(0, 'rgba(245,250,255,0.10)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.22)');
      offscreenCtx.fillStyle = gloss;
      offscreenCtx.fill();

      if (tile.terrain_type === 'grass' || tile.terrain_type === 'forest') {
        offscreenCtx.save();
        drawDiamond(offscreenCtx, c.x, c.y, tileWidth * 0.96, tileHeight * 0.92);
        offscreenCtx.clip();
        offscreenCtx.strokeStyle = tile.terrain_type === 'forest' ? 'rgba(82, 128, 85, 0.24)' : 'rgba(95, 142, 94, 0.2)';
        offscreenCtx.lineWidth = 0.55;
        const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        for (let i = 0; i < 10; i += 1) {
          const n = (seed + i * 2654435761) >>> 0;
          const ox = ((n & 255) / 255 - 0.5) * tileWidth * 0.7;
          const oy = (((n >> 8) & 255) / 255 - 0.5) * tileHeight * 0.58;
          const len = 1.8 + (((n >> 16) & 31) / 31) * 2.1;
          offscreenCtx.beginPath();
          offscreenCtx.moveTo(c.x + ox, c.y + oy + len * 0.2);
          offscreenCtx.lineTo(c.x + ox + 0.7, c.y + oy - len);
          offscreenCtx.stroke();
        }
        offscreenCtx.restore();
      }

      offscreenCtx.strokeStyle = 'rgba(255,255,255,0.07)';
      offscreenCtx.lineWidth = 0.95;
      offscreenCtx.lineCap = 'round';
      offscreenCtx.lineJoin = 'round';
      offscreenCtx.stroke();
    }

    staticDirty = false;
  }

  function isViewportDirty(): boolean {
    const camDelta = Math.abs(camera.x - lastCameraPos.x) + Math.abs(camera.y - lastCameraPos.y) +
                     Math.abs(camera.zoom - lastCameraPos.zoom);
    return camDelta > 2;
  }

  function tileScreenBounds(x: number, y: number): { x0: number; y0: number; x1: number; y1: number } {
    const c = worldCenter(x, y);
    // Isometric diamond bounds (approximate)
    const screenX = camera.x + c.x * camera.zoom;
    const screenY = camera.y + c.y * camera.zoom;
    const halfWidth = (tileWidth * camera.zoom) / 2;
    const halfHeight = (tileHeight * camera.zoom) / 2;
    return {
      x0: screenX - halfWidth,
      y0: screenY - halfHeight,
      x1: screenX + halfWidth,
      y1: screenY + halfHeight
    };
  }

  function isScreenVisible(bounds: { x0: number; y0: number; x1: number; y1: number }, margin = 64): boolean {
    const w = dynamicCanvasEl?.clientWidth ?? 512;
    const h = dynamicCanvasEl?.clientHeight ?? 512;
    return !(bounds.x1 + margin < 0 || bounds.x0 - margin > w ||
             bounds.y1 + margin < 0 || bounds.y0 - margin > h);
  }

  function visibleRange(): { minX: number; minY: number; maxX: number; maxY: number } {
    const w = dynamicCanvasEl.clientWidth;
    const h = dynamicCanvasEl.clientHeight;

    const corners = [
      screenToWorld({ x: 0, y: 0 }),
      screenToWorld({ x: w, y: 0 }),
      screenToWorld({ x: 0, y: h }),
      screenToWorld({ x: w, y: h }),
      screenToWorld({ x: w * 0.5, y: 0 }),
      screenToWorld({ x: w * 0.5, y: h }),
      screenToWorld({ x: 0, y: h * 0.5 }),
      screenToWorld({ x: w, y: h * 0.5 })
    ];

    let minGX = Number.POSITIVE_INFINITY;
    let maxGX = Number.NEGATIVE_INFINITY;
    let minGY = Number.POSITIVE_INFINITY;
    let maxGY = Number.NEGATIVE_INFINITY;

    for (const corner of corners) {
      const g = worldToGrid(corner);
      minGX = Math.min(minGX, g.x);
      maxGX = Math.max(maxGX, g.x);
      minGY = Math.min(minGY, g.y);
      maxGY = Math.max(maxGY, g.y);
    }

    const pad = 8;
    return {
      minX: Math.max(0, Math.floor(minGX) - pad),
      minY: Math.max(0, Math.floor(minGY) - pad),
      maxX: Math.min(mapWidth - 1, Math.ceil(maxGX) + pad),
      maxY: Math.min(mapHeight - 1, Math.ceil(maxGY) + pad)
    };
  }

  function drawDynamicLayer(): void {
    if (!dynamicCtx || !offscreen) return;

    dynamicCtx.setTransform(1, 0, 0, 1, 0, 0);
    dynamicCtx.imageSmoothingEnabled = false;
    dynamicCtx.clearRect(0, 0, dynamicCanvasEl.width, dynamicCanvasEl.height);

    // Use integer math for transform (pixel-aligned rendering)
    const screenZoom = dpr * camera.zoom;
    const screenX = Math.round(dpr * camera.x);
    const screenY = Math.round(dpr * camera.y);
    dynamicCtx.setTransform(screenZoom, 0, 0, screenZoom, screenX, screenY);

    if (undergroundMode) {
      drawUndergroundSchematicBackdrop(dynamicCtx);
    } else {
      dynamicCtx.drawImage(offscreen as CanvasImageSource, 0, 0);
    }

    const range = visibleRange();
    const entries = buildDepthSortedEntries(range);
    
    // Performance: Use viewport culling with margin for off-screen tiles
    const cullMargin = tileWidth;

    for (const entry of entries) {
      const { tile, c, x, y } = entry;
      
      // Viewport culling: Strictly enforce visibility check to skip off-screen tiles
      // This is critical for maintaining 60 FPS on large maps
      const bounds = tileScreenBounds(x, y);
      if (!isScreenVisible(bounds, cullMargin)) {
        // Skip all rendering operations for invisible tiles
        continue;
      }

      if (showZones && tile.zone && !undergroundMode) {
        const zoneColor = tile.zone.abandoned ? '#8f949d' : zoneTint[tile.zone.type] ?? '#7b8ea8';
        const isDeveloped = tile.zone.development_level > 0;

        dynamicCtx.fillStyle = isDeveloped ? zoneColor : 'rgba(255,255,255,0.04)';
        
        if (!isDeveloped) {
          // Undeveloped zone: draw outline + blueprint hatch
          drawDiamond(dynamicCtx, c.x, c.y, tileWidth * 0.9, tileHeight * 0.9);
          dynamicCtx.fill();
          
          // Batch line drawing: set all stroke properties before stroke
          dynamicCtx.setLineDash([5, 4]);
          dynamicCtx.strokeStyle = `${zoneColor}d8`;
          dynamicCtx.lineWidth = 1.3;
          dynamicCtx.stroke();
          dynamicCtx.setLineDash([]);
          
          // Blueprint hatch pattern
          drawBlueprintHatch(dynamicCtx, c.x, c.y, tileWidth * 0.84, tileHeight * 0.82, `${zoneColor}55`);
        } else {
          // Developed zone: simple color tint underlay
          drawDiamond(dynamicCtx, c.x, c.y, tileWidth * 0.9, tileHeight * 0.9);
          const alpha = tile.zone.abandoned ? 0.42 : 0.16;
          dynamicCtx.globalAlpha = alpha;
          dynamicCtx.fill();
          dynamicCtx.globalAlpha = 1;
        }
      }

      if (showInfrastructure && tile.infrastructure && tile.infrastructure.length > 0) {
        const hasSurfaceStructure = Boolean(tile.building || (tile.zone && tile.zone.development_level > 0));
        if (undergroundMode) {
          const undergroundInfra = getUndergroundInfrastructure(tile);
          if (undergroundInfra) {
            drawInfrastructureTile(dynamicCtx, c, undergroundInfra, true);
          }
        } else {
          const surfaceInfra = getSurfaceInfrastructure(tile);
          if (surfaceInfra) {
            const isRoadLike = surfaceInfra === 'road' || surfaceInfra === 'highway' || surfaceInfra === 'highway_ramp';
            // Avoid anti-aesthetic overlap between roads and structures on the same tile.
            if (!(hasSurfaceStructure && isRoadLike)) {
              drawContactShadow(dynamicCtx, c.x, c.y + tileHeight * 0.1, tileWidth * 0.22, tileHeight * 0.11, 0.7);
              drawInfrastructureTile(dynamicCtx, c, surfaceInfra, false);
            }
          }
        }
      }

      if (!undergroundMode) {
        if (tile.building) {
          drawContactShadow(dynamicCtx, c.x, c.y + tileHeight * 0.14, tileWidth * 0.27, tileHeight * 0.12, 1);
          dynamicCtx.save();
          if (tile.zone?.abandoned) {
            dynamicCtx.filter = 'grayscale(100%) brightness(50%)';
          }
          drawCachedBuilding(dynamicCtx, tile, c.x | 0, (c.y - tileHeight * 0.02) | 0);
          dynamicCtx.restore();
        } else if (tile.zone && tile.zone.development_level > 0) {
          // TASK 2: Only render building proxies at level > 0. Level 0 remains flat colored diamonds.
          // TASK 3: Scale hierarchy - TALL (public/dense), SHORT (light)
          const isDenseZone = tile.zone.type.includes('_dense');
          
          // TALL CLASS: dense areas, SHORT CLASS: light zones (still clearly visible)
          const scaleHeightFactor = isDenseZone ? 1.04 : 0.72;
          
          // TASK 3: Industrial unification - both light/dense use factory silhouette, differ only in vertical scale
          let buildingType: BuildingType;
          if (tile.zone.type.startsWith('residential_dense')) {
            buildingType = 'school';
          } else if (tile.zone.type.startsWith('residential')) {
            buildingType = 'school';
          } else if (tile.zone.type.startsWith('commercial_dense')) {
            buildingType = 'subway_station';
          } else if (tile.zone.type.startsWith('commercial')) {
            buildingType = 'bus_depot';
          } else if (tile.zone.type.startsWith('industrial_dense') || tile.zone.type.startsWith('industrial')) {
            // Unified industrial silhouette for both light/dense. Scale is the only visual difference.
            buildingType = 'water_treatment';
          } else {
            buildingType = 'school';
          }

          const developedProxy: Tile = {
            ...tile,
            x,
            y,
            building: {
              id: `proxy-${x}-${y}`,
              type: buildingType,
              position: { x, y },
              size: { w: 1, h: 1 },
              built_year: 0,
              built_month: 0,
              age_months: 0,
              powered: tile.powered,
              funding_pct: 100,
              active: true
            }
          };
          
          // Construction site overlay (early development)
          if (tile.zone.development_level < 15) {
            dynamicCtx.globalAlpha = 0.28;
            drawConstructionSite(dynamicCtx, c.x, c.y, tileWidth * 0.015);
            dynamicCtx.globalAlpha = 1;
          }
          
          // Density-aware building rendering with vertical scaling for realistic skyline
          dynamicCtx.save();
          const developmentFactor = Math.min(1, tile.zone.development_level / 100);
          // Light zones should still be clearly readable at a glance.
          dynamicCtx.globalAlpha = isDenseZone
            ? Math.min(1, 0.5 + developmentFactor * 0.45)
            : Math.min(1, 0.62 + developmentFactor * 0.3);
          
          // TASK 3: Apply scale hierarchy - tall for public/dense, short for light
          const densityScale = (isDenseZone
            ? (1.45 + developmentFactor * 0.25) * scaleHeightFactor
            : (1.02 + developmentFactor * 0.22) * scaleHeightFactor) * PROXY_SILHOUETTE_SCALE;
          if (isDenseZone) {
            dynamicCtx.globalAlpha = Math.min(1, dynamicCtx.globalAlpha + 0.15);
          }
          
          // Slight width boost + height boost for more prominent silhouettes without excessive bleed.
          dynamicCtx.translate(c.x, c.y);
          dynamicCtx.scale(1.07, densityScale);
          dynamicCtx.translate(-(c.x), -(c.y));

          drawContactShadow(
            dynamicCtx,
            c.x,
            c.y + tileHeight * 0.14,
            isDenseZone ? tileWidth * 0.24 : tileWidth * 0.26,
            isDenseZone ? tileHeight * 0.11 : tileHeight * 0.12,
            isDenseZone ? 0.9 : 0.98
          );
          
          if (tile.zone.abandoned) {
            dynamicCtx.filter = 'grayscale(100%) brightness(50%)';
          }
          drawCachedBuilding(dynamicCtx, developedProxy, c.x | 0, (c.y - tileHeight * 0.02) | 0);
          dynamicCtx.restore();
        }
      }

      // TASK 4: Status emoticons - only show if tile is developed (level > 0) and has feedback to display
      if (showStatusIcons && tile.zone && tile.zone.development_level > 0) {
        dynamicCtx.font = '14px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        dynamicCtx.textAlign = 'center';
        dynamicCtx.textBaseline = 'middle';

        // ⚡ Lightning: power status
        if (!tile.powered) {
          dynamicCtx.fillText('⚡', c.x | 0, (c.y - tileHeight * 0.95) | 0);
        }
        // 💧 Water droplet: water status
        if (!tile.watered) {
          dynamicCtx.fillText('💧', (c.x + 12) | 0, (c.y - tileHeight * 0.95) | 0);
        }
        // 🚫 No-Road: road access status
        if (!tile.road_access) {
          dynamicCtx.fillText('🚫', (c.x - 12) | 0, (c.y - tileHeight * 0.95) | 0);
        }
      } else if (showStatusIcons && tile.building && (!tile.powered || !tile.watered)) {
        dynamicCtx.font = '14px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        dynamicCtx.textAlign = 'center';
        dynamicCtx.textBaseline = 'middle';

        // Emoticons for real buildings as well
        if (!tile.powered) {
          dynamicCtx.fillText('⚡', c.x | 0, (c.y - tileHeight * 0.95) | 0);
        }
        if (!tile.watered) {
          dynamicCtx.fillText('💧', (c.x + 12) | 0, (c.y - tileHeight * 0.95) | 0);
        }
      }
    }

    // Composite UI layers on top of game world
    drawSelectionAndHover();
    drawGhostPreview();
    drawDemolitionEffects(dynamicCtx);

    // Debounced overlay rendering (every 5 frames)
    if (activeOverlay) {
      drawOverlayHeatmap(dynamicCtx, activeOverlay);
    }

    drawEconomyParticles(dynamicCtx);

    // Dynamic Lighting: Mouse flashlight effect (underground only)
    if (undergroundMode) {
      dynamicCtx.setTransform(1, 0, 0, 1, 0, 0);
      dynamicCtx.imageSmoothingEnabled = false;
      drawMouseFlashlight(dynamicCtx);
    }
  }

  function overlayTheme(type: string): { tint: string; line: string; alpha: number } {
    if (type === 'crime') return { tint: 'rgba(233, 86, 86, 0.26)', line: 'rgba(255, 160, 160, 0.14)', alpha: 0.24 };
    if (type === 'pollution_air') return { tint: 'rgba(136, 146, 158, 0.3)', line: 'rgba(189, 196, 203, 0.12)', alpha: 0.28 };
    if (type === 'pollution_water') return { tint: 'rgba(120, 92, 74, 0.24)', line: 'rgba(177, 141, 117, 0.12)', alpha: 0.22 };
    if (type === 'land_value') return { tint: 'rgba(103, 188, 154, 0.2)', line: 'rgba(153, 227, 199, 0.14)', alpha: 0.18 };
    if (type === 'traffic') return { tint: 'rgba(229, 152, 88, 0.23)', line: 'rgba(255, 203, 147, 0.14)', alpha: 0.22 };
    if (type === 'power') return { tint: 'rgba(238, 218, 109, 0.21)', line: 'rgba(255, 241, 170, 0.16)', alpha: 0.2 };
    if (type === 'water') return { tint: 'rgba(109, 184, 232, 0.2)', line: 'rgba(173, 226, 255, 0.14)', alpha: 0.2 };
    if (type === 'fire_coverage') return { tint: 'rgba(255, 134, 92, 0.19)', line: 'rgba(255, 198, 153, 0.14)', alpha: 0.18 };
    if (type === 'police_coverage') return { tint: 'rgba(101, 165, 255, 0.19)', line: 'rgba(172, 210, 255, 0.14)', alpha: 0.18 };
    return { tint: 'rgba(43, 112, 255, 0.18)', line: 'rgba(148, 188, 255, 0.12)', alpha: 0.18 };
  }

  function overlaySignal(tile: Tile, type: string): number {
    const pop = Math.min(1, (tile.zone?.population ?? 0) / 240);
    const dev = Math.min(1, (tile.zone?.development_level ?? 0) / 3);
    const infra = Math.min(1, tile.infrastructure.length / 3);
    const service = tile.building ? 1 : 0;

    if (type === 'crime') return Math.max(0, Math.min(1, 0.65 * pop + 0.25 * dev + 0.1 * (1 - service)));
    if (type === 'pollution_air') return Math.max(0, Math.min(1, 0.62 * infra + (tile.zone?.type.includes('industrial') ? 0.38 : 0.12)));
    if (type === 'pollution_water') return Math.max(0, Math.min(1, 0.58 * infra + (tile.terrain_type === 'water' ? 0.2 : 0.05)));
    if (type === 'land_value') return Math.max(0, Math.min(1, 0.75 - 0.5 * infra + 0.2 * (tile.zone?.type.includes('residential') ? 1 : 0)));
    if (type === 'traffic') return Math.max(0, Math.min(1, 0.55 * infra + 0.35 * pop));
    if (type === 'power') return tile.powered ? 0.2 : 0.9;
    if (type === 'water') return tile.watered ? 0.2 : 0.9;
    if (type === 'fire_coverage') return Math.max(0, Math.min(1, 0.7 - 0.45 * pop + 0.2 * service));
    if (type === 'police_coverage') return Math.max(0, Math.min(1, 0.72 - 0.5 * pop + 0.2 * service));
    return Math.max(0, Math.min(1, 0.3 + 0.4 * pop));
  }

  function sampleOverlay(x: number, y: number, type: string): number {
    let total = 0;
    let weight = 0;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const sx = x + ox;
        const sy = y + oy;
        const tile = worldTiles[sy]?.[sx];
        if (!tile) continue;
        const w = ox === 0 && oy === 0 ? 0.42 : (Math.abs(ox) + Math.abs(oy) === 2 ? 0.06 : 0.12);
        total += overlaySignal(tile, type) * w;
        weight += w;
      }
    }
    return weight > 0 ? total / weight : 0;
  }

  function heatmapColorRamp(v: number): string {
    const t = Math.max(0, Math.min(1, v));
    const r = Math.round(50 + t * 205);
    const g = Math.round(212 - t * 152);
    const b = Math.round(78 - t * 42);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawOverlayHeatmap(ctx: CanvasRenderingContext2D, type: string): void {
    // Debounce: Only recalculate every 5 frames or when type/position changes
    const shouldRecalculate = cachedOverlayFrame < 0 || 
                              (overlayFrameCounter - cachedOverlayFrame) >= 5 || 
                              cachedOverlayType !== type;
    
    if (shouldRecalculate) {
      // Create or reuse offscreen canvas for overlay
      if (!overlayDebounceCanvas) {
        overlayDebounceCanvas = new OffscreenCanvas(dynamicCanvasEl.width, dynamicCanvasEl.height);
      }
      
      const w = overlayDebounceCanvas.width;
      const h = overlayDebounceCanvas.height;
      
      // Only recreate if size changed
      if (overlayDebounceCanvas.width !== dynamicCanvasEl.width || 
          overlayDebounceCanvas.height !== dynamicCanvasEl.height) {
        overlayDebounceCanvas = new OffscreenCanvas(dynamicCanvasEl.width, dynamicCanvasEl.height);
      }
      
      const overlayCtx = overlayDebounceCanvas.getContext('2d') as CanvasRenderingContext2D;
      if (!overlayCtx) return;
      
      overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
      overlayCtx.clearRect(0, 0, w, h);
      overlayCtx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, Math.round(dpr * camera.x), Math.round(dpr * camera.y));
      
      const range = visibleRange();
      const entries = buildDepthSortedEntries(range);
      const strength = Math.max(0, Math.min(100, $overlayStrengthStore)) / 100;
      overlayCtx.globalAlpha = 0.14 + strength * 0.34;
      
      // Batch path operations - use minimal state changes
      for (const entry of entries) {
        const value = sampleOverlay(entry.x, entry.y, type);
        const cutoff = 0.07 + (1 - strength) * 0.12;
        if (value < cutoff) continue;
        const center = worldCenter(entry.x, entry.y);
        drawDiamond(overlayCtx, center.x, center.y);
        overlayCtx.fillStyle = heatmapColorRamp(Math.min(1, value * (0.65 + strength * 0.55)));
        overlayCtx.fill();
      }
      
      cachedOverlayFrame = overlayFrameCounter;
      cachedOverlayType = type;
    }
    
    // Draw cached overlay regardless of whether we recalculated
    if (overlayDebounceCanvas) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(overlayDebounceCanvas as CanvasImageSource, 0, 0);
      ctx.restore();
    }
  }

  function drawOverlayAtmosphere(ctx: CanvasRenderingContext2D, type: string): void {
    const theme = overlayTheme(type);
    const left = -tileWidth * 2;
    const top = -tileHeight * 2;
    const width = worldWidth + tileWidth * 4;
    const height = worldHeight + tileHeight * 4;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gradient = ctx.createLinearGradient(left, top, left + width, top + height);
    gradient.addColorStop(0, theme.tint.replace(/0\.[0-9]+\)/, `${Math.max(0.04, theme.alpha * 0.42).toFixed(2)})`));
    gradient.addColorStop(1, theme.tint);
    ctx.fillStyle = gradient;
    ctx.fillRect(left, top, width, height);

    ctx.globalCompositeOperation = 'overlay';
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    const step = Math.max(14, tileHeight * 0.9);
    for (let y = top; y <= top + height; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y + tileHeight * 0.18);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,255,255,${(theme.alpha * 0.08).toFixed(3)})`;
    for (let i = 0; i < 14; i += 1) {
      const x = left + (i / 13) * width;
      ctx.fillRect(x, top, 1, height);
    }
    ctx.restore();
  }

  function drawDemolitionEffects(ctx: CanvasRenderingContext2D): void {
    if (demolitionEffects.length === 0) return;

    const now = performance.now();
    const duration = 300;
    demolitionEffects = demolitionEffects.filter((effect) => now - effect.startedAt < duration);

    for (const effect of demolitionEffects) {
      const center = worldCenter(effect.x, effect.y);
      const t = Math.min(1, (now - effect.startedAt) / duration);
      const radius = tileWidth * (0.12 + t * 0.22);
      const alpha = 0.38 * (1 - t);

      ctx.beginPath();
      ctx.arc(center.x, center.y - tileHeight * 0.25, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(164, 170, 178, ${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }

  function drawStrokeBufferLayer(): void {
    if (!strokeCtx) return;

    strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
    strokeCtx.imageSmoothingEnabled = false;
    strokeCtx.clearRect(0, 0, strokeCanvasEl.width, strokeCanvasEl.height);

    if (!isZoneStroke && !isInfraStroke && !isBulldozeStroke) return;

    strokeCtx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, Math.round(dpr * camera.x), Math.round(dpr * camera.y));
    strokeCtx.lineJoin = 'round';
    strokeCtx.lineCap = 'round';

    if (isZoneStroke) {
      strokeCtx.fillStyle = `${zoneTint[zoneTool ?? 'residential_light'] ?? '#8ea2bf'}77`;
      strokeCtx.strokeStyle = `${zoneTint[zoneTool ?? 'residential_light'] ?? '#8ea2bf'}ee`;
      strokeCtx.lineWidth = 1.8;
      for (const point of sortTileKeysByDepth(ghostZoneKeys)) {
        const center = worldCenter(point.x, point.y);
        drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.95, tileHeight * 0.95);
        strokeCtx.fill();
        strokeCtx.stroke();
      }

      strokeCtx.fillStyle = 'rgba(255, 84, 84, 0.34)';
      strokeCtx.strokeStyle = 'rgba(255, 84, 84, 0.9)';
      strokeCtx.lineWidth = 1.8;
      for (const point of sortTileKeysByDepth(blockedGhostZoneKeys)) {
        const center = worldCenter(point.x, point.y);
        drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.95, tileHeight * 0.95);
        strokeCtx.fill();
        strokeCtx.stroke();
      }
    }

    if (isInfraStroke) {
      for (const point of sortTileKeysByDepth(ghostInfraKeys)) {
        const center = worldCenter(point.x, point.y);

        if (infrastructureTool === 'road') {
          drawRoadWithRealismEffects(strokeCtx, center.x, center.y, tileWidth * 0.88, tileHeight * 0.84);
        } else if (infrastructureTool === 'highway' || infrastructureTool === 'highway_ramp') {
          drawHighwayWithRealism(strokeCtx, center.x, center.y, tileWidth * 0.88, tileHeight * 0.84);
        } else if (infrastructureTool === 'rail') {
          drawRailWithRealism(strokeCtx, center.x, center.y, tileWidth * 0.88, tileHeight * 0.84);
        } else if (infrastructureTool === 'power_line') {
          drawPowerLineWithRealism(strokeCtx, center.x, center.y, tileWidth * 0.88, tileHeight * 0.84);
        } else if (infrastructureTool === 'water_pipe') {
          drawWaterPipeWithRealism(strokeCtx, center.x, center.y, tileWidth * 0.88, tileHeight * 0.84);
        } else if (infrastructureTool === 'subway_tunnel' || infrastructureTool === 'subway') {
          drawSubwayTunnelWithRealism(strokeCtx, center.x, center.y, tileWidth * 0.88, tileHeight * 0.84);
        } else {
          strokeCtx.strokeStyle = 'rgba(232, 239, 248, 0.92)';
          strokeCtx.lineWidth = 2.6;
          drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.78, tileHeight * 0.72);
          strokeCtx.stroke();
        }
      }

      strokeCtx.strokeStyle = 'rgba(255, 84, 84, 0.95)';
      strokeCtx.lineWidth = 2.6;
      for (const point of sortTileKeysByDepth(blockedGhostInfraKeys)) {
        const center = worldCenter(point.x, point.y);
        drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.78, tileHeight * 0.72);
        strokeCtx.stroke();
      }
    }

    if (isBulldozeStroke) {
      strokeCtx.fillStyle = 'rgba(255, 149, 0, 0.26)';
      strokeCtx.strokeStyle = 'rgba(255, 149, 0, 0.96)';
      strokeCtx.lineWidth = 1.9;
      for (const point of sortTileKeysByDepth(ghostBulldozeKeys)) {
        const center = worldCenter(point.x, point.y);
        drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.92, tileHeight * 0.92);
        strokeCtx.fill();
        strokeCtx.stroke();
      }
    }
  }

  function drawSelectionAndHover(): void {
    if (!dynamicCtx) return;
    const selected = selectedTile ?? localSelected;

    if (selected) {
      const center = worldCenter(selected.x, selected.y);
      const pulse = 0.68 + Math.sin(performance.now() * 0.008) * 0.2;
      drawDiamond(dynamicCtx, center.x, center.y);
      dynamicCtx.strokeStyle = `rgba(149,201,255,${pulse.toFixed(3)})`;
      dynamicCtx.lineWidth = 2;
      dynamicCtx.stroke();
    }

    if (hoverTile) {
      const center = worldCenter(hoverTile.x, hoverTile.y);
      drawDiamond(dynamicCtx, center.x, center.y);
      dynamicCtx.fillStyle = 'rgba(255,255,255,0.08)';
      dynamicCtx.fill();
      dynamicCtx.strokeStyle = 'rgba(255,255,255,0.28)';
      dynamicCtx.lineWidth = 1;
      dynamicCtx.stroke();
    }
  }

  function drawGhostPreview(): void {
    if (!dynamicCtx || !hoverTile) return;
    const center = worldCenter(hoverTile.x, hoverTile.y);

    if (activeTool === 'bulldozer') {
      drawDiamond(dynamicCtx, center.x, center.y, tileWidth * 0.95, tileHeight * 0.95);
      dynamicCtx.fillStyle = 'rgba(255,149,0,0.24)';
      dynamicCtx.fill();
      dynamicCtx.strokeStyle = '#FF9500';
      dynamicCtx.lineWidth = 1.6;
      dynamicCtx.stroke();
      return;
    }

    if (zoneTool) {
      const valid = canPlaceZoneAt(hoverTile.tile);
      const zoneBlueprint: Tile = {
        ...hoverTile.tile,
        zone: {
          id: 'ghost-zone',
          type: zoneTool,
          position: { x: hoverTile.x, y: hoverTile.y },
          size: { w: 1, h: 1 },
          development_level: zoneTool.endsWith('dense') ? 3 : 1,
          powered: hoverTile.tile.powered,
          watered: hoverTile.tile.watered,
          road_access: hoverTile.tile.road_access,
          abandoned: false,
          population: 0,
          built_year: 0,
          built_month: 0
        },
        building: null
      };

      dynamicCtx.save();
      dynamicCtx.globalAlpha = valid ? 0.64 : 0.32;
      drawCachedBuilding(dynamicCtx, zoneBlueprint, center.x, center.y - tileHeight * 0.02);
      dynamicCtx.restore();

      drawDiamond(dynamicCtx, center.x, center.y, tileWidth * 0.95, tileHeight * 0.95);
      dynamicCtx.fillStyle = valid ? `${zoneTint[zoneTool] ?? '#8ea2bf'}55` : 'rgba(255,84,84,0.34)';
      dynamicCtx.fill();
      dynamicCtx.strokeStyle = valid ? `${zoneTint[zoneTool] ?? '#8ea2bf'}cc` : 'rgba(255,84,84,0.9)';
      dynamicCtx.lineWidth = 1.4;
      dynamicCtx.stroke();
      return;
    }

    if (infrastructureTool) {
      const valid = canPlaceInfrastructureAt(hoverTile.tile, infrastructureTool);
      if (infrastructureTool === 'road' || infrastructureTool === 'highway' || infrastructureTool === 'highway_ramp') {
        dynamicCtx.save();
        dynamicCtx.translate(center.x, center.y - tileHeight * 0.04);
        dynamicCtx.scale(1, 0.7);
        dynamicCtx.beginPath();
        dynamicCtx.roundRect(-tileWidth * 0.28, -tileHeight * 0.1, tileWidth * 0.56, tileHeight * 0.2, tileHeight * 0.08);
        dynamicCtx.fillStyle = valid ? 'rgba(215, 224, 236, 0.55)' : 'rgba(255, 110, 110, 0.32)';
        dynamicCtx.fill();
        dynamicCtx.restore();
      } else if (infrastructureTool === 'rail') {
        dynamicCtx.save();
        dynamicCtx.translate(center.x, center.y);
        dynamicCtx.scale(0.8, 0.7);
        dynamicCtx.strokeStyle = valid ? 'rgba(200,150,80,0.7)' : 'rgba(255,110,110,0.5)';
        dynamicCtx.lineWidth = 2;
        dynamicCtx.beginPath();
        dynamicCtx.moveTo(-tileWidth * 0.3, 0);
        dynamicCtx.lineTo(tileWidth * 0.3, 0);
        dynamicCtx.stroke();
        dynamicCtx.restore();
      } else if (infrastructureTool === 'power_line') {
        dynamicCtx.save();
        dynamicCtx.translate(center.x, center.y);
        dynamicCtx.shadowColor = valid ? 'rgba(255,230,110,0.4)' : 'rgba(255,110,110,0.3)';
        dynamicCtx.shadowBlur = 8;
        dynamicCtx.strokeStyle = valid ? 'rgba(255,230,110,0.7)' : 'rgba(255,110,110,0.5)';
        dynamicCtx.lineWidth = 1.5;
        dynamicCtx.beginPath();
        dynamicCtx.moveTo(-tileWidth * 0.3, -tileHeight * 0.15);
        dynamicCtx.quadraticCurveTo(0, -tileHeight * 0.3, tileWidth * 0.3, -tileHeight * 0.15);
        dynamicCtx.stroke();
        dynamicCtx.restore();
      } else if (infrastructureTool === 'water_pipe') {
        dynamicCtx.save();
        dynamicCtx.translate(center.x, center.y);
        dynamicCtx.shadowColor = valid ? 'rgba(106,223,255,0.4)' : 'rgba(255,110,110,0.3)';
        dynamicCtx.shadowBlur = 10;
        dynamicCtx.strokeStyle = valid ? 'rgba(106,223,255,0.7)' : 'rgba(255,110,110,0.5)';
        dynamicCtx.lineWidth = 2;
        dynamicCtx.beginPath();
        dynamicCtx.moveTo(0, -tileHeight * 0.25);
        dynamicCtx.lineTo(0, tileHeight * 0.25);
        dynamicCtx.stroke();
        dynamicCtx.restore();
      } else if (infrastructureTool === 'subway_tunnel' || infrastructureTool === 'subway') {
        dynamicCtx.save();
        dynamicCtx.translate(center.x, center.y);
        const subwayGrad = dynamicCtx.createLinearGradient(-tileWidth * 0.3, 0, tileWidth * 0.3, 0);
        subwayGrad.addColorStop(0, valid ? 'rgba(100,200,255,0.5)' : 'rgba(255,110,110,0.3)');
        subwayGrad.addColorStop(0.5, valid ? 'rgba(80,160,255,0.4)' : 'rgba(255,110,110,0.25)');
        subwayGrad.addColorStop(1, valid ? 'rgba(60,140,255,0.5)' : 'rgba(255,110,110,0.3)');
        dynamicCtx.fillStyle = subwayGrad;
        dynamicCtx.beginPath();
        dynamicCtx.ellipse(0, 0, tileWidth * 0.3, tileHeight * 0.2, 0, 0, Math.PI * 2);
        dynamicCtx.fill();
        dynamicCtx.restore();
      }

      drawDiamond(dynamicCtx, center.x, center.y, tileWidth * 0.95, tileHeight * 0.95);
      dynamicCtx.fillStyle = valid ? 'rgba(199,213,233,0.16)' : 'rgba(255,84,84,0.24)';
      dynamicCtx.fill();
      dynamicCtx.strokeStyle = valid ? 'rgba(235,242,250,0.62)' : 'rgba(255,84,84,0.9)';
      dynamicCtx.lineWidth = 1.4;
      dynamicCtx.stroke();
      return;
    }

    if (buildingTool) {
      const valid = canPlaceBuildingAt(hoverTile.tile);
      const affordable = playerTreasury >= selectedBuildingCost;
      const buildAllowed = valid && affordable;
      const ghostTile: Tile = {
        ...hoverTile.tile,
        building: {
          id: 'ghost',
          type: buildingTool,
          position: { x: hoverTile.x, y: hoverTile.y },
          size: { w: 1, h: 1 },
          built_year: 0,
          built_month: 0,
          age_months: 0,
          powered: hoverTile.tile.powered,
          funding_pct: 100,
          active: true
        }
      };
      dynamicCtx.save();
      dynamicCtx.globalAlpha = buildAllowed ? 0.64 : 0.6;
      drawCachedBuilding(
        dynamicCtx,
        ghostTile,
        center.x,
        center.y - tileHeight * 0.02,
        buildAllowed ? undefined : '#FF3B30'
      );

      if (buildAllowed) {
        dynamicCtx.globalAlpha = 0.45;
        dynamicCtx.fillStyle = 'rgba(183,209,240,0.35)';
        drawDiamond(dynamicCtx, center.x, center.y);
        dynamicCtx.fill();
      } else {
        dynamicCtx.globalAlpha = 1;
        dynamicCtx.strokeStyle = 'rgba(255, 59, 48, 0.95)';
        dynamicCtx.lineWidth = 2.2;
        drawDiamond(dynamicCtx, center.x, center.y);
        dynamicCtx.stroke();
      }

      dynamicCtx.restore();
    }
  }

  function resizeCanvases(): void {
    if (!wrapEl || !dynamicCanvasEl || !staticCanvasEl || !rotationCanvasEl || !strokeCanvasEl) return;
    dpr = Math.max(1, window.devicePixelRatio || 1);

    const width = Math.max(1, wrapEl.clientWidth);
    const height = Math.max(1, wrapEl.clientHeight);

    dynamicCanvasEl.width = Math.floor(width * dpr);
    dynamicCanvasEl.height = Math.floor(height * dpr);
    staticCanvasEl.width = Math.floor(width * dpr);
    staticCanvasEl.height = Math.floor(height * dpr);
    strokeCanvasEl.width = Math.floor(width * dpr);
    strokeCanvasEl.height = Math.floor(height * dpr);
    rotationCanvasEl.width = Math.floor(width * dpr);
    rotationCanvasEl.height = Math.floor(height * dpr);

    dynamicCanvasEl.style.width = `${width}px`;
    dynamicCanvasEl.style.height = `${height}px`;
    staticCanvasEl.style.width = `${width}px`;
    staticCanvasEl.style.height = `${height}px`;
    strokeCanvasEl.style.width = `${width}px`;
    strokeCanvasEl.style.height = `${height}px`;
    rotationCanvasEl.style.width = `${width}px`;
    rotationCanvasEl.style.height = `${height}px`;

    ensureRotationSnapshotCanvas(Math.floor(width * dpr), Math.floor(height * dpr));
    if (rotationVisualActive) {
      captureRotationSnapshot();
    } else {
      clearRotationLayer();
    }

    const centerWorld = { x: worldWidth / 2, y: worldHeight / 2 };
    camera.x = width / 2 - centerWorld.x * camera.zoom;
    camera.y = height / 2 - centerWorld.y * camera.zoom;
    cameraTarget.x = camera.x;
    cameraTarget.y = camera.y;
    clampCameraTarget();
    clampCameraCurrent();
  }

  function centerCamera(zoom = 1): void {
    if (!dynamicCanvasEl) return;
    const cw = dynamicCanvasEl.clientWidth;
    const ch = dynamicCanvasEl.clientHeight;
    camera.zoom = zoom;
    cameraTarget.zoom = zoom;
    camera.x = cw / 2 - (worldWidth / 2) * zoom;
    camera.y = ch / 2 - (worldHeight / 2) * zoom;
    cameraTarget.x = camera.x;
    cameraTarget.y = camera.y;
    clampCameraTarget();
    clampCameraCurrent();
  }

  function focusOnTile(target: { x: number; y: number; zoom?: number } | null): void {
    if (!target || !dynamicCanvasEl) return;
    const c = worldCenter(target.x, target.y);
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, target.zoom ?? cameraTarget.zoom));
    cameraTarget.zoom = z;
    cameraTarget.x = dynamicCanvasEl.clientWidth / 2 - c.x * z;
    cameraTarget.y = dynamicCanvasEl.clientHeight / 2 - c.y * z;
    clampCameraTarget();
  }

  function bresenham(a: GridPoint, b: GridPoint): GridPoint[] {
    const out: GridPoint[] = [];
    let x0 = a.x;
    let y0 = a.y;
    const x1 = b.x;
    const y1 = b.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      out.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return out;
  }

  function flushImmediateStrokeQueue(): void {
    processPendingTiles(IMMEDIATE_STROKE_BUDGET_MS, IMMEDIATE_STROKE_MAX_TILES);
  }

  function applyZoneAt(point: GridPoint): boolean {
    if (!zoneTool) return false;
    const tile = worldTiles[point.y]?.[point.x];
    if (!tile || !canPlaceZoneAt(tile)) return false;

    const key = tileKey(point.x, point.y);
    if (zoneStrokeKeys.has(key)) return false;

    tile.zone = {
      id: `z-${point.x}-${point.y}-${Date.now()}`,
      type: zoneTool,
      position: { x: point.x, y: point.y },
      size: { w: 1, h: 1 },
      development_level: tile.zone?.development_level ?? 0,
      powered: tile.powered,
      watered: tile.watered,
      road_access: tile.road_access,
      abandoned: false,
      population: tile.zone?.population ?? 0,
      built_year: new Date().getFullYear(),
      built_month: new Date().getMonth() + 1
    };

    syncTileOccupancySlots(tile);
    strokeSpendTotal += zonePlacementCost[zoneTool];
    strokeAnchor = point;

    zoneStrokeKeys.add(key);
    return true;
  }

  function applyInfrastructureAt(point: GridPoint): boolean {
    if (!infrastructureTool) return false;
    const tile = worldTiles[point.y]?.[point.x];
    if (!tile || !canPlaceInfrastructureAt(tile, infrastructureTool)) return false;

    const key = tileKey(point.x, point.y);
    if (infraStrokeKeys.has(key)) return false;

    if (!tile.infrastructure.includes(infrastructureTool)) {
      tile.infrastructure = [...tile.infrastructure, infrastructureTool];
      if (infrastructureTool === 'road' || infrastructureTool === 'highway') tile.road_access = true;
      if (infrastructureTool === 'power_line') tile.powered = true;
      if (infrastructureTool === 'water_pipe') tile.watered = true;
      syncTileOccupancySlots(tile);
      strokeSpendTotal += infrastructurePlacementCost[infrastructureTool] ?? 0;
      strokeAnchor = point;
    }

    infraStrokeKeys.add(key);
    infraStrokeTypeByKey.set(key, infrastructureTool);
    return true;
  }

  function zoneSegment(next: GridPoint): void {
    const start = lastZonePoint ?? next;
    const line = bresenham(start, next);

    for (const point of line) {
      const key = tileKey(point.x, point.y);
      const tile = worldTiles[point.y]?.[point.x];
      if (tile && canPlaceZoneAt(tile)) {
        ghostZoneKeys.add(key);
        blockedGhostZoneKeys.delete(key);
      } else {
        blockedGhostZoneKeys.add(key);
        ghostZoneKeys.delete(key);
      }

      if (zoneStrokeKeys.has(key) || queuedZoneKeys.has(key)) continue;
      pendingZoneTiles.push(point);
      queuedZoneKeys.add(key);
    }

    lastZonePoint = next;
    
    // If stroke just started, record timing
    if (strokeTileCount === 0) {
      strokeStartTime = performance.now();
    }
  }

  function infraSegment(next: GridPoint): void {
    const start = lastInfraPoint ?? next;
    const line = bresenham(start, next);

    for (const point of line) {
      const key = tileKey(point.x, point.y);
      const tile = worldTiles[point.y]?.[point.x];
      if (tile && infrastructureTool && canPlaceInfrastructureAt(tile, infrastructureTool)) {
        ghostInfraKeys.add(key);
        blockedGhostInfraKeys.delete(key);
      } else {
        blockedGhostInfraKeys.add(key);
        ghostInfraKeys.delete(key);
      }

      if (infraStrokeKeys.has(key) || queuedInfraKeys.has(key)) continue;
      pendingInfraTiles.push(point);
      queuedInfraKeys.add(key);
    }

    lastInfraPoint = next;

    // If stroke just started, record timing
    if (strokeTileCount === 0) {
      strokeStartTime = performance.now();
    }
  }

  function bulldozeSegment(next: GridPoint): void {
    const start = lastBulldozePoint ?? next;
    const line = bresenham(start, next);

    for (const point of line) {
      const key = tileKey(point.x, point.y);

      ghostBulldozeKeys.add(key);
      if (bulldozeStrokeKeys.has(key) || queuedBulldozeKeys.has(key)) continue;
      pendingBulldozeTiles.push(point);
      queuedBulldozeKeys.add(key);
    }

    lastBulldozePoint = next;

    if (strokeTileCount === 0) {
      strokeStartTime = performance.now();
    }
  }

  function processPendingTiles(frameBudgetMs: number, maxTilesPerFrame: number): void {
    const frameStart = performance.now();
    let processedTiles = 0;

    // Process zone tiles
    while (pendingZoneTiles.length > 0) {
      const elapsed = performance.now() - frameStart;
      if (elapsed > frameBudgetMs || processedTiles >= maxTilesPerFrame) break;

      const tile = pendingZoneTiles.pop();
      if (!tile) continue;
      queuedZoneKeys.delete(tileKey(tile.x, tile.y));
      if (applyZoneAt(tile)) {
        strokeTileCount += 1;
        staticDirty = true;
        bufferedZoneKeys.add(tileKey(tile.x, tile.y));
        processedTiles += 1;
      }
    }

    // Process infra tiles (if zone tiles didn't consume all budget)
    while (pendingInfraTiles.length > 0) {
      const elapsed = performance.now() - frameStart;
      if (elapsed > frameBudgetMs || processedTiles >= maxTilesPerFrame) break;

      const tile = pendingInfraTiles.pop();
      if (!tile) continue;
      queuedInfraKeys.delete(tileKey(tile.x, tile.y));
      if (applyInfrastructureAt(tile)) {
        strokeTileCount += 1;
        staticDirty = true;
        bufferedInfraKeys.add(tileKey(tile.x, tile.y));
        processedTiles += 1;
      }
    }

    while (pendingBulldozeTiles.length > 0) {
      const elapsed = performance.now() - frameStart;
      if (elapsed > frameBudgetMs || processedTiles >= maxTilesPerFrame) break;

      const tilePoint = pendingBulldozeTiles.pop();
      if (!tilePoint) continue;

      queuedBulldozeKeys.delete(tileKey(tilePoint.x, tilePoint.y));
      const result = clearTileWithBulldozer(tilePoint);
      if (!result.cleared) continue;

      bulldozeStrokeKeys.add(tileKey(tilePoint.x, tilePoint.y));
      strokeTileCount += 1;
      staticDirty = true;
      processedTiles += 1;

      if (result.demolitionType) {
        bulldozeDemolitions.push({ x: tilePoint.x, y: tilePoint.y, type: result.demolitionType });
      }

      if (result.hadBuilding) {
        demolitionEffects = [...demolitionEffects, { x: tilePoint.x, y: tilePoint.y, startedAt: performance.now() }];
      }
    }
  }

  function dispatchBufferedStrokeUpdates(): void {
    if (isZoneStroke && bufferedZoneKeys.size > 0) {
      dispatch('zoneBuffered', {
        updatedTiles: Array.from(bufferedZoneKeys).map(parseTileKey),
        tilesSnapshot: []
      });
      bufferedZoneKeys.clear();
    }

    if (isInfraStroke && bufferedInfraKeys.size > 0) {
      const typedUpdates = Array.from(bufferedInfraKeys)
        .map((key) => {
          const point = parseTileKey(key);
          const type = infraStrokeTypeByKey.get(key);
          return type ? { ...point, type } : null;
        })
        .filter((entry): entry is InfraTypedTile => entry !== null);

      dispatch('infrastructureBuffered', {
        updatedTiles: Array.from(bufferedInfraKeys).map(parseTileKey),
        tilesSnapshot: [],
        typedUpdates
      });
      bufferedInfraKeys.clear();
    }
  }

  function cloneRowwiseSnapshot(source: Tile[][]): Tile[][] {
    return source.map((row) =>
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
          : null
      }))
    );
  }

  function endStroke(): void {
    // Process any remaining pending tiles
    processPendingTiles(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

    if (isZoneStroke) {
      const updatedTiles = Array.from(zoneStrokeKeys).map(parseTileKey);
      if (updatedTiles.length > 0) {
        dispatch('zonePainted', {
          updatedTiles,
          tilesSnapshot: cloneRowwiseSnapshot(worldTiles)
        });
      }
    }

    if (isInfraStroke) {
      const updatedTiles = Array.from(infraStrokeKeys).map(parseTileKey);
      if (updatedTiles.length > 0) {
        const typedUpdates = Array.from(infraStrokeKeys)
          .map((key) => {
            const point = parseTileKey(key);
            const type = infraStrokeTypeByKey.get(key);
            return type ? { ...point, type } : null;
          })
          .filter((entry): entry is InfraTypedTile => entry !== null);

        dispatch('infrastructureDrawn', {
          updatedTiles,
          tilesSnapshot: cloneRowwiseSnapshot(worldTiles),
          typedUpdates
        });
      }
    }

    if (isBulldozeStroke) {
      const updatedTiles = Array.from(bulldozeStrokeKeys).map(parseTileKey);
      if (updatedTiles.length > 0) {
        dispatch('bulldozerCleared', {
          updatedTiles,
          tilesSnapshot: cloneRowwiseSnapshot(worldTiles),
          cost: updatedTiles.length * 20,
          demolitions: [...bulldozeDemolitions]
        });
      }
    }

    dispatchBufferedStrokeUpdates();

    if (strokeSpendTotal > 0 && strokeAnchor) {
      const center = worldCenter(strokeAnchor.x, strokeAnchor.y);
      emitEconomyParticle(center.x, center.y - tileHeight * 0.65, -strokeSpendTotal);
    }

    if (strokeRefundTotal > 0 && strokeAnchor) {
      const center = worldCenter(strokeAnchor.x, strokeAnchor.y);
      emitEconomyParticle(center.x, center.y - tileHeight * 0.65, strokeRefundTotal);
    }

    // Record stroke metrics
    if (strokeTileCount > 0) {
      const strokeDurationMs = performance.now() - strokeStartTime;
      performanceMetrics.recordStroke(strokeTileCount, strokeDurationMs);
    }

    isZoneStroke = false;
    isInfraStroke = false;
    isBulldozeStroke = false;
    isPanning = false;
    isPinching = false;
    panAnchor = null;
    lastPinchDistance = 0;
    lastZonePoint = null;
    lastInfraPoint = null;
    lastBulldozePoint = null;
    pendingZoneTiles = [];
    pendingInfraTiles = [];
    pendingBulldozeTiles = [];
    queuedZoneKeys = new Set<string>();
    queuedInfraKeys = new Set<string>();
    queuedBulldozeKeys = new Set<string>();
    ghostZoneKeys = new Set<string>();
    ghostInfraKeys = new Set<string>();
    ghostBulldozeKeys = new Set<string>();
    blockedGhostZoneKeys = new Set<string>();
    blockedGhostInfraKeys = new Set<string>();
    bulldozeDemolitions = [];
    bufferedZoneKeys = new Set<string>();
    bufferedInfraKeys = new Set<string>();
    infraStrokeTypeByKey = new Map<string, InfrastructureType>();
    strokeTileCount = 0;
    strokeFrameTicker = 0;
    strokeSpendTotal = 0;
    strokeRefundTotal = 0;
    strokeAnchor = null;
  }

  function onPointerDown(event: MouseEvent): void {
    if (inputLocked || isRotationAnimating()) return;
    if (event.button === 2) {
      event.preventDefault();
      endStroke();
      dispatch('mapClicked', null);
      dispatch('toolCancelRequested', null);
      return;
    }

    if (shouldPanByShortcut(event)) {
      event.preventDefault();
      beginPan(canvasPoint(event));
      dispatch('mapClicked', null);
      return;
    }

    if (event.button !== 0) return;

    const picked = pickTileFromEvent(event);

    if (picked && activeTool !== 'bulldozer') {
      const tile = worldTiles[picked.y]?.[picked.x] ?? null;
      if (canSilentlySkipPickedTile(tile)) {
        dispatch('occupiedAttempt', {
          x: picked.x,
          y: picked.y,
          message: 'Tile occupied. Use Bulldozer to replace existing content.'
        });
        return;
      }
    }

    if (activeTool === 'bulldozer' && picked) {
      bulldozeStrokeKeys = new Set<string>();
      bulldozeDemolitions = [];
      isBulldozeStroke = true;
      lastBulldozePoint = picked;
      bulldozeSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (zoneTool && picked) {
      zoneStrokeKeys = new Set<string>();
      isZoneStroke = true;
      lastZonePoint = picked;
      zoneSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (infrastructureTool && picked) {
      infraStrokeKeys = new Set<string>();
      isInfraStroke = true;
      lastInfraPoint = picked;
      infraSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (!hasActivePaintTool()) {
      beginPan(canvasPoint(event));
    }
  }

  function onPointerMove(event: MouseEvent): void {
    if (inputLocked || isRotationAnimating()) return;
    
    // Track mouse position for flashlight effect (in screen coordinates)
    const rect = dynamicCanvasEl?.getBoundingClientRect();
    if (rect) {
      mouseScreenX = event.clientX - rect.left;
      mouseScreenY = event.clientY - rect.top;
    }
    
    const picked = pickTileFromEvent(event);
    const pickedTile = picked ? (worldTiles[picked.y]?.[picked.x] ?? null) : null;
    if (picked) {
      const tile = pickedTile;
      hoverTile = tile ? { x: picked.x, y: picked.y, tile } : null;
    } else {
      hoverTile = null;
    }

    if (pickedTile && canSilentlySkipPickedTile(pickedTile)) {
      return;
    }

    // Update hover preview for zone/infra tools when no stroke is active
    if (!isZoneStroke && !isInfraStroke && !isBulldozeStroke) {
      if (zoneTool && picked && pickedTile && canPlaceZoneAt(pickedTile)) {
        ghostZoneKeys.clear();
        blockedGhostZoneKeys.clear();
        const key = tileKey(picked.x, picked.y);
        ghostZoneKeys.add(key);
      } else if (zoneTool) {
        ghostZoneKeys.clear();
        blockedGhostZoneKeys.clear();
      }

      if (infrastructureTool && picked && pickedTile && canPlaceInfrastructureAt(pickedTile, infrastructureTool)) {
        ghostInfraKeys.clear();
        blockedGhostInfraKeys.clear();
        const key = tileKey(picked.x, picked.y);
        ghostInfraKeys.add(key);
      } else if (infrastructureTool) {
        ghostInfraKeys.clear();
        blockedGhostInfraKeys.clear();
      }
    }

    if (isZoneStroke && picked) {
      zoneSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (isInfraStroke && picked) {
      infraSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (isBulldozeStroke && picked) {
      bulldozeSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (isPanning && panAnchor) {
      updatePan(canvasPoint(event));
    }
  }

  function onPointerLeave(): void {
    hoverTile = null;
    endStroke();
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    endStroke();
    dispatch('mapClicked', null);
    dispatch('toolCancelRequested', null);
  }

  function onMapClick(event: MouseEvent): void {
    if (inputLocked || isRotationAnimating()) return;
    if (isPanning || isInfraStroke || isZoneStroke || zoneTool || infrastructureTool) {
      dispatch('mapClicked', null);
      return;
    }

    const picked = pickTileFromEvent(event);
    dispatch('mapClicked', picked ?? null);
    if (!picked) return;

    localSelected = picked;
    if (buildingTool) {
      const tile = worldTiles[picked.y]?.[picked.x];
      if (tile && canPlaceBuildingAt(tile)) {
        const center = worldCenter(picked.x, picked.y);
        emitEconomyParticle(center.x, center.y - tileHeight * 0.75, -Math.max(0, selectedBuildingCost));
        dispatch('tileClicked', picked);
      }
    }
  }

  function onWheel(event: WheelEvent): void {
    if (inputLocked || isRotationAnimating()) return;
    event.preventDefault();

    const cursor = canvasPoint(event);
    const worldBefore = screenToWorld(cursor);
    const delta = -event.deltaY * ZOOM_LINEAR_SENSITIVITY;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cameraTarget.zoom + delta));

    if (nextZoom === cameraTarget.zoom) return;

    cameraTarget.zoom = nextZoom;
    cameraTarget.x = cursor.x - worldBefore.x * nextZoom;
    cameraTarget.y = cursor.y - worldBefore.y * nextZoom;
    clampCameraTarget();
  }

  function onTouchStart(event: TouchEvent): void {
    if (inputLocked || isRotationAnimating()) return;

    if (event.touches.length >= 2) {
      event.preventDefault();
      if (isZoneStroke || isInfraStroke || isBulldozeStroke) {
        endStroke();
      }
      isPinching = true;
      isPanning = false;
      panAnchor = null;
      const [t0, t1] = [event.touches[0], event.touches[1]];
      lastPinchDistance = pinchDistance(t0, t1);
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;
    const point = canvasPointFromClient(touch.clientX, touch.clientY);
    const picked = pickTileFromPoint(point);

    if (activeTool === 'bulldozer' && picked) {
      if (event.cancelable) event.preventDefault();
      bulldozeStrokeKeys = new Set<string>();
      bulldozeDemolitions = [];
      isBulldozeStroke = true;
      lastBulldozePoint = picked;
      bulldozeSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (zoneTool && picked) {
      if (event.cancelable) event.preventDefault();
      zoneStrokeKeys = new Set<string>();
      isZoneStroke = true;
      lastZonePoint = picked;
      zoneSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (infrastructureTool && picked) {
      if (event.cancelable) event.preventDefault();
      infraStrokeKeys = new Set<string>();
      isInfraStroke = true;
      lastInfraPoint = picked;
      infraSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (event.cancelable) event.preventDefault();
    beginPan(point);
  }

  function onTouchMove(event: TouchEvent): void {
    if (inputLocked || isRotationAnimating()) return;

    if (event.cancelable && (isPinching || isPanning || isZoneStroke || isInfraStroke || isBulldozeStroke)) {
      event.preventDefault();
    }

    if (event.touches.length >= 2) {
      const [t0, t1] = [event.touches[0], event.touches[1]];
      const midpoint = pinchMidpoint(t0, t1);
      const worldBefore = screenToWorld(midpoint);
      const distance = pinchDistance(t0, t1);

      if (!isPinching) {
        isPinching = true;
        lastPinchDistance = distance;
        return;
      }

      const delta = distance - lastPinchDistance;
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cameraTarget.zoom + delta * PINCH_LINEAR_SENSITIVITY));
      cameraTarget.zoom = nextZoom;
      cameraTarget.x = midpoint.x - worldBefore.x * nextZoom;
      cameraTarget.y = midpoint.y - worldBefore.y * nextZoom;
      clampCameraTarget();
      lastPinchDistance = distance;
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;
    const point = canvasPointFromClient(touch.clientX, touch.clientY);
    const picked = pickTileFromPoint(point);
    const pickedTile = picked ? (worldTiles[picked.y]?.[picked.x] ?? null) : null;
    hoverTile = picked && pickedTile ? { x: picked.x, y: picked.y, tile: pickedTile } : null;

    if (pickedTile && canSilentlySkipPickedTile(pickedTile)) {
      return;
    }

    if (isZoneStroke && picked) {
      zoneSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (isInfraStroke && picked) {
      infraSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (isBulldozeStroke && picked) {
      bulldozeSegment(picked);
      flushImmediateStrokeQueue();
      return;
    }

    if (isPanning && panAnchor) {
      updatePan(point);
    }
  }

  function onTouchEnd(event: TouchEvent): void {
    if (isRotationAnimating()) return;
    if (event.touches.length >= 2) {
      const [t0, t1] = [event.touches[0], event.touches[1]];
      lastPinchDistance = pinchDistance(t0, t1);
      return;
    }

    endStroke();
  }

  function tick(): void {
    strokeFrameTicker += 1;
    const now = performance.now();
    const frameDelta = now - lastFrameTimestamp;
    lastFrameTimestamp = now;
    // Improved smoothing: more responsive to frame variations but stable against noise
    smoothedFrameMs = smoothedFrameMs * 0.85 + frameDelta * 0.15;
    compassDegrees = activeRotationDegrees(now);

    if (isRotationAnimating(now)) {
      rotationVisualActive = true;
    } else if (rotationFromIndex !== rotationToIndex) {
      const pivotScreenX = dpr > 0 ? rotationPivotScreenX / dpr : rotationPivotScreenX;
      const pivotScreenY = dpr > 0 ? rotationPivotScreenY / dpr : rotationPivotScreenY;
      const settledZoom = rotationFrozenCamera.zoom;

      rotationIndex = rotationToIndex;
      rotationFromIndex = rotationToIndex;
      rotationVisualActive = false;
      clearRotationLayer();
      rebuildWorldGeometry();
      ensureOffscreen();

      // Keep the world pivot anchored to the same screen position after rotation.
      const pivotWorldX = worldWidth * 0.5;
      const pivotWorldY = worldHeight * 0.5;
      camera.zoom = settledZoom;
      cameraTarget.zoom = settledZoom;
      camera.x = pivotScreenX - pivotWorldX * settledZoom;
      camera.y = pivotScreenY - pivotWorldY * settledZoom;
      cameraTarget.x = camera.x;
      cameraTarget.y = camera.y;
      staticDirty = true;
    }

    if (rotationVisualActive) {
      camera.x = rotationFrozenCamera.x;
      camera.y = rotationFrozenCamera.y;
      camera.zoom = rotationFrozenCamera.zoom;
      cameraTarget.x = rotationFrozenCamera.x;
      cameraTarget.y = rotationFrozenCamera.y;
      cameraTarget.zoom = rotationFrozenCamera.zoom;
    } else {
      camera.x += (cameraTarget.x - camera.x) * CAMERA_LERP;
      camera.y += (cameraTarget.y - camera.y) * CAMERA_LERP;
      camera.zoom += (cameraTarget.zoom - camera.zoom) * CAMERA_LERP;

      if (!isPanning && !isPinching) {
        const decay = Math.pow(PAN_INERTIA_FRICTION, Math.max(0.5, frameDelta / TARGET_FRAME_MS));
        panVelocity.x *= decay;
        panVelocity.y *= decay;

        if (Math.abs(panVelocity.x) > PAN_INERTIA_EPSILON || Math.abs(panVelocity.y) > PAN_INERTIA_EPSILON) {
          cameraTarget.x += panVelocity.x * frameDelta;
          cameraTarget.y += panVelocity.y * frameDelta;
        } else {
          panVelocity = { x: 0, y: 0 };
        }
      }
    }

    clampCameraTarget();
    clampCameraCurrent();

    // Check if viewport culling needs update
    if (isViewportDirty()) {
      cullingDirty = true;
      lastCameraPos = { x: camera.x, y: camera.y, zoom: camera.zoom };
    }

    if (staticDirty) {
      renderStaticTerrain();
    }

    // Process pending tiles within frame budget (adaptive batching)
    if (pendingZoneTiles.length > 0 || pendingInfraTiles.length > 0 || pendingBulldozeTiles.length > 0) {
      const backlog = pendingZoneTiles.length + pendingInfraTiles.length + pendingBulldozeTiles.length;
      const headroom = TARGET_FRAME_MS - smoothedFrameMs;
      const backlogBoost = Math.min(2.5, backlog / 240);
      const adaptiveBudget = Math.max(
        MIN_PROCESS_BUDGET_MS,
        Math.min(MAX_PROCESS_BUDGET_MS, 3 + headroom * 0.45 + backlogBoost)
      );
      const adaptiveTileCap = smoothedFrameMs > 18 ? 36 : smoothedFrameMs > 16.7 ? 64 : 120;
      processPendingTiles(adaptiveBudget, adaptiveTileCap);
    }

    if ((isZoneStroke || isInfraStroke) && strokeFrameTicker % 10 === 0) {
      dispatchBufferedStrokeUpdates();
    }

    // Increment overlay frame counter for debouncing
    overlayFrameCounter += 1;

    if (!rotationVisualActive) {
      drawDynamicLayer();
      drawStrokeBufferLayer();
    } else {
      drawRotationTweenFrame(now);
    }
    
    // Record frame time for metrics
    performanceMetrics.recordFrame();
    
    raf = requestAnimationFrame(tick);
  }

  $: if (tiles && tiles !== prevTilesRef && tiles.length > 0) {
    worldTiles = tiles;
    prevTilesRef = tiles;
    staticDirty = true;
  }

  $: if (mapWidth > 0 && mapHeight > 0 && tileWidth > 0 && tileHeight > 0) {
    rebuildWorldGeometry();
    ensureOffscreen();
    buildSpatialIndex();
  }

  $: if (focusTile) {
    focusOnTile(focusTile);
  }

  $: if (undergroundMode) {
    staticDirty = true;
  }

  // Clear hover previews when tools are deselected
  $: if (!zoneTool || !hoverTile) {
    if (!isZoneStroke) {
      ghostZoneKeys.clear();
      blockedGhostZoneKeys.clear();
    }
  }

  $: if (!infrastructureTool || !hoverTile) {
    if (!isInfraStroke) {
      ghostInfraKeys.clear();
      blockedGhostInfraKeys.clear();
    }
  }

  onMount(() => {
    dynamicCtx = dynamicCanvasEl.getContext('2d');
    staticCtx = staticCanvasEl.getContext('2d');
    rotationCtx = rotationCanvasEl.getContext('2d');
    strokeCtx = strokeCanvasEl.getContext('2d');

    worldTiles = tiles;
    prevTilesRef = tiles;

    rebuildWorldGeometry();
    ensureOffscreen();
    buildSpatialIndex();

    resizeCanvases();
    centerCamera(1);
    renderStaticTerrain();

    const onResize = (): void => {
      resizeCanvases();
    };
    const onUp = (): void => endStroke();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space') isSpacePressed = true;
      if (!event.repeat && event.code === 'KeyR') {
        event.preventDefault();
        if (!isRotationAnimating()) {
          triggerRotationStep(1);
        }
      }
      if (event.code === 'Escape') {
        endStroke();
        dispatch('mapClicked', null);
        dispatch('toolCancelRequested', null);
      }
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') isSpacePressed = false;
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(raf);
      buildingCache.clear();
      rotationSnapshotCanvas = null;
      rotationSnapshotCtx = null;
      offscreen = null;
      offscreenCtx = null;
      void staticCtx;
    };
  });
</script>

<div class="map-shell" bind:this={wrapEl}>
  <canvas class="static-layer" bind:this={staticCanvasEl}></canvas>
  <canvas
    class="dynamic-layer"
    class:rotation-muted={rotationVisualActive}
    class:locked={inputLocked}
    class:tool-bulldozer={activeTool === 'bulldozer'}
    class:tool-zone={zoneTool !== null}
    class:tool-infrastructure={infrastructureTool !== null}
    class:tool-building={buildingTool !== null}
    bind:this={dynamicCanvasEl}
    on:mousedown={onPointerDown}
    on:mousemove={onPointerMove}
    on:mouseup={endStroke}
    on:mouseleave={onPointerLeave}
    on:wheel={onWheel}
    on:touchstart={onTouchStart}
    on:touchmove={onTouchMove}
    on:touchend={onTouchEnd}
    on:touchcancel={onTouchEnd}
    on:contextmenu={onContextMenu}
    on:click={onMapClick}
  ></canvas>
  <canvas class="rotation-layer" class:active={rotationVisualActive} bind:this={rotationCanvasEl}></canvas>
  <canvas class="stroke-layer" class:rotation-muted={rotationVisualActive} bind:this={strokeCanvasEl}></canvas>

  <div class="map-orientation-ui">
    <div class="rotation-presets" role="group" aria-label="Perspektiba azkarrak">
      <button
        type="button"
        class="preset"
        class:active={((rotationIndex % 4) + 4) % 4 === 0}
        on:click={(event) => onRotatePresetClick(event, 0)}
        disabled={inputLocked || rotationVisualActive}
      >N</button>
      <button
        type="button"
        class="preset"
        class:active={((rotationIndex % 4) + 4) % 4 === 1}
        on:click={(event) => onRotatePresetClick(event, 1)}
        disabled={inputLocked || rotationVisualActive}
      >E</button>
      <button
        type="button"
        class="preset"
        class:active={((rotationIndex % 4) + 4) % 4 === 2}
        on:click={(event) => onRotatePresetClick(event, 2)}
        disabled={inputLocked || rotationVisualActive}
      >S</button>
      <button
        type="button"
        class="preset"
        class:active={((rotationIndex % 4) + 4) % 4 === 3}
        on:click={(event) => onRotatePresetClick(event, 3)}
        disabled={inputLocked || rotationVisualActive}
      >W</button>
    </div>
    <button
      type="button"
      class="rotate-control"
      aria-label="Mapa 90 gradu biratu"
      title="Mapa biratu (R)"
      on:click={onRotateControlClick}
      disabled={inputLocked || rotationVisualActive}
    >
      Biratu
    </button>
    <div class="compass" aria-label="Maparen iparrorratza">
      <div class="compass-ring"></div>
      <div class="compass-needle" style={`transform: translate(-50%, -100%) rotate(${compassDegrees}deg);`}>
        <span>N</span>
      </div>
    </div>
  </div>

  {#if hoverTile}
    <div class="tooltip">
      <div><strong>Laukia:</strong> {hoverTile.x}, {hoverTile.y}</div>
      <div><strong>Lur mota:</strong> {hoverTile.tile.terrain_type}</div>
      <div><strong>Zona:</strong> {hoverTile.tile.zone ? hoverTile.tile.zone.type : 'ez'}</div>
      <div><strong>Energia:</strong> {hoverTile.tile.powered ? 'bai' : 'ez'}</div>
      <div><strong>Ura:</strong> {hoverTile.tile.watered ? 'bai' : 'ez'}</div>
    </div>
  {/if}
</div>

<style>
  .map-shell {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background:
      radial-gradient(circle at 22% 18%, rgba(57, 81, 99, 0.45), rgba(57, 81, 99, 0) 40%),
      radial-gradient(circle at 84% 72%, rgba(23, 36, 46, 0.5), rgba(23, 36, 46, 0) 36%),
      linear-gradient(180deg, #0c1118 0%, #090d13 100%);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .static-layer {
    pointer-events: none;
    opacity: 0;
  }

  .dynamic-layer {
    cursor: grab;
    pointer-events: auto;
    transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .dynamic-layer.tool-bulldozer {
    cursor: crosshair;
  }

  .dynamic-layer.tool-zone {
    cursor: crosshair;
  }

  .dynamic-layer.tool-infrastructure {
    cursor: crosshair;
  }

  .dynamic-layer.tool-building {
    cursor: crosshair;
  }

  .dynamic-layer.locked {
    pointer-events: none;
  }

  .dynamic-layer.rotation-muted {
    opacity: 0;
  }

  .dynamic-layer:active {
    cursor: grabbing;
  }

  .stroke-layer {
    pointer-events: none;
    transition: opacity 140ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .stroke-layer.rotation-muted {
    opacity: 0;
  }

  .rotation-layer {
    pointer-events: none;
    opacity: 0;
    transition: opacity 140ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .rotation-layer.active {
    opacity: 1;
  }

  .tooltip {
    position: absolute;
    top: 84px;
    left: 16px;
    min-width: 220px;
    padding: 12px;
    border-radius: 14px;
    background: rgba(16, 22, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: rgba(241, 247, 255, 0.95);
    font-size: 0.78rem;
    line-height: 1.45;
    letter-spacing: 0.015em;
    backdrop-filter: blur(18px);
    pointer-events: none;
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.28);
  }

  .map-orientation-ui {
    position: absolute;
    right: 16px;
    bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 4;
    pointer-events: auto;
  }

  .rotation-presets {
    display: inline-flex;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    overflow: hidden;
    background: rgba(12, 17, 24, 0.68);
    backdrop-filter: blur(14px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.32);
  }

  .preset {
    border: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.14);
    min-width: 30px;
    height: 32px;
    padding: 0 9px;
    background: transparent;
    color: rgba(239, 248, 255, 0.92);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    cursor: pointer;
  }

  .preset:last-child {
    border-right: 0;
  }

  .preset.active {
    background: rgba(160, 216, 255, 0.22);
    color: rgba(255, 255, 255, 0.98);
  }

  .preset:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .rotate-control {
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 999px;
    padding: 8px 14px;
    background: rgba(12, 17, 24, 0.72);
    color: rgba(239, 248, 255, 0.95);
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    backdrop-filter: blur(14px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.32);
    cursor: pointer;
    transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
  }

  .rotate-control:hover:not(:disabled) {
    background: rgba(25, 38, 52, 0.8);
    border-color: rgba(160, 216, 255, 0.62);
    transform: translateY(-1px);
  }

  .rotate-control:active:not(:disabled) {
    transform: translateY(0);
  }

  .rotate-control:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .compass {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: rgba(12, 17, 24, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.26);
    backdrop-filter: blur(14px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.32);
    pointer-events: none;
  }

  .compass-ring {
    position: absolute;
    inset: 5px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.34);
  }

  .compass-needle {
    position: absolute;
    left: 50%;
    top: 50%;
    transform-origin: 50% 100%;
    width: 2px;
    height: 14px;
    background: linear-gradient(180deg, rgba(255, 120, 120, 0.96), rgba(255, 220, 220, 0.6));
  }

  .compass-needle span {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.48rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(255, 240, 240, 0.95);
  }
</style>
