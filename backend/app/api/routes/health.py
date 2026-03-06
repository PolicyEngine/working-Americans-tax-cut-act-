"""Health check endpoint."""

from fastapi import APIRouter

from ...core.config import settings
from ..models.responses import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
    )
