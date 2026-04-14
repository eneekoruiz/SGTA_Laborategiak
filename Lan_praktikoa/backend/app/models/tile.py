"""Tile (Laukia) model."""
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field


class TerrainType(str, Enum):
    """Terrain types."""

    GRASS = "grass"
    WATER = "water"
    FOREST = "forest"
    ROCK = "rock"
    SAND = "sand"


class Position(BaseModel):
    """Position coordinates."""

    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)

    class Config:
        json_schema_extra = {"example": {"x": 10, "y": 15}}


class Tile(BaseModel):
    """Tile data model representing a map cell."""

    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)
    elevation: int = Field(default=0, ge=0, le=31)
    terrain_type: TerrainType = Field(default=TerrainType.GRASS)
    zone: Optional[dict] = None  # Zone object reference
    building: Optional[dict] = None  # Building object reference
    infrastructure: List[str] = Field(default_factory=list)  # Infrastructure types
    tree: bool = Field(default=False)
    powered: bool = Field(default=False)
    watered: bool = Field(default=False)
    road_access: bool = Field(default=False)
    pollution_air: int = Field(default=0, ge=0, le=255)
    pollution_water: int = Field(default=0, ge=0, le=255)
    crime: int = Field(default=0, ge=0, le=255)
    land_value: int = Field(default=50, ge=0, le=255)

    class Config:
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "x": 10,
                "y": 15,
                "elevation": 5,
                "terrain_type": "grass",
                "zone": None,
                "building": None,
                "infrastructure": ["road"],
                "tree": False,
                "powered": False,
                "watered": False,
                "road_access": True,
                "pollution_air": 10,
                "pollution_water": 5,
                "crime": 15,
                "land_value": 100,
            }
        }
