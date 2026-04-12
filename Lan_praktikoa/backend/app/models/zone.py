"""Zona eta Swagger metadata modeloa."""
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field


class ZoneType(str, Enum):
    """Zona motak."""

    RESIDENTIAL_LIGHT = "residential_light"
    RESIDENTIAL_DENSE = "residential_dense"
    COMMERCIAL_LIGHT = "commercial_light"
    COMMERCIAL_DENSE = "commercial_dense"
    INDUSTRIAL_LIGHT = "industrial_light"
    INDUSTRIAL_DENSE = "industrial_dense"


class Position(BaseModel):
    """Posizioaren eredua grid-ean."""
    x: int = Field(
        ..., title="X koordenatua", description="Laukiaren x koordenatua mapa grid-ean (0-99).", ge=0, le=99
    )
    y: int = Field(
        ..., title="Y koordenatua", description="Laukiaren y koordenatua mapa grid-ean (0-99).", ge=0, le=99
    )


class Size(BaseModel):
    """Tamainaren eredua laukitan."""
    w: int = Field(
        ..., title="Zabalera", description="Zonaren zabalera laukitan, 1-6 artean.", ge=1, le=6
    )
    h: int = Field(
        ..., title="Altuera", description="Zonaren altuera laukitan, 1-6 artean.", ge=1, le=6
    )


class Zone(BaseModel):
    """Zonaren datu eredua."""

    id: str = Field(..., title="Identifikatzailea", description="Zonaren identifikatzaile bakarra.")
    type: ZoneType = Field(..., title="Mota", description="Zonaren mota.")
    position: Position = Field(..., title="Posizioa", description="Zonaren kokapena mapa grid-ean.")
    size: Size = Field(..., title="Tamaina", description="Zonaren tamaina lauheitara.")
    development_level: int = Field(
        default=0,
        title="Garapen maila",
        description="Zonaren garapen-maila 0 eta 3 artean.",
        ge=0,
        le=3,
    )
    powered: bool = Field(
        default=False,
        title="Energiaduna",
        description="Zonak energia jasotzen duen ala ez.",
    )
    watered: bool = Field(
        default=False,
        title="Uraduna",
        description="Zonak ur hornidura jasotzen duen ala ez.",
    )
    road_access: bool = Field(
        default=False,
        title="Bide sarbidea",
        description="Zonak errepide edo autobide sarrerarik duen ala ez.",
    )
    abandoned: bool = Field(
        default=False,
        title="Abandonatua",
        description="Zonaren erabilera abandonatua den ala ez.",
    )
    population: int = Field(
        default=0,
        title="Populazioa",
        description="Zonaren barruan bizi den biztanleria.",
        ge=0,
    )
    built_year: int = Field(..., title="Eraikuntza urtea", description="Zonaren eraikuntza amaitu zen urteka.")
    built_month: int = Field(..., title="Eraikuntza hilabetea", description="Zonaren eraikuntza amaitu zen hilabetea (1-12).", ge=1, le=12)

    class Config:
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "id": "zone-001",
                "type": "residential_light",
                "position": {"x": 10, "y": 15},
                "size": {"w": 2, "h": 2},
                "development_level": 1,
                "powered": True,
                "watered": True,
                "road_access": True,
                "abandoned": False,
                "population": 100,
                "built_year": 2024,
                "built_month": 1,
            }
        }


class ZoneCreate(BaseModel):
    """Zonaren sorrerarako eskaera eredua."""

    type: ZoneType = Field(..., title="Mota", description="Sortuko den zonaren mota.")
    position: Position = Field(..., title="Posizioa", description="Hasierako posizioa mapa grid-ean.")
    size: Size = Field(..., title="Tamaina", description="Zonaren tamaina lauheitara.")

    class Config:
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "type": "residential_light",
                "position": {"x": 10, "y": 15},
                "size": {"w": 2, "h": 2},
            }
        }
