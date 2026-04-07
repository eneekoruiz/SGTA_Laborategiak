<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { BuildingType, InfrastructureType, Tile, ZoneType } from '../types/game';
  import { performanceMetrics } from '../services/performanceMetrics';

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

  type Point = { x: number; y: number };
  type GridPoint = { x: number; y: number };
  type StrokeEvent = { updatedTiles: GridPoint[]; tilesSnapshot: Tile[][] };
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
    | 'commercial_tower'
    | 'industrial_factory'
    | 'power_plant'
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

  const dispatch = createEventDispatcher<{
    zonePainted: StrokeEvent;
    infrastructureDrawn: StrokeEvent;
    zoneBuffered: StrokeEvent;
    infrastructureBuffered: StrokeEvent;
    bulldozerCleared: BulldozeEvent;
    tileClicked: GridPoint;
    occupiedAttempt: { x: number; y: number; message: string };
    mapClicked: GridPoint | null;
  }>();

  const MIN_ZOOM = 0.45;
  const MAX_ZOOM = 2.6;
  const ZOOM_LINEAR_SENSITIVITY = 0.0012;
  const PINCH_LINEAR_SENSITIVITY = 0.0032;
  const CAMERA_LERP = 0.22;
  const PAN_INERTIA_FRICTION = 0.88;
  const PAN_INERTIA_EPSILON = 0.03;
  const CAMERA_MARGIN = 120;
  const ROTATION_DURATION_MS = 280;
  const ROTATION_OVERSCAN_PAD_PX = 8;
  const ROTATION_SCALE_START = 1.05;
  const ROTATION_SCALE_END = 1;
  const ROTATION_SNAPSHOT_ALPHA_MIN = 0.9;
  const SPATIAL_CELL = 8;
  const TARGET_FRAME_MS = 16.67;
  const MIN_PROCESS_BUDGET_MS = 2;
  const MAX_PROCESS_BUDGET_MS = 8;
  const IMMEDIATE_STROKE_BUDGET_MS = 1.4;
  const IMMEDIATE_STROKE_MAX_TILES = 32;
  const BUILDING_CACHE_DPR = 3;
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
    return tile.infrastructure.find((infra) => isSurfaceInfrastructure(infra)) ?? null;
  }

  function getUndergroundInfrastructure(tile: Tile): InfrastructureType | null {
    return tile.infrastructure.find((infra) => isUndergroundInfrastructure(infra)) ?? null;
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

  function rotationProgress(now = performance.now()): number {
    if (rotationFromIndex === rotationToIndex) return 1;
    const raw = Math.max(0, Math.min(1, (now - rotationStartedAt) / ROTATION_DURATION_MS));
    return 1 - Math.pow(1 - raw, 3);
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
    rotationSnapshotCtx.drawImage(dynamicCanvasEl, rotationSnapshotOffsetX, rotationSnapshotOffsetY, width, height);
    rotationSnapshotCtx.drawImage(strokeCanvasEl, rotationSnapshotOffsetX, rotationSnapshotOffsetY, width, height);
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
    // During the 280ms tween, only this pre-rendered snapshot is displayed, rotated
    // around the canvas center with Apple-style easing and a subtle zoom pulse.
    // After the tween completes, the snapshot is discarded and the grid resumes
    // rendering at the new, perfectly-calculated orthogonal rotation angle.
    // This ensures zero visual distortion, preserving the 2:1 rhombus ratio.
    if (!rotationCtx || !rotationCanvasEl || !rotationSnapshotCanvas) return;

    const width = rotationCanvasEl.width;
    const height = rotationCanvasEl.height;
    const t = rotationProgress(now);
    let quarterTurns = (rotationToIndex - rotationFromIndex + 4) % 4;
    if (quarterTurns === 3) quarterTurns = -1;

    const angle = (quarterTurns * Math.PI * 0.5) * t;
    const easeInOut = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const fadePulse = Math.sin(Math.PI * t);
    const fade = ROTATION_SNAPSHOT_ALPHA_MIN + (1 - ROTATION_SNAPSHOT_ALPHA_MIN) * fadePulse;
    const scale = ROTATION_SCALE_START + (ROTATION_SCALE_END - ROTATION_SCALE_START) * easeInOut;

    rotationCtx.setTransform(1, 0, 0, 1, 0, 0);
    rotationCtx.imageSmoothingEnabled = false;
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
    if (isRotationAnimating(now)) {
      rotationIndex = rotationToIndex;
    }

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
    ctx.fillStyle = 'rgba(149,152,161,0.75)';
    ctx.fill();

    const bevelGrad = ctx.createLinearGradient(cx - hw, cy, cx + hw, cy);
    bevelGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
    bevelGrad.addColorStop(0.5, 'rgba(0,0,0,0.08)');
    bevelGrad.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = bevelGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
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
    ctx.fillStyle = 'rgba(120,120,120,0.85)';
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
    ctx.strokeStyle = 'rgba(255,255,200,0.35)';
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
    ctx.fillStyle = 'rgba(100,80,60,0.8)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(200,200,200,0.6)';
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

    ctx.strokeStyle = 'rgba(220,180,100,0.9)';
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
    ctx.fillStyle = 'rgba(140,100,50,0.7)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.shadowColor = 'rgba(255,230,110,0.4)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(255,230,110,0.8)';
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

    ctx.fillStyle = 'rgba(200,150,80,0.9)';
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
    ctx.fillStyle = 'rgba(80,100,120,0.75)';
    ctx.fill();

    ctx.shadowColor = 'rgba(106,223,255,0.6)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(106,223,255,0.9)';
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
    grad.addColorStop(0, 'rgba(100, 200, 255, 0.7)');
    grad.addColorStop(0.5, 'rgba(80, 160, 255, 0.5)');
    grad.addColorStop(1, 'rgba(60, 140, 255, 0.7)');
    ctx.fillStyle = grad;
    drawDiamond(ctx, cx, cy, w, h);
    ctx.fill();

    ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(150, 220, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;

    ctx.restore();
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
    if (type === 'ruin') return 'ruin';
    if (type === 'police_station') return 'service_police';
    if (type === 'hospital') return 'service_hospital';
    if (type === 'fire_station') return 'service_fire';
    if (type === 'prison') return 'service_prison';
    if (type === 'school' || type === 'college' || type === 'library' || type === 'museum' || type === 'university') return 'service_education';
    if (type === 'water_pump' || type === 'water_treatment') return 'utility_water';
    if (type === 'bus_depot' || type === 'rail_station' || type === 'subway_station' || type === 'airport' || type === 'seaport') return 'utility_transport';
    if (type.includes('power')) return 'power_plant';
    if (tile.zone?.type.startsWith('residential_dense')) return 'residential_apartment';
    if (tile.zone?.type.startsWith('residential')) return 'residential_house';
    if (tile.zone?.type.startsWith('commercial')) return 'commercial_tower';
    if (tile.zone?.type.startsWith('industrial')) return 'industrial_factory';
    return 'generic';
  }

  function buildingBaseColor(tile: Tile): string {
    const type = String(tile.building?.type ?? '');
    if (tile.zone?.type.startsWith('residential')) return '#4caf50';
    if (tile.zone?.type.startsWith('commercial')) return '#2196f3';
    if (tile.zone?.type.startsWith('industrial')) return '#ffeb3b';
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
  }

  function drawResidentialHouse(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    drawIsoPrism(ctx, cx, cy, 38 * scale, 22 * scale, 13 * scale, shadeHex(base, 16), shadeHex(base, -18), shadeHex(base, -30));

    ctx.beginPath();
    ctx.moveTo(cx, cy - 22 * scale);
    ctx.lineTo(cx + 21 * scale, cy - 7 * scale);
    ctx.lineTo(cx, cy + 4 * scale);
    ctx.lineTo(cx - 21 * scale, cy - 7 * scale);
    ctx.closePath();
    ctx.fillStyle = shadeHex(base, 34);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy - 22 * scale);
    ctx.lineTo(cx + 21 * scale, cy - 7 * scale);
    ctx.lineTo(cx + 21 * scale, cy - 2 * scale);
    ctx.lineTo(cx, cy - 16 * scale);
    ctx.lineTo(cx - 21 * scale, cy - 2 * scale);
    ctx.lineTo(cx - 21 * scale, cy - 7 * scale);
    ctx.closePath();
    ctx.fillStyle = shadeHex(base, 48);
    ctx.fill();

    ctx.fillStyle = 'rgba(245, 239, 227, 0.92)';
    ctx.fillRect(cx - 10 * scale, cy - 1 * scale, 6 * scale, 7 * scale);
    ctx.fillRect(cx + 3 * scale, cy - 4 * scale, 7 * scale, 4 * scale);
    ctx.fillStyle = 'rgba(40, 52, 64, 0.55)';
    ctx.fillRect(cx - 7 * scale, cy + 1 * scale, 2.2 * scale, 2.2 * scale);
    ctx.fillRect(cx + 5 * scale, cy - 1 * scale, 2.4 * scale, 2.4 * scale);
  }

  function drawResidentialApartment(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    drawIsoPrism(ctx, cx, cy, 42 * scale, 22 * scale, 24 * scale, shadeHex(base, 18), shadeHex(base, -18), shadeHex(base, -32));
    drawIsoPrism(ctx, cx - 1 * scale, cy - 6 * scale, 34 * scale, 18 * scale, 14 * scale, shadeHex(base, 30), shadeHex(base, -8), shadeHex(base, -22));
    drawIsoPrism(ctx, cx + 3 * scale, cy - 12 * scale, 24 * scale, 14 * scale, 10 * scale, shadeHex(base, 38), shadeHex(base, 2), shadeHex(base, -12));

    ctx.fillStyle = 'rgba(249, 251, 255, 0.62)';
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        ctx.fillRect(cx - 15 * scale + col * 8 * scale, cy - 14 * scale + row * 8 * scale, 3 * scale, 4 * scale);
      }
    }
  }

  function drawCommercialTower(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    const top = '#c4f1ff';
    const left = '#8cccf2';
    const right = '#5c8dc2';
    drawIsoPrism(ctx, cx, cy, 34 * scale, 18 * scale, 36 * scale, top, left, right);

    const facade = ctx.createLinearGradient(cx - 18 * scale, cy - 34 * scale, cx + 18 * scale, cy + 14 * scale);
    facade.addColorStop(0, 'rgba(255,255,255,0.30)');
    facade.addColorStop(0.4, 'rgba(106, 195, 248, 0.14)');
    facade.addColorStop(1, 'rgba(15, 45, 74, 0.22)');
    ctx.fillStyle = facade;
    ctx.fillRect(cx - 16 * scale, cy - 33 * scale, 32 * scale, 42 * scale);

    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        ctx.fillRect(cx - 11 * scale + col * 8 * scale, cy - 25 * scale + row * 7 * scale, 3.2 * scale, 3.8 * scale);
      }
    }

    ctx.fillStyle = 'rgba(73, 85, 97, 0.95)';
    ctx.fillRect(cx + 9 * scale, cy - 39 * scale, 2.2 * scale, 9 * scale);
    ctx.fillRect(cx + 12 * scale, cy - 35 * scale, 6 * scale, 2.2 * scale);
    ctx.fillStyle = 'rgba(220, 229, 236, 0.86)';
    ctx.fillRect(cx + 6 * scale, cy - 3 * scale, 10 * scale, 2.2 * scale);
  }

  function drawIndustrialFactory(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: string,
    scale: number
  ): void {
    drawIsoPrism(ctx, cx, cy, 48 * scale, 24 * scale, 16 * scale, shadeHex(base, 10), shadeHex(base, -24), shadeHex(base, -34));

    ctx.beginPath();
    ctx.moveTo(cx - 24 * scale, cy - 24 * scale);
    for (let i = 0; i < 6; i += 1) {
      const px = cx - 24 * scale + i * 8 * scale;
      ctx.lineTo(px + 4 * scale, cy - 18 * scale);
      ctx.lineTo(px + 8 * scale, cy - 24 * scale);
    }
    ctx.lineTo(cx + 24 * scale, cy - 24 * scale);
    ctx.lineTo(cx + 24 * scale, cy - 18 * scale);
    ctx.lineTo(cx - 24 * scale, cy - 18 * scale);
    ctx.closePath();
    ctx.fillStyle = shadeHex(base, 28);
    ctx.fill();

    for (let i = 0; i < 3; i += 1) {
      const chimneyX = cx - 14 * scale + i * 12 * scale;
      drawIsoPrism(ctx, chimneyX, cy - 7 * scale, 7 * scale, 5 * scale, 18 * scale + i * 2 * scale, '#767c86', '#5d636d', '#4c535d');
    }

    ctx.fillStyle = 'rgba(255,255,255,0.17)';
    ctx.fillRect(cx - 18 * scale, cy - 6 * scale, 36 * scale, 4 * scale);
  }

  function drawServiceIcon(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    archetype: BuildingArchetype,
    cx: number,
    cy: number,
    scale: number
  ): void {
    ctx.save();
    ctx.translate(cx, cy - 24 * scale);
    if (archetype === 'service_hospital') {
      ctx.beginPath();
      ctx.rect(-3 * scale, -10 * scale, 6 * scale, 20 * scale);
      ctx.rect(-10 * scale, -3 * scale, 20 * scale, 6 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 44, 44, 0.94)';
      ctx.fillRect(-1.2 * scale, -7 * scale, 2.4 * scale, 14 * scale);
      ctx.fillRect(-7 * scale, -1.2 * scale, 14 * scale, 2.4 * scale);
    } else if (archetype === 'service_police') {
      ctx.beginPath();
      ctx.moveTo(0, -9 * scale);
      ctx.lineTo(10 * scale, -1 * scale);
      ctx.lineTo(7 * scale, 9 * scale);
      ctx.lineTo(-7 * scale, 9 * scale);
      ctx.lineTo(-10 * scale, -1 * scale);
      ctx.closePath();
      ctx.fillStyle = '#f4f8ff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -2 * scale, 6 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(50, 90, 160, 0.30)';
      ctx.fill();
      ctx.fillStyle = '#e6f0ff';
      ctx.fillRect(-1 * scale, -16 * scale, 2 * scale, 6 * scale);
    } else if (archetype === 'service_fire') {
      ctx.fillStyle = '#ffe9d2';
      ctx.fillRect(-10 * scale, -7 * scale, 20 * scale, 14 * scale);
      ctx.fillRect(-4 * scale, -12 * scale, 8 * scale, 5 * scale);
      ctx.fillStyle = '#ff8a3d';
      ctx.fillRect(-9 * scale, -2 * scale, 7 * scale, 2.4 * scale);
      ctx.fillRect(2 * scale, -2 * scale, 7 * scale, 2.4 * scale);
    } else if (archetype === 'service_prison') {
      ctx.fillStyle = '#c0c8d2';
      ctx.fillRect(-11 * scale, -8 * scale, 22 * scale, 16 * scale);
      ctx.fillStyle = 'rgba(67, 79, 92, 0.85)';
      for (let i = -1; i <= 1; i += 1) ctx.fillRect(i * 5 * scale - 0.8 * scale, -9 * scale, 1.6 * scale, 18 * scale);
      ctx.fillRect(-11 * scale, -1.2 * scale, 22 * scale, 2.4 * scale);
    } else if (archetype === 'service_education') {
      ctx.fillStyle = '#f1ebff';
      ctx.fillRect(-12 * scale, -8 * scale, 24 * scale, 16 * scale);
      ctx.beginPath();
      ctx.moveTo(-14 * scale, -8 * scale);
      ctx.lineTo(0, -17 * scale);
      ctx.lineTo(14 * scale, -8 * scale);
      ctx.closePath();
      ctx.fillStyle = '#9a87d2';
      ctx.fill();
      ctx.fillStyle = 'rgba(48, 54, 68, 0.84)';
      ctx.fillRect(-3.2 * scale, -5.5 * scale, 6.4 * scale, 11 * scale);
    }
    ctx.restore();
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

    if (archetype === 'power_plant') {
      drawPowerPlant(ctx, cx, cy, baseColor, scale);
      return;
    }

    if (archetype === 'service_prison' || archetype === 'service_education') {
      drawIsoPrism(ctx, cx, cy, 42 * scale, 22 * scale, 20 * scale, shadeHex(baseColor, 20), shadeHex(baseColor, -18), shadeHex(baseColor, -33));
      if (archetype.startsWith('service_')) {
        drawServiceIcon(ctx, archetype, cx, cy, scale);
      }
      return;
    }

    drawIsoPrism(ctx, cx, cy, 42 * scale, 22 * scale, 20 * scale, shadeHex(baseColor, 20), shadeHex(baseColor, -18), shadeHex(baseColor, -33));
    if (archetype.startsWith('service_')) {
      drawServiceIcon(ctx, archetype, cx, cy, scale);
    }
  }

  function getBuildingCacheEntry(tile: Tile): BuildingCacheEntry {
    const archetype = buildingArchetypeFor(tile);
    const baseColor = buildingBaseColor(tile);
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

  function drawCachedBuilding(ctx: CanvasRenderingContext2D, tile: Tile, cx: number, cy: number): void {
    const entry = getBuildingCacheEntry(tile);
    const scale = 1 / BUILDING_CACHE_DPR;
    const drawX = cx - entry.anchorX * scale;
    const drawY = cy - entry.anchorY * scale;
    const drawW = entry.width * scale;
    const drawH = entry.height * scale;
    ctx.drawImage(entry.canvas as CanvasImageSource, drawX, drawY, drawW, drawH);

    if (entry.archetype === 'industrial_factory') {
      const phase = performance.now() * 0.002 + (tile.x + tile.y) * 0.15;
      ctx.fillStyle = 'rgba(189, 194, 200, 0.42)';
      for (let i = 0; i < 2; i += 1) {
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
    grd.addColorStop(0, '#0e151b');
    grd.addColorStop(1, '#0b1016');
    offscreenCtx.fillStyle = grd;
    offscreenCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const tile = worldTiles[y]?.[x];
        if (!tile) continue;
        const c = worldCenter(x, y);

        drawDiamond(offscreenCtx, c.x, c.y);
        offscreenCtx.fillStyle = terrainColor(tile);
        offscreenCtx.fill();

        const gloss = offscreenCtx.createLinearGradient(c.x, c.y - tileHeight / 2, c.x, c.y + tileHeight / 2);
        gloss.addColorStop(0, 'rgba(255,255,255,0.08)');
        gloss.addColorStop(1, 'rgba(0,0,0,0.18)');
        offscreenCtx.fillStyle = gloss;
        offscreenCtx.fill();

        offscreenCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        offscreenCtx.lineWidth = 0.9;
        offscreenCtx.lineCap = 'round';
        offscreenCtx.lineJoin = 'round';
        offscreenCtx.stroke();
      }
    }

    staticDirty = false;
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

    dynamicCtx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, dpr * camera.x, dpr * camera.y);

    if (undergroundMode) {
      const darkOverlay = dynamicCtx.createLinearGradient(0, 0, worldWidth, worldHeight);
      darkOverlay.addColorStop(0, 'rgba(10, 11, 14, 0.85)');
      darkOverlay.addColorStop(1, 'rgba(8, 8, 12, 0.92)');
      dynamicCtx.fillStyle = darkOverlay;
      dynamicCtx.fillRect(-worldWidth, -worldHeight, worldWidth * 3, worldHeight * 3);
    }

    dynamicCtx.drawImage(offscreen as CanvasImageSource, 0, 0);

    const range = visibleRange();

    for (let y = range.minY; y <= range.maxY; y += 1) {
      for (let x = range.minX; x <= range.maxX; x += 1) {
        const tile = worldTiles[y]?.[x];
        if (!tile) continue;
        const c = worldCenter(x, y);

        if (showZones && tile.zone && !undergroundMode) {
          drawDiamond(dynamicCtx, c.x, c.y, tileWidth * 0.9, tileHeight * 0.9);
          const zoneColor = tile.zone.abandoned ? '#8f949d' : zoneTint[tile.zone.type] ?? '#7b8ea8';
          dynamicCtx.fillStyle = zoneColor;
          dynamicCtx.globalAlpha = tile.zone.abandoned
            ? 0.46
            : 0.26 + tile.zone.development_level * 0.08;
          dynamicCtx.fill();

          drawBlueprintHatch(
            dynamicCtx,
            c.x,
            c.y,
            tileWidth * 0.85,
            tileHeight * 0.85,
            zoneColor
          );

          dynamicCtx.globalAlpha = 1;
        }

        if (showInfrastructure && tile.infrastructure.length > 0) {
          if (!undergroundMode && tile.infrastructure.includes('road')) {
            drawRoadWithRealismEffects(dynamicCtx, c.x, c.y, tileWidth * 0.88, tileHeight * 0.84);
          }

          if (tile.infrastructure.includes('power_line')) {
            dynamicCtx.strokeStyle = undergroundMode ? 'rgba(255,230,110,0.95)' : 'rgba(255,230,110,0.7)';
            dynamicCtx.lineWidth = undergroundMode ? 2.2 : 1.2;
            if (undergroundMode) {
              dynamicCtx.shadowColor = 'rgba(255,230,110,0.8)';
              dynamicCtx.shadowBlur = 12;
            }
            dynamicCtx.beginPath();
            dynamicCtx.moveTo(c.x - tileWidth * 0.2, c.y);
            dynamicCtx.lineTo(c.x + tileWidth * 0.2, c.y);
            dynamicCtx.stroke();
            dynamicCtx.shadowColor = 'rgba(0,0,0,0)';
            dynamicCtx.shadowBlur = 0;
          }

          if (tile.infrastructure.includes('water_pipe')) {
            dynamicCtx.strokeStyle = undergroundMode ? 'rgba(106,223,255,0.96)' : 'rgba(106,223,255,0.5)';
            dynamicCtx.lineWidth = undergroundMode ? 2.8 : 1.2;
            if (undergroundMode) {
              dynamicCtx.shadowColor = 'rgba(106,223,255,0.8)';
              dynamicCtx.shadowBlur = 16;
            }
            dynamicCtx.beginPath();
            dynamicCtx.moveTo(c.x, c.y - tileHeight * 0.2);
            dynamicCtx.lineTo(c.x, c.y + tileHeight * 0.2);
            dynamicCtx.stroke();
            dynamicCtx.shadowColor = 'rgba(0,0,0,0)';
            dynamicCtx.shadowBlur = 0;
          }

          if (undergroundMode && (tile.infrastructure.includes('subway') || tile.infrastructure.includes('subway_tunnel'))) {
            const grad = dynamicCtx.createLinearGradient(c.x - tileWidth * 0.3, c.y - tileHeight * 0.3, c.x + tileWidth * 0.3, c.y + tileHeight * 0.3);
            grad.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
            grad.addColorStop(0.5, 'rgba(80, 180, 255, 0.6)');
            grad.addColorStop(1, 'rgba(60, 160, 255, 0.8)');
            dynamicCtx.strokeStyle = grad;
            dynamicCtx.lineWidth = 2.4;
            dynamicCtx.shadowColor = 'rgba(100, 200, 255, 0.9)';
            dynamicCtx.shadowBlur = 20;
            drawDiamond(dynamicCtx, c.x, c.y, tileWidth * 0.7, tileHeight * 0.6);
            dynamicCtx.stroke();
            dynamicCtx.shadowColor = 'rgba(0,0,0,0)';
            dynamicCtx.shadowBlur = 0;
          }
        }

        if (!undergroundMode && tile.building) {
          drawCachedBuilding(dynamicCtx, tile, c.x, c.y - tileHeight * 0.02);
        }

        if (showStatusIcons && (tile.zone || tile.building) && (!tile.powered || !tile.watered)) {
          dynamicCtx.fillStyle = !tile.powered ? '#ffd36e' : '#70d6ff';
          dynamicCtx.beginPath();
          dynamicCtx.arc(c.x, c.y - tileHeight * 0.95, 6, 0, Math.PI * 2);
          dynamicCtx.fill();
        }
      }
    }

    drawSelectionAndHover();
    drawGhostPreview();
    drawDemolitionEffects(dynamicCtx);

    if (activeOverlay) {
      drawOverlayAtmosphere(dynamicCtx, activeOverlay);
    }

    drawEconomyParticles(dynamicCtx);
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

    strokeCtx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, dpr * camera.x, dpr * camera.y);
    strokeCtx.lineJoin = 'round';
    strokeCtx.lineCap = 'round';

    if (isZoneStroke) {
      strokeCtx.fillStyle = `${zoneTint[zoneTool ?? 'residential_light'] ?? '#8ea2bf'}77`;
      strokeCtx.strokeStyle = `${zoneTint[zoneTool ?? 'residential_light'] ?? '#8ea2bf'}ee`;
      strokeCtx.lineWidth = 1.8;
      for (const key of ghostZoneKeys) {
        const point = parseTileKey(key);
        const center = worldCenter(point.x, point.y);
        drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.95, tileHeight * 0.95);
        strokeCtx.fill();
        strokeCtx.stroke();
      }

      strokeCtx.fillStyle = 'rgba(255, 84, 84, 0.34)';
      strokeCtx.strokeStyle = 'rgba(255, 84, 84, 0.9)';
      strokeCtx.lineWidth = 1.8;
      for (const key of blockedGhostZoneKeys) {
        const point = parseTileKey(key);
        const center = worldCenter(point.x, point.y);
        drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.95, tileHeight * 0.95);
        strokeCtx.fill();
        strokeCtx.stroke();
      }
    }

    if (isInfraStroke) {
      for (const key of ghostInfraKeys) {
        const point = parseTileKey(key);
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
      for (const key of blockedGhostInfraKeys) {
        const point = parseTileKey(key);
        const center = worldCenter(point.x, point.y);
        drawDiamond(strokeCtx, center.x, center.y, tileWidth * 0.78, tileHeight * 0.72);
        strokeCtx.stroke();
      }
    }

    if (isBulldozeStroke) {
      strokeCtx.fillStyle = 'rgba(255, 149, 0, 0.26)';
      strokeCtx.strokeStyle = 'rgba(255, 149, 0, 0.96)';
      strokeCtx.lineWidth = 1.9;
      for (const key of ghostBulldozeKeys) {
        const point = parseTileKey(key);
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
      drawCachedBuilding(dynamicCtx, ghostTile, center.x, center.y - tileHeight * 0.02);

      if (buildAllowed) {
        dynamicCtx.globalAlpha = 0.5;
        dynamicCtx.fillStyle = 'rgba(183,209,240,0.35)';
        drawDiamond(dynamicCtx, center.x, center.y);
        dynamicCtx.fill();
      } else {
        dynamicCtx.globalCompositeOperation = 'source-atop';
        dynamicCtx.globalAlpha = 0.92;
        dynamicCtx.fillStyle = 'rgba(255, 59, 48, 0.88)';
        dynamicCtx.fillRect(center.x - tileWidth * 1.2, center.y - tileHeight * 2.0, tileWidth * 2.4, tileHeight * 3.4);
        dynamicCtx.globalCompositeOperation = 'source-over';
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
      dispatch('infrastructureBuffered', {
        updatedTiles: Array.from(bufferedInfraKeys).map(parseTileKey),
        tilesSnapshot: []
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
        dispatch('infrastructureDrawn', {
          updatedTiles,
          tilesSnapshot: cloneRowwiseSnapshot(worldTiles)
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
    strokeTileCount = 0;
    strokeFrameTicker = 0;
    strokeSpendTotal = 0;
    strokeRefundTotal = 0;
    strokeAnchor = null;
  }

  function onPointerDown(event: MouseEvent): void {
    if (inputLocked || isRotationAnimating()) return;
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
    smoothedFrameMs = smoothedFrameMs * 0.88 + frameDelta * 0.12;
    compassDegrees = activeRotationDegrees(now);

    if (isRotationAnimating(now)) {
      rotationVisualActive = true;
    } else if (rotationFromIndex !== rotationToIndex) {
      rotationIndex = rotationToIndex;
      rotationFromIndex = rotationToIndex;
      rotationVisualActive = false;
      clearRotationLayer();
      rebuildWorldGeometry();
      ensureOffscreen();
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
        triggerRotationStep(1);
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
    on:contextmenu|preventDefault
    on:click={onMapClick}
  ></canvas>
  <canvas class="rotation-layer" class:active={rotationVisualActive} bind:this={rotationCanvasEl}></canvas>
  <canvas class="stroke-layer" class:rotation-muted={rotationVisualActive} bind:this={strokeCanvasEl}></canvas>

  <div class="map-orientation-ui">
    <button
      type="button"
      class="rotate-control"
      aria-label="Mapa 90 gradu biratu"
      title="Mapa biratu (R)"
      on:click={onRotateControlClick}
      disabled={inputLocked}
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
    transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
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
