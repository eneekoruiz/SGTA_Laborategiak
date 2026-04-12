"""Disaster (Hondamendia) model."""
from enum import Enum
from pydantic import BaseModel, Field


class DisasterType(str, Enum):
    """Hondamendi motak."""

    FIRE = "fire"
    FLOOD = "flood"
    TORNADO = "tornado"
    EARTHQUAKE = "earthquake"
    RIOT = "riot"
    NUCLEAR_MELTDOWN = "nuclear_meltdown"
    MONSTER = "monster"


class Disaster(BaseModel):
    """Hondamendiaren datu eredua."""

    id: str
    type: DisasterType
    target_city: str = Field(..., description="player edo ai")
    position: dict = Field(..., description="Hondamendiaren kokapena")  # {"x": int, "y": int}
    radius: int = Field(..., ge=1, le=30)
    damage_level: int = Field(..., ge=1, le=100)
    affected_tiles: list = Field(default_factory=list)
    triggered_at: str  # ISO datetime
    resolved: bool = Field(default=False)

    class Config:
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "id": "disaster-001",
                "type": "fire",
                "target_city": "player",
                "position": {"x": 50, "y": 50},
                "radius": 5,
                "damage_level": 50,
                "affected_tiles": [{"x": 48, "y": 48}, {"x": 49, "y": 49}],
                "triggered_at": "2024-01-01T12:00:00Z",
                "resolved": False,
            }
        }