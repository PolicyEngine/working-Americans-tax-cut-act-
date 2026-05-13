from pathlib import Path

from microdf import MicroSeries

import watca_calc.microsimulation as microsimulation
from watca_calc.microsimulation import _new_us_microsimulation


def test_microsimulation_uses_policyengine_py_bundle():
    sim = _new_us_microsimulation()

    bundle = sim.policyengine_bundle
    assert bundle["managed_by"] == "policyengine.py"
    assert bundle["model_package"] == "policyengine-us"
    assert bundle["data_package"] == "policyengine-us-data"
    assert bundle["runtime_dataset"] == "enhanced_cps_2024"


def test_policyengine_py_microsimulation_calculates_eitc():
    sim = _new_us_microsimulation()

    eitc = float(sim.calc("eitc", period=2024, map_to="tax_unit").sum())

    assert 60e9 < eitc < 75e9


def test_policyengine_py_microsimulation_uses_formulaic_person_spm():
    sim = _new_us_microsimulation()

    person_spm = sim.calc("person_in_poverty", period=2026, map_to="person")
    spm_unit_spm = sim.calc("in_poverty", period=2026, map_to="person")

    assert float(person_spm.mean()) == float(spm_unit_spm.mean())


def test_aggregate_path_maps_poverty_to_people_and_uses_microseries(
    monkeypatch,
):
    calls = []
    household_weights = [1.0] * 10
    person_weights = [9.0] + [1.0] * 9

    class TinyMicrosimulation:
        def __init__(self, variant: str):
            self.variant = variant

        def calc(self, variable: str, **kwargs):
            calls.append((self.variant, variable, kwargs))
            map_to = kwargs.get("map_to")
            weights = person_weights if map_to == "person" else household_weights

            if variable in (
                "income_tax",
                "state_income_tax",
                "household_benefits",
            ):
                values = [100.0] * 10
                if self.variant == "reform":
                    values = [90.0] * 10
            elif variable == "household_net_income":
                values = [10_000.0 + i * 1_000 for i in range(10)]
                if self.variant == "reform":
                    values = [value + 100.0 for value in values]
            elif variable == "household_income_decile":
                values = list(range(1, 11))
            elif variable == "person_in_poverty":
                values = [1] + [0] * 9
            elif variable == "in_deep_poverty":
                values = [0] * 10
            elif variable == "age":
                values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
            elif variable == "adjusted_gross_income":
                values = [20_000.0] * 10
            else:
                raise AssertionError(f"Unexpected variable: {variable}")

            return MicroSeries(values, weights=weights)

    def fake_new_us_microsimulation(reform=None, dataset=None):
        return TinyMicrosimulation("reform" if reform is not None else "baseline")

    monkeypatch.setattr(
        microsimulation,
        "create_watca_reform",
        lambda surtax_enabled, year: object(),
    )
    monkeypatch.setattr(
        microsimulation,
        "_new_us_microsimulation",
        fake_new_us_microsimulation,
    )

    result = microsimulation.calculate_aggregate_impact(year=2026)

    person_requests = {
        (variant, variable)
        for variant, variable, kwargs in calls
        if kwargs.get("map_to") == "person"
    }
    assert ("baseline", "person_in_poverty") in person_requests
    assert ("reform", "person_in_poverty") in person_requests
    assert ("baseline", "household_net_income") in person_requests
    assert ("reform", "household_net_income") in person_requests
    assert ("baseline", "household_income_decile") in person_requests

    # Weighted person poverty is 9 / 18 = 50%; unweighted would be 10%.
    assert result["poverty_baseline_rate"] == 50.0


def test_aggregate_microsimulation_preserves_microseries():
    source = (
        Path(__file__).resolve().parents[1]
        / "watca_calc"
        / "microsimulation.py"
    ).read_text()

    forbidden_stripping_patterns = [
        ".values",
        ".to_numpy(",
        "np.array(",
        "np.asarray(",
    ]

    for pattern in forbidden_stripping_patterns:
        assert pattern not in source
