"""Create WATCA reform objects using PolicyEngine Reform.from_dict."""

from policyengine_us import Reform


def create_watca_reform(surtax_enabled: bool = True, year: int = 2026) -> Reform:
    """
    Create a WATCA reform.

    The reform has two components:
    1. Cost of living exemption (always on)
    2. Millionaire surtax (toggled by surtax_enabled)

    Args:
        surtax_enabled: Whether the millionaire surtax is active.
        year: Tax year.

    Returns:
        PolicyEngine Reform object.
    """
    date_range = f"{year}-01-01.2100-12-31"

    reform_dict = {
        "gov.contrib.congress.watca.in_effect": {date_range: True},
        "gov.contrib.congress.watca.surtax.in_effect": {
            date_range: surtax_enabled
        },
    }

    return Reform.from_dict(reform_dict, country_id="us")
