import pandas as pd

from scripts import pipeline, precompute


def _rows(name: str, year: int, variant: str) -> list[dict]:
    return [
        {"year": year, "variant": variant, "row_id": index}
        for index in range(pipeline.EXPECTED_ROWS_PER_VARIANT[name])
    ]


def _existing_for_year(year: int) -> dict[str, pd.DataFrame]:
    return {
        name: pd.DataFrame(
            [
                row
                for variant in pipeline.VARIANT_LABELS
                for row in _rows(name, year, variant)
            ]
        )
        for name in pipeline.CSV_FILES
    }


def test_completed_years_requires_every_output_file_complete():
    existing = _existing_for_year(2026)
    existing["winners_losers"] = existing["winners_losers"].iloc[:-1]

    assert pipeline._completed_years(existing) == set()


def test_keep_completed_years_drops_partial_rows_before_resume():
    existing = _existing_for_year(2026)
    for name in pipeline.CSV_FILES:
        extra = pd.DataFrame(_rows(name, 2027, pipeline.VARIANT_LABELS[0]))
        existing[name] = pd.concat([existing[name], extra], ignore_index=True)

    completed = pipeline._completed_years(existing)
    cleaned = pipeline._keep_completed_years(existing, completed)

    assert completed == {2026}
    for name in pipeline.CSV_FILES:
        assert set(cleaned[name]["year"]) == {2026}


def test_backend_aggregate_precompute_matches_frontend_csvs():
    data = precompute.build_aggregate_data()
    variant_data = data["variants"]["with_surtax_lsr_cg"]["2026"]

    metrics = pd.read_csv(precompute.FRONTEND_DATA_DIR + "/metrics.csv")
    metric_rows = metrics[
        (metrics["variant"] == "with_surtax_lsr_cg")
        & (metrics["year"] == 2026)
    ]
    expected_metrics = dict(zip(metric_rows["metric"], metric_rows["value"]))

    assert set(data["variants"]) == {"with_surtax", "with_surtax_lsr_cg"}
    assert set(data["variants"]["with_surtax_lsr_cg"]) == {
        str(year) for year in range(2026, 2036)
    }
    assert (
        variant_data["budget"]["budgetary_impact"]
        == expected_metrics["budgetary_impact"]
    )
    assert variant_data["poverty"]["poverty"]["all"]["baseline"] == expected_metrics[
        "poverty_baseline_rate"
    ]
