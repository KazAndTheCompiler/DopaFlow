"""FastAPI router for the health check domain."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.core.config import Settings, get_settings_dependency
from app.domains.health.schemas import (
    HealthLiveResponse,
    HealthReadinessResponse,
    HealthResponse,
)
from app.domains.health.service import HealthService

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health_status(
    settings: Settings = Depends(get_settings_dependency),
) -> HealthResponse:
    """Return system health status, database connectivity, and version."""
    return HealthResponse(**HealthService.get_status(settings.db_path))


@router.get("/live", response_model=HealthLiveResponse)
async def health_live() -> HealthLiveResponse:
    return HealthLiveResponse(status="ok")


@router.get("/detail", response_model=HealthResponse)
async def health_detail(
    settings: Settings = Depends(get_settings_dependency),
) -> HealthResponse:
    """Return detailed health payload."""
    return HealthResponse(**HealthService.get_detail(settings.db_path))


@router.get(
    "/ready",
    response_model=HealthReadinessResponse,
    responses={503: {"model": HealthReadinessResponse}},
)
async def health_ready(
    response: Response,
    settings: Settings = Depends(get_settings_dependency),
) -> HealthReadinessResponse:
    payload = HealthService.get_ready(settings.db_path)
    if payload["status"] != "ready":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthReadinessResponse(**payload)
