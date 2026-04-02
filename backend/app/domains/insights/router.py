# ENDPOINTS
#   GET    /insights/momentum
#   GET    /insights/weekly-digest
#   GET    /insights/correlations

"""API router for the insights domain."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings_dependency
from app.domains.insights.repository import InsightsRepository
from app.domains.insights.schemas import CorrelationInsight, WeeklyDigest
from app.domains.insights.service import InsightsService
from app.middleware.auth_scopes import require_scope
from app.domains.packy.schemas import MomentumScore

router = APIRouter(prefix="/insights", tags=["insights"])


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> InsightsService:
    """Create an insights service backed by the configured database."""

    return InsightsService(InsightsRepository(settings.db_path))


@router.get("/momentum", response_model=MomentumScore, dependencies=[Depends(require_scope("read:insights"))])
async def get_momentum(svc: InsightsService = Depends(_svc)) -> MomentumScore:
    """Return the current momentum score."""

    return svc.momentum()


@router.get("/weekly-digest", response_model=WeeklyDigest, dependencies=[Depends(require_scope("read:insights"))])
async def get_weekly_digest(svc: InsightsService = Depends(_svc)) -> WeeklyDigest:
    """Return the weekly digest."""

    return svc.weekly_digest()


@router.get("/correlations", response_model=list[CorrelationInsight], dependencies=[Depends(require_scope("read:insights"))])
async def get_correlations(svc: InsightsService = Depends(_svc)) -> list[CorrelationInsight]:
    """Return habit-mood and other cross-domain correlations."""

    return svc.correlations()
