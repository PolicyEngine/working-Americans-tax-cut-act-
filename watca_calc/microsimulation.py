"""Aggregate impact calculations using enhanced CPS microsimulation.

Methodology matches the PolicyEngine API v2 calculate_economy_comparison:
- Budget: household_tax and household_benefits weighted sums
- Decile: uses household_income_decile variable, groupby sum/count for average,
  sum/sum for relative
- Intra-decile: % change floored at max(baseline, 1), ±0.1% no-change band,
  person-weighted via household_count_people
- Poverty: person-level weighted mean of in_poverty boolean
"""

import numpy as np
from policyengine_us import Microsimulation

from .reforms import create_watca_reform


# API v2 intra-decile bounds and labels
_INTRA_BOUNDS = [-np.inf, -0.05, -1e-3, 1e-3, 0.05, np.inf]
_INTRA_LABELS = [
    "Lose more than 5%",
    "Lose less than 5%",
    "No change",
    "Gain less than 5%",
    "Gain more than 5%",
]


def calculate_aggregate_impact(
    surtax_enabled: bool = True, year: int = 2026
) -> dict:
    """
    Calculate national aggregate impact of WATCA reform.

    Follows the PolicyEngine API v2 calculate_economy_comparison methodology.

    Args:
        surtax_enabled: Whether millionaire surtax is enabled.
        year: Tax year.

    Returns:
        Dict matching PolicyEngine API output structure.
    """
    reforms = create_watca_reform(surtax_enabled=surtax_enabled, year=year)

    sim_baseline = Microsimulation()
    sim_reform = Microsimulation(reform=reforms)

    # ===== FISCAL IMPACT (budget) =====
    # Matches API: reform.total_tax - baseline.total_tax
    net_income_baseline = sim_baseline.calculate(
        "household_net_income", period=year, map_to="household"
    )
    net_income_reform = sim_reform.calculate(
        "household_net_income", period=year, map_to="household"
    )
    income_change = net_income_reform - net_income_baseline

    # Tax revenue: API uses household_tax for US
    tax_revenue_baseline = sim_baseline.calculate(
        "household_tax", period=year, map_to="household"
    )
    tax_revenue_reform = sim_reform.calculate(
        "household_tax", period=year, map_to="household"
    )
    tax_revenue_impact = float((tax_revenue_reform - tax_revenue_baseline).sum())

    benefit_baseline = sim_baseline.calculate(
        "household_benefits", period=year, map_to="household"
    )
    benefit_reform = sim_reform.calculate(
        "household_benefits", period=year, map_to="household"
    )
    benefit_spending_impact = float((benefit_reform - benefit_baseline).sum())

    # Weights and AGI
    household_weight = sim_reform.calculate("household_weight", period=year)
    agi = sim_reform.calculate(
        "adjusted_gross_income", period=year, map_to="household"
    )

    raw_weights = np.array(household_weight)
    total_households = raw_weights.sum()
    baseline_net_income = float(net_income_baseline.sum())

    # Budgetary impact = tax_revenue_impact - benefit_spending_impact
    budgetary_impact = float(tax_revenue_impact - benefit_spending_impact)

    # ===== WINNERS / LOSERS =====
    change_arr = np.array(income_change)
    affected_mask = np.abs(change_arr) > 1
    winners_mask = change_arr > 1
    losers_mask = change_arr < -1
    beneficiaries_mask = change_arr > 0

    affected_households = raw_weights[affected_mask].sum()
    beneficiaries = raw_weights[beneficiaries_mask].sum()
    winners = raw_weights[winners_mask].sum()
    losers = raw_weights[losers_mask].sum()

    avg_benefit = float(np.average(change_arr[affected_mask], weights=raw_weights[affected_mask])) if affected_households > 0 else 0.0
    winners_rate = float(winners / total_households * 100) if total_households > 0 else 0.0
    losers_rate = float(losers / total_households * 100) if total_households > 0 else 0.0

    # ===== INCOME DECILE ANALYSIS =====
    # Use PolicyEngine's built-in household_income_decile (matches API)
    decile_arr = np.array(sim_baseline.calculate(
        "household_income_decile", period=year, map_to="household"
    ))
    weight_arr = np.array(household_weight)
    baseline_arr = np.array(net_income_baseline)

    # People per household (for intra-decile, matches API)
    people_arr = np.array(sim_baseline.calculate(
        "household_count_people", period=year, map_to="household"
    ))
    people_weighted = people_arr * weight_arr

    decile_average = {}
    decile_relative = {}
    intra_decile_deciles = {label: [] for label in _INTRA_LABELS}

    # Relative income change for intra-decile: floor denominator at 1 (matches API)
    capped_baseline = np.maximum(baseline_arr, 1)
    rel_change = change_arr / capped_baseline

    for d in range(1, 11):
        dmask = decile_arr == d
        d_weights = weight_arr[dmask]
        d_changes = change_arr[dmask]
        d_baseline = baseline_arr[dmask]
        d_total_weight = d_weights.sum()

        if d_total_weight > 0:
            # Average: total weighted change / total weighted count (matches API groupby.sum / groupby.count)
            weighted_change_sum = float((d_changes * d_weights).sum())
            decile_average[str(d)] = weighted_change_sum / d_total_weight

            # Relative: total weighted change / total weighted baseline (matches API groupby.sum / groupby.sum)
            weighted_baseline_sum = float((d_baseline * d_weights).sum())
            decile_relative[str(d)] = float(weighted_change_sum / weighted_baseline_sum) if weighted_baseline_sum != 0 else 0.0

            # Intra-decile: person-weighted proportions using API bounds
            d_rel = rel_change[dmask]
            d_people = people_weighted[dmask]
            d_total_people = d_people.sum()

            for lower, upper, label in zip(_INTRA_BOUNDS[:-1], _INTRA_BOUNDS[1:], _INTRA_LABELS):
                in_group = (d_rel > lower) & (d_rel <= upper)
                proportion = float(d_people[in_group].sum() / d_total_people) if d_total_people > 0 else 0.0
                intra_decile_deciles[label].append(proportion)
        else:
            decile_average[str(d)] = 0.0
            decile_relative[str(d)] = 0.0
            for label in _INTRA_LABELS:
                intra_decile_deciles[label].append(0.0)

    # Intra-decile "all" — simple average of 10 decile shares (matches API)
    intra_decile_all = {}
    for label in _INTRA_LABELS:
        intra_decile_all[label] = sum(intra_decile_deciles[label]) / 10

    # ===== POVERTY IMPACT =====
    # Person-level weighted mean of boolean (matches API poverty_impact)
    person_weight = np.array(sim_baseline.calculate("person_weight", period=year))
    total_person_weight = person_weight.sum()

    person_in_poverty_baseline = np.array(sim_baseline.calculate(
        "in_poverty", period=year, map_to="person"
    )).astype(bool)
    person_in_poverty_reform = np.array(sim_reform.calculate(
        "in_poverty", period=year, map_to="person"
    )).astype(bool)

    poverty_baseline_rate = float((person_in_poverty_baseline * person_weight).sum() / total_person_weight * 100)
    poverty_reform_rate = float((person_in_poverty_reform * person_weight).sum() / total_person_weight * 100)
    poverty_rate_change = poverty_reform_rate - poverty_baseline_rate
    poverty_percent_change = float(poverty_rate_change / poverty_baseline_rate * 100) if poverty_baseline_rate > 0 else 0.0

    # Child poverty: age < 18 (matches API)
    age = np.array(sim_baseline.calculate("age", period=year))
    is_child = age < 18
    child_weight = person_weight[is_child]
    total_child_weight = child_weight.sum()

    child_poverty_baseline_rate = float((person_in_poverty_baseline[is_child] * child_weight).sum() / total_child_weight * 100) if total_child_weight > 0 else 0.0
    child_poverty_reform_rate = float((person_in_poverty_reform[is_child] * child_weight).sum() / total_child_weight * 100) if total_child_weight > 0 else 0.0
    child_poverty_rate_change = child_poverty_reform_rate - child_poverty_baseline_rate
    child_poverty_percent_change = float(child_poverty_rate_change / child_poverty_baseline_rate * 100) if child_poverty_baseline_rate > 0 else 0.0

    # Deep poverty
    person_in_deep_poverty_baseline = np.array(sim_baseline.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )).astype(bool)
    person_in_deep_poverty_reform = np.array(sim_reform.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )).astype(bool)

    deep_poverty_baseline_rate = float((person_in_deep_poverty_baseline * person_weight).sum() / total_person_weight * 100)
    deep_poverty_reform_rate = float((person_in_deep_poverty_reform * person_weight).sum() / total_person_weight * 100)
    deep_poverty_rate_change = deep_poverty_reform_rate - deep_poverty_baseline_rate
    deep_poverty_percent_change = float(deep_poverty_rate_change / deep_poverty_baseline_rate * 100) if deep_poverty_baseline_rate > 0 else 0.0

    # Deep child poverty
    deep_child_poverty_baseline_rate = float((person_in_deep_poverty_baseline[is_child] * child_weight).sum() / total_child_weight * 100) if total_child_weight > 0 else 0.0
    deep_child_poverty_reform_rate = float((person_in_deep_poverty_reform[is_child] * child_weight).sum() / total_child_weight * 100) if total_child_weight > 0 else 0.0
    deep_child_poverty_rate_change = deep_child_poverty_reform_rate - deep_child_poverty_baseline_rate
    deep_child_poverty_percent_change = float(deep_child_poverty_rate_change / deep_child_poverty_baseline_rate * 100) if deep_child_poverty_baseline_rate > 0 else 0.0

    # ===== INCOME BRACKET BREAKDOWN =====
    agi_arr = np.array(agi)

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
        mask = (agi_arr >= min_inc) & (agi_arr < max_inc) & (np.abs(change_arr) > 1)
        bracket_affected = float(raw_weights[mask].sum())
        bracket_cost = float(income_change[mask].sum()) if bracket_affected > 0 else 0.0
        bracket_avg = float(np.average(change_arr[mask], weights=raw_weights[mask])) if bracket_affected > 0 else 0.0
        by_income_bracket.append(
            {
                "bracket": label,
                "beneficiaries": bracket_affected,
                "total_cost": bracket_cost,
                "avg_benefit": bracket_avg,
            }
        )

    return {
        "budget": {
            "baseline_net_income": baseline_net_income,
            "budgetary_impact": budgetary_impact,
            "tax_revenue_impact": tax_revenue_impact,
            "benefit_spending_impact": benefit_spending_impact,
            "households": float(total_households),
        },
        "decile": {
            "average": decile_average,
            "relative": decile_relative,
        },
        "intra_decile": {
            "all": intra_decile_all,
            "deciles": intra_decile_deciles,
        },
        "total_cost": float(income_change.sum()),
        "beneficiaries": float(beneficiaries),
        "avg_benefit": avg_benefit,
        "winners": float(winners),
        "losers": float(losers),
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
