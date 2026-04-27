"""Router for APM metrics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.apm import get_apm
from app.core.config import Settings, get_settings_dependency

router = APIRouter(prefix="/apm", tags=["apm"])


@router.get("/metrics")
async def get_metrics(
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Get APM metrics."""
    apm = get_apm()
    return apm.get_all_metrics()


@router.get("/system")
async def get_system_metrics(
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Get system resource metrics."""
    apm = get_apm()
    return apm.get_system_metrics()


@router.get("/custom")
async def get_custom_metrics(
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Get custom application metrics."""
    apm = get_apm()
    return apm.metrics.get_metrics()
