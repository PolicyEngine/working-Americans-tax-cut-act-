"""Response models for WATCA calculator API."""

from typing import Dict, List, Optional
from pydantic import BaseModel


class BenefitAtIncome(BaseModel):
    baseline: float
    reform: float
    difference: float


class HouseholdImpactResponse(BaseModel):
    income_range: List[float]
    net_income_change: List[float]
    benefit_at_income: BenefitAtIncome
    x_axis_max: float


class IncomeBracket(BaseModel):
    bracket: str
    beneficiaries: float
    total_cost: float
    avg_benefit: float


class BudgetImpact(BaseModel):
    baseline_net_income: float
    budgetary_impact: float
    tax_revenue_impact: float
    benefit_spending_impact: float
    households: float


class DecileImpact(BaseModel):
    average: Dict[str, float]
    relative: Dict[str, float]


class IntraDecileAll(BaseModel):
    """Population-wide winners/losers breakdown (5% threshold)."""
    gain_more_than_5pct: float
    gain_less_than_5pct: float
    no_change: float
    lose_less_than_5pct: float
    lose_more_than_5pct: float


class IntraDecileDeciles(BaseModel):
    """Per-decile winners/losers breakdown (arrays of 10)."""
    gain_more_than_5pct: List[float]
    gain_less_than_5pct: List[float]
    no_change: List[float]
    lose_less_than_5pct: List[float]
    lose_more_than_5pct: List[float]


class IntraDecile(BaseModel):
    all: IntraDecileAll
    deciles: IntraDecileDeciles


class PovertyGroup(BaseModel):
    baseline: float
    reform: float


class PovertyCategory(BaseModel):
    all: PovertyGroup
    child: PovertyGroup


class PovertyImpact(BaseModel):
    poverty: PovertyCategory
    deep_poverty: PovertyCategory


class AggregateImpactResponse(BaseModel):
    budget: BudgetImpact
    decile: DecileImpact
    intra_decile: IntraDecile
    poverty: PovertyImpact
    # Flat metrics for simple display
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
    by_income_bracket: List[IncomeBracket]


class HealthResponse(BaseModel):
    status: str
    version: str
