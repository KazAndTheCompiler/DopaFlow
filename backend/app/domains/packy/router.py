# ENDPOINTS
#   POST   /packy/ask
#   GET    /packy/whisper
#   POST   /packy/lorebook
#   GET    /packy/momentum

"""API router for the Packy domain."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings_dependency
from app.middleware.auth_scopes import require_scope
from app.domains.packy.repository import PackyRepository
from app.domains.packy.schemas import MomentumScore, PackyAnswer, PackyAskRequest, PackyLorebookRequest, PackyWhisper
from app.domains.packy.service import PackyService

router = APIRouter(prefix="/packy", tags=["packy"])


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> PackyService:
    return PackyService(PackyRepository(settings.db_path))


@router.post("/ask", response_model=PackyAnswer, dependencies=[Depends(require_scope("write:packy"))])
async def ask_packy(payload: PackyAskRequest, svc: PackyService = Depends(_svc)) -> PackyAnswer:
    """Handle Packy's main ask endpoint."""

    return svc.ask(payload)


@router.get("/whisper", response_model=PackyWhisper, dependencies=[Depends(require_scope("read:packy"))])
async def get_whisper(svc: PackyService = Depends(_svc)) -> PackyWhisper:
    """Return a Packy proactive tip."""

    return svc.whisper()


@router.post("/lorebook", response_model=dict[str, object], dependencies=[Depends(require_scope("write:packy"))])
async def update_lorebook(payload: PackyLorebookRequest, svc: PackyService = Depends(_svc)) -> dict[str, object]:
    """Push contextual lorebook updates into Packy."""

    return svc.lorebook(payload)


@router.get("/momentum", response_model=MomentumScore, dependencies=[Depends(require_scope("read:packy"))])
async def get_momentum(svc: PackyService = Depends(_svc)) -> MomentumScore:
    """Return the Packy momentum score."""

    return svc.momentum()
