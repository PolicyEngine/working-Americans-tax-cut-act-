"""Subprocess worker for pipeline.py — runs one variant for one year.

Usage: python scripts/_pipeline_worker.py <year> <surtax> <cbo_lsr> <variant>

Outputs JSON to stdout with the single variant's result.
All progress messages go to stderr to keep stdout clean for JSON.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _convert_for_json(obj):
    """Convert numpy types to Python types for JSON serialization."""
    import numpy as np

    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: _convert_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_for_json(v) for v in obj]
    return obj


def main():
    year = int(sys.argv[1])
    surtax_enabled = sys.argv[2] == "True"
    cbo_lsr = sys.argv[3] == "True"
    variant = sys.argv[4]

    from watca_calc.microsimulation import calculate_aggregate_impact

    print(f"  Computing {variant} {year}...", file=sys.stderr)
    result = calculate_aggregate_impact(
        surtax_enabled=surtax_enabled, year=year, cbo_lsr=cbo_lsr
    )
    result = _convert_for_json(result)
    print(f"  Done: {variant} {year}", file=sys.stderr)

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
