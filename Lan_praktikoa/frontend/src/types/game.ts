export type TerrainType = 'grass' | 'water' | 'forest' | 'rock' | 'sand';
export type InfrastructureType = 'road' | 'highway' | 'power_line' | 'rail' | 'water_pipe' | 'subway';
export type ZoneType =
  | 'residential_light'
  | 'residential_dense'
  | 'commercial_light'
  | 'commercial_dense'
  | 'industrial_light'
  | 'industrial_dense';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Zone {
  id: string;
  type: ZoneType;
  position: Position;
  size: Size;
  development_level: number;
  powered: boolean;
  watered: boolean;
  road_access: boolean;
  abandoned: boolean;
  population: number;
  built_year: number;
  built_month: number;
}

export interface Building {
  id: string;
  type: string;
  position: Position;
  size: Size;
  built_year: number;
  built_month: number;
  age_months: number;
  powered: boolean;
  funding_pct: number;
  active: boolean;
}

export interface InfraSegment {
  from: Position;
  to: Position;
}

export interface Budget {
  tax_rates: {
    residential: number;
    commercial: number;
    industrial: number;
  };
  funding: {
    transportation: number;
    police: number;
    fire: number;
    health: number;
    education: number;
  };
  bonds: Array<{
    id: string;
    amount: number;
    interest_rate: number;
    months_remaining: number;
    monthly_payment: number;
  }>;
  last_year_income: number;
  last_year_expenses: number;
  monthly_income: number;
  monthly_expenses: number;
}

export interface Tile {
  x: number;
  y: number;
  elevation: number;
  terrain_type: TerrainType;
  zone: Zone | null;
  building: Building | null;
  infrastructure: InfrastructureType[];
  tree: boolean;
  powered: boolean;
  watered: boolean;
  road_access: boolean;
  pollution_air: number;
  pollution_water: number;
  crime: number;
  land_value: number;
}

export interface CityState {
  name: string;
  owner: 'player' | 'ai';
  population: number;
  treasury: number;
  months_bankrupt: number;
  zones: Zone[];
  buildings: Building[];
  infrastructure: {
    roads: InfraSegment[];
    highways: InfraSegment[];
    power_lines: InfraSegment[];
    rail: InfraSegment[];
    water_pipes: InfraSegment[];
    subway: InfraSegment[];
  };
  budget: Budget;
  ordinances: string[];
  metrics: {
    eq: number;
    hq: number;
    crime_rate: number;
    pollution_air: number;
    pollution_water: number;
    land_value_avg: number;
    approval: number;
    unemployment: number;
    traffic_avg: number;
    rci_demand: { r: number; c: number; i: number };
    composite_score: number;
  };
  power_grid: {
    total_capacity_mw: number;
    total_demand_mw: number;
    coverage_pct: number;
  };
  water_system: {
    total_capacity: number;
    total_demand: number;
    coverage_pct: number;
  };
}

export interface GameState {
  _id: string;
  user_id: string;
  name: string;
  scenario_id: string;
  created_at: string;
  last_saved: string;
  is_autosave: boolean;
  current_date: { year: number; month: number };
  current_player: 'player' | 'ai';
  difficulty: 'easy' | 'medium' | 'hard';
  disasters_enabled: boolean;
  player_city: CityState;
  ai_city: CityState;
  ai_personality: 'expansionist' | 'ecologist' | 'industrialist' | 'balanced' | 'tax_collector';
  map: {
    size: { width: number; height: number };
    tiles: Tile[][];
    water_level: number;
  };
  disaster_attacks: {
    player_attacks_used: number;
    ai_attacks_used: number;
    last_player_attack_date: { year: number; month: number } | null;
    last_ai_attack_date: { year: number; month: number } | null;
  };
  cheats_used: string[];
  victory_status:
    | 'ongoing'
    | 'player_population'
    | 'player_score'
    | 'player_rival_bankrupt'
    | 'ai_population'
    | 'ai_score'
    | 'player_bankrupt'
    | 'player_arkology_exodus';
  ai_context: {
    conversation_history: object[];
    strategy_notes: string;
  };
}

export interface StatsResponse {
  player: {
    population: number;
    treasury: number;
    composite_score: number;
    eq: number;
    hq: number;
    crime_rate: number;
    pollution: number;
    approval: number;
    rci_demand: { r: number; c: number; i: number };
    power_coverage: number;
    water_coverage: number;
  };
  ai: {
    population: number;
    treasury: number;
    composite_score: number;
    approval: number;
  };
  comparison: {
    population_diff: number;
    score_diff: number;
    months_to_victory: number | null;
  };
}

export interface EducationResponse {
  eq: number;
  eq_trend: number;
  facilities: Array<{
    type: 'school' | 'college' | 'library' | 'museum';
    count: number;
    funding_pct: number;
    coverage: number;
  }>;
  effects: {
    high_tech_industry_pct: number;
    crime_reduction: number;
    land_value_bonus: number;
  };
}

export interface HealthResponse {
  hq: number;
  hq_trend: number;
  hospitals: number;
  average_lifespan: number;
  mortality_rate: number;
  pollution_health_impact: number;
}

export interface OverlayData {
  overlay_type: string;
  data: number[][];
  min_value: number;
  max_value: number;
}

export interface CheatResponse {
  success: boolean;
  cheat_code: string;
  message: string;
  changes: Record<string, { before: any; after: any }>;
  game_state: GameState;
}
