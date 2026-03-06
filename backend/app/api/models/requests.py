"""Request models for WATCA calculator API."""

from pydantic import BaseModel, Field


class ReformParams(BaseModel):
    surtax_enabled: bool = Field(True, description="Enable millionaire surtax")


class HouseholdRequest(BaseModel):
    age_head: int = Field(..., ge=18, le=100)
    age_spouse: int | None = Field(None, ge=18, le=100)
    dependent_ages: list[int] = Field(default_factory=list)
    income: int = Field(..., ge=0)
    year: int = Field(2026, ge=2026, le=2030)
    reform_params: ReformParams = Field(default_factory=ReformParams)


class AggregateImpactRequest(BaseModel):
    surtax_enabled: bool = Field(True)
