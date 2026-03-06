"""Build PolicyEngine household situations for WATCA calculations."""

_GROUP_UNITS = ["families", "spm_units", "tax_units", "households"]


def _add_member_to_units(situation, member_id):
    """Append a member to all group units (families, spm, tax, households)."""
    for unit in _GROUP_UNITS:
        key = next(iter(situation[unit]))
        situation[unit][key]["members"].append(member_id)


def build_household_situation(
    age_head: int,
    age_spouse: int | None,
    dependent_ages: list[int],
    year: int = 2026,
    with_axes: bool = False,
    max_earnings: int = 2_000_000,
    state_code: str = "CA",
) -> dict:
    """
    Build a PolicyEngine household situation dict.

    Args:
        age_head: Age of household head.
        age_spouse: Age of spouse (None if single).
        dependent_ages: List of dependent ages.
        year: Tax year.
        with_axes: If True, adds AGI sweep axis.
        max_earnings: Maximum AGI for the sweep axis.

    Returns:
        PolicyEngine situation dict.
    """
    situation = {
        "people": {"you": {"age": {year: age_head}}},
        "families": {"your family": {"members": ["you"]}},
        "marital_units": {"your marital unit": {"members": ["you"]}},
        "spm_units": {"your household": {"members": ["you"]}},
        "tax_units": {"your tax unit": {"members": ["you"]}},
        "households": {
            "your household": {
                "members": ["you"],
                "state_code": {year: state_code},
            }
        },
    }

    if with_axes:
        situation["axes"] = [
            [
                {
                    "name": "adjusted_gross_income",
                    "min": 0,
                    "max": max_earnings,
                    "count": min(4_001, max(501, max_earnings // 500)),
                    "period": year,
                    "target": "tax_unit",
                }
            ]
        ]

    if age_spouse is not None:
        situation["people"]["your partner"] = {
            "age": {year: age_spouse}
        }
        _add_member_to_units(situation, "your partner")
        situation["marital_units"]["your marital unit"][
            "members"
        ].append("your partner")

    for i, dep_age in enumerate(dependent_ages):
        if i == 0:
            child_id = "your first dependent"
        elif i == 1:
            child_id = "your second dependent"
        else:
            child_id = f"dependent_{i + 1}"

        situation["people"][child_id] = {"age": {year: dep_age}}
        _add_member_to_units(situation, child_id)
        situation["marital_units"][f"{child_id}'s marital unit"] = {
            "members": [child_id]
        }

    return situation
