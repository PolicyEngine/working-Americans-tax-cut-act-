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
        return json.load(f)


@router.post("/aggregate-impact", response_model=AggregateImpactResponse)
async def aggregate_impact(request: AggregateImpactRequest):
    """Return precomputed national aggregate impact."""
    data = _load_precomputed(request.surtax_enabled)
    return AggregateImpactResponse(**data)
