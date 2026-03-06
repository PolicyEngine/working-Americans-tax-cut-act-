"""Aggregate (national) impact endpoint serving precomputed data."""

import json
import os

from fastapi import APIRouter, HTTPException

from ..models.requests import AggregateImpactRequest
from ..models.responses import AggregateImpactResponse

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data")


def _load_precomputed(surtax_enabled: bool) -> dict:
    label = "with_surtax" if surtax_enabled else "without_surtax"
    path = os.path.join(DATA_DIR, f"aggregate_{label}.json")
    if not os.path.exists(path):
        raise HTTPException(
            status_code=503,
            detail=f"Precomputed data not available ({label}). Run scripts/precompute.py first.",
        )
    with open(path) as f:
        data = json.load(f)

    # Map JSON keys with spaces to Python-safe Pydantic field names
    intra = data["intra_decile"]
    data["intra_decile"] = {
        "all": {
            "gain_more_than_5pct": intra["all"]["Gain more than 5%"],
            "gain_less_than_5pct": intra["all"]["Gain less than 5%"],
            "no_change": intra["all"]["No change"],
            "lose_less_than_5pct": intra["all"]["Lose less than 5%"],
            "lose_more_than_5pct": intra["all"]["Lose more than 5%"],
        },
        "deciles": {
            "gain_more_than_5pct": intra["deciles"]["Gain more than 5%"],
            "gain_less_than_5pct": intra["deciles"]["Gain less than 5%"],
            "no_change": intra["deciles"]["No change"],
            "lose_less_than_5pct": intra["deciles"]["Lose less than 5%"],
            "lose_more_than_5pct": intra["deciles"]["Lose more than 5%"],
        },
    }

    return data


@router.post("/aggregate-impact", response_model=AggregateImpactResponse)
async def aggregate_impact(request: AggregateImpactRequest):
    """Return precomputed national aggregate impact."""
    data = _load_precomputed(request.surtax_enabled)
    # Build nested poverty structure from flat keys
    data["poverty"] = {
        "poverty": {
            "all": {
                "baseline": data["poverty_baseline_rate"],
                "reform": data["poverty_reform_rate"],
            },
            "child": {
                "baseline": data["child_poverty_baseline_rate"],
                "reform": data["child_poverty_reform_rate"],
            },
        },
        "deep_poverty": {
            "all": {
                "baseline": data["deep_poverty_baseline_rate"],
                "reform": data["deep_poverty_reform_rate"],
            },
            "child": {
                "baseline": data["deep_child_poverty_baseline_rate"],
                "reform": data["deep_child_poverty_reform_rate"],
            },
        },
    }
    return AggregateImpactResponse(**data)
