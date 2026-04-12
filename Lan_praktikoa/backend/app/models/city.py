"""City (Hiri) models."""
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class RCIDemand(BaseModel):
    """RCI (Residential, Commercial, Industrial) demand model."""

    r: int = Field(default=0, ge=-200, le=200)
    c: int = Field(default=0, ge=-200, le=200)
    i: int = Field(default=0, ge=-200, le=200)


class PowerGrid(BaseModel):
    """Power grid status model."""

    total_capacity_mw: int = Field(default=0, ge=0)
    total_demand_mw: int = Field(default=0, ge=0)
    coverage_pct: int = Field(default=0, ge=0, le=100)


class WaterSystem(BaseModel):
    """Water system status model."""

    total_capacity: int = Field(default=0, ge=0)
    total_demand: int = Field(default=0, ge=0)
    coverage_pct: int = Field(default=0, ge=0, le=100)


class CityMetrics(BaseModel):
    """City metrics model - Key indicators for city health & education."""

    eq: int = Field(default=50, ge=0, le=200)  # Education Quality
    hq: int = Field(default=50, ge=0, le=200)  # Health Quality
    crime_rate: int = Field(default=50, ge=0, le=100)
    pollution_air: int = Field(default=50, ge=0, le=100)
    pollution_water: int = Field(default=50, ge=0, le=100)
    land_value_avg: int = Field(default=50, ge=0, le=255)
    approval: int = Field(default=50, ge=0, le=100)
    unemployment: int = Field(default=5, ge=0, le=100)
    traffic_avg: int = Field(default=50, ge=0, le=100)
    rci_demand: RCIDemand = Field(default_factory=RCIDemand)
    composite_score: int = Field(default=0, ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "eq": 50,
                "hq": 50,
                "crime_rate": 50,
                "pollution_air": 50,
                "pollution_water": 50,
                "land_value_avg": 50,
                "approval": 50,
                "unemployment": 5,
                "traffic_avg": 50,
                "rci_demand": {"r": 0, "c": 0, "i": 0},
                "composite_score": 0,
            }
        }


class CityState(BaseModel):
    """City state data model."""

    name: str
    owner: str = Field(...)  # "player" or "ai"
    population: int = Field(default=0, ge=0)
    treasury: int = Field(default=10000, ge=0)
    months_bankrupt: int = Field(default=0, ge=0, le=12)
    zones: List[Dict] = Field(default_factory=list)
    buildings: List[Dict] = Field(default_factory=list)
    infrastructure: Dict = Field(default_factory=lambda: {
        "roads": [],
        "highways": [],
        "power_lines": [],
        "rail": [],
        "water_pipes": [],
        "subway": [],
    })
    budget: Dict = Field(default_factory=lambda: {
        "tax_rates": {"residential": 7, "commercial": 7, "industrial": 7},
        "funding": {
            "transportation": 100,
            "police": 100,
            "fire": 100,
            "health": 100,
            "education": 100,
        },
        "bonds": [],
        "last_year_income": 0,
        "last_year_expenses": 0,
        "monthly_income": 0,
        "monthly_expenses": 0,
    })
    ordinances: List[str] = Field(default_factory=list)
    metrics: CityMetrics = Field(default_factory=CityMetrics)
    power_grid: PowerGrid = Field(default_factory=PowerGrid)
    water_system: WaterSystem = Field(default_factory=WaterSystem)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Player City",
                "owner": "player",
                "population": 5000,
                "treasury": 50000,
                "months_bankrupt": 0,
                "zones": [],
                "buildings": [],
                "infrastructure": {
                    "roads": [],
                    "highways": [],
                    "power_lines": [],
                    "rail": [],
                    "water_pipes": [],
                    "subway": [],
                },
                "budget": {
                    "tax_rates": {"residential": 7, "commercial": 7, "industrial": 7},
                    "funding": {
                        "transportation": 100,
                        "police": 100,
                        "fire": 100,
                        "health": 100,
                        "education": 100,
                    },
                    "bonds": [],
                    "last_year_income": 0,
                    "last_year_expenses": 0,
                    "monthly_income": 0,
                    "monthly_expenses": 0,
                },
                "ordinances": [],
                "metrics": {
                    "eq": 50,
                    "hq": 50,
                    "crime_rate": 50,
                    "pollution_air": 50,
                    "pollution_water": 50,
                    "land_value_avg": 50,
                    "approval": 50,
                    "unemployment": 5,
                    "traffic_avg": 50,
                    "rci_demand": {"r": 0, "c": 0, "i": 0},
                    "composite_score": 0,
                },
                "power_grid": {"total_capacity_mw": 0, "total_demand_mw": 0, "coverage_pct": 0},
                "water_system": {"total_capacity": 0, "total_demand": 0, "coverage_pct": 0},
            }
        }
