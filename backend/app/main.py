"""FastAPI application for WATCA Calculator."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.routes import health, household, aggregate

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

# CORS
origins = os.environ.get("CORS_ORIGINS", "").split(",") if os.environ.get("CORS_ORIGINS") else settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(household.router, prefix=settings.api_prefix)
app.include_router(aggregate.router, prefix=settings.api_prefix)
