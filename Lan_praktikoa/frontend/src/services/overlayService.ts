import type { OverlayData } from '../types/game';

/**
 * OVERLAY SERVICE
 * Generates mock 2D heatmap data for data visualization overlays.
 * Each overlay type uses procedural generation based on tile coordinates.
 *
 * Values are normalized to 0-255 for color mapping in the canvas renderer.
 * This is extensible to include Health and Education overlays.
 */

/**
 * Pseudo-random hash function for consistent tile-based generation
 */
function tileHash(x: number, y: number, salt: number): number {
  const h = (x * 73856093) ^ (y * 19349663) ^ (salt * 1103515245);
  return (h >>> 0) % 256;
}

/**
 * Smooth interpolation function (perlin-like)
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Generate smooth noise at a tile coordinate
 */
function noise2D(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const n00 = tileHash(ix, iy, salt);
  const n10 = tileHash(ix + 1, iy, salt);
  const n01 = tileHash(ix, iy + 1, salt);
  const n11 = tileHash(ix + 1, iy + 1, salt);

  const u = smoothstep(fx);
  const v = smoothstep(fy);

  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

/**
 * CRIME OVERLAY (REACTIVE)
 * Based on: population density, proximity to industrial zones, police coverage
 * Red gradient: 0=safe, 255=high crime
 */
export function generateCrimeOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Base: noise pattern
      let crime = noise2D(x * 0.15, y * 0.15, 42) * 0.6;

      // Population density increases crime
      if (tile?.zone?.population) {
        crime += (tile.zone.population / 100) * 0.3;
      }

      // Industrial zones increase crime
      if (tile?.zone?.type?.includes('industrial')) {
        crime += 80;
      }

      // Dense zones increase crime more
      if (tile?.zone?.type?.includes('dense')) {
        crime += 40;
      }

      // Check for nearby police stations (reduce crime)
      let policeDistance = Infinity;
      for (let dy = -18; dy <= 18; dy++) {
        for (let dx = -18; dx <= 18; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'police_station') {
              const distance = Math.sqrt(dx * dx + dy * dy);
              policeDistance = Math.min(policeDistance, distance);
            }
          }
        }
      }

      // Police coverage reduces crime
      if (policeDistance < Infinity) {
        crime *= Math.max(0.3, 1 - policeDistance / 18);
      }

      // Road access slightly reduces crime
      if (tile?.road_access) {
        crime *= 0.85;
      }

      row.push(Math.min(255, Math.max(0, Math.round(crime))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'crime',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * AIR POLLUTION OVERLAY (REACTIVE)
 * Based on: industrial zones, power lines, proximity to roads
 * Purple-Grey gradient: 0=clean, 255=heavily polluted
 */
export function generatePollutionAirOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Base noise
      let pollution = noise2D(x * 0.12, y * 0.12, 88) * 0.4;

      // Industrial zones are major polluters
      if (tile?.zone?.type?.includes('industrial')) {
        pollution = 200;
      }

      // Check for nearby industrial zones (5 tile radius)
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.zone?.type?.includes('industrial')) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              const impact = (100 / (distance + 1)) * 0.5;
              pollution = Math.max(pollution, impact);
            }
          }
        }
      }

      // Roads contribute to air pollution
      if (tile?.infrastructure?.includes('road')) {
        pollution += 25;
      }

      // Power lines add pollution
      if (tile?.infrastructure?.includes('power_line')) {
        pollution += 15;
      }

      // Water tiles reduce pollution
      if (tile?.terrain_type === 'water') {
        pollution *= 0.3;
      }

      row.push(Math.min(255, Math.max(0, Math.round(pollution))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'pollution_air',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * WATER POLLUTION OVERLAY
 * Based on: proximity to industrial zones and roads near water
 * Dark Brown/Gray gradient: 0=clean, 255=heavily contaminated
 */
export function generatePollutionWaterOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Base: low unless near water
      let pollution = tile?.terrain_type === 'water' ? noise2D(x * 0.1, y * 0.1, 99) * 0.8 : 10;

      // Industrial zones near water contaminate heavily
      if (tile?.zone?.type?.includes('industrial') && tile?.terrain_type === 'water') {
        pollution += 100;
      }

      // Check neighborhood for industrial runoff
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.zone?.type?.includes('industrial')) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              pollution += (100 / (distance + 1)) * 0.3;
            }
          }
        }
      }

      // Roads contribute to water runoff
      if (tile?.infrastructure?.includes('road')) {
        pollution += 20;
      }

      // Treatment plants reduce water pollution
      if (tile?.building?.type === 'water_treatment') {
        pollution *= 0.2;
      }

      row.push(Math.min(255, Math.max(0, Math.round(pollution))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'pollution_water',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * LAND VALUE OVERLAY
 * Based on: zone type, infrastructure proximity, development level
 * Green gradient: 0=worthless, 255=prime real estate
 */
export function generateLandValueOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Base: noise pattern
      let value = 80 + noise2D(x * 0.1, y * 0.1, 33) * 0.5;

      // Water reduces land value
      if (tile?.terrain_type === 'water') {
        value = 30;
      }

      // Commercial zones are valuable
      if (tile?.zone?.type?.includes('commercial')) {
        value += 80;
      }

      // Residential zones have decent value
      if (tile?.zone?.type?.includes('residential')) {
        value += 60;
      }

      // Development level increases value
      value += (tile?.zone?.development_level ?? 0) * 20;

      // Road access is essential for value
      if (tile?.road_access) {
        value += 40;
      }

      // Power + Water is a premium
      if (tile?.powered && tile?.watered) {
        value += 30;
      }

      row.push(Math.min(255, Math.max(0, Math.round(value))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'land_value',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * TRAFFIC OVERLAY
 * Based on: road density, proximity to commercial/industrial zones
 * Blue-Purple gradient: 0=empty, 255=gridlocked
 */
export function generateTrafficOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  // Pre-compute road network density for each tile
  const roadDensity: number[][] = [];
  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let density = 0;
      // 3x3 neighborhood road counting
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.infrastructure?.includes('road')) {
              density += 1;
            }
          }
        }
      }
      row.push(density);
    }
    roadDensity.push(row);
  }

  // Generate traffic values
  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Base: road density
      let traffic = (roadDensity[y]?.[x] || 0) * 20;

      // Commercial zones generate traffic
      if (tile?.zone?.type?.includes('commercial')) {
        traffic += 70;
      }

      // Dense zones generate more traffic
      if (tile?.zone?.type?.includes('dense')) {
        traffic += 40;
      }

      // Industrial zones generate heavy traffic
      if (tile?.zone?.type?.includes('industrial')) {
        traffic += 80;
      }

      // Highways carry traffic
      if (tile?.infrastructure?.includes('highway')) {
        traffic += 50;
      }

      // Population adds traffic
      if (tile?.zone?.population) {
        traffic += (tile.zone.population / 100) * 30;
      }

      row.push(Math.min(255, Math.max(0, Math.round(traffic))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'traffic',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * HEALTH COVERAGE OVERLAY (Future use for Group 8)
 * Based on: hospital proximity, population density
 * Green-Blue gradient: 0=no coverage, 255=excellent coverage
 */
export function generateHealthOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Base: use watered as proxy for health infrastructure
      let health = tile?.watered ? 160 : 40;

      // Hospital buildings provide coverage
      if (tile?.building?.type === 'hospital') {
        health = 255;
      }

      // Proximity to hospital (simple: radius check)
      let minDist = Infinity;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'hospital') {
              minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
            }
          }
        }
      }

      // Decrease coverage by distance
      if (minDist < Infinity) {
        health = Math.max(health, 200 - minDist * 20);
      }

      row.push(Math.min(255, Math.max(0, Math.round(health))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'health',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * EDUCATION COVERAGE OVERLAY (Future use for Group 8)
 * Based on: school proximity, funding percentage
 * Purple-Blue gradient: 0=no coverage, 255=excellent coverage
 */
export function generateEducationOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Base: powered as proxy for school infrastructure
      let education = tile?.powered ? 120 : 30;

      // School buildings provide coverage
      if (tile?.building?.type === 'school') {
        education = 240;
      }

      // University provides excellent coverage
      if (tile?.building?.type === 'university') {
        education = 255;
      }

      // Proximity to school
      let minDist = Infinity;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'school' || neighbor?.building?.type === 'university') {
              minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
            }
          }
        }
      }

      if (minDist < Infinity) {
        education = Math.max(education, 180 - minDist * 15);
      }

      row.push(Math.min(255, Math.max(0, Math.round(education))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'education',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * POWER COVERAGE OVERLAY (REACTIVE)
 * Based on: tile.powered state, proximity to power plants and power lines
 * Bright Yellow gradient: 0=no coverage, 255=excellent coverage
 */
export function generatePowerOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Check if tile is powered (reactive to current state)
      let power = tile?.powered ? 220 : 0;

      // Power plants provide full coverage
      if (tile?.building?.type?.includes('power')) {
        power = 255;
      }

      // Power lines provide corridor coverage
      if (tile?.infrastructure?.includes('power_line')) {
        power = Math.max(power, 200);
      }

      // Check proximity to power sources (8 tile radius)
      if (!tile?.powered) {
        for (let dy = -8; dy <= 8; dy++) {
          for (let dx = -8; dx <= 8; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
              const neighbor = tiles[ny]?.[nx];
              if (neighbor?.building?.type?.includes('power') || neighbor?.infrastructure?.includes('power_line')) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                const coverage = Math.max(0, 255 - distance * 20);
                power = Math.max(power, coverage);
              }
            }
          }
        }
      }

      row.push(Math.min(255, Math.max(0, power)));
    }
    data.push(row);
  }

  return {
    overlay_type: 'power',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * WATER COVERAGE OVERLAY (REACTIVE)
 * Based on: tile.watered state, proximity to water pipes and pumps
 * Bright Blue gradient: 0=no coverage, 255=excellent coverage
 */
export function generateWaterOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];

      // Check if tile is watered (reactive to current state)
      let water = tile?.watered ? 200 : 0;

      // Water pumps provide full coverage
      if (tile?.building?.type === 'water_pump') {
        water = 255;
      }

      // Water pipes provide corridor coverage
      if (tile?.infrastructure?.includes('water_pipe')) {
        water = Math.max(water, 180);
      }

      // Check proximity to water sources (6 tile radius)
      if (!tile?.watered) {
        for (let dy = -6; dy <= 6; dy++) {
          for (let dx = -6; dx <= 6; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
              const neighbor = tiles[ny]?.[nx];
              if (neighbor?.building?.type === 'water_pump' || neighbor?.infrastructure?.includes('water_pipe')) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                const coverage = Math.max(0, 255 - distance * 25);
                water = Math.max(water, coverage);
              }
            }
          }
        }
      }

      row.push(Math.min(255, Math.max(0, water)));
    }
    data.push(row);
  }

  return {
    overlay_type: 'water',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * FIRE COVERAGE OVERLAY
 * Based on: proximity to fire stations (18 tile radius)
 * Red gradient: 0=no coverage, 255=excellent coverage
 */
export function generateFireCoverageOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const FIRE_RADIUS = 18;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let coverage = 0;

      // Check proximity to fire stations
      for (let dy = -FIRE_RADIUS; dy <= FIRE_RADIUS; dy++) {
        for (let dx = -FIRE_RADIUS; dx <= FIRE_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'fire_station') {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= FIRE_RADIUS) {
                const value = 255 * (1 - distance / FIRE_RADIUS);
                coverage = Math.max(coverage, value);
              }
            }
          }
        }
      }

      row.push(Math.min(255, Math.max(0, Math.round(coverage))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'fire_coverage',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * POLICE COVERAGE OVERLAY
 * Based on: proximity to police stations (18 tile radius)
 * Blue gradient: 0=no coverage, 255=excellent coverage
 */
export function generatePoliceCoverageOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const POLICE_RADIUS = 18;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let coverage = 0;

      // Check proximity to police stations
      for (let dy = -POLICE_RADIUS; dy <= POLICE_RADIUS; dy++) {
        for (let dx = -POLICE_RADIUS; dx <= POLICE_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'police_station') {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= POLICE_RADIUS) {
                const value = 255 * (1 - distance / POLICE_RADIUS);
                coverage = Math.max(coverage, value);
              }
            }
          }
        }
      }

      row.push(Math.min(255, Math.max(0, Math.round(coverage))));
    }
    data.push(row);
  }

  return {
    overlay_type: 'police_coverage',
    data,
    min_value: Math.min(...data.flat()),
    max_value: Math.max(...data.flat())
  };
}

/**
 * Master function to generate any overlay type
 */
export async function getOverlayData(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number,
  type: string
): Promise<OverlayData> {
  switch (type) {
    case 'crime':
      return generateCrimeOverlay(tiles, mapWidth, mapHeight);
    case 'pollution_air':
      return generatePollutionAirOverlay(tiles, mapWidth, mapHeight);
    case 'pollution_water':
      return generatePollutionWaterOverlay(tiles, mapWidth, mapHeight);
    case 'land_value':
      return generateLandValueOverlay(tiles, mapWidth, mapHeight);
    case 'traffic':
      return generateTrafficOverlay(tiles, mapWidth, mapHeight);
    case 'power':
      return generatePowerOverlay(tiles, mapWidth, mapHeight);
    case 'water':
      return generateWaterOverlay(tiles, mapWidth, mapHeight);
    case 'fire_coverage':
      return generateFireCoverageOverlay(tiles, mapWidth, mapHeight);
    case 'police_coverage':
      return generatePoliceCoverageOverlay(tiles, mapWidth, mapHeight);
    case 'health':
      return generateHealthOverlay(tiles, mapWidth, mapHeight);
    case 'education':
      return generateEducationOverlay(tiles, mapWidth, mapHeight);
    default:
      throw new Error(`Unknown overlay type: ${type}`);
  }
}
