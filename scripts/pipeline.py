"""Data generation pipeline for WATCA calculator dashboard.

Runs microsimulation for reform variants (with/without surtax, with CBO LSR)
across multiple years and saves output to frontend/public/data/ as CSV files.

Uses subprocess isolation per year to prevent memory accumulation.

Usage:
    python scripts/pipeline.py           # Resume from completed years
    python scripts/pipeline.py --fresh   # Start from scratch
"""

import gc
import json
import os
import subprocess
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Default output directory — Next.js serves files from public/
DEFAULT_OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend",
    "public",
    "data",
)

YEARS = list(range(2026, 2036))
CSV_FILES = [
    "distributional_impact",
    "metrics",
    "winners_losers",
    "income_brackets",
]


def _save_csv(df: pd.DataFrame, path: str) -> None:
    """Save DataFrame to CSV, creating parent directories if needed."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_csv(path, index=False)
    print(f"Saved: {path}")


def _load_existing(output_dir: str) -> dict[str, pd.DataFrame]:
    """Load existing CSVs if they exist."""
    existing = {}
    for name in CSV_FILES:
        path = os.path.join(output_dir, f"{name}.csv")
        if os.path.exists(path):
            existing[name] = pd.read_csv(path)
        else:
            existing[name] = pd.DataFrame()
    return existing


def _completed_years(existing: dict[str, pd.DataFrame]) -> set[int]:
    """Find years that already have metrics data."""
    if existing["metrics"].empty or "year" not in existing["metrics"].columns:
        return set()
    return set(existing["metrics"]["year"].unique()) & set(YEARS)


def _append_rows(
    pending: dict[str, list[list[dict]]],
    name: str,
    rows: list[dict],
) -> None:
    """Buffer rows for later concat."""
    pending[name].append(rows)


def _flush_pending(
    existing: dict[str, pd.DataFrame],
    pending: dict[str, list[list[dict]]],
) -> None:
    """Concat all pending rows into existing DataFrames in one pass."""
    for name in CSV_FILES:
        if not pending[name]:
            continue
        new_df = pd.DataFrame([row for batch in pending[name] for row in batch])
        if existing[name].empty:
            existing[name] = new_df
        else:
            existing[name] = pd.concat([existing[name], new_df], ignore_index=True)
        pending[name].clear()


def _extract_distributional(result: dict, variant: str, year: int) -> list[dict]:
    """Extract distributional impact rows from aggregate result."""
    rows = []
    for decile, avg in result["decile"]["average"].items():
        row = {
            "year": year,
            "variant": variant,
            "decile": decile,
            "average_change": round(avg, 2),
            "relative_change": round(result["decile"]["relative"][decile], 6),
        }
        if "decile_tax" in result:
            row["average_change_tax"] = round(result["decile_tax"]["average"][decile], 2)
            row["relative_change_tax"] = round(result["decile_tax"]["relative"][decile], 6)
        rows.append(row)
    return rows


def _extract_metrics(result: dict, variant: str, year: int) -> list[dict]:
    """Extract flat metrics into rows."""
    metrics = [
        ("budgetary_impact", result["budget"]["budgetary_impact"]),
        ("federal_tax_revenue_impact", result["budget"]["federal_tax_revenue_impact"]),
        ("state_tax_revenue_impact", result["budget"]["state_tax_revenue_impact"]),
        ("tax_revenue_impact", result["budget"]["tax_revenue_impact"]),
        ("benefit_spending_impact", result["budget"]["benefit_spending_impact"]),
        ("baseline_net_income", result["budget"].get("baseline_net_income", 0)),
        ("households", result["budget"]["households"]),
        ("total_cost", result["total_cost"]),
        ("beneficiaries", result["beneficiaries"]),
        ("avg_benefit", result["avg_benefit"]),
        ("winners", result["winners"]),
        ("losers", result["losers"]),
        ("winners_rate", result["winners_rate"]),
        ("losers_rate", result["losers_rate"]),
        ("poverty_baseline_rate", result["poverty_baseline_rate"]),
        ("poverty_reform_rate", result["poverty_reform_rate"]),
        ("poverty_rate_change", result["poverty_rate_change"]),
        ("poverty_percent_change", result["poverty_percent_change"]),
        ("child_poverty_baseline_rate", result["child_poverty_baseline_rate"]),
        ("child_poverty_reform_rate", result["child_poverty_reform_rate"]),
        ("child_poverty_rate_change", result["child_poverty_rate_change"]),
        ("child_poverty_percent_change", result["child_poverty_percent_change"]),
        ("deep_poverty_baseline_rate", result["deep_poverty_baseline_rate"]),
        ("deep_poverty_reform_rate", result["deep_poverty_reform_rate"]),
        ("deep_poverty_rate_change", result["deep_poverty_rate_change"]),
        ("deep_poverty_percent_change", result["deep_poverty_percent_change"]),
        ("deep_child_poverty_baseline_rate", result["deep_child_poverty_baseline_rate"]),
        ("deep_child_poverty_reform_rate", result["deep_child_poverty_reform_rate"]),
        ("deep_child_poverty_rate_change", result["deep_child_poverty_rate_change"]),
        ("deep_child_poverty_percent_change", result["deep_child_poverty_percent_change"]),
    ]
    return [{"year": year, "variant": variant, "metric": k, "value": v} for k, v in metrics]


def _extract_winners_losers(result: dict, variant: str, year: int) -> list[dict]:
    """Extract intra-decile winners/losers data."""
    intra = result["intra_decile"]
    rows = []

    # "All" row
    rows.append({
        "year": year,
        "variant": variant,
        "decile": "All",
        "gain_more_5pct": intra["all"]["Gain more than 5%"],
        "gain_less_5pct": intra["all"]["Gain less than 5%"],
        "no_change": intra["all"]["No change"],
        "lose_less_5pct": intra["all"]["Lose less than 5%"],
        "lose_more_5pct": intra["all"]["Lose more than 5%"],
    })

    # Per-decile rows
    for i in range(10):
        rows.append({
            "year": year,
            "variant": variant,
            "decile": str(i + 1),
            "gain_more_5pct": intra["deciles"]["Gain more than 5%"][i],
            "gain_less_5pct": intra["deciles"]["Gain less than 5%"][i],
            "no_change": intra["deciles"]["No change"][i],
            "lose_less_5pct": intra["deciles"]["Lose less than 5%"][i],
            "lose_more_5pct": intra["deciles"]["Lose more than 5%"][i],
        })

    return rows


def _extract_income_brackets(result: dict, variant: str, year: int) -> list[dict]:
    """Extract income bracket breakdown."""
    return [
        {
            "year": year,
            "variant": variant,
            "bracket": b["bracket"],
            "beneficiaries": b["beneficiaries"],
            "total_cost": b["total_cost"],
            "avg_benefit": b["avg_benefit"],
            "total_cost_tax": b.get("total_cost_tax", 0),
            "avg_benefit_tax": b.get("avg_benefit_tax", 0),
        }
        for b in result["by_income_bracket"]
    ]


# Variant definitions: (surtax_enabled, cbo_lsr, cg_response, label)
VARIANTS = [
    (True, False, False, "with_surtax"),
    (True, True, True, "with_surtax_lsr_cg"),
]


def _run_year_in_process(year: int) -> dict:
    """Run all variants for a single year, then free memory."""
    from watca_calc.microsimulation import calculate_aggregate_impact

    results = {}
    for surtax_enabled, cbo_lsr, cg_response, variant in VARIANTS:
        print(f"  Computing {variant}...")
        results[variant] = calculate_aggregate_impact(
            surtax_enabled=surtax_enabled,
            year=year,
            cbo_lsr=cbo_lsr,
            cg_response=cg_response,
        )
        gc.collect()

    return results


def _run_year_subprocess(year: int) -> dict:
    """Run both variants for one year in a subprocess to isolate memory."""
    worker_script = os.path.join(os.path.dirname(__file__), "_pipeline_worker.py")
    proc = subprocess.run(
        [sys.executable, "-u", worker_script, str(year)],
        capture_output=False,
        stderr=None,  # inherit stderr so progress shows in real-time
        stdout=subprocess.PIPE,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Worker failed for year {year}")
    return json.loads(proc.stdout)


def generate_all_data(
    output_dir: str = None,
    use_subprocess: bool = True,
    fresh: bool = False,
) -> dict[str, pd.DataFrame]:
    """Generate all dashboard data as CSVs for all years and variants."""
    output_dir = output_dir or DEFAULT_OUTPUT_DIR

    if fresh:
        existing = {name: pd.DataFrame() for name in CSV_FILES}
        done = set()
        print("Starting fresh — ignoring any existing data.")
    else:
        existing = _load_existing(output_dir)
        done = _completed_years(existing)
        if done:
            print(f"Found existing data for years: {sorted(done)}")

    remaining = [year for year in YEARS if year not in done]
    if not remaining:
        print("All years already computed. Use --fresh to regenerate.")
        return existing

    pending: dict[str, list[list[dict]]] = {name: [] for name in CSV_FILES}

    for i, year in enumerate(remaining):
        print(f"\n[{i + 1}/{len(YEARS)}] Year {year}...")

        if use_subprocess:
            year_results = _run_year_subprocess(year)
        else:
            year_results = _run_year_in_process(year)

        for variant, result in year_results.items():
            _append_rows(
                pending,
                "distributional_impact",
                _extract_distributional(result, variant, year),
            )
            _append_rows(pending, "metrics", _extract_metrics(result, variant, year))
            _append_rows(
                pending,
                "winners_losers",
                _extract_winners_losers(result, variant, year),
            )
            _append_rows(
                pending,
                "income_brackets",
                _extract_income_brackets(result, variant, year),
            )

        _flush_pending(existing, pending)
        for name in CSV_FILES:
            _save_csv(existing[name], os.path.join(output_dir, f"{name}.csv"))

        print(f"  Year {year} complete.")

    print(f"\nAll data saved to {output_dir}/")
    return existing


if __name__ == "__main__":
    generate_all_data(fresh="--fresh" in sys.argv)
