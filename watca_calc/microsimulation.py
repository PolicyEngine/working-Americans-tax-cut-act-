"""Aggregate impact calculations using enhanced CPS microsimulation."""

import numpy as np
from policyengine_us import Microsimulation

from .reforms import create_watca_reform

DATASET = "enhanced_cps"


def calculate_aggregate_impact(
    surtax_enabled: bool = True, year: int = 2026
) -> dict:
    """
    Calculate national aggregate impact of WATCA reform.

    Args:
        surtax_enabled: Whether millionaire surtax is enabled.
        year: Tax year.

    Returns:
        Dict with aggregate impact metrics.
    """
    reform = create_watca_reform(surtax_enabled=surtax_enabled, year=year)

    sim_baseline = Microsimulation(dataset=DATASET)
    sim_reform = Microsimulation(dataset=DATASET, reform=reform)

    # Household-level net income change
    net_income_baseline = sim_baseline.calculate(
        "household_net_income", period=year, map_to="household"
    )
    net_income_reform = sim_reform.calculate(
        "household_net_income", period=year, map_to="household"
    )
    change = net_income_reform - net_income_baseline

    # Weights and AGI
    household_weight = sim_reform.calculate("household_weight", period=year)
    agi = sim_reform.calculate(
        "adjusted_gross_income", period=year, map_to="household"
    )

    raw_weights = np.array(household_weight)
    total_households = raw_weights.sum()

    # Basic metrics
    total_cost = float(change.sum())
    beneficiaries = float(raw_weights[change > 1].sum())
    avg_benefit = float(change[change > 1].mean()) if (change > 1).any() else 0.0

    # Winners / losers
    winners = float(raw_weights[change > 1].sum())
    losers = float(raw_weights[change < -1].sum())
    winners_rate = float(winners / total_households * 100)
    losers_rate = float(losers / total_households * 100)

    # --- Poverty analysis (person-level) ---
    in_poverty_b = sim_baseline.calculate(
        "in_poverty", period=year, map_to="person"
    )
    in_poverty_r = sim_reform.calculate(
        "in_poverty", period=year, map_to="person"
    )
    person_weight = sim_baseline.calculate("person_weight", period=year)
    total_pop = float(person_weight.sum())

    poverty_baseline_rate = float(in_poverty_b.sum() / total_pop * 100)
    poverty_reform_rate = float(in_poverty_r.sum() / total_pop * 100)
    poverty_rate_change = poverty_reform_rate - poverty_baseline_rate
    poverty_percent_change = (
        (poverty_rate_change / poverty_baseline_rate * 100)
        if poverty_baseline_rate
        else 0.0
    )

    # Child poverty
    is_child = sim_baseline.calculate("is_child", period=year)
    total_children = float(is_child.sum())

    child_pov_b = float((in_poverty_b * is_child).sum())
    child_pov_r = float((in_poverty_r * is_child).sum())
    child_poverty_baseline_rate = (
        child_pov_b / total_children * 100 if total_children else 0.0
    )
    child_poverty_reform_rate = (
        child_pov_r / total_children * 100 if total_children else 0.0
    )
    child_poverty_rate_change = child_poverty_reform_rate - child_poverty_baseline_rate
    child_poverty_percent_change = (
        (child_poverty_rate_change / child_poverty_baseline_rate * 100)
        if child_poverty_baseline_rate
        else 0.0
    )

    # Deep poverty
    in_deep_b = sim_baseline.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )
    in_deep_r = sim_reform.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )
    deep_poverty_baseline_rate = float(in_deep_b.sum() / total_pop * 100)
    deep_poverty_reform_rate = float(in_deep_r.sum() / total_pop * 100)
    deep_poverty_rate_change = deep_poverty_reform_rate - deep_poverty_baseline_rate
    deep_poverty_percent_change = (
        (deep_poverty_rate_change / deep_poverty_baseline_rate * 100)
        if deep_poverty_baseline_rate
        else 0.0
    )

    # Deep child poverty
    deep_child_pov_b = float((in_deep_b * is_child).sum())
    deep_child_pov_r = float((in_deep_r * is_child).sum())
    deep_child_poverty_baseline_rate = (
        deep_child_pov_b / total_children * 100 if total_children else 0.0
    )
    deep_child_poverty_reform_rate = (
        deep_child_pov_r / total_children * 100 if total_children else 0.0
    )
    deep_child_poverty_rate_change = (
        deep_child_poverty_reform_rate - deep_child_poverty_baseline_rate
    )
    deep_child_poverty_percent_change = (
        (deep_child_poverty_rate_change / deep_child_poverty_baseline_rate * 100)
        if deep_child_poverty_baseline_rate
        else 0.0
    )

    # Income bracket breakdown
    income_brackets = [
        (0, 50_000, "Under $50k"),
        (50_000, 100_000, "$50k-$100k"),
        (100_000, 200_000, "$100k-$200k"),
        (200_000, 500_000, "$200k-$500k"),
        (500_000, 1_000_000, "$500k-$1M"),
        (1_000_000, 2_000_000, "$1M-$2M"),
        (2_000_000, float("inf"), "Over $2M"),
    ]

    by_income_bracket = []
    for min_inc, max_inc, label in income_brackets:
        mask = (agi >= min_inc) & (agi < max_inc) & (abs(change) > 1)
        bracket_affected = float(raw_weights[mask].sum())
        bracket_cost = float(change[mask].sum()) if mask.any() else 0.0
        bracket_avg = float(change[mask].mean()) if mask.any() else 0.0
        by_income_bracket.append(
            {
                "bracket": label,
                "beneficiaries": bracket_affected,
                "total_cost": bracket_cost,
                "avg_benefit": bracket_avg,
            }
        )

    return {
        "total_cost": total_cost,
        "beneficiaries": beneficiaries,
        "avg_benefit": avg_benefit,
        "winners": winners,
        "losers": losers,
        "winners_rate": winners_rate,
        "losers_rate": losers_rate,
        "poverty_baseline_rate": poverty_baseline_rate,
        "poverty_reform_rate": poverty_reform_rate,
        "poverty_rate_change": poverty_rate_change,
        "poverty_percent_change": poverty_percent_change,
        "child_poverty_baseline_rate": child_poverty_baseline_rate,
        "child_poverty_reform_rate": child_poverty_reform_rate,
        "child_poverty_rate_change": child_poverty_rate_change,
        "child_poverty_percent_change": child_poverty_percent_change,
        "deep_poverty_baseline_rate": deep_poverty_baseline_rate,
        "deep_poverty_reform_rate": deep_poverty_reform_rate,
        "deep_poverty_rate_change": deep_poverty_rate_change,
        "deep_poverty_percent_change": deep_poverty_percent_change,
        "deep_child_poverty_baseline_rate": deep_child_poverty_baseline_rate,
        "deep_child_poverty_reform_rate": deep_child_poverty_reform_rate,
        "deep_child_poverty_rate_change": deep_child_poverty_rate_change,
        "deep_child_poverty_percent_change": deep_child_poverty_percent_change,
        "by_income_bracket": by_income_bracket,
    }
