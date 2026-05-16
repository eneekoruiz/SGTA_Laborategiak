"""Budget (Aurrekontua) model."""
from typing import List, Optional
from pydantic import BaseModel, Field


class TaxRates(BaseModel):
    """Tax rates model."""

    residential: int = Field(default=7, ge=0, le=20)
    commercial: int = Field(default=7, ge=0, le=20)
    industrial: int = Field(default=7, ge=0, le=20)


class Funding(BaseModel):
    """Service funding levels model."""

    transportation: int = Field(default=100, ge=0, le=120)
    police: int = Field(default=100, ge=0, le=120)
    fire: int = Field(default=100, ge=0, le=120)
    health: int = Field(default=100, ge=0, le=120)
    education: int = Field(default=100, ge=0, le=120)


class Bond(BaseModel):
    """Bond (Bonua) model."""

    id: str
    amount: int = Field(..., gt=0)
    interest_rate: float = Field(default=20.0)  # 20% annual
    months_remaining: int = Field(..., gt=0)
    monthly_payment: float = Field(...)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "bond-001",
                "amount": 10000,
                "interest_rate": 20.0,
                "months_remaining": 240,
                "monthly_payment": 50,
            }
        }


class Budget(BaseModel):
    """Budget data model."""

    tax_rates: TaxRates = Field(default_factory=TaxRates)
    funding: Funding = Field(default_factory=Funding)
    bonds: List[Bond] = Field(default_factory=list)
    last_year_income: float = Field(default=0.0)  # Changed from int to float
    last_year_expenses: float = Field(default=0.0)  # Changed from int to float
    monthly_income: float = Field(default=0.0)  # Changed from int to float
    monthly_expenses: float = Field(default=0.0)  # Changed from int to float

    class Config:
        json_schema_extra = {
            "example": {
                "tax_rates": {"residential": 7, "commercial": 7, "industrial": 7},
                "funding": {
                    "transportation": 100,
                    "police": 100,
                    "fire": 100,
                    "health": 100,
                    "education": 100,
                },
                "bonds": [],
                "last_year_income": 50000.0,
                "last_year_expenses": 45000.0,
                "monthly_income": 4500.0,
                "monthly_expenses": 4000.0,
            }
        }


class BudgetUpdate(BaseModel):
    """Budget update request model."""

    tax_rates: Optional[TaxRates] = None
    funding: Optional[Funding] = None

    class Config:
        json_schema_extra = {
            "example": {
                "tax_rates": {"residential": 8, "commercial": 8, "industrial": 8},
                "funding": None,
            }
        }
