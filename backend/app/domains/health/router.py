"""FastAPI router for the health check domain."""

from __future__ import annotations

from fastapi import APIRouter

from app.domains.health.schemas import HealthResponse
from app.domains.health.service import HealthService

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health_status() -> HealthResponse:
    """Return system health status, database connectivity, and version."""
    return HealthResponse(**HealthService.get_status())


@router.get("/detail", response_model=HealthResponse)
async def health_detail() -> HealthResponse:
    """Return detailed health payload."""
    return HealthResponse(**HealthService.get_detail())
