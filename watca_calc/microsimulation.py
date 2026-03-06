"""Aggregate impact calculations using enhanced CPS microsimulation.

Methodology matches the RI CTC calculator and PolicyEngine app-v2 API:
- Fiscal: weighted sum of household net income change
- Distributional: by income bracket using raw weights for counts, MicroSeries for dollars
- Winners/losers: $1 threshold to filter noise, raw weights for household counts
- Poverty: person-level using in_poverty/in_deep_poverty, boolean AND for child filtering
- Decile: income decile average and relative impacts matching app-v2 output schema
- Intra-decile: 5% threshold winners/losers breakdown per decile
"""

import numpy as np
from policyengine_us import Microsimulation

from .reforms import create_watca_reform

# Use default dataset (enhanced CPS) by passing no argument to Microsimulation()


def calculate_aggregate_impact(
    surtax_enabled: bool = True, year: int = 2026
) -> dict:
    """
    Calculate national aggregate impact of WATCA reform.

    Follows the exact methodology from:
    - ri_ctc_calc/calculations/microsimulation.py (weight handling, poverty, brackets)
    - policyengine-app-v2 ReportOutputSocietyWideUS (budget, decile, intra_decile, poverty)

    Args:
        surtax_enabled: Whether millionaire surtax is enabled.
        year: Tax year.

    Returns:
        Dict matching PolicyEngine API output structure.
    """
    reform = create_watca_reform(surtax_enabled=surtax_enabled, year=year)

    sim_baseline = Microsimulation()
    sim_reform = Microsimulation(reform=reform)

    # ===== FISCAL IMPACT (budget) =====
    # Household-level net income change
    net_income_baseline = sim_baseline.calculate(
        "household_net_income", period=year, map_to="household"
    )
    net_income_reform = sim_reform.calculate(
        "household_net_income", period=year, map_to="household"
    )
    ctc_change = net_income_reform - net_income_baseline

    # Tax revenue components
    tax_revenue_baseline = sim_baseline.calculate(
        "income_tax", period=year, map_to="household"
    )
    tax_revenue_reform = sim_reform.calculate(
        "income_tax", period=year, map_to="household"
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

    # IMPORTANT: Extract raw weights as numpy array for household counting
    # MicroSeries.sum() does weighted_sum(value * weight), which double-weights
    # when value IS the weight. For counting households, we need sum(weight).
    raw_weights = np.array(household_weight)
    total_households = raw_weights.sum()

    # Baseline net income for relative calculations
    baseline_net_income = float(net_income_baseline.sum())

    # Budgetary impact = net change in government position
    # Positive = government gains revenue, Negative = government loses revenue
    budgetary_impact = float(tax_revenue_impact - benefit_spending_impact)

    # ===== WINNERS / LOSERS =====
    # Use $1 threshold to filter noise (matches RI methodology)
    affected_mask = np.array(np.abs(ctc_change) > 1)
    winners_mask = np.array(ctc_change > 1)
    losers_mask = np.array(ctc_change < -1)
    beneficiaries_mask = np.array(ctc_change > 0)

    affected_households = raw_weights[affected_mask].sum()
    beneficiaries = raw_weights[beneficiaries_mask].sum()
    winners = raw_weights[winners_mask].sum()
    losers = raw_weights[losers_mask].sum()

    # Average impact across ALL affected households (not just winners)
    avg_benefit = float(ctc_change[affected_mask].mean()) if affected_households > 0 else 0.0
    winners_rate = float(winners / total_households * 100) if total_households > 0 else 0.0
    losers_rate = float(losers / total_households * 100) if total_households > 0 else 0.0

    # ===== INCOME DECILE ANALYSIS =====
    # Sort households into 10 equally-weighted groups by equivalised income
    equiv_income = sim_baseline.calculate(
        "equiv_household_net_income", period=year, map_to="household"
    )
    equiv_arr = np.array(equiv_income)
    weight_arr = np.array(household_weight)
    change_arr = np.array(ctc_change)
    baseline_arr = np.array(net_income_baseline)

    # Weighted decile assignment
    sorted_idx = np.argsort(equiv_arr)
    sorted_weights = weight_arr[sorted_idx]
    cum_weights = np.cumsum(sorted_weights)
    total_weight = cum_weights[-1]

    decile_labels = np.zeros(len(equiv_arr), dtype=int)
    for d in range(10):
        lower = d / 10.0 * total_weight
        upper = (d + 1) / 10.0 * total_weight
        mask = (cum_weights > lower) & (cum_weights <= upper)
        decile_labels[sorted_idx[mask]] = d + 1
    # Assign any remaining to decile 1
    decile_labels[decile_labels == 0] = 1

    decile_average = {}
    decile_relative = {}
    intra_decile_deciles = {
        "Gain more than 5%": [],
        "Gain less than 5%": [],
        "No change": [],
        "Lose less than 5%": [],
        "Lose more than 5%": [],
    }

    for d in range(1, 11):
        dmask = decile_labels == d
        dweights = weight_arr[dmask]
        dchanges = change_arr[dmask]
        dbaseline = baseline_arr[dmask]
        dtotal_weight = dweights.sum()

        if dtotal_weight > 0:
            # Average absolute change (weighted)
            avg_change = float(np.average(dchanges, weights=dweights))
            decile_average[str(d)] = avg_change

            # Relative change: average change / average baseline income
            avg_baseline = float(np.average(dbaseline, weights=dweights))
            decile_relative[str(d)] = float(avg_change / avg_baseline) if avg_baseline != 0 else 0.0

            # Intra-decile winners/losers (5% threshold on relative change)
            with np.errstate(divide="ignore", invalid="ignore"):
                rel_changes = np.where(dbaseline != 0, dchanges / dbaseline, 0.0)

            gain_more_5 = float(dweights[rel_changes > 0.05].sum() / dtotal_weight)
            gain_less_5 = float(dweights[(rel_changes > 0) & (rel_changes <= 0.05)].sum() / dtotal_weight)
            no_change = float(dweights[rel_changes == 0].sum() / dtotal_weight)
            lose_less_5 = float(dweights[(rel_changes < 0) & (rel_changes >= -0.05)].sum() / dtotal_weight)
            lose_more_5 = float(dweights[rel_changes < -0.05].sum() / dtotal_weight)

            intra_decile_deciles["Gain more than 5%"].append(gain_more_5)
            intra_decile_deciles["Gain less than 5%"].append(gain_less_5)
            intra_decile_deciles["No change"].append(no_change)
            intra_decile_deciles["Lose less than 5%"].append(lose_less_5)
            intra_decile_deciles["Lose more than 5%"].append(lose_more_5)
        else:
            decile_average[str(d)] = 0.0
            decile_relative[str(d)] = 0.0
            for cat in intra_decile_deciles:
                intra_decile_deciles[cat].append(0.0)

    # Intra-decile "all" (population-wide)
    with np.errstate(divide="ignore", invalid="ignore"):
        all_rel = np.where(baseline_arr != 0, change_arr / baseline_arr, 0.0)
    intra_decile_all = {
        "Gain more than 5%": float(weight_arr[all_rel > 0.05].sum() / total_weight),
        "Gain less than 5%": float(weight_arr[(all_rel > 0) & (all_rel <= 0.05)].sum() / total_weight),
        "No change": float(weight_arr[all_rel == 0].sum() / total_weight),
        "Lose less than 5%": float(weight_arr[(all_rel < 0) & (all_rel >= -0.05)].sum() / total_weight),
        "Lose more than 5%": float(weight_arr[all_rel < -0.05].sum() / total_weight),
    }

    # ===== POVERTY IMPACT =====
    # Person-level analysis (matches RI methodology exactly)
    total_population = float(sim_baseline.calculate("person_count", period=year).sum())

    person_in_poverty_baseline = sim_baseline.calculate(
        "in_poverty", period=year, map_to="person"
    )
    person_in_poverty_reform = sim_reform.calculate(
        "in_poverty", period=year, map_to="person"
    )

    poverty_baseline_count = person_in_poverty_baseline.sum()
    poverty_reform_count = person_in_poverty_reform.sum()
    poverty_baseline_rate = float(poverty_baseline_count / total_population * 100) if total_population > 0 else 0.0
    poverty_reform_rate = float(poverty_reform_count / total_population * 100) if total_population > 0 else 0.0
    poverty_rate_change = poverty_reform_rate - poverty_baseline_rate
    poverty_percent_change = float((poverty_reform_rate - poverty_baseline_rate) / poverty_baseline_rate * 100) if poverty_baseline_rate > 0 else 0.0

    # Child poverty (boolean AND, matching RI methodology)
    is_child = sim_baseline.calculate("is_child", period=year)
    total_children = float(is_child.sum())

    child_poverty_baseline_count = (person_in_poverty_baseline & is_child).sum()
    child_poverty_reform_count = (person_in_poverty_reform & is_child).sum()
    child_poverty_baseline_rate = float(child_poverty_baseline_count / total_children * 100) if total_children > 0 else 0.0
    child_poverty_reform_rate = float(child_poverty_reform_count / total_children * 100) if total_children > 0 else 0.0
    child_poverty_rate_change = child_poverty_reform_rate - child_poverty_baseline_rate
    child_poverty_percent_change = float((child_poverty_reform_rate - child_poverty_baseline_rate) / child_poverty_baseline_rate * 100) if child_poverty_baseline_rate > 0 else 0.0

    # Deep poverty
    person_in_deep_poverty_baseline = sim_baseline.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )
    person_in_deep_poverty_reform = sim_reform.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )

    deep_poverty_baseline_count = person_in_deep_poverty_baseline.sum()
    deep_poverty_reform_count = person_in_deep_poverty_reform.sum()
    deep_poverty_baseline_rate = float(deep_poverty_baseline_count / total_population * 100) if total_population > 0 else 0.0
    deep_poverty_reform_rate = float(deep_poverty_reform_count / total_population * 100) if total_population > 0 else 0.0
    deep_poverty_rate_change = deep_poverty_reform_rate - deep_poverty_baseline_rate
    deep_poverty_percent_change = float((deep_poverty_reform_rate - deep_poverty_baseline_rate) / deep_poverty_baseline_rate * 100) if deep_poverty_baseline_rate > 0 else 0.0

    # Deep child poverty
    deep_child_poverty_baseline_count = (person_in_deep_poverty_baseline & is_child).sum()
    deep_child_poverty_reform_count = (person_in_deep_poverty_reform & is_child).sum()
    deep_child_poverty_baseline_rate = float(deep_child_poverty_baseline_count / total_children * 100) if total_children > 0 else 0.0
    deep_child_poverty_reform_rate = float(deep_child_poverty_reform_count / total_children * 100) if total_children > 0 else 0.0
    deep_child_poverty_rate_change = deep_child_poverty_reform_rate - deep_child_poverty_baseline_rate
    deep_child_poverty_percent_change = float((deep_child_poverty_reform_rate - deep_child_poverty_baseline_rate) / deep_child_poverty_baseline_rate * 100) if deep_child_poverty_baseline_rate > 0 else 0.0

    # ===== INCOME BRACKET BREAKDOWN =====
    # Convert to numpy for consistent masking (matches RI methodology)
    agi_arr = np.array(agi)
    ctc_arr = np.array(ctc_change)

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
        # Include ALL affected households (positive or negative impact)
        mask = (agi_arr >= min_inc) & (agi_arr < max_inc) & (np.abs(ctc_arr) > 1)
        # Use raw weights for household counts, MicroSeries for weighted sums
        bracket_affected = float(raw_weights[mask].sum())
        bracket_cost = float(ctc_change[mask].sum()) if bracket_affected > 0 else 0.0
        bracket_avg = float(ctc_change[mask].mean()) if bracket_affected > 0 else 0.0
        by_income_bracket.append(
            {
                "bracket": label,
                "beneficiaries": bracket_affected,
                "total_cost": bracket_cost,
                "avg_benefit": bracket_avg,
            }
        )

    return {
        # Budget (matches app-v2 ReportOutputSocietyWideUS.budget)
        "budget": {
            "baseline_net_income": baseline_net_income,
            "budgetary_impact": budgetary_impact,
            "tax_revenue_impact": tax_revenue_impact,
            "benefit_spending_impact": benefit_spending_impact,
            "households": float(total_households),
        },
        # Decile (matches app-v2 ReportOutputSocietyWideUS.decile)
        "decile": {
            "average": decile_average,
            "relative": decile_relative,
        },
        # Intra-decile winners/losers (matches app-v2 ReportOutputSocietyWideUS.intra_decile)
        "intra_decile": {
            "all": intra_decile_all,
            "deciles": intra_decile_deciles,
        },
        # Poverty (matches app-v2 ReportOutputSocietyWideUS.poverty)
        "poverty": {
            "poverty": {
                "all": {
                    "baseline": poverty_baseline_rate,
                    "reform": poverty_reform_rate,
                },
                "child": {
                    "baseline": child_poverty_baseline_rate,
                    "reform": child_poverty_reform_rate,
                },
            },
            "deep_poverty": {
                "all": {
                    "baseline": deep_poverty_baseline_rate,
                    "reform": deep_poverty_reform_rate,
                },
                "child": {
                    "baseline": deep_child_poverty_baseline_rate,
                    "reform": deep_child_poverty_reform_rate,
                },
            },
        },
        # Flat metrics for backward compatibility with existing frontend
        "total_cost": float(ctc_change.sum()),
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
