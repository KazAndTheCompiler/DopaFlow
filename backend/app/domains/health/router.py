"""FastAPI router for the health check domain."""

from __future__ import annotations

from fastapi import APIRouter

from app.domains.health.service import HealthService

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_status() -> dict[str, object]:
    """Return system health status, database connectivity, and version."""
    return HealthService.get_status()


@router.get("/detail")
async def health_detail() -> dict[str, object]:
    """Return detailed health payload."""
    return HealthService.get_detail()
