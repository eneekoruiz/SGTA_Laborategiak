import type {
  EducationResponse,
  GameState,
  HealthResponse,
  InfrastructureType,
  StatsResponse,
  Tile,
  Zone
} from '../../types/game';
import { computeRCIDemandValues, growthLevelForTile, updateUtilityCoverage, zonePopulationForLevel as simulationZonePopulationForLevel, hasServiceCoverage as simulationHasServiceCoverage } from '../../lib/simulation/core';

interface MockUser {
  id: string;
  username: string;
  email: string;
}

interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  difficulty_options: string[];
  map_size: { width: number; height: number };
}

interface GameListItem {
  id: string;
  name: string;
  scenario_id: string;
  current_date: { year: number; month: number };
  player_city_name: string;
  player_population: number;
  ai_city_name: string;
  ai_population: number;
  victory_status: string;
  last_saved: string;
  is_autosave: boolean;
}

const MAP_WIDTH = 64;
const MAP_HEIGHT = 64;

const ZONE_COST: Record<string, number> = {
  residential_light: 5,
  residential_dense: 10,
  commercial_light: 5,
  commercial_dense: 10,
  industrial_light: 5,
  industrial_dense: 10
};

const INFRA_COST: Record<string, number> = {
  road: 10,
  highway: 25,
  highway_ramp: 25,
  power_line: 2,
  rail: 3,
  water_pipe: 1,
  subway_tunnel: 5,
  subway: 5
};

const BUILDING_COST: Record<string, number> = {
  coal_power: 4000,
  hydro_power: 400,
  oil_power: 6500,
  gas_power: 2000,
  nuclear_power: 15000,
  wind_power: 100,
  solar_power: 1300,
  microwave_power: 28000,
  fusion_power: 40000,
  police_station: 500,
  fire_station: 500,
  hospital: 500,
  prison: 3000,
  school: 250,
  college: 1000,
  library: 500,
  museum: 1000,
  bus_depot: 250,
  rail_station: 500,
  subway_station: 500,
  airport: 10000,
  seaport: 5000,
  water_pump: 100,
  water_treatment: 500
};

const POWER_CAPACITY_MW: Record<string, number> = {
  coal_power: 200,
  hydro_power: 20,
  oil_power: 220,
  gas_power: 50,
  nuclear_power: 500,
  wind_power: 4,
  solar_power: 50,
  microwave_power: 1600,
  fusion_power: 2500
};

const ROAD_INFRA_TYPES = new Set(['road', 'highway', 'highway_ramp']);

type OrdinanceEffect = {
  crimeMultiplier?: number;
  pollutionMultiplier?: number;
  healthBonus?: number;
  educationBonus?: number;
  r?: number;
  c?: number;
  i?: number;
};

const ORDINANCE_EFFECTS: Record<string, OrdinanceEffect> = {
  sales_tax: { c: -10 },
  income_tax: { r: -10 },
  legalized_gambling: { crimeMultiplier: 1.1 },
  parking_fines: {},
  free_clinics: { healthBonus: 5 },
  junior_sports: { crimeMultiplier: 0.95 },
  pro_reading: { educationBonus: 5 },
  anti_drug: { crimeMultiplier: 0.95 },
  pollution_controls: { pollutionMultiplier: 0.85, i: -5 },
  tourist_promotion: { c: 10 },
  neighborhood_watch: { crimeMultiplier: 0.97 },
  cpr_training: { healthBonus: 2 },
  smoking_ban: { healthBonus: 3 },
  homeless_shelters: { crimeMultiplier: 0.97, r: 4 },
  water_conservation: {},
  energy_conservation: {},
  business_incentives: { c: 15, i: 15 },
  clean_air_act: { pollutionMultiplier: 0.9 },
  volunteer_fire: {}
};

let pendingDisasterImpact: {
  target: 'player' | 'ai';
  populationLoss: number;
  treasuryLoss: number;
} | null = null;

// Tracks consecutive no-power months for level-1 zones.
const zoneNoPowerMonths = new Map<string, number>();

/**
 * Canonical mock simulation engine alias.
 *
 * Why: the API bridge should be able to point at a named provider without
 * changing the surrounding component/store code.
 */
export const MockSimulationEngine = {
  computeRCIDemandValues,
  growthLevelForTile,
  hasServiceCoverage: simulationHasServiceCoverage,
  updateUtilityCoverage,
  zonePopulationForLevel: simulationZonePopulationForLevel
} as const;

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function zoneIsDense(type: string): boolean {
  return type.endsWith('_dense');
}

function zonePopulationForLevel(type: string, level: number): number {
  const lv = Math.max(0, Math.min(3, level));
  if (type.startsWith('residential')) return type.includes('dense') ? lv * 200 : lv * 50;
  if (type.startsWith('commercial')) return type.includes('dense') ? lv * 140 : lv * 45;
  return type.includes('dense') ? lv * 160 : lv * 50;
}

function inBounds(tilesGrid: Tile[][], x: number, y: number): boolean {
  return y >= 0 && y < tilesGrid.length && x >= 0 && x < (tilesGrid[0]?.length ?? 0);
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
 * Delegates utility propagation to the canonical simulation BFS implementation.
 *
 * Why: keeping mock mode and backend-ready simulation on the same graph logic
 * eliminates drift between development and integration environments.
 */
function applyUtilityBFS(tilesGrid: Tile[][]): Tile[][] {
  return updateUtilityCoverage(tilesGrid);
}

function recomputeZoneCollections(state: GameState): void {
  state.player_city.zones = state.map.tiles.flat().map((tile) => tile.zone).filter((zone): zone is Zone => zone !== null);
  state.player_city.buildings = state.map.tiles.flat().map((tile) => tile.building).filter((building): building is NonNullable<Tile['building']> => building !== null);
}

function recomputePlayerStats(state: GameState): StatsResponse {
  const player = state.player_city;
  const ai = state.ai_city;
  return {
    player: {
      population: player.population,
      treasury: player.treasury,
      composite_score: player.metrics.composite_score,
      eq: player.metrics.eq,
      hq: player.metrics.hq,
      crime_rate: player.metrics.crime_rate,
      pollution: Math.round((player.metrics.pollution_air + player.metrics.pollution_water) / 2),
      approval: player.metrics.approval,
      rci_demand: { ...player.metrics.rci_demand },
      power_coverage: player.power_grid.coverage_pct,
      water_coverage: player.water_system.coverage_pct
    },
    ai: {
      population: ai.population,
      treasury: ai.treasury,
      composite_score: ai.metrics.composite_score,
      approval: ai.metrics.approval
    },
    comparison: {
      population_diff: player.population - ai.population,
      score_diff: player.metrics.composite_score - ai.metrics.composite_score,
      months_to_victory: null
    }
  };
}

function getDemolitionBaseCost(tile: Tile | null, type: string): number {
  if (!tile) return 0;
  if (type === 'building') {
    return BUILDING_COST[tile.building?.type ?? ''] ?? 0;
  }
  if (type === 'zone') {
    return ZONE_COST[tile.zone?.type ?? ''] ?? 0;
  }

  if (tile.infrastructure.length > 0) {
    return tile.infrastructure.reduce((sum, infra) => sum + (INFRA_COST[infra] ?? 0), 0);
  }

  return 0;
}

function getOrdinanceRollup(ordinances: string[]): {
  crimeMultiplier: number;
  pollutionMultiplier: number;
  healthBonus: number;
  educationBonus: number;
  r: number;
  c: number;
  i: number;
} {
  let crimeMultiplier = 1;
  let pollutionMultiplier = 1;
  let healthBonus = 0;
  let educationBonus = 0;
  let r = 0;
  let c = 0;
  let i = 0;

  for (const id of ordinances) {
    const effect = ORDINANCE_EFFECTS[id];
    if (!effect) continue;
    if (effect.crimeMultiplier !== undefined) crimeMultiplier *= effect.crimeMultiplier;
    if (effect.pollutionMultiplier !== undefined) pollutionMultiplier *= effect.pollutionMultiplier;
    healthBonus += effect.healthBonus ?? 0;
    educationBonus += effect.educationBonus ?? 0;
    r += effect.r ?? 0;
    c += effect.c ?? 0;
    i += effect.i ?? 0;
  }

  return { crimeMultiplier, pollutionMultiplier, healthBonus, educationBonus, r, c, i };
}

function applyDisasterRuinsToPlayer(
  disasterType: 'fire' | 'flood' | 'tornado' | 'earthquake'
): {
  buildingsDamaged: number;
  zonesDamaged: number;
  infrastructureDamaged: number;
  populationLoss: number;
  treasuryLoss: number;
  estimatedRepairCost: number;
} {
  const impactScale = {
    fire: { min: 3, max: 8, pop: 120, treasury: 700 },
    flood: { min: 5, max: 12, pop: 180, treasury: 1200 },
    tornado: { min: 6, max: 14, pop: 260, treasury: 2200 },
    earthquake: { min: 10, max: 20, pop: 420, treasury: 4800 }
  }[disasterType];

  const candidates: Array<{ x: number; y: number; tile: Tile }> = [];
  for (let y = 0; y < mockGameState.map.tiles.length; y += 1) {
    for (let x = 0; x < mockGameState.map.tiles[y].length; x += 1) {
      const tile = mockGameState.map.tiles[y][x];
      if (tile.building || tile.zone || tile.infrastructure.length > 0) {
        candidates.push({ x, y, tile });
      }
    }
  }

  const picks = Math.min(
    candidates.length,
    impactScale.min + Math.floor(Math.random() * Math.max(1, impactScale.max - impactScale.min + 1))
  );

  let buildingsDamaged = 0;
  let zonesDamaged = 0;
  let infrastructureDamaged = 0;
  let populationLoss = 0;
  let estimatedRepairCost = 0;

  for (let i = 0; i < picks; i += 1) {
    const idx = Math.floor(Math.random() * candidates.length);
    const hit = candidates.splice(idx, 1)[0];
    if (!hit) continue;
    const tile = hit.tile;

    if (tile.building && tile.building.type !== 'ruin') {
      const original = tile.building.type;
      estimatedRepairCost += Math.round((BUILDING_COST[original] ?? 500) * 0.5);
      tile.building = {
        ...tile.building,
        id: `ruin-${hit.x}-${hit.y}-${Date.now()}-${i}`,
        type: 'ruin',
        age_months: 0,
        powered: false,
        funding_pct: 0,
        active: false
      };
      buildingsDamaged += 1;
    }

    if (tile.zone && !tile.zone.abandoned) {
      populationLoss += Math.round((tile.zone.population ?? 0) * 0.35 + impactScale.pop * 0.2);
      tile.zone = {
        ...tile.zone,
        abandoned: true,
        powered: false,
        watered: false,
        population: 0
      };
      zonesDamaged += 1;
    }

    if (tile.infrastructure.length > 0) {
      const infraCount = tile.infrastructure.length;
      infrastructureDamaged += infraCount;
      tile.infrastructure = [];
      estimatedRepairCost += infraCount * 20;
      tile.road_access = false;
      tile.powered = false;
      tile.watered = false;
    }
  }

  const treasuryLoss = Math.round(impactScale.treasury + estimatedRepairCost * 0.2);
  return {
    buildingsDamaged,
    zonesDamaged,
    infrastructureDamaged,
    populationLoss,
    treasuryLoss,
    estimatedRepairCost
  };
}

function applyAICityMonthlySimulation(state: GameState): {
  populationChange: number;
  treasuryChange: number;
} {
  const popBefore = state.ai_city.population;
  const treasuryBefore = state.ai_city.treasury;

  const simulationState = cloneGameState(state);
  simulationState.player_city = JSON.parse(JSON.stringify(state.ai_city)) as GameState['player_city'];
  simulationState.map.tiles = JSON.parse(JSON.stringify(state.map.tiles)) as GameState['map']['tiles'];

  applyMonthlySimulationToPlayer(simulationState);

  state.ai_city = {
    ...state.ai_city,
    ...simulationState.player_city
  };

  if (pendingDisasterImpact?.target === 'ai') {
    state.ai_city.population = Math.max(0, state.ai_city.population - pendingDisasterImpact.populationLoss);
    state.ai_city.treasury -= pendingDisasterImpact.treasuryLoss;
  }

  state.ai_city.months_bankrupt = state.ai_city.treasury < -100000 ? state.ai_city.months_bankrupt + 1 : 0;

  return {
    populationChange: state.ai_city.population - popBefore,
    treasuryChange: state.ai_city.treasury - treasuryBefore
  };
}

function applyMonthlySimulationToPlayer(state: GameState): {
  populationChange: number;
  treasuryChange: number;
  zonesDeveloped: number;
  zonesAbandoned: number;
  newPowerCapacity: number;
} {
  const city = state.player_city;
  const ordinanceRollup = getOrdinanceRollup(city.ordinances);
  const tilesGrid = applyUtilityBFS(state.map.tiles);

  let zonesDeveloped = 0;
  let zonesAbandoned = 0;

  const pollutionAndCrimeTiles = tilesGrid.map((row) =>
    row.map((tile) => {
      const industrialSource = tile.zone?.type.startsWith('industrial') ? 24 : 0;
      const powerSource = tile.building?.type && POWER_CAPACITY_MW[tile.building.type] ? 16 : 0;
      const treeReduction = tile.tree ? 8 : 0;
      const pollutionAir = clampInt((tile.pollution_air + industrialSource + powerSource - treeReduction) * ordinanceRollup.pollutionMultiplier, 0, 255);

      const crimeBase = tile.zone ? zonePopulationForLevel(tile.zone.type, tile.zone.development_level) * 0.03 : 2;
      const policeBonus = simulationHasServiceCoverage(tilesGrid, tile.x, tile.y) ? 8 : 0;
      const crime = clampInt((crimeBase - policeBonus + (tile.road_access ? -2 : 2)) * ordinanceRollup.crimeMultiplier, 0, 255);

      const landValue = clampInt(130 + (tile.tree ? 8 : 0) + (tile.road_access ? 10 : -5) - pollutionAir * 0.18 - crime * 0.14, 0, 255);

      return {
        ...tile,
        pollution_air: pollutionAir,
        crime,
        land_value: landValue
      };
    })
  );

  const tax = city.budget.tax_rates;

  const provisionalResidentialPop = pollutionAndCrimeTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('residential') && !tile.zone.abandoned)
    .reduce((sum, tile) => sum + zonePopulationForLevel(tile.zone!.type, tile.zone!.development_level), 0);

  const commercialJobs = pollutionAndCrimeTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('commercial') && !tile.zone.abandoned)
    .reduce((sum, tile) => sum + zonePopulationForLevel(tile.zone!.type, tile.zone!.development_level), 0);

  const industrialJobs = pollutionAndCrimeTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('industrial') && !tile.zone.abandoned)
    .reduce((sum, tile) => sum + zonePopulationForLevel(tile.zone!.type, tile.zone!.development_level), 0);

  const zoneCount = Math.max(1, pollutionAndCrimeTiles.flat().filter((tile) => tile.zone).length);
  const serviceBonus = Math.min(
    30,
    (pollutionAndCrimeTiles.flat().filter((tile) => simulationHasServiceCoverage(pollutionAndCrimeTiles, tile.x, tile.y)).length / zoneCount) * 30
  );
  const transportBonus = Math.min(
    20,
    (pollutionAndCrimeTiles.flat().filter((tile) => tile.infrastructure.includes('rail') || tile.infrastructure.some((i) => ROAD_INFRA_TYPES.has(i))).length / zoneCount) * 20
  );
  const airportBonus = pollutionAndCrimeTiles.flat().some((tile) => tile.building?.type === 'airport') ? 50 : 0;
  const seaportBonus = pollutionAndCrimeTiles.flat().some((tile) => tile.building?.type === 'seaport') ? 40 : 0;
  const railBonus = pollutionAndCrimeTiles.flat().some((tile) => tile.infrastructure.includes('rail') || tile.building?.type === 'rail_station') ? 20 : 0;

  let rDemand =
    10 +
    (commercialJobs + industrialJobs - provisionalResidentialPop) * 0.3 +
    serviceBonus -
    tax.residential * 5 -
    city.metrics.crime_rate * 0.3;
  let cDemand = 10 + provisionalResidentialPop * 0.1 + city.metrics.eq * 0.2 + airportBonus + transportBonus - tax.commercial * 5;
  let iDemand = 10 + provisionalResidentialPop * 0.05 + seaportBonus + railBonus - tax.industrial * 5 - city.metrics.pollution_air * 0.1;

  rDemand += ordinanceRollup.r;
  cDemand += ordinanceRollup.c;
  iDemand += ordinanceRollup.i;

  const demand = {
    r: clampInt(rDemand, -200, 200),
    c: clampInt(cDemand, -200, 200),
    i: clampInt(iDemand, -200, 200)
  };

  const grownTiles = pollutionAndCrimeTiles.map((row, y) =>
    row.map((tile, x) => {
      if (!tile.zone) return tile;
      const zoneType = tile.zone.type;
      const prevLevel = tile.zone.development_level;
      const zonePowerKey = tile.zone.id || `${x},${y}`;

      const industrialGrowthPenalty = city.ordinances.includes('pollution_controls') && zoneType.startsWith('industrial') ? 25 : 0;

      const positiveDemand =
        (zoneType.startsWith('residential') && demand.r > 0) ||
        (zoneType.startsWith('commercial') && demand.c > 0) ||
        (zoneType.startsWith('industrial') && demand.i > industrialGrowthPenalty);

      let nextLevel = prevLevel;
      const canGrow = tile.powered && tile.road_access;

      // TASK 1: Autonomous growth at level 0 with 20% random chance
      if (prevLevel === 0 && canGrow && Math.random() < 0.2) {
        nextLevel = 1;
      }

      // Upgrades for already-developed zones.
      if (prevLevel >= 1 && canGrow) {
        if (tile.watered && positiveDemand && Math.random() < 0.45) {
          nextLevel = Math.max(nextLevel, 2);
        }
        if (
          zoneIsDense(zoneType) &&
          nextLevel >= 2 &&
          simulationHasServiceCoverage(pollutionAndCrimeTiles, x, y) &&
          tile.crime < 80 &&
          tile.pollution_air < 80 &&
          tile.land_value >= 140 &&
          Math.random() < 0.3
        ) {
          nextLevel = 3;
        }
      }

      if (nextLevel > prevLevel) zonesDeveloped += 1;

      let abandoned = tile.zone.abandoned;

      // TASK 1: Decay rule - level 1 with no power for more than 2 months becomes abandoned.
      let noPowerMonths = zoneNoPowerMonths.get(zonePowerKey) ?? 0;
      if (prevLevel === 1 && !tile.powered) {
        noPowerMonths += 1;
      } else {
        noPowerMonths = 0;
      }
      zoneNoPowerMonths.set(zonePowerKey, noPowerMonths);

      if (prevLevel === 1 && noPowerMonths > 2) {
        abandoned = true;
      }

      // TASK 1: Recovery rule - abandoned zone with power recovers.
      if (abandoned && tile.powered) {
        abandoned = false;
        zoneNoPowerMonths.set(zonePowerKey, 0);
      }

      let nextBuilding = tile.building;
      if (abandoned) {
        const decayedToRuin = nextLevel <= 1 && Math.random() < 0.22;
        if (decayedToRuin && (!nextBuilding || nextBuilding.type !== 'ruin')) {
          nextBuilding = {
            id: `ruin-${x}-${y}-${state.current_date.year}-${state.current_date.month}`,
            type: 'ruin',
            position: { x, y },
            size: { w: 1, h: 1 },
            built_year: state.current_date.year,
            built_month: state.current_date.month,
            age_months: 0,
            powered: false,
            funding_pct: 0,
            active: false
          };
        }
      }

      if (!tile.zone.abandoned && abandoned) zonesAbandoned += 1;

      return {
        ...tile,
        building: nextBuilding,
        zone: {
          ...tile.zone,
          powered: tile.powered,
          watered: tile.watered,
          road_access: tile.road_access,
          development_level: Math.max(0, nextLevel),
          abandoned,
          population: abandoned ? 0 : zonePopulationForLevel(zoneType, Math.max(0, nextLevel))
        }
      };
    })
  );

  const residentialPop = grownTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('residential') && !tile.zone.abandoned)
    .reduce((sum, tile) => sum + (tile.zone?.population ?? 0), 0);

  const developedCommercialZones = grownTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('commercial') && tile.zone.development_level > 0 && !tile.zone.abandoned).length;
  const developedIndustrialZones = grownTiles
    .flat()
    .filter((tile) => tile.zone && tile.zone.type.startsWith('industrial') && tile.zone.development_level > 0 && !tile.zone.abandoned).length;

  const landValueFactor = Math.max(0.6, city.metrics.land_value_avg / 128);
  const monthlyIncome = Math.round(
    residentialPop * tax.residential * 0.01 * landValueFactor +
    developedCommercialZones * tax.commercial * 0.2 * landValueFactor +
    developedIndustrialZones * tax.industrial * 0.15 * landValueFactor
  );

  const f = city.budget.funding;
  const roads = grownTiles.flat().filter((tile) => tile.infrastructure.includes('road')).length;
  const rails = grownTiles.flat().filter((tile) => tile.infrastructure.includes('rail')).length;
  const policeStations = grownTiles.flat().filter((tile) => tile.building?.type === 'police_station').length;
  const fireStations = grownTiles.flat().filter((tile) => tile.building?.type === 'fire_station').length;
  const hospitals = grownTiles.flat().filter((tile) => tile.building?.type === 'hospital').length;
  const schools = grownTiles.flat().filter((tile) => tile.building?.type === 'school').length;
  const colleges = grownTiles.flat().filter((tile) => tile.building?.type === 'college').length;
  const libraries = grownTiles.flat().filter((tile) => tile.building?.type === 'library').length;
  const museums = grownTiles.flat().filter((tile) => tile.building?.type === 'museum').length;
  const bondPayment = city.budget.bonds.reduce((sum, bond) => sum + bond.monthly_payment, 0);
  const monthlyExpense = Math.round(
    (roads * 0.1 + rails * 0.2) * (f.transportation / 100) +
      policeStations * 2.5 * (f.police / 100) +
      fireStations * 2.5 * (f.fire / 100) +
      hospitals * 3.0 * (f.health / 100) +
      (schools * 1.5 + colleges * 5 + libraries * 2.5 + museums * 5) * (f.education / 100) +
      bondPayment
  );

  const treasuryBefore = city.treasury;
  const treasuryAfter = city.treasury + (monthlyIncome - monthlyExpense);

  const powerCapacity = grownTiles
    .flat()
    .reduce((sum, tile) => sum + (tile.building?.type ? POWER_CAPACITY_MW[tile.building.type] ?? 0 : 0), 0);
  const powerDemand = grownTiles
    .flat()
    .reduce((sum, tile) => {
      if (!tile.zone || tile.zone.abandoned) return sum;
      const lv = tile.zone.development_level;
      if (lv <= 0) return sum;
      return sum + (lv === 1 ? 1 : lv === 2 ? 2 : 4);
    }, 0);

  const waterPumps = grownTiles.flat().filter((tile) => tile.building?.type === 'water_pump');
  const waterSupply = waterPumps.reduce((sum, tile) => {
    const nearWater = tile.terrain_type === 'water' || neighbors4(tile.x, tile.y).some((nb) => inBounds(grownTiles, nb.x, nb.y) && grownTiles[nb.y][nb.x].terrain_type === 'water');
    return sum + 20 * (nearWater ? 2.0 : 0.5);
  }, 0);
  const waterDemand = Math.max(0, Math.round(residentialPop / 50));

  const avgCrime = Math.round(grownTiles.flat().reduce((sum, tile) => sum + tile.crime, 0) / Math.max(1, grownTiles.flat().length));
  const avgPollutionAir = Math.round(grownTiles.flat().reduce((sum, tile) => sum + tile.pollution_air, 0) / Math.max(1, grownTiles.flat().length));
  const avgPollutionWater = Math.round(grownTiles.flat().reduce((sum, tile) => sum + tile.pollution_water, 0) / Math.max(1, grownTiles.flat().length));
  const avgLand = Math.round(grownTiles.flat().reduce((sum, tile) => sum + tile.land_value, 0) / Math.max(1, grownTiles.flat().length));

  city.population = residentialPop;
  city.treasury = treasuryAfter;
  city.budget.monthly_income = monthlyIncome;
  city.budget.monthly_expenses = monthlyExpense;
  city.metrics.crime_rate = Math.max(0, Math.min(100, Math.round(avgCrime / 2.55)));
  city.metrics.pollution_air = Math.max(0, Math.min(100, Math.round(avgPollutionAir / 2.55)));
  city.metrics.pollution_water = Math.max(0, Math.min(100, Math.round(avgPollutionWater / 2.55)));
  city.metrics.land_value_avg = avgLand;
  const educationFundingFactor = Math.max(0, f.education / 100);
  const healthFundingFactor = Math.max(0, f.health / 100);

  const targetEq = clampInt(
    schools * 5 * educationFundingFactor +
      colleges * 10 * educationFundingFactor +
      libraries * 3 * educationFundingFactor +
      museums * 4 * educationFundingFactor +
      ordinanceRollup.educationBonus,
    0,
    200
  );

  const hospitalCoverage = Math.max(0, Math.min(1, hospitals * 0.18 * healthFundingFactor));
  const pollutionPenalty = ((avgPollutionAir + avgPollutionWater) / 2) * 0.35;
  const targetHq = Math.max(0, Math.min(200, hospitalCoverage * 50 - pollutionPenalty + ordinanceRollup.healthBonus + 70));

  // SPECS module 8 convergence
  // EQ_next = EQ_current + (TargetEQ - EQ_current) * 0.01
  // HQ_next = HQ_current + (TargetHQ - HQ_current) * 0.02
  const prevEq = city.metrics.eq;
  const prevHq = city.metrics.hq;
  const nextEq = prevEq + (targetEq - prevEq) * 0.01;
  const nextHq = prevHq + (targetHq - prevHq) * 0.02;

  city.metrics.eq = clampInt(nextEq, 0, 200);
  city.metrics.hq = clampInt(nextHq, 0, 200);
  lastEqTrend = Number((city.metrics.eq - prevEq).toFixed(2));
  lastHqTrend = Number((city.metrics.hq - prevHq).toFixed(2));
  city.metrics.rci_demand = demand;
  city.metrics.composite_score = Math.round(
    city.population * 0.4 +
      city.metrics.eq * 50 * 0.15 +
      city.metrics.hq * 50 * 0.15 +
      city.metrics.land_value_avg * 40 * 0.15 +
      (100 - city.metrics.crime_rate) * 100 * 0.1 +
      (100 - city.metrics.pollution_air) * 50 * 0.05
  );

  city.power_grid.total_capacity_mw = powerCapacity;
  city.power_grid.total_demand_mw = powerDemand;
  city.power_grid.coverage_pct = powerDemand <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((powerCapacity / powerDemand) * 100)));

  city.water_system.total_capacity = Math.round(waterSupply);
  city.water_system.total_demand = waterDemand;
  city.water_system.coverage_pct = waterDemand <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((waterSupply / waterDemand) * 100)));

  state.map.tiles = grownTiles;
  recomputeZoneCollections(state);

  city.months_bankrupt = city.treasury < -100000 ? city.months_bankrupt + 1 : 0;
  if (city.months_bankrupt >= 12) {
    state.victory_status = 'player_bankrupt';
  }

  return {
    populationChange: city.population - provisionalResidentialPop,
    treasuryChange: city.treasury - treasuryBefore,
    zonesDeveloped,
    zonesAbandoned,
    newPowerCapacity: powerCapacity
  };
}

function makeZone(x: number, y: number): Zone | null {
  const roll = Math.random();
  if (roll > 0.04) {
    return null;
  }

  const types: Zone['type'][] = [
    'residential_light',
    'commercial_light',
    'industrial_light',
    'residential_dense',
    'commercial_dense',
    'industrial_dense'
  ];
  const type = types[Math.floor(Math.random() * types.length)];

  return {
    id: `zone-${x}-${y}`,
    type,
    position: { x, y },
    size: { w: 1, h: 1 },
    development_level: 0,
    powered: false,
    watered: false,
    road_access: false,
    abandoned: false,
    population: 0,
    built_year: 1900 + Math.floor(Math.random() * 150),
    built_month: 1 + Math.floor(Math.random() * 12)
  };
}

function makeTile(x: number, y: number): Tile {
  const nearWater = y < 8 || x < 3 || x > MAP_WIDTH - 4;
  const terrain_type = nearWater ? 'water' : 'grass';
  const zone = terrain_type === 'grass' ? makeZone(x, y) : null;

  return {
    x,
    y,
    elevation: Math.floor(Math.random() * 4),
    terrain_type,
    zone,
    building: null,
    infrastructure: [],
    tree: terrain_type === 'grass' ? Math.random() > 0.86 : false,
    powered: false,
    watered: false,
    road_access: false,
    pollution_air: Math.floor(Math.random() * 90),
    pollution_water: Math.floor(Math.random() * 70),
    crime: Math.floor(Math.random() * 60),
    land_value: 90 + Math.floor(Math.random() * 120)
  };
}

function makeTiles(): Tile[][] {
  return Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => makeTile(x, y))
  );
}

function baseBudget() {
  return {
    tax_rates: {
      residential: 7,
      commercial: 7,
      industrial: 7
    },
    funding: {
      transportation: 100,
      police: 100,
      fire: 100,
      health: 100,
      education: 100
    },
    bonds: [],
    last_year_income: 14500,
    last_year_expenses: 12120,
    monthly_income: 1310,
    monthly_expenses: 1020
  };
}

const tiles = makeTiles();

const mockScenarios: ScenarioSummary[] = [
  {
    id: 'coastal-growth',
    name: 'Coastal Growth',
    description: 'A balanced shoreline city with strong tourism and transport potential.',
    difficulty_options: ['easy', 'medium', 'hard'],
    map_size: { width: MAP_WIDTH, height: MAP_HEIGHT }
  },
  {
    id: 'industrial-basin',
    name: 'Industrial Basin',
    description: 'A dense inland basin with heavier pollution management pressure.',
    difficulty_options: ['medium', 'hard'],
    map_size: { width: MAP_WIDTH, height: MAP_HEIGHT }
  }
];

const mockUsers: MockUser[] = [
  { id: 'user-001', username: 'mayor', email: 'mayor@simhiri.local' }
];

let mockCurrentUser = mockUsers[0];

function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function getTileRef(x: number, y: number): Tile | null {
  const tile = mockGameState.map.tiles[y]?.[x];
  return tile || null;
}

function toGameListItem(state: GameState): GameListItem {
  return {
    id: state._id,
    name: state.name,
    scenario_id: state.scenario_id,
    current_date: state.current_date,
    player_city_name: state.player_city.name,
    player_population: state.player_city.population,
    ai_city_name: state.ai_city.name,
    ai_population: state.ai_city.population,
    victory_status: state.victory_status,
    last_saved: state.last_saved,
    is_autosave: state.is_autosave
  };
}

function makeGameId(): string {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Canonical in-memory game snapshot for mock provider mode.
 *
 * Why: backend integration tests need deterministic initial data so
 * frontend behavior can be validated with or without a live API.
 */
export const mockGameState: GameState = {
  _id: 'game-001',
  user_id: 'user-001',
  name: 'Donostiako Metropolia',
  scenario_id: 'coastal-growth',
  created_at: '2050-01-01T00:00:00.000Z',
  last_saved: '2050-05-01T00:00:00.000Z',
  is_autosave: true,
  current_date: { year: 2050, month: 5 },
  current_player: 'player',
  difficulty: 'medium',
  disasters_enabled: true,
  player_city: {
    name: 'Euskal Berria',
    owner: 'player',
    population: 48210,
    treasury: 185450,
    months_bankrupt: 0,
    zones: tiles.flat().map((t) => t.zone).filter((z): z is Zone => z !== null),
    buildings: [],
    infrastructure: {
      roads: [],
      highways: [],
      power_lines: [],
      rail: [],
      water_pipes: [],
      subway: []
    },
    budget: baseBudget(),
    ordinances: [],
    metrics: {
      eq: 118,
      hq: 96,
      crime_rate: 18,
      pollution_air: 24,
      pollution_water: 17,
      land_value_avg: 142,
      approval: 74,
      unemployment: 7,
      traffic_avg: 33,
      rci_demand: { r: 35, c: 12, i: -8 },
      composite_score: 71120
    },
    power_grid: {
      total_capacity_mw: 980,
      total_demand_mw: 820,
      coverage_pct: 96
    },
    water_system: {
      total_capacity: 1020,
      total_demand: 800,
      coverage_pct: 95
    }
  },
  ai_city: {
    name: 'Rivalia',
    owner: 'ai',
    population: 45520,
    treasury: 169800,
    months_bankrupt: 0,
    zones: [],
    buildings: [],
    infrastructure: {
      roads: [],
      highways: [],
      power_lines: [],
      rail: [],
      water_pipes: [],
      subway: []
    },
    budget: baseBudget(),
    ordinances: [],
    metrics: {
      eq: 102,
      hq: 90,
      crime_rate: 21,
      pollution_air: 31,
      pollution_water: 19,
      land_value_avg: 136,
      approval: 70,
      unemployment: 8,
      traffic_avg: 38,
      rci_demand: { r: 20, c: 7, i: -2 },
      composite_score: 66380
    },
    power_grid: {
      total_capacity_mw: 910,
      total_demand_mw: 850,
      coverage_pct: 92
    },
    water_system: {
      total_capacity: 940,
      total_demand: 860,
      coverage_pct: 89
    }
  },
  ai_personality: 'balanced',
  map: {
    size: { width: MAP_WIDTH, height: MAP_HEIGHT },
    tiles,
    water_level: 2
  },
  disaster_attacks: {
    player_attacks_used: 0,
    ai_attacks_used: 1,
    last_player_attack_date: null,
    last_ai_attack_date: { year: 2050, month: 4 }
  },
  cheats_used: [],
  victory_status: 'ongoing',
  ai_context: {
    conversation_history: [],
    strategy_notes: 'Balanced growth with moderate taxes and controlled pollution.'
  }
};

let mockGames: GameListItem[] = [
  {
    id: mockGameState._id,
    name: mockGameState.name,
    scenario_id: mockGameState.scenario_id,
    current_date: mockGameState.current_date,
    player_city_name: mockGameState.player_city.name,
    player_population: mockGameState.player_city.population,
    ai_city_name: mockGameState.ai_city.name,
    ai_population: mockGameState.ai_city.population,
    victory_status: mockGameState.victory_status,
    last_saved: mockGameState.last_saved,
    is_autosave: mockGameState.is_autosave
  }
];

/**
 * Precomputed stats payload mirroring GET /api/games/{id}/stats.
 *
 * Why: preserving endpoint shape in mock mode makes API swapping transparent.
 */
export const mockStats: StatsResponse = {
  player: {
    population: 48210,
    treasury: 185450,
    composite_score: 71120,
    eq: 118,
    hq: 96,
    crime_rate: 18,
    pollution: 21,
    approval: 74,
    rci_demand: { r: 35, c: 12, i: -8 },
    power_coverage: 96,
    water_coverage: 95
  },
  ai: {
    population: 45520,
    treasury: 169800,
    composite_score: 66380,
    approval: 70
  },
  comparison: {
    population_diff: 2690,
    score_diff: 4740,
    months_to_victory: null
  }
};

/**
 * Education module response fixture for group-8 requirements.
 *
 * Why: this keeps the frontend panel contract stable before backend rollout.
 */
export const mockEducation: EducationResponse = {
  eq: 118,
  eq_trend: 4,
  facilities: [
    { type: 'school', count: 28, funding_pct: 102, coverage: 88 },
    { type: 'college', count: 9, funding_pct: 100, coverage: 72 },
    { type: 'library', count: 15, funding_pct: 95, coverage: 64 },
    { type: 'museum', count: 4, funding_pct: 90, coverage: 41 }
  ],
  effects: {
    high_tech_industry_pct: 0.59,
    crime_reduction: 11.8,
    land_value_bonus: 59
  }
};

/**
 * Health module response fixture for group-8 requirements.
 *
 * Why: contract parity avoids UI drift while backend endpoints are evolving.
 */
export const mockHealth: HealthResponse = {
  hq: 96,
  hq_trend: 3,
  hospitals: 6,
  average_lifespan: 69.2,
  mortality_rate: 5.2,
  pollution_health_impact: 12
};

let lastEqTrend = 0;
let lastHqTrend = 0;

function delayed<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

function hasInfrastructureNearby(
  tilesGrid: Tile[][],
  x: number,
  y: number,
  kind: InfrastructureType,
  radius = 2
): boolean {
  const minY = Math.max(0, y - radius);
  const maxY = Math.min(tilesGrid.length - 1, y + radius);

  for (let ty = minY; ty <= maxY; ty += 1) {
    const row = tilesGrid[ty] || [];
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(row.length - 1, x + radius);

    for (let tx = minX; tx <= maxX; tx += 1) {
      const tile = row[tx];
      if (!tile) continue;
      if (Math.abs(tx - x) + Math.abs(ty - y) > radius) continue;
      if (tile.infrastructure.includes(kind)) return true;
    }
  }

  return false;
}

/**
 * Mock API provider implementing the same public contract as live backend.
 *
 * Why: USE_MOCK must remain a drop-in backend substitute for integration and QA.
 */
export const mockApiService = {
  async login(username: string, password: string): Promise<{ token: string; user: MockUser }> {
    void password;
    const user = mockUsers.find((entry) => entry.username === username) ?? {
      id: `user-${mockUsers.length + 1}`,
      username,
      email: `${username}@simhiri.local`
    };

    mockCurrentUser = user;
    if (!mockUsers.some((entry) => entry.id === user.id)) {
      mockUsers.push(user);
    }

    return delayed({ token: `mock-token-${user.id}`, user });
  },

  async register(
    username: string,
    email: string,
    password: string
  ): Promise<{ message: string; user: MockUser; token?: string }> {
    void password;
    const existing = mockUsers.find((entry) => entry.username === username || entry.email === email);
    if (existing) {
      throw new Error('User already exists');
    }

    const user = {
      id: `user-${mockUsers.length + 1}`,
      username,
      email
    };
    mockUsers.push(user);
    mockCurrentUser = user;
    return delayed({ message: 'User created', user, token: `mock-token-${user.id}` });
  },

  async getProfile(): Promise<{ id: string; username: string; email: string; created_at: string; games_count: number }> {
    return delayed({
      id: mockCurrentUser.id,
      username: mockCurrentUser.username,
      email: mockCurrentUser.email,
      created_at: '2050-01-01T00:00:00.000Z',
      games_count: mockGames.length
    });
  },

  async listGames(): Promise<{ games: GameListItem[] }> {
    return delayed({ games: mockGames.map((game) => ({ ...game })) });
  },

  async createGame(config: {
    name: string;
    scenario_id: string;
    difficulty: 'easy' | 'medium' | 'hard';
    player_city_name: string;
    ai_personality: 'expansionist' | 'ecologist' | 'industrialist' | 'balanced' | 'tax_collector';
    disasters_enabled: boolean;
  }): Promise<{ game_id: string; game_state: GameState }> {
    const gameId = makeGameId();
    const nextGame = cloneGameState(mockGameState);
    nextGame._id = gameId;
    nextGame.name = config.name;
    nextGame.scenario_id = config.scenario_id;
    nextGame.difficulty = config.difficulty;
    nextGame.player_city.name = config.player_city_name;
    nextGame.ai_personality = config.ai_personality;
    nextGame.disasters_enabled = config.disasters_enabled;
    nextGame.created_at = new Date().toISOString();
    nextGame.last_saved = nextGame.created_at;

    mockGameState._id = gameId;
    mockGameState.name = config.name;
    mockGameState.scenario_id = config.scenario_id;
    mockGameState.difficulty = config.difficulty;
    mockGameState.player_city.name = config.player_city_name;
    mockGameState.ai_personality = config.ai_personality;
    mockGameState.disasters_enabled = config.disasters_enabled;
    mockGameState.created_at = nextGame.created_at;
    mockGameState.last_saved = nextGame.last_saved;

    mockGames = [toGameListItem(nextGame), ...mockGames.filter((entry) => entry.id !== gameId)];

    return delayed({ game_id: gameId, game_state: nextGame });
  },

  async deleteGame(gameId: string): Promise<{ success: boolean; message: string }> {
    mockGames = mockGames.filter((game) => game.id !== gameId);
    return delayed({ success: true, message: 'Game deleted' });
  },

  async getScenarios(): Promise<{ scenarios: ScenarioSummary[] }> {
    return delayed({ scenarios: mockScenarios.map((scenario) => ({ ...scenario })) });
  },

  async getGame(gameId: string): Promise<{ game_state: GameState }> {
    void gameId;
    return delayed({ game_state: mockGameState });
  },

  async getStats(gameId: string): Promise<StatsResponse> {
    void gameId;
    return delayed(recomputePlayerStats(mockGameState));
  },

  async getEducation(gameId: string): Promise<EducationResponse> {
    void gameId;
    const funding = mockGameState.player_city.budget.funding.education;
    const eq = mockGameState.player_city.metrics.eq;
    const eqTrend = lastEqTrend;

    return delayed({
      ...mockEducation,
      eq,
      eq_trend: eqTrend,
      facilities: mockEducation.facilities.map((facility) => ({
        ...facility,
        funding_pct: funding
      })),
      effects: {
        high_tech_industry_pct: Math.max(0, Math.min(1, eq / 200)),
        crime_reduction: Math.max(0, Math.round((eq - 80) * 0.12 * 10) / 10),
        land_value_bonus: Math.max(0, Math.round((eq - 70) * 0.7))
      }
    });
  },

  async getHealth(gameId: string): Promise<HealthResponse> {
    void gameId;
    const airPollution = mockGameState.player_city.metrics.pollution_air;
    const waterPollution = mockGameState.player_city.metrics.pollution_water;
    const pollutionImpact = Math.max(0, Math.round((airPollution + waterPollution) / 5));
    const hq = mockGameState.player_city.metrics.hq;
    const hqTrend = lastHqTrend;

    return delayed({
      ...mockHealth,
      hq,
      hq_trend: hqTrend,
      pollution_health_impact: pollutionImpact,
      average_lifespan: Math.max(52, Math.min(91, 66 + hq * 0.05)),
      mortality_rate: Math.max(2.1, Math.min(12.5, 10.5 - hq * 0.04))
    });
  },

  async getTileServiceConnection(
    gameId: string,
    x: number,
    y: number,
    tilesGrid: Tile[][]
  ): Promise<{ road_connected: boolean; power_connected: boolean; water_connected: boolean }> {
    void gameId;
    const road_connected = hasInfrastructureNearby(tilesGrid, x, y, 'road', 2);
    const power_connected = hasInfrastructureNearby(tilesGrid, x, y, 'power_line', 2);
    const water_connected = hasInfrastructureNearby(tilesGrid, x, y, 'water_pipe', 2);
    return delayed({ road_connected, power_connected, water_connected }, 80);
  },

  async placeZone(_gameId: string, zoneType: any, pos: any, _size: any): Promise<any> {
    const tile = getTileRef(pos.x, pos.y);
    if (!tile) {
      throw new Error('Invalid tile position');
    }
    if (tile.terrain_type === 'water') {
      throw new Error('Cannot zone water tiles');
    }
    if (tile.building?.type === 'ruin') {
      throw new Error('Tile is occupied by ruins. Clear with bulldozer first.');
    }
    if (tile.zone || tile.building || tile.infrastructure.length > 0) {
      throw new Error('Tile is occupied. Clear with bulldozer first.');
    }

    const cost = ZONE_COST[String(zoneType)] ?? 5;
    if (mockGameState.player_city.treasury < cost) {
      throw new Error('Insufficient treasury');
    }

    mockGameState.player_city.treasury -= cost;
    tile.zone = {
      id: `zone-${pos.x}-${pos.y}-${Date.now()}`,
      type: zoneType,
      position: { x: pos.x, y: pos.y },
      size: { w: 1, h: 1 },
      development_level: 0,
      powered: tile.powered,
      watered: tile.watered,
      road_access: tile.road_access,
      abandoned: false,
      population: 0,
      built_year: mockGameState.current_date.year,
      built_month: mockGameState.current_date.month
    };
    recomputeZoneCollections(mockGameState);

    return delayed({
      success: true,
      cost,
      treasury_after: mockGameState.player_city.treasury,
      game_state: cloneGameState(mockGameState)
    });
  },

  async placeInfrastructure(_gameId: string, type: any, segments: any): Promise<any> {
    const normalizedSegments = Array.isArray(segments) ? segments : [];
    const uniqueTiles = new Set<string>();

    for (const segment of normalizedSegments) {
      const to = segment?.to;
      if (typeof to?.x !== 'number' || typeof to?.y !== 'number') continue;
      const tile = getTileRef(to.x, to.y);
      if (!tile) continue;

      if (!tile.infrastructure.includes(type)) {
        tile.infrastructure = [...tile.infrastructure, type];
      }
      uniqueTiles.add(`${to.x}:${to.y}`);
    }

    const segmentsPlaced = uniqueTiles.size;
    const unitCost = INFRA_COST[String(type)] ?? 1;
    const cost = segmentsPlaced * unitCost;
    if (mockGameState.player_city.treasury < cost) {
      throw new Error('Insufficient treasury');
    }

    mockGameState.player_city.treasury -= cost;

    return delayed({
      success: true,
      cost,
      segments_placed: segmentsPlaced,
      treasury_after: mockGameState.player_city.treasury,
      game_state: cloneGameState(mockGameState)
    });
  },

  async buildStructure(_gameId: string, type: any, pos: any): Promise<any> {
    const tile = getTileRef(pos.x, pos.y);
    if (!tile) {
      throw new Error('Invalid tile position');
    }
    if (tile.terrain_type === 'water') {
      throw new Error('Cannot build on water');
    }
    if (tile.building?.type === 'ruin') {
      throw new Error('Tile is occupied by ruins. Clear with bulldozer first.');
    }
    if (tile.zone || tile.building || tile.infrastructure.length > 0) {
      throw new Error('Tile is occupied. Clear with bulldozer first.');
    }

    const cost = BUILDING_COST[String(type)] ?? 1000;
    if (mockGameState.player_city.treasury < cost) {
      throw new Error('Insufficient treasury');
    }

    mockGameState.player_city.treasury -= cost;
    tile.building = {
      id: `building-${pos.x}-${pos.y}-${Date.now()}`,
      type,
      position: { x: pos.x, y: pos.y },
      size: { w: 1, h: 1 },
      built_year: mockGameState.current_date.year,
      built_month: mockGameState.current_date.month,
      age_months: 0,
      powered: tile.powered,
      funding_pct: 100,
      active: true
    };

    recomputeZoneCollections(mockGameState);

    return delayed({
      success: true,
      cost,
      treasury_after: mockGameState.player_city.treasury,
      game_state: cloneGameState(mockGameState)
    });
  },

  async demolish(_gameId: string, pos: any, type: any): Promise<any> {
    const tile = getTileRef(pos?.x, pos?.y);
    if (!tile) {
      throw new Error('Invalid tile position');
    }

    const demolitionFee = 10;
    const baseCost = getDemolitionBaseCost(tile, String(type));
    const refund = Math.round(baseCost * 0.5);

    if (String(type) === 'building') {
      tile.building = null;
    } else if (String(type) === 'zone') {
      tile.zone = null;
    } else {
      tile.infrastructure = [];
    }

    mockGameState.player_city.treasury += refund - demolitionFee;
    recomputeZoneCollections(mockGameState);

    return delayed({
      success: true,
      demolished_type: String(type),
      cost: demolitionFee,
      refund,
      game_state: cloneGameState(mockGameState)
    });
  },

  async updateBudget(_gameId: string, taxRates?: any, funding?: any): Promise<any> {
    if (taxRates) {
      mockGameState.player_city.budget.tax_rates = {
        ...mockGameState.player_city.budget.tax_rates,
        ...taxRates
      };
    }

    if (funding) {
      mockGameState.player_city.budget.funding = {
        ...mockGameState.player_city.budget.funding,
        ...funding
      };
    }

    const taxes = mockGameState.player_city.budget.tax_rates;
    const funds = mockGameState.player_city.budget.funding;
    const incomeFactor = (taxes.residential + taxes.commercial + taxes.industrial) / 21;
    const spendingFactor =
      (funds.transportation + funds.police + funds.fire + funds.health + funds.education) / 500;

    const monthly_income = Math.round(1200 * incomeFactor);
    const monthly_expenses = Math.round(950 * spendingFactor);
    mockGameState.player_city.budget.monthly_income = monthly_income;
    mockGameState.player_city.budget.monthly_expenses = monthly_expenses;

    return delayed({
      success: true,
      budget: { ...mockGameState.player_city.budget },
      estimated_monthly_balance: monthly_income - monthly_expenses,
      game_state: cloneGameState(mockGameState)
    });
  },

  async toggleOrdinance(_gameId: string, ordinanceId: any, action: any): Promise<any> {
    const current = new Set(mockGameState.player_city.ordinances);
    if (action === 'enact') current.add(ordinanceId);
    if (action === 'repeal') current.delete(ordinanceId);
    mockGameState.player_city.ordinances = Array.from(current);

    return delayed({
      success: true,
      budget_impact: 0,
      game_state: cloneGameState(mockGameState)
    });
  },

  async issueBond(_gameId: string, amount: any): Promise<any> {
    const bondAmount = Number(amount) || 0;
    if (bondAmount <= 0) throw new Error('Invalid bond amount');

    mockGameState.player_city.treasury += bondAmount;
    mockGameState.player_city.budget.bonds = [
      ...mockGameState.player_city.budget.bonds,
      {
        id: `bond-${Date.now()}`,
        amount: bondAmount,
        interest_rate: 0.25,
        months_remaining: 120,
        monthly_payment: Math.round((bondAmount * 1.25) / 120)
      }
    ];

    return delayed({
      success: true,
      treasury_after: mockGameState.player_city.treasury,
      game_state: cloneGameState(mockGameState)
    });
  },

  async attackRival(_gameId: string, _disasterType: any, target: any): Promise<any> {
    const disasterType = String(_disasterType ?? 'fire') as 'fire' | 'flood' | 'tornado' | 'earthquake';
    const disasterCost = {
      fire: 5000,
      flood: 10000,
      tornado: 20000,
      earthquake: 50000
    }[disasterType] ?? 5000;

    const cost = disasterCost;
    if (mockGameState.player_city.treasury < cost) {
      throw new Error('Insufficient treasury for attack');
    }

    mockGameState.player_city.treasury -= cost;
    mockGameState.disaster_attacks.player_attacks_used += 1;
    mockGameState.disaster_attacks.last_player_attack_date = { ...mockGameState.current_date };

    let damageReport = {
      buildings_damaged: 0,
      zones_damaged: 0,
      infrastructure_damaged: 0,
      estimated_repair_cost: 0
    };

    if (target === 'ai') {
      const aiPopLoss = Math.round({ fire: 240, flood: 340, tornado: 520, earthquake: 900 }[disasterType]);
      const aiTreasuryLoss = Math.round({ fire: 900, flood: 1600, tornado: 3200, earthquake: 6000 }[disasterType]);
      pendingDisasterImpact = {
        target: 'ai',
        populationLoss: aiPopLoss,
        treasuryLoss: aiTreasuryLoss
      };

      mockGameState.ai_city.population = Math.max(0, mockGameState.ai_city.population - aiPopLoss);
      mockGameState.ai_city.treasury -= aiTreasuryLoss;
      damageReport = {
        buildings_damaged: Math.round(aiPopLoss / 45),
        zones_damaged: Math.round(aiPopLoss / 80),
        infrastructure_damaged: Math.round(aiPopLoss / 120),
        estimated_repair_cost: aiTreasuryLoss
      };
    } else {
      const ruinReport = applyDisasterRuinsToPlayer(disasterType);
      pendingDisasterImpact = {
        target: 'player',
        populationLoss: ruinReport.populationLoss,
        treasuryLoss: ruinReport.treasuryLoss
      };

      mockGameState.player_city.population = Math.max(0, mockGameState.player_city.population - ruinReport.populationLoss);
      mockGameState.player_city.treasury -= ruinReport.treasuryLoss;
      damageReport = {
        buildings_damaged: ruinReport.buildingsDamaged,
        zones_damaged: ruinReport.zonesDamaged,
        infrastructure_damaged: ruinReport.infrastructureDamaged,
        estimated_repair_cost: ruinReport.estimatedRepairCost
      };
    }

    recomputeZoneCollections(mockGameState);

    return delayed({
      success: true,
      cost,
      disaster: {
        id: `dis-${Date.now()}`,
        type: disasterType,
        position: { x: Math.floor(Math.random() * MAP_WIDTH), y: Math.floor(Math.random() * MAP_HEIGHT) },
        radius: 6,
        damage_level: 65,
        game_date: { ...mockGameState.current_date },
        source: 'attack',
        target_city: target
      },
      damage_report: damageReport,
      treasury_after: mockGameState.player_city.treasury,
      game_state: cloneGameState(mockGameState)
    });
  },

  async endMonth(_gameId: string): Promise<any> {
    const nextMonth = mockGameState.current_date.month === 12 ? 1 : mockGameState.current_date.month + 1;
    const nextYear = nextMonth === 1 ? mockGameState.current_date.year + 1 : mockGameState.current_date.year;
    mockGameState.current_date = { year: nextYear, month: nextMonth };

    const simulation = applyMonthlySimulationToPlayer(mockGameState);
    const aiSimulation = applyAICityMonthlySimulation(mockGameState);

    pendingDisasterImpact = null;

    mockGameState.last_saved = new Date().toISOString();
    mockGames = [toGameListItem(mockGameState), ...mockGames.filter((entry) => entry.id !== mockGameState._id)];

    const updatedStats = recomputePlayerStats(mockGameState);

    return delayed({
      success: true,
      new_date: { ...mockGameState.current_date },
      player_simulation: {
        population_change: simulation.populationChange,
        treasury_change: simulation.treasuryChange,
        zones_developed: simulation.zonesDeveloped,
        zones_abandoned: simulation.zonesAbandoned,
        new_power_capacity: simulation.newPowerCapacity,
        events: mockGameState.victory_status === 'player_bankrupt' ? ['City bankrupt for 12 months. Game over.'] : []
      },
      ai_turn: {
        actions: [
          { action_type: 'zone_growth', description: 'Expanded a residential block near the core' },
          { action_type: 'service_upgrade', description: 'Added city services to support density' }
        ],
        reasoning: 'Balanced growth with service coverage while keeping treasury pressure low.',
        simulation: {
          population_change: aiSimulation.populationChange,
          treasury_change: aiSimulation.treasuryChange
        }
      },
      victory_check: {
        status: mockGameState.victory_status,
        winner: mockGameState.victory_status === 'player_bankrupt' ? 'ai' : null,
        reason: mockGameState.victory_status === 'player_bankrupt' ? 'player_bankrupt' : null
      },
      stats: updatedStats,
      game_state: cloneGameState(mockGameState)
    });
  },

  async submitCheat(_gameId: string, _cheatCode: string): Promise<any> {
    return delayed({ success: true, cheat_code: _cheatCode, message: 'Cheat applied' });
  },

  async getOverlay(_gameId: string, _type: string): Promise<any> {
    return delayed({ overlay_type: _type, data: [], min_value: 0, max_value: 255 });
  }
};
