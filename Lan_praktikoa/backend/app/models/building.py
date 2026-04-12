"""Eraikinaren datu eredua eta Swagger deskribapenak."""
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field


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
        ..., title="Zabalera", description="Eraikinaren zabalera laukitan, 1-6 artean.", ge=1, le=6
    )
    h: int = Field(
        ..., title="Altuera", description="Eraikinaren altuera laukitan, 1-6 artean.", ge=1, le=6
    )


class BuildingType(str, Enum):
    """Eraikin motak."""

    # Zentral Elektrikoak
    COAL_POWER = "coal_power"
    HYDRO_POWER = "hydro_power"
    OIL_POWER = "oil_power"
    GAS_POWER = "gas_power"
    NUCLEAR_POWER = "nuclear_power"
    WIND_POWER = "wind_power"
    SOLAR_POWER = "solar_power"
    MICROWAVE_POWER = "microwave_power"
    FUSION_POWER = "fusion_power"

    # Hiri Zerbitzuak
    POLICE_STATION = "police_station"
    FIRE_STATION = "fire_station"
    HOSPITAL = "hospital"
    PRISON = "prison"

    # Hezkuntza
    SCHOOL = "school"
    COLLEGE = "college"
    LIBRARY = "library"
    MUSEUM = "museum"

    # Garraio Azpiegiturak
    BUS_DEPOT = "bus_depot"
    RAIL_STATION = "rail_station"
    SUBWAY_STATION = "subway_station"
    AIRPORT = "airport"
    SEAPORT = "seaport"

    # Ur Sistema
    WATER_PUMP = "water_pump"
    WATER_TREATMENT = "water_treatment"


class Building(BaseModel):
    """Eraikinaren datu eredua."""

    id: str = Field(..., title="Identifikatzailea", description="Eraikinen identifikatzaile bakarra.")
    type: BuildingType = Field(..., title="Mota", description="Eraikinaren mota.")
    position: Position = Field(..., title="Posizioa", description="Eraikinaren kokapena mapa grid-ean.")
    size: Size = Field(..., title="Tamaina", description="Eraikinaren tamaina lauheitara.")
    built_year: int = Field(..., title="Eraikuntza urtea", description="Eraikuntza amaitu zen urteka.")
    built_month: int = Field(..., title="Eraikuntza hilabetea", description="Eraikuntza amaitu zen hilabetea (1-12).", ge=1, le=12)
    age_months: int = Field(
        default=0,
        title="Adina hilabetetan",
        description="Eraikinaren egindako hilabete kopurua.",
        ge=0,
    )
    powered: bool = Field(
        default=False,
        title="Energiaduna",
        description="Eraikinak energia badu ala ezin du funtzionatu.",
    )
    funding_pct: int = Field(
        default=100,
        title="Finantzaketa %",
        description="Eraikinaren finantzaketa maila, %etan.",
        ge=0,
        le=120,
    )
    active: bool = Field(
        default=True,
        title="Aktiboa",
        description="Eraikinaren egoera aktiboa ala ez.",
    )

    class Config:
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "id": "building-001",
                "type": "school",
                "position": {"x": 10, "y": 15},
                "size": {"w": 2, "h": 2},
                "built_year": 2024,
                "built_month": 3,
                "age_months": 3,
                "powered": True,
                "funding_pct": 100,
                "active": True,
            }
        }


class BuildingCreate(BaseModel):
    """Eraikinaren sorrerarako eskaera eredua."""

    type: BuildingType = Field(..., title="Mota", description="Eraikinaren motaren identifikatzailea.")
    position: Position = Field(..., title="Posizioa", description="Eraikinaren hasierako kokapena mapa grid-ean.")
    size: Size = Field(
        default_factory=lambda: Size(w=1, h=1),
        title="Tamaina",
        description="Eraikinaren tamaina lauheitara, gehienez 6x6.",
    )

    class Config:
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "type": "school",
                "position": {"x": 10, "y": 15},
                "size": {"w": 2, "h": 2},
            }
        }
