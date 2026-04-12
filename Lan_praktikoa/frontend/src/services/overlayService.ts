import type { OverlayData } from '../types/game';

/**
 * 🎯 FREQUENCY HEATMAP ENGINE
 * 
 * Core Principle: "Intensity = Max(0, 1 - (distance / Radius))"
 * 
 * This engine:
 * ✅ Uses DISTANCE DECAY for all intensity calculations
 * ✅ Supports ADDITIVE BLENDING when overlapping sources
 * ✅ Clamps final intensity at 1.0 (255)
 * ✅ Skips rendering tiles with intensity < 0.1 (KISS optimization)
 * 
 * For each overlay type, we calculate how much "influence" each source
 * (building, zone, infrastructure) exerts on each tile, decaying with distance.
 */

// ═══════════════════════════════════════════════════════════════════════════
// DISTANCE DECAY FORMULA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate intensity from a source using exponential distance decay
 * Formula: intensity = max(0, 1 - (distance / radius))
 */
function decayIntensity(distance: number, radius: number): number {
  if (distance >= radius) return 0;
  return Math.max(0, 1 - distance / radius);
}

/**
 * Accumulate intensities from multiple sources using additive blending
 * Final: clamp at 1.0 to prevent oversaturation
 */
function accumulateIntensity(current: number, source: number): number {
  return Math.min(1.0, current + source);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: Perlin-like noise for terrain-based variation
// ═══════════════════════════════════════════════════════════════════════════

function tileHash(x: number, y: number, salt: number): number {
  const h = (x * 73856093) ^ (y * 19349663) ^ (salt * 1103515245);
  return (h >>> 0) % 256;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

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

// ═══════════════════════════════════════════════════════════════════════════
// CRIME OVERLAY: Distance decay from police stations & industrial zones
// ═══════════════════════════════════════════════════════════════════════════

export function generateCrimeOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const POLICE_RADIUS = 18;
  const INDUSTRY_RADIUS = 8;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let intensity = 0;

      // Base terrain noise (~20% influence)
      intensity += noise2D(x * 0.15, y * 0.15, 42) * 0.2;

      // Industrial zones are crime sources (strong influence)
      for (let dy = -INDUSTRY_RADIUS; dy <= INDUSTRY_RADIUS; dy++) {
        for (let dx = -INDUSTRY_RADIUS; dx <= INDUSTRY_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.zone?.type?.includes('industrial')) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, INDUSTRY_RADIUS) * 0.7);
            }
          }
        }
      }

      // Population density contributes (additive)
      const tile = tiles[y]?.[x];
      if (tile?.zone?.population) {
        intensity = accumulateIntensity(intensity, Math.min(0.3, tile.zone.population / 1000));
      }

      // Police stations REDUCE crime (negative influence = cancellation)
      for (let dy = -POLICE_RADIUS; dy <= POLICE_RADIUS; dy++) {
        for (let dx = -POLICE_RADIUS; dx <= POLICE_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'police_station') {
              const dist = Math.sqrt(dx * dx + dy * dy);
              const coverage = decayIntensity(dist, POLICE_RADIUS);
              intensity *= (1 - coverage * 0.7); // Coverage reduces crime
            }
          }
        }
      }

      // Road access slightly reduces crime
      if (tile?.road_access) {
        intensity *= 0.9;
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// AIR POLLUTION OVERLAY: Industrial zones + power plants + roads
// ═══════════════════════════════════════════════════════════════════════════

export function generatePollutionAirOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const INDUSTRY_RADIUS = 8;
  const POWER_RADIUS = 10;
  const ROAD_RADIUS = 4;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let intensity = 0;

      // Background noise (low)
      intensity += noise2D(x * 0.1, y * 0.1, 88) * 0.05;

      const tile = tiles[y]?.[x];

      // Industrial zones are PRIMARY polluters
      for (let dy = -INDUSTRY_RADIUS; dy <= INDUSTRY_RADIUS; dy++) {
        for (let dx = -INDUSTRY_RADIUS; dx <= INDUSTRY_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.zone?.type?.includes('industrial')) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, INDUSTRY_RADIUS) * 0.8);
            }
          }
        }
      }

      // Power plants are SECONDARY sources
      for (let dy = -POWER_RADIUS; dy <= POWER_RADIUS; dy++) {
        for (let dx = -POWER_RADIUS; dx <= POWER_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            const isCoalOilGas = neighbor?.building?.type?.match(/(coal|oil|gas)_power/);
            if (isCoalOilGas) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, POWER_RADIUS) * 0.5);
            }
          }
        }
      }

      // Roads contribute local pollution
      if (tile?.infrastructure?.includes('road')) {
        intensity = accumulateIntensity(intensity, 0.15);
      }

      // Power lines add minor pollution
      if (tile?.infrastructure?.includes('power_line')) {
        intensity = accumulateIntensity(intensity, 0.08);
      }

      // Water REDUCES pollution (think: natural scrubbing)
      if (tile?.terrain_type === 'water') {
        intensity *= 0.4;
      }

      // Forest REDUCES pollution (natural filter)
      if (tile?.terrain_type === 'forest') {
        intensity *= 0.6;
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// WATER POLLUTION OVERLAY: Industrial runoff + water treatment
// ═══════════════════════════════════════════════════════════════════════════

export function generatePollutionWaterOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const INDUSTRY_RADIUS = 5;
  const TREATMENT_RADIUS = 6;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];
      let intensity = 0;

      // Only water tiles naturally have pollution
      const baseLevel = tile?.terrain_type === 'water' ? 0.2 : 0.05;
      intensity += baseLevel;

      // Industrial zones near water are MAJOR sources
      for (let dy = -INDUSTRY_RADIUS; dy <= INDUSTRY_RADIUS; dy++) {
        for (let dx = -INDUSTRY_RADIUS; dx <= INDUSTRY_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.zone?.type?.includes('industrial')) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, INDUSTRY_RADIUS) * 0.7);
            }
          }
        }
      }

      // Water treatment plants REDUCE pollution
      for (let dy = -TREATMENT_RADIUS; dy <= TREATMENT_RADIUS; dy++) {
        for (let dx = -TREATMENT_RADIUS; dx <= TREATMENT_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'water_treatment') {
              const dist = Math.sqrt(dx * dx + dy * dy);
              const treatmentPower = decayIntensity(dist, TREATMENT_RADIUS);
              intensity *= (1 - treatmentPower * 0.6); // Reduce pollution
            }
          }
        }
      }

      // Roads near water contribute runoff
      if (tile?.infrastructure?.includes('road')) {
        intensity = accumulateIntensity(intensity, 0.1);
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// POWER COVERAGE OVERLAY: Power plants + power lines
// ═══════════════════════════════════════════════════════════════════════════

export function generatePowerOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const GENERATION_RADIUS = 15;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let intensity = 0;

      const tile = tiles[y]?.[x];

      // Power plants are sources
      for (let dy = -GENERATION_RADIUS; dy <= GENERATION_RADIUS; dy++) {
        for (let dx = -GENERATION_RADIUS; dx <= GENERATION_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type?.match(/_power$/)) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, GENERATION_RADIUS) * 0.8);
            }
          }
        }
      }

      // Power lines carry electricity
      if (tile?.infrastructure?.includes('power_line')) {
        intensity = accumulateIntensity(intensity, 0.5);
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// WATER COVERAGE OVERLAY: Water pumps + water pipes
// ═══════════════════════════════════════════════════════════════════════════

export function generateWaterOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const PUMP_RADIUS = 12;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let intensity = 0;

      const tile = tiles[y]?.[x];

      // Water pumps are sources
      for (let dy = -PUMP_RADIUS; dy <= PUMP_RADIUS; dy++) {
        for (let dx = -PUMP_RADIUS; dx <= PUMP_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'water_pump') {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, PUMP_RADIUS) * 0.8);
            }
          }
        }
      }

      // Water pipes carry distribution
      if (tile?.infrastructure?.includes('water_pipe')) {
        intensity = accumulateIntensity(intensity, 0.5);
      }

      // Natural water bodies have coverage
      if (tile?.terrain_type === 'water') {
        intensity = accumulateIntensity(intensity, 0.9);
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// FIRE COVERAGE OVERLAY: Fire stations only
// ═══════════════════════════════════════════════════════════════════════════

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
      let intensity = 0;

      // Fire stations provide coverage
      for (let dy = -FIRE_RADIUS; dy <= FIRE_RADIUS; dy++) {
        for (let dx = -FIRE_RADIUS; dx <= FIRE_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'fire_station') {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, FIRE_RADIUS) * 0.9);
            }
          }
        }
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// POLICE COVERAGE OVERLAY: Police stations only
// ═══════════════════════════════════════════════════════════════════════════

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
      let intensity = 0;

      // Police stations provide coverage
      for (let dy = -POLICE_RADIUS; dy <= POLICE_RADIUS; dy++) {
        for (let dx = -POLICE_RADIUS; dx <= POLICE_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'police_station') {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, POLICE_RADIUS) * 0.9);
            }
          }
        }
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH COVERAGE OVERLAY: School-backed civic coverage fallback
// ═══════════════════════════════════════════════════════════════════════════

export function generateHealthOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const HEALTH_RADIUS = 8;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let intensity = 0;

      // In strict scope, schools are the only civic source available.
      for (let dy = -HEALTH_RADIUS; dy <= HEALTH_RADIUS; dy++) {
        for (let dx = -HEALTH_RADIUS; dx <= HEALTH_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.building?.type === 'school') {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, HEALTH_RADIUS));
            }
          }
        }
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// EDUCATION COVERAGE OVERLAY: Schools
// ═══════════════════════════════════════════════════════════════════════════

export function generateEducationOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const SCHOOL_RADIUS = 10;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let intensity = 0;

      // Schools provide coverage
      for (let dy = -SCHOOL_RADIUS; dy <= SCHOOL_RADIUS; dy++) {
        for (let dx = -SCHOOL_RADIUS; dx <= SCHOOL_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            const isSchool = neighbor?.building?.type === 'school';
            if (isSchool) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, SCHOOL_RADIUS));
            }
          }
        }
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED OVERLAY HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function getOverlayDataOptimized(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number,
  overlayType: string
): Promise<OverlayData> {
  // All overlays are async for consistency (even though they're synchronous)
  switch (overlayType) {
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
      return generateCrimeOverlay(tiles, mapWidth, mapHeight);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAND VALUE OVERLAY (Frequency-based)
// ═══════════════════════════════════════════════════════════════════════════

export function generateLandValueOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const ZONE_RADIUS = 7;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = tiles[y]?.[x];
      let intensity = 0.3; // Base value

      // Water has low value
      if (tile?.terrain_type === 'water') {
        intensity = 0.1;
      } else {
        // Commercial zones increase value
        for (let dy = -ZONE_RADIUS; dy <= ZONE_RADIUS; dy++) {
          for (let dx = -ZONE_RADIUS; dx <= ZONE_RADIUS; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
              const neighbor = tiles[ny]?.[nx];
              if (neighbor?.zone?.type?.includes('commercial')) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                intensity = accumulateIntensity(intensity, decayIntensity(dist, ZONE_RADIUS) * 0.6);
              }
            }
          }
        }

        // Residential zones also increase value
        for (let dy = -ZONE_RADIUS; dy <= ZONE_RADIUS; dy++) {
          for (let dx = -ZONE_RADIUS; dx <= ZONE_RADIUS; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
              const neighbor = tiles[ny]?.[nx];
              if (neighbor?.zone?.type?.includes('residential')) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                intensity = accumulateIntensity(intensity, decayIntensity(dist, ZONE_RADIUS) * 0.4);
              }
            }
          }
        }
      }

      // Development level adds value
      if (tile?.zone?.development_level) {
        intensity = accumulateIntensity(intensity, tile.zone.development_level * 0.1);
      }

      // Road access increases value
      if (tile?.road_access) {
        intensity = accumulateIntensity(intensity, 0.2);
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// TRAFFIC OVERLAY (Frequency-based)
// ═══════════════════════════════════════════════════════════════════════════

export function generateTrafficOverlay(
  tiles: any[][],
  mapWidth: number,
  mapHeight: number
): OverlayData {
  const data: number[][] = [];
  const ZONE_RADIUS = 6;

  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      let intensity = 0;

      const tile = tiles[y]?.[x];

      // Commercial zones generate traffic
      for (let dy = -ZONE_RADIUS; dy <= ZONE_RADIUS; dy++) {
        for (let dx = -ZONE_RADIUS; dx <= ZONE_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.zone?.type?.includes('commercial')) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, ZONE_RADIUS) * 0.7);
            }
          }
        }
      }

      // Industrial zones generate heavy traffic
      for (let dy = -ZONE_RADIUS; dy <= ZONE_RADIUS; dy++) {
        for (let dx = -ZONE_RADIUS; dx <= ZONE_RADIUS; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < mapHeight && nx >= 0 && nx < mapWidth) {
            const neighbor = tiles[ny]?.[nx];
            if (neighbor?.zone?.type?.includes('industrial')) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              intensity = accumulateIntensity(intensity, decayIntensity(dist, ZONE_RADIUS) * 0.8);
            }
          }
        }
      }

      // Road density adds traffic
      if (tile?.infrastructure?.includes('road') || tile?.infrastructure?.includes('highway')) {
        intensity = accumulateIntensity(intensity, 0.3);
      }

      row.push(Math.round(Math.min(255, Math.max(0, intensity * 255))));
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

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY ALIAS
// ═══════════════════════════════════════════════════════════════════════════
export const getOverlayData = getOverlayDataOptimized;
