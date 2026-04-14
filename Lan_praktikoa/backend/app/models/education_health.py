"""Hezkuntza eta Osasun metrikak 8. talderako.

EQ (Hezkuntza Kalitatea) - 0-200 eskala
HQ (Osasun Kalitatea) - 0-200 eskala

SPECS.md § 6.8 oinarrian.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List


class EducationFacility(BaseModel):
    """Hezkuntza-eraikinen jarraipena."""
    facility_type: str = Field(..., description="school | college | library | museum")
    count: int = Field(default=0, ge=0)
    funding_pct: int = Field(default=100, ge=0, le=120)
    coverage: int = Field(default=0, ge=0, le=100)

    class Config:
        json_schema_extra = {
            "example": {
                "facility_type": "school",
                "count": 5,
                "funding_pct": 100,
                "coverage": 75,
            }
        }


class HealthFacility(BaseModel):
    """Osasun-eraikinen jarraipena."""
    hospitals: int = Field(default=0, ge=0)
    hospital_funding_pct: int = Field(default=100, ge=0, le=120)
    coverage: int = Field(default=0, ge=0, le=100)
    average_lifespan: float = Field(default=50.0)
    mortality_rate: float = Field(default=10.0, ge=0.0, le=100.0)


class EducationMetrics(BaseModel):
    """Hezkuntza kalitate metrikak."""
    eq: int = Field(default=0, ge=0, le=200, description="Hezkuntza Kalitatea 0-200")
    eq_trend: int = Field(default=0, description="EQren hilean behingo aldaketa")
    facilities: List[EducationFacility] = Field(default_factory=list)

    high_tech_industry_pct: float = Field(default=0.0, description="Industria garaikidearen portzentajea")
    crime_reduction_from_eq: float = Field(default=0.0)
    land_value_bonus_from_eq: float = Field(default=0.0)

    class Config:
        json_schema_extra = {
            "example": {
                "eq": 85,
                "eq_trend": 2,
                "facilities": [
                    {"facility_type": "school", "count": 3, "funding_pct": 100, "coverage": 60},
                    {"facility_type": "college", "count": 1, "funding_pct": 100, "coverage": 40},
                ],
                "high_tech_industry_pct": 42.5,
                "crime_reduction_from_eq": 8.5,
                "land_value_bonus_from_eq": 42.5,
            }
        }


class HealthMetrics(BaseModel):
    """Osasun kalitate metrikak."""
    hq: int = Field(default=0, ge=0, le=200, description="Osasun Kalitatea 0-200")
    hq_trend: int = Field(default=0, description="HQren hilean behingo aldaketa")
    hospitals: int = Field(default=0, ge=0)
    hospital_funding_pct: int = Field(default=100, ge=0, le=120)
    average_lifespan: float = Field(default=50.0, description="Batez besteko bizitza adina urteetan")
    mortality_rate: float = Field(default=10.0, ge=0.0, le=100.0, description="Hildakoak 1000 pertsonako")
    pollution_health_impact: float = Field(default=0.0, description="Kutsadurak osasunari egiten dion kaltea")

    class Config:
        json_schema_extra = {
            "example": {
                "hq": 120,
                "hq_trend": 1,
                "hospitals": 2,
                "hospital_funding_pct": 100,
                "average_lifespan": 72.5,
                "mortality_rate": 5.0,
                "pollution_health_impact": 2.5,
            }
        }


class EducationHealthResponse(BaseModel):
    """Hezkuntza eta Osasun erantzun konbinatua."""
    education: EducationMetrics
    health: HealthMetrics
    combined_quality: int = Field(default=0, ge=0, le=400, description="EQ + HQ konbinatua")

    class Config:
        json_schema_extra = {
            "example": {
                "education": {
                    "eq": 85,
                    "eq_trend": 2,
                    "facilities": [],
                    "high_tech_industry_pct": 42.5,
                    "crime_reduction_from_eq": 8.5,
                    "land_value_bonus_from_eq": 42.5,
                },
                "health": {
                    "hq": 120,
                    "hq_trend": 1,
                    "hospitals": 2,
                    "hospital_funding_pct": 100,
                    "average_lifespan": 72.5,
                    "mortality_rate": 5.0,
                    "pollution_health_impact": 2.5,
                },
                "combined_quality": 205,
            }
        }
