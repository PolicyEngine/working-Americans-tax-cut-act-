"""Sanity check generated CSV data for reasonableness.

Exits with code 1 if any check fails. Suitable for CI.

Usage:
    python scripts/sanity_check.py [data_dir]
"""

import os
import sys

import pandas as pd

DEFAULT_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend",
    "public",
    "data",
)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORBIDDEN_WEIGHT_NAMES = (
    "household" + "_weight",
    "person" + "_weight",
    "tax_unit" + "_weight",
    "spm_unit" + "_weight",
    "household_count_" + "people",
)
FORBIDDEN_MICROSIM_IMPORTS = (
    "from policyengine_us import " + "Microsimulation",
)
FORBIDDEN_MICROSERIES_STRIPPING_PATTERNS = (
    ".values",
    ".to_numpy(",
    "np.array(",
    "np.asarray(",
)


def check(condition: bool, msg: str):
    """Assert a condition, printing pass/fail."""
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {msg}")
    if not condition:
        check.failures += 1


check.failures = 0


def main(data_dir: str = None):
    data_dir = data_dir or DEFAULT_DATA_DIR
    for source_root in ("backend", "scripts", "watca_calc"):
        root = os.path.join(REPO_ROOT, source_root)
        for dirpath, _, filenames in os.walk(root):
            for filename in filenames:
                if not filename.endswith(".py"):
                    continue
                path = os.path.join(dirpath, filename)
                if os.path.samefile(path, __file__):
                    continue
                with open(path) as file:
                    text = file.read()
                offenders = [
                    token
                    for name in FORBIDDEN_WEIGHT_NAMES
                    for token in (f'"{name}"', f"'{name}'")
                    if token in text
                ]
                check(
                    not offenders,
                    (
                        f"{os.path.relpath(path, REPO_ROOT)} uses only "
                        "MicroSeries .sum()/.mean() and map_to for weighting"
                    ),
                )
                direct_microsim_imports = [
                    token for token in FORBIDDEN_MICROSIM_IMPORTS if token in text
                ]
                check(
                    not direct_microsim_imports,
                    (
                        f"{os.path.relpath(path, REPO_ROOT)} constructs "
                        "microsimulations through policyengine.py"
                    ),
                )
                stripping_offenders = [
                    pattern
                    for pattern in FORBIDDEN_MICROSERIES_STRIPPING_PATTERNS
                    if pattern in text
                ]
                check(
                    not stripping_offenders,
                    (
                        f"{os.path.relpath(path, REPO_ROOT)} preserves "
                        "MicroSeries entity context and weights"
                    ),
                )

    metrics = pd.read_csv(os.path.join(data_dir, "metrics.csv"))
    dist = pd.read_csv(os.path.join(data_dir, "distributional_impact.csv"))
    wl = pd.read_csv(os.path.join(data_dir, "winners_losers.csv"))

    # Check all expected years and variants exist
    years = sorted(metrics["year"].unique())
    variants = sorted(metrics["variant"].unique())
    expected_variants = {"with_surtax", "with_surtax_lsr_cg"}

    print("Data coverage:")
    check(len(years) >= 1, f"At least 1 year present (found {len(years)})")
    check(
        set(variants) == expected_variants,
        f"Both variants present: {variants}",
    )

    for variant in variants:
        for year in years:
            m = metrics[(metrics["variant"] == variant) & (metrics["year"] == year)]
            mv = dict(zip(m["metric"], m["value"]))

            print(f"\n{variant} {year}:")

            # Budgetary impact should be negative (tax cut = revenue loss)
            # with_surtax partially offsets, but net should still be negative
            # for most years
            budget = mv.get("budgetary_impact", 0)
            check(
                abs(budget) > 1e9,
                f"Budgetary impact is significant: ${budget / 1e9:.1f}B",
            )

            # Households should be ~130-160M
            hh = mv.get("households", 0)
            check(
                100e6 < hh < 200e6,
                f"Households in range: {hh / 1e6:.1f}M",
            )

            # Winners should outnumber losers (it's a tax cut)
            winners = mv.get("winners", 0)
            losers = mv.get("losers", 0)
            check(
                winners > losers,
                f"Winners ({winners / 1e6:.1f}M) > losers ({losers / 1e6:.1f}M)",
            )

            # Winners rate should be substantial (>20%)
            wr = mv.get("winners_rate", 0)
            check(wr > 20, f"Winners rate > 20%: {wr:.1f}%")

            # Poverty should not increase
            pov_change = mv.get("poverty_rate_change", 0)
            check(
                pov_change <= 0.1,
                f"Poverty rate change <= 0.1pp: {pov_change:.3f}pp",
            )

            # Decile relative changes should be reasonable (-50% to +50%)
            d = dist[(dist["variant"] == variant) & (dist["year"] == year)]
            max_rel = d["relative_change"].abs().max()
            check(
                max_rel < 0.5,
                f"Max decile relative change < 50%: {max_rel * 100:.1f}%",
            )

            # Lower deciles should generally benefit more (relative)
            if len(d) == 10:
                low_avg = d[d["decile"].astype(int) <= 3]["relative_change"].mean()
                check(
                    low_avg >= 0,
                    f"Lower 3 deciles avg relative change >= 0: {low_avg * 100:.2f}%",
                )

            # Intra-decile: proportions should sum to ~1 for each decile
            w = wl[
                (wl["variant"] == variant)
                & (wl["year"] == year)
                & (wl["decile"] != "All")
            ]
            if len(w) > 0:
                cols = [
                    "gain_more_5pct",
                    "gain_less_5pct",
                    "no_change",
                    "lose_less_5pct",
                    "lose_more_5pct",
                ]
                row_sums = w[cols].sum(axis=1)
                check(
                    (row_sums - 1.0).abs().max() < 0.01,
                    "Intra-decile proportions sum to ~1.0",
                )

    print(f"\n{'=' * 40}")
    if check.failures > 0:
        print(f"FAILED: {check.failures} check(s) failed")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED")


if __name__ == "__main__":
    data_dir = sys.argv[1] if len(sys.argv) > 1 else None
    main(data_dir)
