"""Household impact endpoint."""

from fastapi import APIRouter

from ..models.requests import HouseholdRequest
from ..models.responses import HouseholdImpactResponse
from ...services.calculator import calculate_household_impact

router = APIRouter()


@router.post("/household-impact", response_model=HouseholdImpactResponse)
async def household_impact(request: HouseholdRequest):
    """Calculate WATCA impact for a specific household across income range."""
    result = await calculate_household_impact(
        age_head=request.age_head,
        age_spouse=request.age_spouse,
        dependent_ages=request.dependent_ages,
        income=request.income,
        surtax_enabled=request.reform_params.surtax_enabled,
        year=request.year,
    )
    return result
