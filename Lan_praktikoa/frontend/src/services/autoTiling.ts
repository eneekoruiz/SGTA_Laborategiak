import type { Tile } from '../types/game';

/**
 * Auto-Tiling Service
 * Intelligently connects roads based on neighbors to create T-junctions, corners, and crosses.
 *
 * Road variants (16 total, based on 4 directions):
 * Straight: N-S or E-W
 * T-Junction: 3 directions
 * 4-way: All 4 directions
 * Corner: 2 adjacent directions
 * Stub: 1 direction
 */

export interface RoadConnections {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

/**
 * Compute road connections for a specific tile.
 * Check N/S/E/W neighbors for roads.
 */
export function computeRoadConnections(
  tiles: Tile[][],
  x: number,
  y: number
): RoadConnections {
  const height = tiles.length;
  const width = tiles[0]?.length || 0;

  const hasRoad = (tx: number, ty: number): boolean => {
    if (tx < 0 || tx >= width || ty < 0 || ty >= height) return false;
    const tile = tiles[ty][tx];
    return tile && tile.infrastructure.includes('road');
  };

  return {
    north: hasRoad(x, y - 1),
    south: hasRoad(x, y + 1),
    east: hasRoad(x + 1, y),
    west: hasRoad(x - 1, y)
  };
}

/**
 * Get visual variant key for road based on connections.
 * This key is used to select the correct sprite frame from the tileset.
 *
 * Encoding: north (1) + south (2) + east (4) + west (8) = 0-15
 */
export function getRoadVariant(connections: RoadConnections): number {
  let variant = 0;
  if (connections.north) variant += 1;
  if (connections.south) variant += 2;
  if (connections.east) variant += 4;
  if (connections.west) variant += 8;
  return variant;
}

/**
 * Get human-readable description of road type.
 * Useful for debugging or UI tooltips.
 */
export function getRoadTypeName(variant: number): string {
  const descriptions: Record<number, string> = {
    0: 'Stub',
    1: 'North',
    2: 'South',
    3: 'Vertical',
    4: 'East',
    5: 'NE Corner',
    6: 'SE Corner',
    7: 'T-Junction (South)',
    8: 'West',
    9: 'NW Corner',
    10: 'SW Corner',
    11: 'T-Junction (East)',
    12: 'Horizontal',
    13: 'T-Junction (West)',
    14: 'T-Junction (North)',
    15: '4-Way Cross'
  };
  return descriptions[variant] || 'Unknown';
}

/**
 * Update auto-tiling for a tile and its neighbors.
 * Call this after placing or removing any road infrastructure.
 *
 * Mutates the tiles array in-place, adding roadVariant metadata.
 */
export function updateAutoTiling(tiles: Tile[][], x: number, y: number): void {
  const height = tiles.length;
  const width = tiles[0]?.length || 0;

  // Update the tile itself
  const tile = tiles[y]?.[x];
  if (tile && tile.infrastructure.includes('road')) {
    const connections = computeRoadConnections(tiles, x, y);
    const variant = getRoadVariant(connections);
    // Store in tile metadata for rendering
    (tile as any).roadVariant = variant;
  }

  // Update all neighbors so they account for this tile
  const neighbors = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 }
  ];

  for (const { x: nx, y: ny } of neighbors) {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const neighborTile = tiles[ny][nx];
    if (neighborTile && neighborTile.infrastructure.includes('road')) {
      const connections = computeRoadConnections(tiles, nx, ny);
      const variant = getRoadVariant(connections);
      (neighborTile as any).roadVariant = variant;
    }
  }
}

/**
 * Re-compute auto-tiling for all roads on the map.
 * Expensive operation - use sparingly (e.g., on load or island-wide changes).
 */
export function recomputeAllRoads(tiles: Tile[][]): void {
  const height = tiles.length;
  const width = tiles[0]?.length || 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      if (tile && tile.infrastructure.includes('road')) {
        updateAutoTiling(tiles, x, y);
      }
    }
  }
}
