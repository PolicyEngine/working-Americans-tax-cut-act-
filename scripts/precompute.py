"""
Precompute aggregate impacts for both WATCA reform variants.

Since there are only 2 variants (with/without surtax), we precompute
both and serve them as static JSON from the backend.

Usage:
    python scripts/precompute.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from watca_calc.microsimulation import calculate_aggregate_impact

OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "backend",
    "data",
)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for surtax_enabled, label in [(True, "with_surtax"), (False, "without_surtax")]:
        print(f"Computing aggregate impact ({label})...")
        result = calculate_aggregate_impact(
            surtax_enabled=surtax_enabled, year=2026
        )

        output_path = os.path.join(OUTPUT_DIR, f"aggregate_{label}.json")
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"  Saved to {output_path}")

    print("Done.")


if __name__ == "__main__":
    main()
