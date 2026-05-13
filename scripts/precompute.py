"""Precompute backend aggregate impacts from regenerated frontend CSVs.

The frontend dashboard and backend aggregate endpoint both serve the same two
policy variants and years. This script builds the backend JSON from the
pipeline CSVs so there is one generated data source of truth.

Usage:
    python scripts/precompute.py
"""

import json
import os

import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DATA_DIR = os.path.join(PROJECT_ROOT, "frontend", "public", "data")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "backend", "data")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "aggregate_impacts.json")

VARIANTS = ("with_surtax", "with_surtax_lsr_cg")
YEARS = tuple(range(2026, 2036))
INTRA_KEYS = {
    "gain_more_than_5pct": "gain_more_5pct",
    "gain_less_than_5pct": "gain_less_5pct",
    "no_change": "no_change",
    "lose_less_than_5pct": "lose_less_5pct",
    "lose_more_than_5pct": "lose_more_5pct",
}


def _number(value):
    """Convert pandas/numpy scalar values into JSON-native numbers."""
    if hasattr(value, "item"):
        return value.item()
    return value


def _load_csvs(input_dir: str = FRONTEND_DATA_DIR) -> dict[str, pd.DataFrame]:
    return {
        name: pd.read_csv(os.path.join(input_dir, f"{name}.csv"))
        for name in (
            "distributional_impact",
            "metrics",
            "winners_losers",
            "income_brackets",
        )
    }


def _filter(df: pd.DataFrame, variant: str, year: int) -> pd.DataFrame:
    return df[(df["variant"] == variant) & (df["year"] == year)]


def _metrics_lookup(metrics: pd.DataFrame, variant: str, year: int) -> dict:
    rows = _filter(metrics, variant, year)
    return {
        str(row.metric): _number(row.value)
        for row in rows.itertuples(index=False)
    }


def _decile_payload(distributional: pd.DataFrame, variant: str, year: int) -> dict:
    rows = _filter(distributional, variant, year).copy()
    rows["decile_sort"] = rows["decile"].astype(int)
    rows = rows.sort_values("decile_sort")
    return {
        "average": {
            str(row.decile): _number(row.average_change)
            for row in rows.itertuples(index=False)
        },
        "relative": {
            str(row.decile): _number(row.relative_change)
            for row in rows.itertuples(index=False)
        },
    }


def _intra_decile_payload(winners_losers: pd.DataFrame, variant: str, year: int) -> dict:
    rows = _filter(winners_losers, variant, year)
    all_row = rows[rows["decile"].astype(str) == "All"].iloc[0]
    decile_rows = rows[rows["decile"].astype(str) != "All"].copy()
    decile_rows["decile_sort"] = decile_rows["decile"].astype(int)
    decile_rows = decile_rows.sort_values("decile_sort")

    return {
        "all": {
            api_key: _number(all_row[csv_key])
            for api_key, csv_key in INTRA_KEYS.items()
        },
        "deciles": {
            api_key: [
                _number(row[csv_key])
                for _, row in decile_rows.iterrows()
            ]
            for api_key, csv_key in INTRA_KEYS.items()
        },
    }


def _income_bracket_payload(income_brackets: pd.DataFrame, variant: str, year: int) -> list[dict]:
    rows = _filter(income_brackets, variant, year)
    return [
        {
            "bracket": str(row.bracket),
            "beneficiaries": _number(row.beneficiaries),
            "total_cost": _number(row.total_cost),
            "avg_benefit": _number(row.avg_benefit),
        }
        for row in rows.itertuples(index=False)
    ]


def _aggregate_payload(csvs: dict[str, pd.DataFrame], variant: str, year: int) -> dict:
    m = _metrics_lookup(csvs["metrics"], variant, year)
    return {
        "budget": {
            "baseline_net_income": m["baseline_net_income"],
            "budgetary_impact": m["budgetary_impact"],
            "federal_tax_revenue_impact": m.get(
                "federal_tax_revenue_impact",
                m["tax_revenue_impact"],
            ),
            "state_tax_revenue_impact": m.get("state_tax_revenue_impact", 0.0),
            "tax_revenue_impact": m["tax_revenue_impact"],
            "benefit_spending_impact": m["benefit_spending_impact"],
            "households": m["households"],
        },
        "decile": _decile_payload(csvs["distributional_impact"], variant, year),
        "intra_decile": _intra_decile_payload(csvs["winners_losers"], variant, year),
        "poverty": {
            "poverty": {
                "all": {
                    "baseline": m["poverty_baseline_rate"],
                    "reform": m["poverty_reform_rate"],
                },
                "child": {
                    "baseline": m["child_poverty_baseline_rate"],
                    "reform": m["child_poverty_reform_rate"],
                },
            },
            "deep_poverty": {
                "all": {
                    "baseline": m["deep_poverty_baseline_rate"],
                    "reform": m["deep_poverty_reform_rate"],
                },
                "child": {
                    "baseline": m["deep_child_poverty_baseline_rate"],
                    "reform": m["deep_child_poverty_reform_rate"],
                },
            },
        },
        "total_cost": m["total_cost"],
        "beneficiaries": m["beneficiaries"],
        "avg_benefit": m["avg_benefit"],
        "winners": m["winners"],
        "losers": m["losers"],
        "winners_rate": m["winners_rate"],
        "losers_rate": m["losers_rate"],
        "poverty_baseline_rate": m["poverty_baseline_rate"],
        "poverty_reform_rate": m["poverty_reform_rate"],
        "poverty_rate_change": m["poverty_rate_change"],
        "poverty_percent_change": m["poverty_percent_change"],
        "child_poverty_baseline_rate": m["child_poverty_baseline_rate"],
        "child_poverty_reform_rate": m["child_poverty_reform_rate"],
        "child_poverty_rate_change": m["child_poverty_rate_change"],
        "child_poverty_percent_change": m["child_poverty_percent_change"],
        "deep_poverty_baseline_rate": m["deep_poverty_baseline_rate"],
        "deep_poverty_reform_rate": m["deep_poverty_reform_rate"],
        "deep_poverty_rate_change": m["deep_poverty_rate_change"],
        "deep_poverty_percent_change": m["deep_poverty_percent_change"],
        "deep_child_poverty_baseline_rate": m["deep_child_poverty_baseline_rate"],
        "deep_child_poverty_reform_rate": m["deep_child_poverty_reform_rate"],
        "deep_child_poverty_rate_change": m["deep_child_poverty_rate_change"],
        "deep_child_poverty_percent_change": m["deep_child_poverty_percent_change"],
        "by_income_bracket": _income_bracket_payload(
            csvs["income_brackets"],
            variant,
            year,
        ),
    }


def build_aggregate_data(input_dir: str = FRONTEND_DATA_DIR) -> dict:
    csvs = _load_csvs(input_dir)
    return {
        "schema_version": 1,
        "variants": {
            variant: {
                str(year): _aggregate_payload(csvs, variant, year)
                for year in YEARS
            }
            for variant in VARIANTS
        },
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    data = build_aggregate_data()
    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"Saved: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
