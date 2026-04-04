import type {
  EducationResponse,
  GameState,
  HealthResponse,
  InfrastructureType,
  StatsResponse,
  Tile,
  Zone
} from '../types/game';

const MAP_WIDTH = 64;
const MAP_HEIGHT = 64;

function makeZone(x: number, y: number): Zone | null {
  const roll = Math.random();
  if (roll > 0.12) {
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
    development_level: Math.floor(Math.random() * 4),
    powered: true,
    watered: true,
    road_access: true,
    abandoned: false,
    population: Math.floor(Math.random() * 180),
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
    powered: true,
    watered: true,
    road_access: true,
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

export const mockHealth: HealthResponse = {
  hq: 96,
  hq_trend: 3,
  hospitals: 6,
  average_lifespan: 69.2,
  mortality_rate: 5.2,
  pollution_health_impact: 12
};

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

export const mockApiService = {
  async getGame(gameId: string): Promise<{ game_state: GameState }> {
    void gameId;
    return delayed({ game_state: mockGameState });
  },

  async getStats(gameId: string): Promise<StatsResponse> {
    void gameId;
    return delayed(mockStats);
  },

  async getEducation(gameId: string): Promise<EducationResponse> {
    void gameId;
    return delayed(mockEducation);
  },

  async getHealth(gameId: string): Promise<HealthResponse> {
    void gameId;
    return delayed(mockHealth);
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

  async placeZone(): Promise<any> {
    return delayed({ success: true, cost: 250, treasury_after: 0 });
  },

  async placeInfrastructure(): Promise<any> {
    return delayed({ success: true, cost: 100, segments_placed: 1, treasury_after: 0 });
  },

  async buildStructure(): Promise<any> {
    return delayed({ success: true, cost: 1000, treasury_after: 0 });
  },

  async demolish(): Promise<any> {
    return delayed({ success: true, refund: 500 });
  },

  async updateBudget(): Promise<any> {
    return delayed({ success: true, budget: baseBudget(), estimated_monthly_balance: 0 });
  },

  async toggleOrdinance(): Promise<any> {
    return delayed({ success: true, budget_impact: 0 });
  },

  async issueBond(): Promise<any> {
    return delayed({ success: true, treasury_after: 0 });
  },

  async attackRival(): Promise<any> {
    return delayed({ success: true, cost: 5000, treasury_after: 0 });
  },

  async endMonth(): Promise<any> {
    return delayed({ success: true, new_date: { year: 2050, month: 6 }, game_state: mockGameState });
  },

  async submitCheat(): Promise<any> {
    return delayed({ success: true, cheat_code: 'test', message: 'Cheat applied' });
  },

  async getOverlay(): Promise<any> {
    return delayed({ overlay_type: '', data: [], min_value: 0, max_value: 255 });
  }
};
