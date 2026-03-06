"""Build PolicyEngine household situations for WATCA calculations."""


def build_household_situation(
    age_head: int,
    age_spouse: int | None,
    dependent_ages: list[int],
    year: int = 2026,
    with_axes: bool = False,
) -> dict:
    """
    Build a PolicyEngine household situation dict.

    Args:
        age_head: Age of household head.
        age_spouse: Age of spouse (None if single).
        dependent_ages: List of dependent ages.
        year: Tax year.
        with_axes: If True, adds AGI sweep axis (0-$2M, 4001 points).

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
            "your household": {"members": ["you"]}
        },
    }

    if with_axes:
        situation["axes"] = [
            [
                {
                    "name": "adjusted_gross_income",
                    "min": 0,
                    "max": 2_000_000,
                    "count": 4_001,
                    "period": year,
                    "target": "tax_unit",
                }
            ]
        ]

    if age_spouse is not None:
        situation["people"]["your partner"] = {"age": {year: age_spouse}}
        for unit in ["families", "spm_units", "tax_units", "households"]:
            key = list(situation[unit].keys())[0]
            situation[unit][key]["members"].append("your partner")
        situation["marital_units"]["your marital unit"]["members"].append(
            "your partner"
        )

    for i, dep_age in enumerate(dependent_ages):
        if i == 0:
            child_id = "your first dependent"
        elif i == 1:
            child_id = "your second dependent"
        else:
            child_id = f"dependent_{i + 1}"

        situation["people"][child_id] = {"age": {year: dep_age}}
        for unit in ["families", "spm_units", "tax_units", "households"]:
            key = list(situation[unit].keys())[0]
            situation[unit][key]["members"].append(child_id)
        situation["marital_units"][f"{child_id}'s marital unit"] = {
            "members": [child_id]
        }

    return situation
