import { writable } from 'svelte/store';
import { getConstants } from '../services/api/legacy';

export interface GameConstants {
    ZONE_COSTS: Record<string, number>;
    BUILDING_COSTS: Record<string, number>;
    POWER_PLANT_SPECS: Record<string, any>;
    INFRA_COSTS: Record<string, number>;
    SERVICE_MAINTENANCE: Record<string, number>;
    TAX_FACTORS: Record<string, number>;
    VICTORY_CONDITIONS: Record<string, number>;
    TREASURY_THRESHOLDS: Record<string, number>;
}

// Fallback values in case the API fails
const defaultConstants: GameConstants = {
    ZONE_COSTS: {
        "residential_light": 5,
        "residential_dense": 10,
        "commercial_light": 5,
        "commercial_dense": 10,
        "industrial_light": 5,
        "industrial_dense": 10,
    },
    BUILDING_COSTS: {
        "police_station": 500,
        "fire_station": 500,
        "hospital": 500,
        "prison": 3000,
        "school": 250,
        "college": 1000,
        "library": 500,
        "museum": 1000,
        "bus_depot": 250,
        "rail_station": 500,
        "subway_station": 500,
        "airport": 10000,
        "seaport": 5000,
        "water_pump": 100,
        "water_treatment": 500,
        "coal_power": 4000,
        "hydro_power": 400,
        "oil_power": 6500,
        "gas_power": 2000,
        "nuclear_power": 15000,
        "wind_power": 100,
        "solar_power": 1300,
        "microwave_power": 28000,
        "fusion_power": 40000,
    },
    POWER_PLANT_SPECS: {
        "coal_power": {"cost": 4000, "power": 200, "pollution": 150, "year": 1900, "life": 600},
        "hydro_power": {"cost": 400, "power": 20, "pollution": 0, "year": 1900, "life": 0},
        "oil_power": {"cost": 6500, "power": 220, "pollution": 120, "year": 1900, "life": 600},
        "gas_power": {"cost": 2000, "power": 50, "pollution": 30, "year": 1950, "life": 600},
        "nuclear_power": {"cost": 15000, "power": 500, "pollution": 0, "year": 1955, "life": 600},
        "wind_power": {"cost": 100, "power": 4, "pollution": 0, "year": 1980, "life": 0},
        "solar_power": {"cost": 1300, "power": 50, "pollution": 0, "year": 1990, "life": 600},
        "microwave_power": {"cost": 28000, "power": 1600, "pollution": 0, "year": 2020, "life": 600},
        "fusion_power": {"cost": 40000, "power": 2500, "pollution": 0, "year": 2050, "life": 600},
    },
    INFRA_COSTS: {
        "road": 10,
        "highway": 25,
        "highway_ramp": 25,
        "power_line": 2,
        "rail": 3,
        "water_pipe": 1,
        "subway_tunnel": 5,
    },
    SERVICE_MAINTENANCE: {
        "school": 1.5,
        "college": 5,
        "library": 2.5,
        "museum": 5,
        "hospital": 3.0,
        "police_station": 2.5,
        "fire_station": 2.5,
    },
    TAX_FACTORS: {
        "residential": 0.01,
        "commercial": 0.2,
        "industrial": 0.15
    },
    VICTORY_CONDITIONS: {
        "population_target": 100000,
        "max_months_bankrupt": 12,
        "game_duration_months": 1200
    },
    TREASURY_THRESHOLDS: {
        "bankrupt_limit": -100000,
        "warning_limit": 5000
    }
};

export const gameConstants = writable<GameConstants>(defaultConstants);

export async function fetchGameConstants() {
    try {
        console.log('fetching constants...');
        const data = await getConstants();
        if (data) {
            console.log('constants loaded successfully');
            gameConstants.update(current => ({ ...current, ...data }));
        } else {
            console.warn('Failed to load constants from API, using defaults');
        }
    } catch (error) {
        console.error('Error fetching game constants:', error);
        console.warn('Using default constants');
    }
}
