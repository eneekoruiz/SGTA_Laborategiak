/**
 * Centralized numeric constants for the deterministic monthly simulation engine.
 *
 * Why: keeping these values in one location avoids accidental drift across
 * multiple files and makes future SPECS-alignment audits straightforward.
 */
export const SIMULATION_CONSTANTS = {
  // Date progression
  MONTHS_PER_YEAR: 12,

  // Graph search radii for utility availability
  ROAD_ACCESS_RADIUS: 3,
  POWER_ACCESS_RADIUS: 3,
  WATER_ACCESS_RADIUS: 6,

  // Coverage and quality thresholds
  SERVICE_COVERAGE_RADIUS: 18,
  DENSE_LEVEL3_LAND_VALUE_MIN: 140,
  ABANDONMENT_CRIME_THRESHOLD: 80,
  ABANDONMENT_POLLUTION_THRESHOLD: 80,

  // RCI baseline and coefficients (SPECS section 3.2)
  RCI_BASE_DEMAND: 10,
  RCI_EMPLOYMENT_BALANCE_WEIGHT: 0.3,
  RCI_RESIDENTIAL_CUSTOMER_WEIGHT: 0.1,
  RCI_INDUSTRIAL_WORKFORCE_WEIGHT: 0.05,
  RCI_EQ_WEIGHT: 0.2,
  RCI_CRIME_PENALTY_WEIGHT: 0.3,
  RCI_POLLUTION_PENALTY_WEIGHT: 0.1,
  RCI_TAX_PENALTY_WEIGHT: 5,
  RCI_MAX_SERVICE_BONUS: 30,
  RCI_MAX_TRANSPORT_BONUS: 20,
  RCI_AIRPORT_BONUS: 50,
  RCI_SEAPORT_BONUS: 40,
  RCI_RAIL_BONUS: 20,

  // Environment update weights
  POLLUTION_INDUSTRIAL_BOOST: 24,
  POLLUTION_POWER_BOOST: 16,
  POLLUTION_TREE_REDUCTION: 8,
  CRIME_BASE_NO_ZONE: 3,
  CRIME_ZONE_POPULATION_WEIGHT: 0.03,
  CRIME_ROAD_ACCESS_BONUS: -4,
  CRIME_NO_ROAD_PENALTY: 2,
  LAND_VALUE_BASE: 120,
  LAND_VALUE_ROAD_ACCESS_BONUS: 10,
  LAND_VALUE_NO_ROAD_PENALTY: -8,
  LAND_VALUE_TREE_BONUS: 8,
  LAND_VALUE_POLLUTION_WEIGHT: 0.18,
  LAND_VALUE_CRIME_WEIGHT: 0.14,

  // Zone population model (SPECS section 3.3)
  RESIDENTIAL_LIGHT_LEVEL_POP: 50,
  RESIDENTIAL_DENSE_LEVEL_POP: 200,
  COMMERCIAL_LIGHT_LEVEL_POP: 45,
  COMMERCIAL_DENSE_LEVEL_POP: 140,
  INDUSTRIAL_LIGHT_LEVEL_POP: 50,
  INDUSTRIAL_DENSE_LEVEL_POP: 160,

  // Growth and abandonment probabilities (SPECS section 3.1)
  ABANDONMENT_NO_POWER_PROBABILITY: 0.3,
  ABANDONMENT_HIGH_CRIME_PROBABILITY: 0.2,
  ABANDONMENT_RESIDENTIAL_HIGH_POLLUTION_PROBABILITY: 0.15,
  ABANDONMENT_HIGH_TAX_PROBABILITY: 0.1,
  HIGH_TAX_THRESHOLD: 15,

  // Economy and failure state
  BANKRUPTCY_TREASURY_THRESHOLD: -100000,
  BANKRUPTCY_MONTHS_TO_DEFEAT: 12,
  LAND_VALUE_FACTOR_MIN: 0.6,

  // Tick scheduling
  TICK_INTERVAL_NORMAL_MS: 5000,
  TICK_INTERVAL_FAST_MS: 1000,
  TICK_INTERVAL_INSTANT_MS: 0,

  // Demand bounds
  DEMAND_MIN: -200,
  DEMAND_MAX: 200,

  // Tile metric bounds
  TILE_MIN: 0,
  TILE_MAX: 255
} as const;

/**
 * Ordinance demand modifiers used by the in-frontend simulation path.
 *
 * Why: this allows policy impact updates without rewriting the demand formula.
 */
export const ORDINANCE_RCI_MODIFIERS = {
  sales_tax: { c: -10 },
  income_tax: { r: -10 },
  tourist_promotion: { c: 10 },
  pollution_controls: { i: -5 },
  business_incentives: { c: 15, i: 15 }
} as const;

/**
 * Infrastructure categories for utility graph construction.
 *
 * Why: utility BFS is driven by infra classes, not by rendering/UI concerns.
 */
export const ROAD_TYPES = new Set(['road', 'highway', 'highway_ramp']);
export const POWER_TYPES = new Set(['power_line']);
export const WATER_TYPES = new Set(['water_pipe']);
