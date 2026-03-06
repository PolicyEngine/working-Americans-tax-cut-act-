"""Create WATCA reform objects using the policyengine-us structural reform."""

from policyengine_core.reforms import Reform
from policyengine_us.reforms.congress.watca.working_americans_tax_cut_act import (
    create_watca,
)


def create_watca_reform(surtax_enabled: bool = True, year: int = 2026):
    """
    Create a WATCA reform.

    Uses the structural reform from policyengine-us which overrides
    taxable_income to subtract the cost-of-living exemption and adds
    the millionaire surtax to income_tax_before_credits.

    Args:
        surtax_enabled: Whether the millionaire surtax is active.
        year: Tax year (unused — reform covers all years).

    Returns:
        Tuple of (structural_reform, parameter_reform) for PolicyEngine.
    """
    # Structural reform overriding taxable_income and income_tax_before_credits
    structural_reform = create_watca()

    # Parameter overlay to activate the reform
    date_range = "2020-01-01.2100-12-31"
    param_reform = Reform.from_dict(
        {
            "gov.contrib.congress.watca.in_effect": {date_range: True},
            "gov.contrib.congress.watca.surtax.in_effect": {
                date_range: surtax_enabled,
            },
        },
        country_id="us",
    )

    return (structural_reform, param_reform)
