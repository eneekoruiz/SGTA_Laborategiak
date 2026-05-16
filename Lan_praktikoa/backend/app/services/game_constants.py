"""
SimHiri jokoaren konstante globalak (SPECS.md § 1.4 eta § 1.6).
Zentralizatuta daude DRY printzipioa mantentzeko.
"""

ZONE_COSTS = {
    "residential_light": 5,
    "residential_dense": 10,
    "commercial_light": 5,
    "commercial_dense": 10,
    "industrial_light": 5,
    "industrial_dense": 10,
}

POWER_PLANT_SPECS = {
    "coal_power": {"cost": 4000, "power": 200, "pollution": 150, "year": 1900, "life": 600},
    "hydro_power": {"cost": 400, "power": 20, "pollution": 0, "year": 1900, "life": 0},
    "oil_power": {"cost": 6500, "power": 220, "pollution": 120, "year": 1900, "life": 600},
    "gas_power": {"cost": 2000, "power": 50, "pollution": 30, "year": 1950, "life": 600},
    "nuclear_power": {"cost": 15000, "power": 500, "pollution": 0, "year": 1955, "life": 600},
    "wind_power": {"cost": 100, "power": 4, "pollution": 0, "year": 1980, "life": 0},
    "solar_power": {"cost": 1300, "power": 50, "pollution": 0, "year": 1990, "life": 600},
    "microwave_power": {"cost": 28000, "power": 1600, "pollution": 0, "year": 2020, "life": 600},
    "fusion_power": {"cost": 40000, "power": 2500, "pollution": 0, "year": 2050, "life": 600},
}

ARCOLOGY_SPECS = {
    "arcology_plymouth": {"cost": 100000, "population": 10000, "pollution": 50, "year": 2000, "size": {"w": 4, "h": 4}},
    "arcology_darco": {"cost": 150000, "population": 30000, "pollution": 20, "year": 2050, "size": {"w": 4, "h": 4}},
    "arcology_launch": {"cost": 200000, "population": 65000, "pollution": 0, "year": 2100, "size": {"w": 4, "h": 4}},
}

BUILDING_COSTS = {
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
}

# Combine power plants, buildings and arcologies for easier frontend access
ALL_BUILDING_COSTS = {**BUILDING_COSTS}
for k, v in POWER_PLANT_SPECS.items():
    ALL_BUILDING_COSTS[k] = v["cost"]
for k, v in ARCOLOGY_SPECS.items():
    ALL_BUILDING_COSTS[k] = v["cost"]

INFRA_COSTS = {
    "road": 10,
    "highway": 25,
    "highway_ramp": 25,
    "power_line": 2,
    "rail": 3,
    "water_pipe": 1,
    "subway_tunnel": 5,
}

SERVICE_MAINTENANCE = {
    "school": 1.5,
    "college": 5,
    "library": 2.5,
    "museum": 5,
    "hospital": 3.0,
    "police_station": 2.5,
    "fire_station": 2.5,
}

TAX_FACTORS = {
    "residential": 0.01,
    "commercial": 0.2,
    "industrial": 0.15
}

VICTORY_CONDITIONS = {
    "population_target": 100000,
    "max_months_bankrupt": 12,
    "game_duration_months": 1200,
    "arcology_target": 4
}

TREASURY_THRESHOLDS = {
    "bankrupt_limit": -100000,
    "warning_limit": 5000
}

GAME_CONSTANTS = {
    "ZONE_COSTS": ZONE_COSTS,
    "BUILDING_COSTS": ALL_BUILDING_COSTS,
    "POWER_PLANT_SPECS": POWER_PLANT_SPECS,
    "ARCOLOGY_SPECS": ARCOLOGY_SPECS,
    "INFRA_COSTS": INFRA_COSTS,
    "SERVICE_MAINTENANCE": SERVICE_MAINTENANCE,
    "TAX_FACTORS": TAX_FACTORS,
    "VICTORY_CONDITIONS": VICTORY_CONDITIONS,
    "TREASURY_THRESHOLDS": TREASURY_THRESHOLDS
}

