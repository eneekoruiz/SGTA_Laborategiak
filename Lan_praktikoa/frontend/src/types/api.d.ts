/**
 * API CONTRACTS - Data Types
 *
 * This file defines the exact JSON structures that the Backend will send.
 * It acts as the "contract" between Frontend and Backend.
 *
 * All types MUST match SPECS.md Section 2 (Data Models)
 * and AGENT-BACKEND.md (Endpoint specifications).
 *
 * When the FastAPI/Flask backend is ready, these types ensure:
 * ✅ Type safety
 * ✅ Autocomplete in IDE
 * ✅ Compile-time catch of API mismatches
 * ✅ Documentation available without API calls
 */

import type {
  Position,
  Size,
  TerrainType,
  ZoneType,
  InfrastructureType,
  Zone,
  Building,
  Budget,
  Tile,
  CityState,
  GameState
} from './game';

// ═════════════════════════════════════════════════════════════
// AUTHENTICATION API CONTRACTS
// ═════════════════════════════════════════════════════════════

export namespace Auth {
  export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
  }

  export interface RegisterResponse {
    message: string;
    user: {
      id: string;
      username: string;
      email: string;
    };
  }

  export interface LoginRequest {
    username: string;
    password: string;
  }

  export interface LoginResponse {
    token: string;
    user: {
      id: string;
      username: string;
    };
  }

  export interface ProfileResponse {
    id: string;
    username: string;
    email: string;
    created_at: string;
    games_count: number;
  }
}

// ═════════════════════════════════════════════════════════════
// GAME LIFECYCLE API CONTRACTS
// ═════════════════════════════════════════════════════════════

export namespace Games {
  export interface CreateRequest {
    name: string;
    scenario_id: string;
    difficulty: 'easy' | 'medium' | 'hard';
    player_city_name: string;
    ai_personality: string;
    disasters_enabled: boolean;
  }

  export interface CreateResponse {
    game_id: string;
    game_state: GameState;
  }

  export interface LoadResponse {
    game_state: GameState;
  }

  export interface SaveRequest {
    name?: string;
  }

  export interface SaveResponse {
    message: string;
    saved_at: string;
  }

  export interface ListResponse {
    games: Array<{
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
    }>;
  }

  export interface ScenariosResponse {
    scenarios: Array<{
      id: string;
      name: string;
      description: string;
      difficulty_options: string[];
      map_size: { width: number; height: number };
    }>;
  }
}

// ═════════════════════════════════════════════════════════════
// CITY ACTIONS API CONTRACTS
// ═════════════════════════════════════════════════════════════

export namespace CityActions {
  export interface PlaceZoneRequest {
    zone_type: ZoneType;
    position: Position;
    size: Size;
  }

  export interface PlaceZoneResponse {
    success: boolean;
    cost: number;
    zone: Zone;
    treasury_after: number;
    game_state: GameState;
  }

  export interface PlaceInfrastructureRequest {
    type: InfrastructureType;
    segments: Array<{
      from: Position;
      to: Position;
    }>;
  }

  export interface PlaceInfrastructureResponse {
    success: boolean;
    cost: number;
    segments_placed: number;
    treasury_after: number;
    game_state: GameState;
  }

  export interface BuildStructureRequest {
    building_type: string;
    position: Position;
  }

  export interface BuildStructureResponse {
    success: boolean;
    cost: number;
    building: Building;
    treasury_after: number;
    game_state: GameState;
  }

  export interface DemolishRequest {
    position: Position;
    type: 'zone' | 'building' | 'infrastructure';
  }

  export interface DemolishResponse {
    success: boolean;
    demolished_type: string;
    refund: number;
    game_state: GameState;
  }
}

// ═════════════════════════════════════════════════════════════
// BUDGET & FINANCE API CONTRACTS
// ═════════════════════════════════════════════════════════════

export namespace Budget {
  export interface UpdateRequest {
    tax_rates?: {
      residential?: number;
      commercial?: number;
      industrial?: number;
    };
    funding?: {
      transportation?: number;
      police?: number;
      fire?: number;
      health?: number;
      education?: number;
    };
  }

  export interface UpdateResponse {
    success: boolean;
    budget: {
      tax_rates: Record<string, number>;
      funding: Record<string, number>;
      monthly_income: number;
      monthly_expenses: number;
    };
    estimated_monthly_balance: number;
    game_state: GameState;
  }

  export interface OrdinanceRequest {
    ordinance_id: string;
    action: 'enact' | 'repeal';
  }

  export interface OrdinanceResponse {
    success: boolean;
    ordinance: {
      id: string;
      name: string;
      annual_cost: number;
      active: boolean;
    };
    budget_impact: number;
    game_state: GameState;
  }

  export interface IssueBondRequest {
    amount: number;
  }

  export interface IssueBondResponse {
    success: boolean;
    bond: {
      id: string;
      amount: number;
      interest_rate: number;
      months_remaining: number;
    };
    treasury_after: number;
    game_state: GameState;
  }
}

// ═════════════════════════════════════════════════════════════
// GAME STATE & TURN API CONTRACTS
// ═════════════════════════════════════════════════════════════

export namespace Turn {
  export interface EndMonthResponse {
    success: boolean;
    new_date: { year: number; month: number };
    player_simulation: {
      population_change: number;
      treasury_change: number;
      zones_developed: number;
      zones_abandoned: number;
      events: string[];
    };
    ai_turn: {
      actions: Array<{
        action_type: string;
        description: string;
      }>;
      reasoning: string;
      simulation: {
        population_change: number;
        treasury_change: number;
      };
    };
    ai_actions?: Array<{
      action_type: string;
      position?: { x: number; y: number };
      building_type?: string;
      infrastructure_type?: string;
      segments?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
    }>;
    ai_city?: { population: number; treasury: number };
    game_state: GameState;
    victory_check: {
      status: 'ongoing' | 'victory' | 'defeat';
      winner?: string;
      reason?: string;
    };
  }

  export interface AttackRequest {
    disaster_type: string;
    target: 'player' | 'ai';
  }

  export interface AttackResponse {
    success: boolean;
    cost: number;
    disaster: {
      type: string;
      position: Position;
      radius: number;
      damage_level: number;
    };
    damage_report: {
      buildings_damaged: number;
      zones_damaged: number;
      infrastructure_damaged: number;
      estimated_repair_cost: number;
    };
    treasury_after: number;
    game_state: GameState;
  }
}

// ═════════════════════════════════════════════════════════════
// QUERY API CONTRACTS (Read-only, no state changes)
// ═════════════════════════════════════════════════════════════

export namespace Queries {
  export interface OverlayResponse {
    overlay_type: string;
    data: number[][];
    min_value: number;
    max_value: number;
  }

  export interface StatsResponse {
    player: {
      population: number;
      treasury: number;
      composite_score: number;
      eq: number;
      hq: number;
      crime_rate: number;
      pollution_air: number;
      pollution_water: number;
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
      months_to_victory?: number;
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
}

// ═════════════════════════════════════════════════════════════
// CHEAT & DEBUG API CONTRACTS
// ═════════════════════════════════════════════════════════════

export namespace Debug {
  export interface CheatRequest {
    cheat_code: string;
  }

  export interface CheatResponse {
    success: boolean;
    cheat_code: string;
    message: string;
    changes: Record<string, { before: any; after: any }>;
    game_state: GameState;
  }

  export interface HealthCheckResponse {
    status: 'healthy' | 'degraded' | 'offline';
    uptime_seconds?: number;
    version?: string;
  }
}

// ═════════════════════════════════════════════════════════════
// ERROR HANDLING CONTRACTS
// ═════════════════════════════════════════════════════════════

export namespace Errors {
  export interface ApiError {
    status: number;
    error: string;
    message?: string;
    details?: Record<string, any>;
  }

  export interface ValidationError extends ApiError {
    fields: Record<string, string[]>;
  }

  export interface ServerOfflineError {
    type: 'server_offline';
    message: 'Backend server is not responding';
    retryable: boolean;
  }

  export interface RequestTimeoutError {
    type: 'timeout';
    message: 'Request took too long to complete';
    endpoint: string;
  }

  export interface NetworkError {
    type: 'network';
    message: 'Network request failed';
    original_error: string;
  }
}
