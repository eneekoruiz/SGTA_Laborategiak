"""Infrastructure (Azpiegitura) model."""
from typing import List
from enum import Enum
from pydantic import BaseModel, Field


class InfrastructureType(str, Enum):
    """Azpiegitura motak."""

    ROAD = "road"
    HIGHWAY = "highway"
    HIGHWAY_RAMP = "highway_ramp"
    POWER_LINE = "power_line"
    RAIL = "rail"
    WATER_PIPE = "water_pipe"
    SUBWAY_TUNNEL = "subway_tunnel"


class Position(BaseModel):
    """Posizioaren eredua grid-ean."""
    x: int = Field(..., ge=0, le=99)
    y: int = Field(..., ge=0, le=99)


class InfraSegment(BaseModel):
    """Azpiegitura segmentuaren eredua."""

    id: str
    type: InfrastructureType
    start_position: Position
    end_position: Position
    tiles_covered: List[Position] = Field(default_factory=list)
    built_year: int
    built_month: int = Field(..., ge=1, le=12)
    maintenance_level: int = Field(default=100, ge=0, le=100)

    class Config:
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "id": "infra-001",
                "type": "road",
                "start_position": {"x": 10, "y": 15},
                "end_position": {"x": 10, "y": 20},
                "tiles_covered": [
                    {"x": 10, "y": 15},
                    {"x": 10, "y": 16},
                    {"x": 10, "y": 17},
                    {"x": 10, "y": 18},
                    {"x": 10, "y": 19},
                    {"x": 10, "y": 20},
                ],
                "built_year": 2024,
                "built_month": 1,
                "maintenance_level": 100,
            }
        }


class Infrastructure(BaseModel):
    """Infrastructure collection model."""

    roads: List[InfraSegment] = Field(default_factory=list)
    highways: List[InfraSegment] = Field(default_factory=list)
    power_lines: List[InfraSegment] = Field(default_factory=list)
    rail: List[InfraSegment] = Field(default_factory=list)
    water_pipes: List[InfraSegment] = Field(default_factory=list)
    subway: List[InfraSegment] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "roads": [],
                "highways": [],
                "power_lines": [],
                "rail": [],
                "water_pipes": [],
                "subway": [],
            }
        }
