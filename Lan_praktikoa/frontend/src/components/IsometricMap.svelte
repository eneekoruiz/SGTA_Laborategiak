<script lang="ts">
  import { spring } from 'svelte/motion';
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { updateAutoTiling, getRoadVariant, computeRoadConnections } from '../services/autoTiling';
  import * as apiService from '../services/apiService';
  import type { InfrastructureType, Tile, Zone, ZoneType } from '../types/game';

  export let tiles: Tile[][] = [];
  export let mapWidth = 64;
  export let mapHeight = 64;
  export let tileWidth = 64;
  export let tileHeight = 32;
  export let month = new Date().getMonth() + 1;
  export let selectedTile: { x: number; y: number } | null = null;
  export let zoneTool: ZoneType | null = null;
  export let infrastructureTool: InfrastructureType | null = null;
  export let undergroundMode = false;
  export let showInfrastructure = true;
  export let showZones = true;
  export let showStatusIcons = false;
  export let gameId = 'game-001';

  type Point = { x: number; y: number };
  type TileRef = { x: number; y: number; tile: Tile };
  type VisibleEntry = { x: number; y: number; tile: Tile; depth: number };
  type CameraState = { x: number; y: number; zoom: number };
  type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number };
  type FloatingCost = { x: number; y: number; value: number; life: number; maxLife: number };
  type GridPoint = { x: number; y: number };

  const dispatch = createEventDispatcher<{
    zonePainted: { updatedTiles: GridPoint[] };
    infrastructureDrawn: { updatedTiles: GridPoint[] };
  }>();

  let canvas: HTMLCanvasElement;
  let wrap: HTMLDivElement;
  let hover: TileRef | null = null;
  let localSelected: TileRef | null = null;
  let pointerScreen: Point | null = null;
  let dpr = 1;
  let grainPattern: CanvasPattern | null = null;
  let pendingOperations = new Set<string>(); // Track x:y positions with pending API calls

  const textureKeys = [
    'grass',
    'water',
    'forest',
    'rock',
    'sand',
    'residential_lvl1',
    'residential_dense_lvl1',
    'commercial_lvl1',
    'commercial_dense_lvl1',
    'industrial_lvl1',
    'industrial_dense_lvl1',
    'building_generic',
    'tile_shadow'
  ] as const;

  const emojiFont =
    '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif';

  type TextureKey = (typeof textureKeys)[number];
  const textures: Partial<Record<TextureKey, HTMLImageElement>> = {};
  const atlasFrames: Partial<Record<TextureKey, { x: number; y: number; w: number; h: number }>> = {
    grass: { x: 0, y: 0, w: 64, h: 32 },
    water: { x: 64, y: 0, w: 64, h: 32 },
    forest: { x: 128, y: 0, w: 64, h: 32 },
    rock: { x: 192, y: 0, w: 64, h: 32 },
    sand: { x: 256, y: 0, w: 64, h: 32 },
    residential_lvl1: { x: 0, y: 32, w: 64, h: 64 },
    residential_dense_lvl1: { x: 64, y: 32, w: 64, h: 64 },
    commercial_lvl1: { x: 128, y: 32, w: 64, h: 64 },
    commercial_dense_lvl1: { x: 192, y: 32, w: 64, h: 64 },
    industrial_lvl1: { x: 256, y: 32, w: 64, h: 64 },
    industrial_dense_lvl1: { x: 320, y: 32, w: 64, h: 64 },
    building_generic: { x: 384, y: 32, w: 64, h: 64 },
    tile_shadow: { x: 448, y: 0, w: 64, h: 32 }
  };
  let atlasImage: HTMLImageElement | null = null;

  const camera: CameraState = { x: 0, y: 0, zoom: 1 };
  const springX = spring(0, { stiffness: 0.11, damping: 0.74, precision: 0.05 });
  const springY = spring(0, { stiffness: 0.11, damping: 0.74, precision: 0.05 });
  const springZoom = spring(1, { stiffness: 0.13, damping: 0.78, precision: 0.001 });

  springX.subscribe((v) => (camera.x = v));
  springY.subscribe((v) => (camera.y = v));
  springZoom.subscribe((v) => (camera.zoom = v));

  let targetX = 0;
  let targetY = 0;
  let targetZoom = 1;
  let velocityX = 0;
  let velocityY = 0;

  const minZoom = 0.45;
  const maxZoom = 2.4;
  const zoomStep = 0.12;
  const friction = 0.91;
  const velocityMin = 0.02;

  let rafId = 0;
  let isDragging = false;
  let isInfraDrawing = false;
  let isZonePainting = false;
  let lastPointer: Point | null = null;
  let lastInfraTile: GridPoint | null = null;
  let lastZoneTile: GridPoint | null = null;
  let drawnThisStroke = new Set<string>();
  let zonedThisStroke = new Set<string>();
  let lastFrameTs = 0;
  let dragVelocity: Point = { x: 0, y: 0 };
  let particles: Particle[] = [];
  let floatingCosts: FloatingCost[] = [];
  let shake = 0;
  let monthDrift = 0;

  function activeSelected(): { x: number; y: number } | null {
    if (selectedTile) return selectedTile;
    return localSelected ? { x: localSelected.x, y: localSelected.y } : null;
  }

  function origin(): Point {
    return { x: (mapHeight * tileWidth) / 2, y: tileHeight };
  }

  function toIso(x: number, y: number): Point {
    return {
      x: Math.round((x - y) * (tileWidth / 2)),
      y: Math.round((x + y) * (tileHeight / 2))
    };
  }

  function tileCenter(x: number, y: number): Point {
    const o = origin();
    const iso = toIso(x, y);
    return { x: Math.round(o.x + iso.x), y: Math.round(o.y + iso.y) };
  }

  function worldToScreen(p: Point): Point {
    return {
      x: Math.round(p.x * camera.zoom + camera.x),
      y: Math.round(p.y * camera.zoom + camera.y)
    };
  }

  function screenToWorld(p: Point): Point {
    return {
      x: (p.x - camera.x) / camera.zoom,
      y: (p.y - camera.y) / camera.zoom
    };
  }

  function worldToGrid(world: Point): Point {
    const o = origin();
    const dx = world.x - o.x;
    const dy = world.y - o.y;
    return {
      x: (dy / (tileHeight / 2) + dx / (tileWidth / 2)) / 2,
      y: (dy / (tileHeight / 2) - dx / (tileWidth / 2)) / 2
    };
  }

  function pickTile(screen: Point): Point | null {
    const world = screenToWorld(screen);
    const grid = worldToGrid(world);
    const baseX = Math.floor(grid.x);
    const baseY = Math.floor(grid.y);

    const candidates: Point[] = [
      { x: baseX, y: baseY },
      { x: baseX + 1, y: baseY },
      { x: baseX, y: baseY + 1 },
      { x: baseX - 1, y: baseY },
      { x: baseX, y: baseY - 1 }
    ];

    for (const candidate of candidates) {
      if (candidate.x < 0 || candidate.y < 0 || candidate.x >= mapWidth || candidate.y >= mapHeight) continue;
      const center = tileCenter(candidate.x, candidate.y);
      const dx = Math.abs(world.x - center.x) / (tileWidth / 2);
      const dy = Math.abs(world.y - center.y) / (tileHeight / 2);
      if (dx + dy <= 1) return candidate;
    }

    return null;
  }

  function getVisibleTileRange(): { minX: number; maxX: number; minY: number; maxY: number } {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const corners: Point[] = [
      screenToWorld({ x: 0, y: 0 }),
      screenToWorld({ x: w, y: 0 }),
      screenToWorld({ x: 0, y: h }),
      screenToWorld({ x: w, y: h })
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

    const margin = 5;
    return {
      minX: Math.max(0, Math.floor(minGX) - margin),
      maxX: Math.min(mapWidth - 1, Math.ceil(maxGX) + margin),
      minY: Math.max(0, Math.floor(minGY) - margin),
      maxY: Math.min(mapHeight - 1, Math.ceil(maxGY) + margin)
    };
  }

  function drawDiamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, scaleW?: number, scaleH?: number): void {
    const hw = (scaleW ?? tileWidth) / 2;
    const hh = (scaleH ?? tileHeight) / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  }

  function tileHash(x: number, y: number, salt = 0): number {
    const h = (x * 73856093) ^ (y * 19349663) ^ salt;
    return (h >>> 0) % 2147483647;
  }

  function pickVariant<T>(variants: T[], x: number, y: number, salt = 0): T {
    return variants[tileHash(x, y, salt) % variants.length];
  }

  function zoneFamily(type: Zone['type'] | undefined): 'residential' | 'commercial' | 'industrial' | null {
    if (!type) return null;
    if (type.startsWith('residential')) return 'residential';
    if (type.startsWith('commercial')) return 'commercial';
    if (type.startsWith('industrial')) return 'industrial';
    return null;
  }

  function normalizeLevel(level: number | undefined): 1 | 2 | 3 {
    if (!level || level <= 1) return 1;
    if (level >= 3) return 3;
    return 2;
  }

  function resolveBuildingEmoji(tile: Tile): string | null {
    if (tile.building?.type === 'hospital') return '🏥';
    if (tile.building?.type === 'school') return '🏫';
    if (tile.building?.type === 'university') return '🎓';

    const family = zoneFamily(tile.zone?.type);
    if (!family) return null;
    const level = normalizeLevel(tile.zone?.development_level);

    if (family === 'residential') return level === 1 ? '🏡' : level === 2 ? '🏠' : '🏙️';
    if (family === 'commercial') return level === 1 ? '🛒' : level === 2 ? '🏢' : '🏬';
    return level === 1 ? '📦' : level === 2 ? '🏭' : '🏗️';
  }

  function textureKeyForTile(tile: Tile): TextureKey {
    if (tile.zone?.type === 'residential_light') return 'residential_lvl1';
    if (tile.zone?.type === 'residential_dense') return 'residential_dense_lvl1';
    if (tile.zone?.type === 'commercial_light') return 'commercial_lvl1';
    if (tile.zone?.type === 'commercial_dense') return 'commercial_dense_lvl1';
    if (tile.zone?.type === 'industrial_light') return 'industrial_lvl1';
    if (tile.zone?.type === 'industrial_dense') return 'industrial_dense_lvl1';
    if (tile.terrain_type === 'water') return 'water';
    if (tile.terrain_type === 'forest') return 'forest';
    if (tile.terrain_type === 'rock') return 'rock';
    if (tile.terrain_type === 'sand') return 'sand';
    return 'grass';
  }

  function hasBuilding(tile: Tile): boolean {
    return tile.building !== null || tile.zone !== null;
  }

  function drawTexturedTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, key: TextureKey): void {
    const image = textures[key] ?? textures.grass;
    const frame = atlasFrames[key];

    // Scale render dimensions by camera zoom, with integer precision
    const scaledW = Math.round(tileWidth * camera.zoom);
    const scaledH = Math.round(tileHeight * camera.zoom);
    const overlapW = Math.ceil(scaledW + 1);
    const overlapH = Math.ceil(scaledH + 1);

    if (!image && !(atlasImage && frame)) {
      drawDiamondPath(ctx, Math.round(cx), Math.round(cy), scaledW, scaledH);
      ctx.fillStyle = '#8ea88c';
      ctx.fill();
      return;
    }

    ctx.save();
    drawDiamondPath(ctx, Math.round(cx), Math.round(cy), scaledW, scaledH);
    ctx.clip();

    const tileX = Math.round(cx - scaledW / 2);
    const tileY = Math.round(cy - scaledH / 2);

    if (atlasImage && frame) {
      ctx.drawImage(
        atlasImage,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        tileX,
        tileY,
        overlapW,
        overlapH
      );
    } else if (image) {
      ctx.drawImage(image, tileX, tileY, overlapW, overlapH);
    }

    if (grainPattern) {
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = grainPattern;
      ctx.fillRect(tileX, tileY, overlapW, overlapH);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawInfrastructure(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: Tile): void {
    const infra = tile.infrastructure || [];
    if (!infra.length) return;

    // Scale infrastructure dimensions by zoom, integer precision
    const scaledW = Math.round(tileWidth * camera.zoom);
    const scaledH = Math.round(tileHeight * camera.zoom);

    // Fallback: draw solid gray slab for roads (full tile coverage for seamlessness)
    const drawRoadSlab = (directionMask: number) => {
      ctx.save();
      ctx.globalAlpha = undergroundMode ? 0.3 : 0.65;
      ctx.fillStyle = 'rgba(100, 105, 110, 1)';

      // Draw diamond-shaped slab centered on tile (full coverage = seamless)
      ctx.beginPath();
      ctx.moveTo(Math.round(cx), Math.round(cy - scaledH / 2));
      ctx.lineTo(Math.round(cx + scaledW / 2), Math.round(cy));
      ctx.lineTo(Math.round(cx), Math.round(cy + scaledH / 2));
      ctx.lineTo(Math.round(cx - scaledW / 2), Math.round(cy));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawStroke = (color: string, width: number, directionMask?: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();

      // If directionMask provided (for roads), only draw active connections
      if (directionMask !== undefined) {
        const hasNorth = directionMask & 1;
        const hasSouth = directionMask & 2;
        const hasEast = directionMask & 4;
        const hasWest = directionMask & 8;

        if (hasNorth || hasSouth) {
          ctx.moveTo(Math.round(cx), Math.round(cy - scaledH * 0.22));
          ctx.lineTo(Math.round(cx), Math.round(cy + scaledH * 0.22));
        }
        if (hasEast || hasWest) {
          ctx.moveTo(Math.round(cx - scaledW * 0.22), Math.round(cy));
          ctx.lineTo(Math.round(cx + scaledW * 0.22), Math.round(cy));
        }
      } else {
        // Default: draw cross pattern (for non-road infrastructure)
        ctx.moveTo(Math.round(cx - scaledW * 0.22), Math.round(cy));
        ctx.lineTo(Math.round(cx + scaledW * 0.22), Math.round(cy));
        ctx.moveTo(Math.round(cx), Math.round(cy - scaledH * 0.22));
        ctx.lineTo(Math.round(cx), Math.round(cy + scaledH * 0.22));
      }

      ctx.stroke();
    };

    // Only show Power/Water in Underground mode
    const dimSurface = undergroundMode ? 0.08 : 1;

    // Roads with auto-tiling: draw solid gray slab (full-tile rhombus = seamless)
    if (infra.includes('road')) {
      if (!undergroundMode) {
        const variant = (tile as any).roadVariant ?? 0;
        drawRoadSlab(variant);
      }
    } else if (!undergroundMode && infra.includes('highway')) {
      drawStroke(`rgba(121, 137, 152, ${0.95 * dimSurface})`, 5);
      drawStroke(`rgba(238, 220, 179, ${0.45 * dimSurface})`, 1.2);
    }

    // Power lines: only visible in Underground mode
    if (infra.includes('power_line')) {
      drawStroke(
        undergroundMode ? 'rgba(233, 201, 86, 0.95)' : 'rgba(0, 0, 0, 0)',
        undergroundMode ? 2.8 : 1.4
      );
    }

    // Water pipes: always visible, stronger in Underground
    if (infra.includes('water_pipe')) {
      drawStroke(
        undergroundMode ? 'rgba(84, 220, 255, 0.98)' : 'rgba(84, 220, 255, 0.44)',
        undergroundMode ? 4.2 : 1.8
      );
    }

    // Subway: always visible, stronger in Underground
    if (infra.includes('subway')) {
      drawStroke(
        undergroundMode ? 'rgba(173, 103, 255, 0.96)' : 'rgba(173, 103, 255, 0.32)',
        undergroundMode ? 3 : 1.6
      );
    }

    // Rails: only visible in normal mode
    if (!undergroundMode && infra.includes('rail')) {
      drawStroke(`rgba(37, 52, 68, ${0.84 * dimSurface})`, 1.4);
    }
  }

  function getVisibleEntries(): VisibleEntry[] {
    const range = getVisibleTileRange();
    const entries: VisibleEntry[] = [];

    for (let y = range.minY; y <= range.maxY; y += 1) {
      for (let x = range.minX; x <= range.maxX; x += 1) {
        const tile = tiles[y]?.[x];
        if (!tile) continue;
        entries.push({
          x,
          y,
          tile,
          depth: x + y
        });
      }
    }

    // Back-to-front sort so near buildings correctly overlap distant ones.
    entries.sort((a, b) => a.depth - b.depth || a.y - b.y || a.x - b.x);
    return entries;
  }

  function buildingEmojiFontSize(tile: Tile): number {
    const level = normalizeLevel(tile.zone?.development_level);
    if (tile.building?.type === 'hospital' || tile.building?.type === 'school' || tile.building?.type === 'university') {
      return 42;
    }
    // Scale emoji size by development level: level 1 = 32, level 2 = 38, level 3 = 46
    return level === 1 ? 32 : level === 2 ? 38 : 46;
  }

  function getBuildingAnchor(
    x: number,
    y: number,
    cx: number,
    cy: number,
    tile: Tile
  ): { emoji: string; emojiX: number; emojiY: number; fontSize: number; roofX: number; roofY: number } | null {
    const emoji = resolveBuildingEmoji(tile);
    if (!emoji) return null;
    const fontSize = buildingEmojiFontSize(tile);

    // Scale emoji positioning by zoom with integer precision
    const verticalOffset = Math.round(tileHeight * camera.zoom * 0.56);

    // Center on tile while slightly lifted so the emoji reads as a standing building.
    const emojiX = Math.round(cx);
    const emojiY = Math.round(cy - verticalOffset);
    return {
      emoji,
      emojiX,
      emojiY,
      fontSize,
      roofX: emojiX,
      roofY: Math.round(emojiY - fontSize * 0.52)
    };
  }

  function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, cx: number, cy: number, tile: Tile): void {
    const anchor = getBuildingAnchor(x, y, cx, cy, tile);
    if (!anchor) return;

    try {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${anchor.fontSize}px ${emojiFont}`;
      ctx.fillText(anchor.emoji, anchor.emojiX, anchor.emojiY);
      ctx.restore();
      return;
    } catch {
      // Safety fallback: keep a visible marker if emoji rendering is unavailable.
      ctx.fillStyle = 'rgba(48, 60, 78, 0.88)';
      ctx.fillRect(anchor.emojiX - 20, anchor.emojiY - 12, 40, 24);
      ctx.strokeStyle = 'rgba(235, 240, 248, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(anchor.emojiX - 20, anchor.emojiY - 12, 40, 24);
      ctx.fillStyle = 'rgba(245, 248, 252, 0.92)';
      ctx.font = '600 11px var(--font-ui)';
      ctx.textAlign = 'center';
      ctx.fillText('BLDG', anchor.emojiX, anchor.emojiY + 4);
    }
  }

  function drawStatusIcons(ctx: CanvasRenderingContext2D, x: number, y: number, cx: number, cy: number, tile: Tile): void {
    // Only show status icons if explicitly enabled OR if power/water tool is active
    const shouldShowIcons = showStatusIcons || infrastructureTool === 'power_line' || infrastructureTool === 'water_pipe';
    if (!shouldShowIcons) return;

    if (!hasBuilding(tile)) return;
    const anchor = getBuildingAnchor(x, y, cx, cy, tile);
    if (!anchor) return;

    const missingPower = !tile.powered;
    const missingWater = !tile.watered;
    if (!missingPower && !missingWater) return;

    const t = performance.now() * 0.0045;
    const bob = Math.sin(t + tileHash(x, y, 97) * 0.001) * 3;
    const pulse = 0.7 + Math.sin(t * 1.8 + tileHash(x, y, 131) * 0.001) * 0.3;
    const baseX = anchor.roofX;
    const baseY = anchor.roofY - 12 + bob;

    const drawEmojiBadge = (ix: number, iy: number, glyph: string): void => {
      const glow = ctx.createRadialGradient(ix, iy, 1, ix, iy, 15);
      glow.addColorStop(0, `rgba(255, 255, 255, ${0.22 + pulse * 0.24})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ix, iy, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `18px ${emojiFont}`;
      ctx.fillText(glyph, ix, iy);
    };

    if (missingPower && missingWater) {
      drawEmojiBadge(baseX - 10, baseY, '⚡');
      drawEmojiBadge(baseX + 10, baseY, '💧');
    } else if (missingPower) {
      drawEmojiBadge(baseX, baseY, '⚡');
    } else {
      drawEmojiBadge(baseX, baseY, '💧');
    }
  }

  function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Scale shadow dimensions by zoom with integer precision
    const scaledW = Math.round(tileWidth * camera.zoom);
    const scaledH = Math.round(tileHeight * camera.zoom);
    const overlapW = Math.ceil(scaledW + 1);
    const overlapH = Math.ceil(scaledH + 1);
    const shadowX = Math.round(cx - scaledW / 2);
    const shadowY = Math.round(cy - scaledH / 2 + 3);

    const atlasShadow = atlasFrames.tile_shadow;
    if (atlasImage && atlasShadow) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(
        atlasImage,
        atlasShadow.x,
        atlasShadow.y,
        atlasShadow.w,
        atlasShadow.h,
        shadowX,
        shadowY,
        overlapW,
        overlapH
      );
      ctx.globalAlpha = 1;
      return;
    }

    const shadow = textures.tile_shadow;
    if (shadow) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(shadow, shadowX, shadowY, overlapW, overlapH);
      ctx.globalAlpha = 1;
      return;
    }

    const g = ctx.createRadialGradient(
      Math.round(cx),
      Math.round(cy + 4),
      2,
      Math.round(cx),
      Math.round(cy + 4),
      Math.round(scaledW * 0.35)
    );
    g.addColorStop(0, 'rgba(15,23,42,0.3)');
    g.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(
      Math.round(cx),
      Math.round(cy + 6),
      Math.round(scaledW * 0.33),
      Math.round(scaledH * 0.25),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function drawHoverGlow(ctx: CanvasRenderingContext2D): void {
    if (!hover || !pointerScreen) return;
    const center = worldToScreen(tileCenter(hover.x, hover.y));
    const pulse = 0.82 + Math.sin(performance.now() * 0.005) * 0.18;

    // Scale tile dimensions by zoom for consistent hover appearance
    const scaledW = Math.round(tileWidth * camera.zoom);
    const scaledH = Math.round(tileHeight * camera.zoom);

    ctx.save();
    drawDiamondPath(ctx, Math.round(center.x), Math.round(center.y), scaledW, scaledH);
    const gradient = ctx.createRadialGradient(
      Math.round(center.x),
      Math.round(center.y),
      scaledH * 0.1,
      Math.round(center.x),
      Math.round(center.y),
      scaledW * 0.7
    );
    gradient.addColorStop(0, `rgba(182, 154, 99, ${0.3 * pulse})`);
    gradient.addColorStop(0.6, `rgba(140, 168, 138, ${0.18 * pulse})`);
    gradient.addColorStop(1, 'rgba(140, 168, 138, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = `rgba(189, 163, 105, ${0.8 * pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(Math.round(pointerScreen.x), Math.round(pointerScreen.y), 3.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217, 193, 142, 0.94)';
    ctx.fill();
  }

  function drawSelectedTile(ctx: CanvasRenderingContext2D): void {
    const selected = activeSelected();
    if (!selected) return;
    const center = worldToScreen(tileCenter(selected.x, selected.y));
    const pulse = 0.78 + Math.sin(performance.now() * 0.004) * 0.22;

    // Scale the tile dimensions by zoom with integer precision
    const scaledW = Math.round(tileWidth * camera.zoom);
    const scaledH = Math.round(tileHeight * camera.zoom);

    ctx.save();
    drawDiamondPath(ctx, Math.round(center.x), Math.round(center.y), scaledW, scaledH);
    const bloom = ctx.createRadialGradient(
      Math.round(center.x),
      Math.round(center.y),
      scaledH * 0.1,
      Math.round(center.x),
      Math.round(center.y),
      scaledW * 0.95
    );
    bloom.addColorStop(0, `rgba(188, 164, 115, ${0.35 * pulse})`);
    bloom.addColorStop(1, 'rgba(188, 164, 115, 0)');
    ctx.fillStyle = bloom;
    ctx.fill();
    ctx.strokeStyle = `rgba(204, 179, 128, ${0.95 * pulse})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  function drawNoRoadIcon(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile): void {
    if (!tile.zone || !tile.zone.type.startsWith('residential') || tile.road_access) return;
    const center = worldToScreen(tileCenter(x, y));
    const iconX = Math.round(center.x);
    const iconY = Math.round(center.y - tileHeight * camera.zoom * 1.2);

    ctx.save();
    ctx.globalAlpha = undergroundMode ? 0.25 : 1;
    ctx.fillStyle = 'rgba(184, 70, 76, 0.95)';
    ctx.beginPath();
    ctx.arc(iconX, iconY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 236, 238, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(iconX - 4, iconY - 4);
    ctx.lineTo(iconX + 4, iconY + 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawAtmosphericLighting(ctx: CanvasRenderingContext2D): void {
    const dayCycle = (month + monthDrift) % 12;
    const warm = Math.max(0, Math.sin((dayCycle / 12) * Math.PI * 2 - Math.PI / 3));
    const night = Math.max(0, Math.sin((dayCycle / 12) * Math.PI * 2 + Math.PI / 2));
    const cool = 1 - warm * 0.7;

    const top = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight);
    top.addColorStop(0, `rgba(255, 227, 186, ${0.03 + warm * 0.12})`);
    top.addColorStop(0.46, `rgba(174, 202, 224, ${0.02 + cool * 0.08})`);
    top.addColorStop(1, `rgba(10, 24, 44, ${0.08 + night * 0.22})`);
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const fog = ctx.createLinearGradient(0, canvas.clientHeight * 0.35, 0, canvas.clientHeight);
    fog.addColorStop(0, 'rgba(230, 240, 252, 0)');
    fog.addColorStop(1, `rgba(13, 28, 49, ${0.09 + night * 0.18})`);
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const vignette = ctx.createRadialGradient(
      canvas.clientWidth * 0.45,
      canvas.clientHeight * 0.42,
      Math.min(canvas.clientWidth, canvas.clientHeight) * 0.16,
      canvas.clientWidth * 0.5,
      canvas.clientHeight * 0.54,
      Math.max(canvas.clientWidth, canvas.clientHeight) * 0.92
    );
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, `rgba(2, 9, 20, ${0.2 + night * 0.2})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const edgeFog = ctx.createLinearGradient(0, 0, canvas.clientWidth, 0);
    edgeFog.addColorStop(0, 'rgba(7, 14, 27, 0.26)');
    edgeFog.addColorStop(0.08, 'rgba(7, 14, 27, 0)');
    edgeFog.addColorStop(0.92, 'rgba(7, 14, 27, 0)');
    edgeFog.addColorStop(1, 'rgba(7, 14, 27, 0.26)');
    ctx.fillStyle = edgeFog;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  function drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(202, 186, 154, ${alpha * 0.32})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFloatingCosts(ctx: CanvasRenderingContext2D): void {
    ctx.font = `600 16px var(--font-mono)`;
    ctx.textAlign = 'center';
    for (const item of floatingCosts) {
      const alpha = Math.max(0, item.life / item.maxLife);
      ctx.fillStyle = `rgba(224, 201, 152, ${alpha})`;
      ctx.fillText(`\u00A7 -${item.value}`, item.x, item.y);
    }
  }

  function triggerPlacementFeedback(x: number, y: number, cost: number): void {
    const center = worldToScreen(tileCenter(x, y));
    floatingCosts = [...floatingCosts, { x: center.x, y: center.y - 18, value: cost, life: 54, maxLife: 54 }];

    particles = [
      ...particles,
      ...Array.from({ length: 10 }, () => ({
        x: center.x + (Math.random() - 0.5) * 14,
        y: center.y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 1.3,
        vy: -Math.random() * 1.8 - 0.2,
        life: 34 + Math.random() * 22,
        maxLife: 56,
        size: 1 + Math.random() * 2.5
      }))
    ];

    shake = Math.max(shake, 5.5);
  }

  function resizeCanvas(): void {
    if (!canvas || !wrap) return;
    dpr = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function centerCamera(): void {
    const o = origin();
    const minX = 0;
    const maxX = (mapWidth + mapHeight) * (tileWidth / 2);
    const minY = o.y - tileHeight / 2;
    const maxY = o.y + (mapWidth + mapHeight) * (tileHeight / 2);

    const centerWorldX = (minX + maxX) / 2;
    const centerWorldY = (minY + maxY) / 2;

    targetX = canvas.clientWidth / 2 - centerWorldX * targetZoom;
    targetY = canvas.clientHeight / 2 - centerWorldY * targetZoom;
    springX.set(targetX, { hard: true });
    springY.set(targetY, { hard: true });
    springZoom.set(targetZoom, { hard: true });
  }

  function render(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for crisp pixel art / sprite rendering
    ctx.imageSmoothingEnabled = false;

    const shakeOffsetX = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
    const shakeOffsetY = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 0.6) : 0;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.translate(shakeOffsetX, shakeOffsetY);
    const visibleEntries = getVisibleEntries();

    // 1) Base terrain
    for (const entry of visibleEntries) {
      const { x, y, tile } = entry;
      const center = worldToScreen(tileCenter(x, y));
      const isHoverTile = hover && hover.x === x && hover.y === y;
      ctx.save();
      if (undergroundMode) ctx.globalAlpha = 0.2;
      if (isHoverTile) {
        ctx.translate(center.x, center.y);
        ctx.scale(1.03, 1.03);
        drawTexturedTile(ctx, 0, 0, textureKeyForTile(tile));
      } else {
        drawTexturedTile(ctx, center.x, center.y, textureKeyForTile(tile));
      }
      ctx.restore();
    }

    // 2) Infrastructure
    if (showInfrastructure) {
      for (const entry of visibleEntries) {
        const { x, y, tile } = entry;
        const center = worldToScreen(tileCenter(x, y));
        drawInfrastructure(ctx, center.x, center.y, tile);
      }
    }

    // 2.5) Shadows (under buildings/zones for 3D depth)
    for (const entry of visibleEntries) {
      const { x, y, tile } = entry;
      if (!hasBuilding(tile) && !showZones) continue;
      if (!hasBuilding(tile) && !tile.zone) continue;
      const center = worldToScreen(tileCenter(x, y));

      // Shadow parameters based on development level
      const devLevel = tile.zone?.development_level || 0;
      const shadowOpacity = Math.min(0.25, 0.1 + devLevel * 0.04);
      const shadowHeight = 8;
      const shadowWidth = 40;
      const shadowHeight2 = 6;

      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      // Draw shadow as an ellipse beneath the tile
      ctx.beginPath();
      ctx.ellipse(
        Math.round(center.x),
        Math.round(center.y + shadowHeight),
        shadowWidth,
        shadowHeight2,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // 3) Buildings (sprite render) - only if zones are visible
    if (showZones) {
      for (const entry of visibleEntries) {
        const { x, y, tile } = entry;
        if (!hasBuilding(tile)) continue;
        const center = worldToScreen(tileCenter(x, y));
        ctx.save();
        if (undergroundMode) ctx.globalAlpha = 0.2;
        drawBuilding(ctx, x, y, center.x, center.y, tile);
        ctx.restore();
      }
    }

    // 4) Grounding shadows
    for (const entry of visibleEntries) {
      const { x, y, tile } = entry;
      if (!hasBuilding(tile)) continue;
      const center = worldToScreen(tileCenter(x, y));
      ctx.save();
      if (undergroundMode) ctx.globalAlpha = 0.2;
      drawShadow(ctx, center.x, center.y);
      ctx.restore();
    }

    // 5) Status and warnings
    for (const entry of visibleEntries) {
      const { x, y, tile } = entry;
      if (hasBuilding(tile)) {
        const center = worldToScreen(tileCenter(x, y));
        ctx.save();
        if (undergroundMode) ctx.globalAlpha = 0.36;
        drawStatusIcons(ctx, x, y, center.x, center.y, tile);
        ctx.restore();
      }
      drawNoRoadIcon(ctx, x, y, tile);
    }

    drawSelectedTile(ctx);
    drawHoverGlow(ctx);
    drawParticles(ctx);
    drawFloatingCosts(ctx);
    drawAtmosphericLighting(ctx);
    ctx.restore();
  }

  function animate(ts: number): void {
    const dt = lastFrameTs === 0 ? 16 : Math.min(34, ts - lastFrameTs);
    lastFrameTs = ts;
    monthDrift += dt * 0.00006;
    if (monthDrift > 12) monthDrift -= 12;

    // Camera motion: use springs for smooth interpolation (only when not dragging)
    if (!isDragging) {
      springX.set(targetX);
      springY.set(targetY);
    }

    // Decay shake effect
    if (shake > 0) {
      shake *= 0.84;
      if (shake < 0.2) shake = 0;
    }

    // Update particles with gravity
    particles = particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx * (dt / 15),
        y: p.y + p.vy * (dt / 15),
        vx: p.vx * 0.98,
        vy: p.vy + 0.04,
        life: p.life - dt * 0.08
      }))
      .filter((p) => p.life > 0);

    // Update floating cost labels
    floatingCosts = floatingCosts
      .map((f) => ({ ...f, y: f.y - 0.4 * (dt / 16), life: f.life - dt * 0.06 }))
      .filter((f) => f.life > 0);

    // Request next frame
    render();
    rafId = requestAnimationFrame(animate);
  }

  function keyForPoint(p: GridPoint): string {
    return `${p.x}:${p.y}`;
  }

  function lineBetween(a: GridPoint, b: GridPoint): GridPoint[] {
    const points: GridPoint[] = [];
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
      points.push({ x: x0, y: y0 });
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

    return points;
  }

  function drawInfrastructureAt(tilePos: GridPoint): void {
    if (!infrastructureTool) return;
    const tile = tiles[tilePos.y]?.[tilePos.x];
    if (!tile || tile.terrain_type === 'water') return;

    if (tile.infrastructure.includes(infrastructureTool)) return;

    // Prevent duplicate submissions
    const key = `infra-${tilePos.x}:${tilePos.y}-${infrastructureTool}`;
    if (pendingOperations.has(key)) return;
    pendingOperations.add(key);

    // Store original state for rollback
    const originalInfra = [...tile.infrastructure];

    // Apply optimistically (instant feedback)
    tile.infrastructure = [...tile.infrastructure, infrastructureTool];

    // Update auto-tiling for roads
    if (infrastructureTool === 'road') {
      updateAutoTiling(tiles, tilePos.x, tilePos.y);
      tile.road_access = true;
    }

    if (infrastructureTool === 'power_line') {
      tile.powered = true;
    }
    if (infrastructureTool === 'water_pipe') {
      tile.watered = true;
    }

    drawnThisStroke.add(keyForPoint(tilePos));
    triggerPlacementFeedback(tilePos.x, tilePos.y, infrastructureTool === 'road' ? 10 : 5);

    // Send to backend in background
    void apiService.placeInfrastructure(gameId, infrastructureTool, [{ from: tilePos, to: tilePos }]).then((result) => {
      pendingOperations.delete(key);
      if (!result.success) {
        // Rollback on failure
        tile.infrastructure = originalInfra;
        if (infrastructureTool === 'road') {
          updateAutoTiling(tiles, tilePos.x, tilePos.y);
        }
        tiles = [...tiles];
      }
    }).catch((err) => {
      pendingOperations.delete(key);
      console.error('Infrastructure placement failed:', err);
      // Rollback on error
      tile.infrastructure = originalInfra;
      if (infrastructureTool === 'road') {
        updateAutoTiling(tiles, tilePos.x, tilePos.y);
      }
      tiles = [...tiles];
    });
  }

  function zonePaintCost(type: ZoneType): number {
    if (type.endsWith('dense')) return 10;
    return 5;
  }

  function placeZoneAt(tilePos: GridPoint): void {
    if (!zoneTool) return;
    const tile = tiles[tilePos.y]?.[tilePos.x];
    if (!tile || tile.terrain_type === 'water') return;

    if (tile.zone?.type === zoneTool) return;

    // Prevent duplicate submissions
    const key = `${tilePos.x}:${tilePos.y}`;
    if (pendingOperations.has(key)) return;
    pendingOperations.add(key);

    // Store original state for rollback
    const originalZone = tile.zone ? { ...tile.zone } : null;

    // Apply optimistically (instant feedback)
    tile.zone = {
      id: `z-${tilePos.x}-${tilePos.y}-${Date.now()}`,
      type: zoneTool,
      position: { x: tilePos.x, y: tilePos.y },
      size: { w: 1, h: 1 },
      development_level: Math.max(0, tile.zone?.development_level ?? 0),
      powered: tile.powered,
      watered: tile.watered,
      road_access: tile.road_access,
      abandoned: false,
      population: tile.zone?.population ?? 0,
      built_year: new Date().getFullYear(),
      built_month: month
    };

    zonedThisStroke.add(keyForPoint(tilePos));
    triggerPlacementFeedback(tilePos.x, tilePos.y, zonePaintCost(zoneTool));

    // Send to backend in background
    const cost = zonePaintCost(zoneTool);
    void apiService.placeZone(gameId, zoneTool, tilePos, { w: 1, h: 1 }).then((result) => {
      pendingOperations.delete(key);
      if (!result.success) {
        // Rollback on failure
        if (originalZone) {
          tile.zone = originalZone;
        } else {
          tile.zone = null;
        }
        tiles = [...tiles];
      }
    }).catch((err) => {
      pendingOperations.delete(key);
      console.error('Zone placement failed:', err);
      // Rollback on error
      if (originalZone) {
        tile.zone = originalZone;
      } else {
        tile.zone = null;
      }
      tiles = [...tiles];
    });
  }

  function applyZoneSegment(next: GridPoint): void {
    if (!zoneTool) return;
    const from = lastZoneTile ?? next;
    const path = lineBetween(from, next);
    for (const p of path) placeZoneAt(p);
    lastZoneTile = next;
  }

  function applyInfrastructureSegment(next: GridPoint): void {
    if (!infrastructureTool) return;
    const from = lastInfraTile ?? next;
    const path = lineBetween(from, next);
    for (const p of path) drawInfrastructureAt(p);
    lastInfraTile = next;
  }

  function startDragging(event: MouseEvent): void {
    if (zoneTool) {
      const picked = pickTile({ x: event.offsetX, y: event.offsetY });
      if (!picked) return;
      isZonePainting = true;
      zonedThisStroke = new Set<string>();
      lastZoneTile = picked;
      applyZoneSegment(picked);
      return;
    }

    if (infrastructureTool) {
      const picked = pickTile({ x: event.offsetX, y: event.offsetY });
      if (!picked) return;
      isInfraDrawing = true;
      drawnThisStroke = new Set<string>();
      lastInfraTile = picked;
      applyInfrastructureSegment(picked);
      return;
    }

    isDragging = true;
    lastPointer = { x: event.offsetX, y: event.offsetY };
  }

  function stopDragging(): void {
    if (isZonePainting) {
      isZonePainting = false;
      const updatedTiles = Array.from(zonedThisStroke).map((item) => {
        const [x, y] = item.split(':').map(Number);
        return { x, y };
      });
      if (updatedTiles.length > 0) dispatch('zonePainted', { updatedTiles });
      zonedThisStroke.clear();
      lastZoneTile = null;
    }

    if (isInfraDrawing) {
      isInfraDrawing = false;
      const updatedTiles = Array.from(drawnThisStroke).map((item) => {
        const [x, y] = item.split(':').map(Number);
        return { x, y };
      });
      if (updatedTiles.length > 0) dispatch('infrastructureDrawn', { updatedTiles });
      drawnThisStroke.clear();
      lastInfraTile = null;
    }

    isDragging = false;
    lastPointer = null;
  }

  function onPointerMove(event: MouseEvent): void {
    pointerScreen = { x: event.offsetX, y: event.offsetY };

    if (isZonePainting) {
      const picked = pickTile(pointerScreen);
      if (picked) applyZoneSegment(picked);
    }

    if (isInfraDrawing) {
      const picked = pickTile(pointerScreen);
      if (picked) applyInfrastructureSegment(picked);
    }

    if (isDragging && lastPointer) {
      const dx = event.offsetX - lastPointer.x;
      const dy = event.offsetY - lastPointer.y;
      targetX += dx;
      targetY += dy;
      springX.set(targetX, { hard: true });
      springY.set(targetY, { hard: true });
      lastPointer = { x: event.offsetX, y: event.offsetY };
    }

    const picked = pickTile(pointerScreen);
    if (!picked) {
      hover = null;
      return;
    }

    const tile = tiles[picked.y]?.[picked.x];
    hover = tile ? { x: picked.x, y: picked.y, tile } : null;
  }

  function onPointerLeave(): void {
    hover = null;
    pointerScreen = null;
    stopDragging();
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const screen = { x: Math.round(event.clientX - rect.left), y: Math.round(event.clientY - rect.top) };
    const before = screenToWorld(screen);

    const direction = event.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.min(maxZoom, Math.max(minZoom, targetZoom * (1 + zoomStep * direction)));
    if (nextZoom === targetZoom) return;

    targetZoom = nextZoom;
    targetX = screen.x - before.x * targetZoom;
    targetY = screen.y - before.y * targetZoom;
    springZoom.set(targetZoom);
    springX.set(targetX);
    springY.set(targetY);
  }

  function onCanvasClick(event: MouseEvent): void {
    if (isDragging || isInfraDrawing || isZonePainting || infrastructureTool || zoneTool) return;
    const picked = pickTile({ x: event.offsetX, y: event.offsetY });
    if (!picked) return;
    const tile = tiles[picked.y]?.[picked.x];
    if (!tile) return;

    localSelected = { x: picked.x, y: picked.y, tile };
  }

  async function loadTextures(): Promise<void> {
    const atlasTask = new Promise<void>((resolve) => {
      const atlas = new Image();
      atlas.src = '/assets/tiles/spritesheet.png';
      atlas.decoding = 'async';
      atlas.onload = () => {
        atlasImage = atlas;
        resolve();
      };
      atlas.onerror = () => resolve();
    });

    await Promise.all([
      atlasTask,
      ...textureKeys.map(
        (key) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.src = `/assets/tiles/${key}.svg`;
            img.decoding = 'async';
            img.onload = () => {
              textures[key] = img;
              resolve();
            };
            img.onerror = () => resolve();
          })
      )
    ]);

  }

  function createGrainPattern(): void {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 96;
    patternCanvas.height = 96;
    const pctx = patternCanvas.getContext('2d');
    if (!pctx) return;

    const data = pctx.createImageData(patternCanvas.width, patternCanvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const noise = 116 + Math.floor(Math.random() * 90);
      data.data[i] = noise;
      data.data[i + 1] = noise;
      data.data[i + 2] = noise;
      data.data[i + 3] = Math.floor(Math.random() * 24);
    }
    pctx.putImageData(data, 0, 0);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    grainPattern = ctx.createPattern(patternCanvas, 'repeat');
  }

  $: if (canvas && tiles.length > 0) {
    resizeCanvas();
    render();
  }

  onMount(() => {
    let disposed = false;
    resizeCanvas();
    centerCamera();
    createGrainPattern();
    void loadTextures().then(() => {
      if (!disposed) render();
    });

    const handleResize = () => {
      resizeCanvas();
      render();
    };

    const handleWindowMouseUp = () => stopDragging();

    window.addEventListener('resize', handleResize);
    window.addEventListener('mouseup', handleWindowMouseUp);

    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      cancelAnimationFrame(rafId);
    };
  });
</script>

<div class="map-wrap" bind:this={wrap}>
  <canvas
    bind:this={canvas}
    on:click={onCanvasClick}
    on:mousedown={startDragging}
    on:mouseup={stopDragging}
    on:mousemove={onPointerMove}
    on:mouseleave={onPointerLeave}
    on:wheel={onWheel}
  ></canvas>

  {#if hover}
    <div class="tooltip" in:fly={{ y: -8, duration: 180 }} out:fade={{ duration: 140 }}>
      <div><strong>Tile:</strong> {hover.x}, {hover.y}</div>
      <div><strong>Terrain:</strong> {hover.tile.terrain_type}</div>
      <div><strong>Zone:</strong> {hover.tile.zone ? hover.tile.zone.type : 'none'}</div>
      <div><strong>Power:</strong> {hover.tile.powered ? 'yes' : 'no'}</div>
      <div><strong>Water:</strong> {hover.tile.watered ? 'yes' : 'no'}</div>
      <div><strong>Pop:</strong> {hover.tile.zone?.population ?? 0}</div>
    </div>
  {/if}
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background:
      radial-gradient(circle at 12% 8%, rgba(139, 160, 137, 0.2) 0%, rgba(139, 160, 137, 0) 42%),
      radial-gradient(circle at 84% 72%, rgba(176, 153, 102, 0.18) 0%, rgba(176, 153, 102, 0) 40%),
      linear-gradient(180deg, #13233c 0%, #122039 62%, #0f1b31 100%);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: auto;
    cursor: grab;
  }

  canvas:active {
    cursor: grabbing;
  }

  .tooltip {
    position: absolute;
    top: 80px;
    left: 14px;
    background: rgba(10, 20, 38, 0.56);
    color: #f2f6ff;
    padding: 9px 11px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(14px);
    font-size: 0.78rem;
    line-height: 1.4;
    pointer-events: none;
    min-width: 210px;
    box-shadow: 0 12px 32px rgba(1, 10, 25, 0.28);
  }
</style>
