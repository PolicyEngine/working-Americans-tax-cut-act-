"""Response models for WATCA calculator API."""

from pydantic import BaseModel


class BenefitAtIncome(BaseModel):
    baseline: float
    reform: float
    difference: float


class HouseholdImpactResponse(BaseModel):
    income_range: list[float]
    net_income_change: list[float]
    benefit_at_income: BenefitAtIncome
    x_axis_max: float


class IncomeBracket(BaseModel):
    bracket: str
    beneficiaries: float
    total_cost: float
    avg_benefit: float


class AggregateImpactResponse(BaseModel):
    total_cost: float
    beneficiaries: float
    avg_benefit: float
    winners: float
    losers: float
    winners_rate: float
    losers_rate: float
    poverty_baseline_rate: float
    poverty_reform_rate: float
    poverty_rate_change: float
    poverty_percent_change: float
    child_poverty_baseline_rate: float
    child_poverty_reform_rate: float
    child_poverty_rate_change: float
    child_poverty_percent_change: float
    deep_poverty_baseline_rate: float
    deep_poverty_reform_rate: float
    deep_poverty_rate_change: float
    deep_poverty_percent_change: float
    deep_child_poverty_baseline_rate: float
    deep_child_poverty_reform_rate: float
    deep_child_poverty_rate_change: float
    deep_child_poverty_percent_change: float
    by_income_bracket: list[IncomeBracket]


class HealthResponse(BaseModel):
    status: str
    version: str
