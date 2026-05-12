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
