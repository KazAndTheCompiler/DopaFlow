# ENDPOINTS
#   GET    /gamification/status
#   GET    /gamification/badges
#   POST   /gamification/award

"""API router for the gamification domain."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings_dependency
from app.domains.gamification.repository import GamificationRepository
from app.domains.gamification.schemas import BadgeRead, PlayerLevelRead, XPAwardRequest
from app.domains.gamification.service import GamificationService

router = APIRouter(prefix="/gamification", tags=["gamification"])


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> GamificationService:
    return GamificationService(GamificationRepository(settings.db_path))


@router.get("/status", response_model=dict[str, object])
async def get_status(svc: GamificationService = Depends(_svc)) -> dict[str, object]:
    return svc.get_status()


@router.get("/badges", response_model=list[BadgeRead])
async def get_badges(svc: GamificationService = Depends(_svc)) -> list[BadgeRead]:
    return svc.get_badges()


@router.post("/award", response_model=PlayerLevelRead)
async def award_xp(payload: XPAwardRequest, svc: GamificationService = Depends(_svc)) -> PlayerLevelRead:
    return svc.award(payload.source, payload.source_id)
