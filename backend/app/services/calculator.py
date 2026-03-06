"""Core calculation logic for WATCA household impact."""

import sys
import os
import numpy as np
from policyengine_us import Simulation

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
)

from watca_calc.household import build_household_situation
from watca_calc.reforms import create_watca_reform


async def calculate_household_impact(
    age_head: int,
    age_spouse: int | None,
    dependent_ages: list[int],
    income: int,
    surtax_enabled: bool = True,
    year: int = 2026,
) -> dict:
    """
    Calculate WATCA impact across income range for a household.

    Returns income sweep data for charting plus point estimate at user's income.
    """
    household = build_household_situation(
        age_head=age_head,
        age_spouse=age_spouse,
        dependent_ages=dependent_ages,
        year=year,
        with_axes=True,
    )

    reform = create_watca_reform(surtax_enabled=surtax_enabled, year=year)

    sim_baseline = Simulation(situation=household)
    sim_reform = Simulation(situation=household, reform=reform)

    income_range = sim_baseline.calculate(
        "adjusted_gross_income", map_to="tax_unit", period=year
    )
    net_baseline = sim_baseline.calculate(
        "household_net_income", map_to="household", period=year
    )
    net_reform = sim_reform.calculate(
        "household_net_income", map_to="household", period=year
    )

    net_income_change = net_reform - net_baseline

    # Point estimate at user's income
    baseline_at_income = float(np.interp(income, income_range, net_baseline))
    reform_at_income = float(np.interp(income, income_range, net_reform))
    difference = reform_at_income - baseline_at_income

    return {
        "income_range": income_range.tolist(),
        "net_income_change": net_income_change.tolist(),
        "benefit_at_income": {
            "baseline": baseline_at_income,
            "reform": reform_at_income,
            "difference": difference,
        },
        "x_axis_max": 2_000_000,
    }
