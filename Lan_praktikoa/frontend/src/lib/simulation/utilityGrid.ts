import type { Tile } from '../../types/game';
import {
  POWER_TYPES,
  ROAD_TYPES,
  SIMULATION_CONSTANTS,
  WATER_TYPES
} from './constants';

const POWER_ACCESS_RADIUS = SIMULATION_CONSTANTS.POWER_ACCESS_RADIUS;
const ROAD_ACCESS_RADIUS = SIMULATION_CONSTANTS.ROAD_ACCESS_RADIUS;
const WATER_ACCESS_RADIUS = SIMULATION_CONSTANTS.WATER_ACCESS_RADIUS;
const SERVICE_RADIUS = SIMULATION_CONSTANTS.SERVICE_COVERAGE_RADIUS;

function toTileKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function inBounds(tiles: Tile[][], x: number, y: number): boolean {
  return y >= 0 && y < tiles.length && x >= 0 && x < (tiles[0]?.length ?? 0);
}

function neighbors4(x: number, y: number): Array<{ x: number; y: number }> {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ];
}

/**
 * Building type check remains explicit so frontend simulation mirrors backend source semantics.
 */
export function isPowerPlant(type?: string): boolean {
  return Boolean(type && type.endsWith('_power'));
}

/**
 * Pump detection drives water BFS sources as described in SPECS 3.5.
 */
export function isWaterPump(type?: string): boolean {
  return type === 'water_pump';
}

/**
 * Builds BFS-connected infrastructure graph used by utility propagation.
 */
export function infrastructureGraph(
  tiles: Tile[][],
  infraTypes: Set<string>
): { connected: Set<string>; distanceMap: Map<string, number> } {
  const connected = new Set<string>();
  const distanceMap = new Map<string, number>();
  const queue: Array<{ x: number; y: number; d: number }> = [];

  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      const tile = tiles[y][x];
      const isSource =
        Array.from(infraTypes).some((infra) => tile.infrastructure.includes(infra as any)) ||
        (infraTypes === POWER_TYPES && isPowerPlant(tile.building?.type)) ||
        (infraTypes === WATER_TYPES && isWaterPump(tile.building?.type));

      if (!isSource) continue;
      const key = toTileKey(x, y);
      connected.add(key);
      distanceMap.set(key, 0);
      queue.push({ x, y, d: 0 });
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const next of neighbors4(current.x, current.y)) {
      if (!inBounds(tiles, next.x, next.y)) continue;
      const key = toTileKey(next.x, next.y);
      if (connected.has(key)) continue;

      const tile = tiles[next.y][next.x];
      const carriesInfra = Array.from(infraTypes).some((infra) => tile.infrastructure.includes(infra as any));
      if (!carriesInfra) continue;

      connected.add(key);
      distanceMap.set(key, current.d + 1);
      queue.push({ x: next.x, y: next.y, d: current.d + 1 });
    }
  }

  return { connected, distanceMap };
}

/**
 * Uses nearest Manhattan distance so coverage behaves predictably in an isometric projection.
 */
export function nearestGraphDistance(
  graph: Set<string>,
  x: number,
  y: number,
  maxRadius: number
): number | null {
  let bestDistance: number | null = null;

  for (let dy = -maxRadius; dy <= maxRadius; dy += 1) {
    for (let dx = -maxRadius; dx <= maxRadius; dx += 1) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > maxRadius) continue;
      if (!graph.has(toTileKey(x + dx, y + dy))) continue;
      if (bestDistance === null || distance < bestDistance) bestDistance = distance;
    }
  }

  return bestDistance;
}

/**
 * Service coverage is a boolean approximation used by growth and demand in the current frontend simulation.
 */
export function hasServiceCoverage(tiles: Tile[][], x: number, y: number): boolean {
  for (let dy = -SERVICE_RADIUS; dy <= SERVICE_RADIUS; dy += 1) {
    for (let dx = -SERVICE_RADIUS; dx <= SERVICE_RADIUS; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(tiles, nx, ny)) continue;

      const serviceType = tiles[ny][nx].building?.type;
      if (!serviceType) continue;
      const isService =
        serviceType === 'police_station' ||
        serviceType === 'fire_station' ||
        serviceType === 'hospital' ||
        serviceType === 'school' ||
        serviceType === 'college' ||
        serviceType === 'library' ||
        serviceType === 'museum';
      if (!isService) continue;

      if (Math.hypot(dx, dy) <= SERVICE_RADIUS) return true;
    }
  }

  return false;
}

/**
 * Applies utility coverage fields in the same order as SPECS 3.1 mandates.
 */
export function updateUtilityCoverage(tiles: Tile[][]): Tile[][] {
  const roadGraph = infrastructureGraph(tiles, ROAD_TYPES).connected;
  const powerGraph = infrastructureGraph(tiles, POWER_TYPES).connected;
  const waterGraph = infrastructureGraph(tiles, WATER_TYPES).connected;

  return tiles.map((row, y) =>
    row.map((tile, x) => {
      const roadDistance = nearestGraphDistance(roadGraph, x, y, ROAD_ACCESS_RADIUS);
      const powerDistance = nearestGraphDistance(powerGraph, x, y, POWER_ACCESS_RADIUS);
      const waterDistance = nearestGraphDistance(waterGraph, x, y, WATER_ACCESS_RADIUS);

      return {
        ...tile,
        road_access: roadDistance !== null,
        powered: powerDistance !== null,
        watered: waterDistance !== null
      };
    })
  );
}
