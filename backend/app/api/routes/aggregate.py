"""Aggregate (national) impact endpoint serving precomputed data."""

import json
import os

from fastapi import APIRouter, HTTPException

from ..models.requests import AggregateImpactRequest
from ..models.responses import AggregateImpactResponse

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data")
DATA_PATH = os.path.join(DATA_DIR, "aggregate_impacts.json")


def _load_precomputed(variant: str, year: int) -> dict:
    if not os.path.exists(DATA_PATH):
        raise HTTPException(
            status_code=503,
            detail="Precomputed aggregate data not available. Run scripts/precompute.py first.",
        )
    with open(DATA_PATH) as f:
        data = json.load(f)

    try:
        return data["variants"][variant][str(year)]
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Precomputed data not available for {variant} in {year}.",
        ) from exc


@router.post("/aggregate-impact", response_model=AggregateImpactResponse)
async def aggregate_impact(request: AggregateImpactRequest):
    """Return precomputed national aggregate impact."""
    if not request.surtax_enabled:
        raise HTTPException(
            status_code=400,
            detail="Aggregate data is only available for WATCA with the surtax enabled.",
        )

    variant = "with_surtax_lsr_cg" if request.behavioral_responses else "with_surtax"
    data = _load_precomputed(variant, request.year)
    return AggregateImpactResponse(**data)
