import type { GameState, Tile, Zone } from '../../types/game';
import {
  ORDINANCE_RCI_MODIFIERS,
  ROAD_TYPES,
  SIMULATION_CONSTANTS
} from './constants';
import {
  hasServiceCoverage as utilityHasServiceCoverage,
  isPowerPlant,
  updateUtilityCoverage as utilityUpdateUtilityCoverage
} from './utilityGrid';

export type RCIValues = { r: number; c: number; i: number };

/**
 * Re-export utility/service coverage via the authoritative BFS module.
 *
 * Why: backend integration requires one canonical propagation algorithm so
 * frontend preview ticks and server simulation do not drift over time.
 */
export const hasServiceCoverage = utilityHasServiceCoverage;

/**
 * Re-export utility propagation via the authoritative BFS module.
 *
 * Why: a single source of truth keeps the USE_MOCK and live-backend modes
 * behaviorally aligned during integration testing.
 */
export const updateUtilityCoverage = utilityUpdateUtilityCoverage;

/**
 * Returns the monthly tick interval for the selected game speed.
 *
 * Why: a single source for tick cadence prevents hidden timing drift
 * between game loop services and store-managed simulation paths.
 */
export function getTickInterval(speed?: 'normal' | 'fast' | 'instant'): number {
  if (speed === 'instant') return SIMULATION_CONSTANTS.TICK_INTERVAL_INSTANT_MS;
  if (speed === 'fast') return SIMULATION_CONSTANTS.TICK_INTERVAL_FAST_MS;
  return SIMULATION_CONSTANTS.TICK_INTERVAL_NORMAL_MS;
}

/**
 * Applies the deterministic monthly simulation and returns a new immutable state.
 *
 * Why: extracting this into a pure function isolates domain rules from Svelte store
 * concerns, which makes backend parity testing and regression validation easier.
 */
export function applyMonthlySimulationSnapshot(current: GameState): GameState {
  const nextMonth =
    current.current_date.month === SIMULATION_CONSTANTS.MONTHS_PER_YEAR
      ? 1
      : current.current_date.month + 1;
  const nextYear =
    nextMonth === 1 ? current.current_date.year + 1 : current.current_date.year;

  const utilityTiles = updateUtilityCoverage(current.map.tiles);

  const envTiles = utilityTiles.map((row) =>
    row.map((tile) => {
      const industrialBoost = tile.zone?.type.startsWith('industrial')
        ? SIMULATION_CONSTANTS.POLLUTION_INDUSTRIAL_BOOST
        : 0;
      const powerBoost = isPowerPlant(tile.building?.type)
        ? SIMULATION_CONSTANTS.POLLUTION_POWER_BOOST
        : 0;
      const treeReduction = tile.tree
        ? SIMULATION_CONSTANTS.POLLUTION_TREE_REDUCTION
        : 0;
      const airPollution = clamp(
        tile.pollution_air + industrialBoost + powerBoost - treeReduction,
        SIMULATION_CONSTANTS.TILE_MIN,
        SIMULATION_CONSTANTS.TILE_MAX
      );

      const crimeBase = tile.zone
        ? zonePopulationForLevel(tile.zone.type, tile.zone.development_level) *
          SIMULATION_CONSTANTS.CRIME_ZONE_POPULATION_WEIGHT
        : SIMULATION_CONSTANTS.CRIME_BASE_NO_ZONE;
      const crime = clamp(
        Math.round(
          crimeBase +
            (tile.road_access
              ? SIMULATION_CONSTANTS.CRIME_ROAD_ACCESS_BONUS
              : SIMULATION_CONSTANTS.CRIME_NO_ROAD_PENALTY)
        ),
        SIMULATION_CONSTANTS.TILE_MIN,
        SIMULATION_CONSTANTS.TILE_MAX
      );

      const landValue = clamp(
        SIMULATION_CONSTANTS.LAND_VALUE_BASE +
          (tile.road_access
            ? SIMULATION_CONSTANTS.LAND_VALUE_ROAD_ACCESS_BONUS
            : SIMULATION_CONSTANTS.LAND_VALUE_NO_ROAD_PENALTY) +
          (tile.tree ? SIMULATION_CONSTANTS.LAND_VALUE_TREE_BONUS : 0) -
          Math.round(airPollution * SIMULATION_CONSTANTS.LAND_VALUE_POLLUTION_WEIGHT) -
          Math.round(crime * SIMULATION_CONSTANTS.LAND_VALUE_CRIME_WEIGHT),
        SIMULATION_CONSTANTS.TILE_MIN,
        SIMULATION_CONSTANTS.TILE_MAX
      );

      return {
        ...tile,
        pollution_air: airPollution,
        crime,
        land_value: landValue
      };
    })
  );

  const residentialPopulation = envTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('residential') && !tile.zone.abandoned)
    .reduce(
      (sum, tile) => sum + zonePopulationForLevel(tile.zone!.type, tile.zone!.development_level),
      0
    );

  const demand = computeRCIDemandValues(current, residentialPopulation);

  const updatedTiles = envTiles.map((row, y) =>
    row.map((tile, x) => {
      if (!tile.zone) return tile;

      const serviceCoverage = hasServiceCoverage(envTiles, x, y);
      const nextLevel = growthLevelForTile(tile, demand, serviceCoverage);

      let abandoned = tile.zone.abandoned;
      if (
        !tile.powered &&
        Math.random() < SIMULATION_CONSTANTS.ABANDONMENT_NO_POWER_PROBABILITY
      ) {
        abandoned = true;
      }
      if (
        tile.crime > SIMULATION_CONSTANTS.ABANDONMENT_CRIME_THRESHOLD &&
        Math.random() < SIMULATION_CONSTANTS.ABANDONMENT_HIGH_CRIME_PROBABILITY
      ) {
        abandoned = true;
      }
      if (
        tile.zone.type.startsWith('residential') &&
        tile.pollution_air > SIMULATION_CONSTANTS.ABANDONMENT_POLLUTION_THRESHOLD &&
        Math.random() <
          SIMULATION_CONSTANTS.ABANDONMENT_RESIDENTIAL_HIGH_POLLUTION_PROBABILITY
      ) {
        abandoned = true;
      }
      if (
        (current.player_city.budget.tax_rates.residential ?? 7) >
          SIMULATION_CONSTANTS.HIGH_TAX_THRESHOLD &&
        Math.random() < SIMULATION_CONSTANTS.ABANDONMENT_HIGH_TAX_PROBABILITY
      ) {
        abandoned = true;
      }

      const zonePopulation = abandoned
        ? 0
        : zonePopulationForLevel(tile.zone.type, nextLevel);

      return {
        ...tile,
        zone: {
          ...tile.zone,
          powered: tile.powered,
          watered: tile.watered,
          road_access: tile.road_access,
          development_level: nextLevel,
          abandoned,
          population: zonePopulation
        }
      };
    })
  );

  const activeResidentialPopulation = updatedTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('residential') && !tile.zone.abandoned)
    .reduce((sum, tile) => sum + (tile.zone?.population ?? 0), 0);

  const activeCommercialUnits = updatedTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('commercial') && !tile.zone.abandoned)
    .length;

  const activeIndustrialUnits = updatedTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('industrial') && !tile.zone.abandoned)
    .length;

  const taxRates = current.player_city.budget.tax_rates;
  const landValueFactor = Math.max(
    SIMULATION_CONSTANTS.LAND_VALUE_FACTOR_MIN,
    current.player_city.metrics.land_value_avg / 128
  );
  const monthlyIncome = Math.round(
    activeResidentialPopulation * taxRates.residential * 0.01 * landValueFactor +
      activeCommercialUnits * taxRates.commercial * 0.2 * landValueFactor +
      activeIndustrialUnits * taxRates.industrial * 0.15 * landValueFactor
  );

  const funding = current.player_city.budget.funding;
  const monthlyExpense = Math.round(
    (current.player_city.infrastructure.roads.length * 0.1 +
      current.player_city.infrastructure.rail.length * 0.2) *
      (funding.transportation / 100) +
      current.player_city.buildings.filter((building) => building.type === 'police_station')
        .length *
        2.5 *
        (funding.police / 100) +
      current.player_city.buildings.filter((building) => building.type === 'fire_station')
        .length *
        2.5 *
        (funding.fire / 100) +
      current.player_city.buildings.filter((building) => building.type === 'hospital').length *
        3.0 *
        (funding.health / 100)
  );

  const monthlyBalance = monthlyIncome - monthlyExpense;
  const newTreasury = current.player_city.treasury + monthlyBalance;

  const monthsBankrupt =
    newTreasury < SIMULATION_CONSTANTS.BANKRUPTCY_TREASURY_THRESHOLD
      ? current.player_city.months_bankrupt + 1
      : 0;
  const victoryStatus =
    monthsBankrupt >= SIMULATION_CONSTANTS.BANKRUPTCY_MONTHS_TO_DEFEAT
      ? 'player_bankrupt'
      : current.victory_status;

  const flattenedTiles = updatedTiles.flat();
  const tileCount = Math.max(1, flattenedTiles.length);

  const avgCrime = Math.round(
    flattenedTiles.reduce((sum, tile) => sum + tile.crime, 0) / tileCount
  );
  const avgPollution = Math.round(
    flattenedTiles.reduce((sum, tile) => sum + tile.pollution_air, 0) / tileCount
  );
  const avgLand = Math.round(
    flattenedTiles.reduce((sum, tile) => sum + tile.land_value, 0) / tileCount
  );

  return {
    ...current,
    victory_status: victoryStatus,
    current_date: { year: nextYear, month: nextMonth },
    player_city: {
      ...current.player_city,
      treasury: newTreasury,
      population: activeResidentialPopulation,
      months_bankrupt: monthsBankrupt,
      budget: {
        ...current.player_city.budget,
        monthly_income: monthlyIncome,
        monthly_expenses: monthlyExpense
      },
      metrics: {
        ...current.player_city.metrics,
        crime_rate: avgCrime,
        pollution_air: avgPollution,
        land_value_avg: avgLand,
        rci_demand: demand
      }
    },
    map: {
      ...current.map,
      tiles: updatedTiles
    }
  };
}

/**
 * Applies only growth-level updates without month progression or economy update.
 *
 * Why: this powers lightweight visual auto-growth ticks used by the UI game loop.
 */
export function applyAutoGrowthSnapshot(current: GameState): GameState {
  const demand = current.player_city.metrics.rci_demand;

  const updatedTiles = current.map.tiles.map((row) =>
    row.map((tile, x) => {
      if (!tile.zone) return tile;

      const nextLevel = growthLevelForTile(
        tile,
        demand,
        hasServiceCoverage(current.map.tiles, x, tile.y)
      );

      return {
        ...tile,
        zone: {
          ...tile.zone,
          development_level: nextLevel,
          population: tile.zone.abandoned
            ? 0
            : zonePopulationForLevel(tile.zone.type, nextLevel)
        }
      };
    })
  );

  return {
    ...current,
    map: {
      ...current.map,
      tiles: updatedTiles
    }
  };
}

/**
 * Calculates RCI demand based on city state and active ordinances.
 *
 * Why: exposing this function allows targeted tests around SPECS section 3.2
 * without having to execute the full monthly simulation.
 */
export function computeRCIDemandValues(
  state: GameState,
  residentialPopulation: number
): RCIValues {
  const tiles = state.map.tiles;
  const tax = state.player_city.budget.tax_rates;
  const ordinances = state.player_city.ordinances;

  let commercialJobs = 0;
  let industrialJobs = 0;
  let serviceCoverageTiles = 0;
  let zoneTiles = 0;
  let transportAccessTiles = 0;
  let airportBonus = 0;
  let seaportBonus = 0;
  let railBonus = 0;

  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      const tile = tiles[y][x];
      if (tile.zone && !tile.zone.abandoned) {
        zoneTiles += 1;
        if (tile.zone.type.startsWith('commercial')) {
          commercialJobs += zonePopulationForLevel(
            tile.zone.type,
            tile.zone.development_level
          );
        }
        if (tile.zone.type.startsWith('industrial')) {
          industrialJobs += zonePopulationForLevel(
            tile.zone.type,
            tile.zone.development_level
          );
        }
      }

      if (hasServiceCoverage(tiles, x, y)) serviceCoverageTiles += 1;
      if (
        tile.infrastructure.some((infraType) => ROAD_TYPES.has(infraType)) ||
        tile.infrastructure.includes('rail')
      ) {
        transportAccessTiles += 1;
      }

      if (tile.building?.type === 'airport') airportBonus = SIMULATION_CONSTANTS.RCI_AIRPORT_BONUS;
      if (tile.building?.type === 'seaport') seaportBonus = SIMULATION_CONSTANTS.RCI_SEAPORT_BONUS;
      if (tile.infrastructure.includes('rail') || tile.building?.type === 'rail_station') {
        railBonus = SIMULATION_CONSTANTS.RCI_RAIL_BONUS;
      }
    }
  }

  const serviceCoverageBonus =
    zoneTiles > 0
      ? Math.min(
          SIMULATION_CONSTANTS.RCI_MAX_SERVICE_BONUS,
          (serviceCoverageTiles / zoneTiles) * SIMULATION_CONSTANTS.RCI_MAX_SERVICE_BONUS
        )
      : 0;

  const transportAccessBonus =
    zoneTiles > 0
      ? Math.min(
          SIMULATION_CONSTANTS.RCI_MAX_TRANSPORT_BONUS,
          (transportAccessTiles / zoneTiles) * SIMULATION_CONSTANTS.RCI_MAX_TRANSPORT_BONUS
        )
      : 0;

  const crimeRate = state.player_city.metrics.crime_rate;
  const pollutionAir = state.player_city.metrics.pollution_air;
  const eq = state.player_city.metrics.eq;

  let r =
    SIMULATION_CONSTANTS.RCI_BASE_DEMAND +
    (commercialJobs + industrialJobs - residentialPopulation) *
      SIMULATION_CONSTANTS.RCI_EMPLOYMENT_BALANCE_WEIGHT +
    serviceCoverageBonus -
    tax.residential * SIMULATION_CONSTANTS.RCI_TAX_PENALTY_WEIGHT -
    crimeRate * SIMULATION_CONSTANTS.RCI_CRIME_PENALTY_WEIGHT;

  let c =
    SIMULATION_CONSTANTS.RCI_BASE_DEMAND +
    residentialPopulation * SIMULATION_CONSTANTS.RCI_RESIDENTIAL_CUSTOMER_WEIGHT +
    eq * SIMULATION_CONSTANTS.RCI_EQ_WEIGHT +
    airportBonus +
    transportAccessBonus -
    tax.commercial * SIMULATION_CONSTANTS.RCI_TAX_PENALTY_WEIGHT;

  let i =
    SIMULATION_CONSTANTS.RCI_BASE_DEMAND +
    residentialPopulation * SIMULATION_CONSTANTS.RCI_INDUSTRIAL_WORKFORCE_WEIGHT +
    seaportBonus +
    railBonus -
    tax.industrial * SIMULATION_CONSTANTS.RCI_TAX_PENALTY_WEIGHT -
    pollutionAir * SIMULATION_CONSTANTS.RCI_POLLUTION_PENALTY_WEIGHT;

  for (const ordinanceId of ordinances) {
    const modifier = ORDINANCE_RCI_MODIFIERS[
      ordinanceId as keyof typeof ORDINANCE_RCI_MODIFIERS
    ] as Partial<RCIValues> | undefined;
    if (!modifier) continue;
    r += modifier.r ?? 0;
    c += modifier.c ?? 0;
    i += modifier.i ?? 0;
  }

  return {
    r: clampDemand(r),
    c: clampDemand(c),
    i: clampDemand(i)
  };
}

/**
 * Computes next zone growth level under current tile conditions.
 *
 * Why: growth decisions are a core game mechanic and must be reused consistently
 * by both monthly simulation and lightweight UI-side growth previews.
 */
export function growthLevelForTile(
  tile: Tile,
  demand: RCIValues,
  serviceCoverage: boolean
): number {
  if (!tile.zone) return 0;

  const currentLevel = tile.zone.development_level;
  const zoneType = tile.zone.type;
  const hasPositiveDemand =
    (zoneType.startsWith('residential') && demand.r > 0) ||
    (zoneType.startsWith('commercial') && demand.c > 0) ||
    (zoneType.startsWith('industrial') && demand.i > 0);

  let nextLevel = 0;
  if (tile.powered && tile.road_access) nextLevel = 1;
  if (nextLevel >= 1 && tile.watered && hasPositiveDemand) nextLevel = 2;

  if (
    zoneIsDense(zoneType) &&
    nextLevel >= 2 &&
    serviceCoverage &&
    tile.crime < SIMULATION_CONSTANTS.ABANDONMENT_CRIME_THRESHOLD &&
    tile.pollution_air < SIMULATION_CONSTANTS.ABANDONMENT_POLLUTION_THRESHOLD &&
    tile.land_value >= SIMULATION_CONSTANTS.DENSE_LEVEL3_LAND_VALUE_MIN
  ) {
    nextLevel = 3;
  }

  return Math.max(currentLevel, nextLevel);
}

/**
 * Returns zone population for a zone type/development level pair.
 *
 * Why: this function is the canonical mapping for population capacity and is
 * shared by demand, economy, and abandonment calculations.
 */
export function zonePopulationForLevel(
  type: Zone['type'],
  level: number
): number {
  const normalizedLevel = clamp(level, 0, 3);

  if (type.startsWith('residential')) {
    return type.includes('dense')
      ? normalizedLevel * SIMULATION_CONSTANTS.RESIDENTIAL_DENSE_LEVEL_POP
      : normalizedLevel * SIMULATION_CONSTANTS.RESIDENTIAL_LIGHT_LEVEL_POP;
  }

  if (type.startsWith('commercial')) {
    return type.includes('dense')
      ? normalizedLevel * SIMULATION_CONSTANTS.COMMERCIAL_DENSE_LEVEL_POP
      : normalizedLevel * SIMULATION_CONSTANTS.COMMERCIAL_LIGHT_LEVEL_POP;
  }

  return type.includes('dense')
    ? normalizedLevel * SIMULATION_CONSTANTS.INDUSTRIAL_DENSE_LEVEL_POP
    : normalizedLevel * SIMULATION_CONSTANTS.INDUSTRIAL_LIGHT_LEVEL_POP;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampDemand(value: number): number {
  return clamp(
    Math.round(value),
    SIMULATION_CONSTANTS.DEMAND_MIN,
    SIMULATION_CONSTANTS.DEMAND_MAX
  );
}

function zoneIsDense(type: Zone['type']): boolean {
  return type.endsWith('_dense');
}
