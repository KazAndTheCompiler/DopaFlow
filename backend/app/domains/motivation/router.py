# ENDPOINTS
#   GET    /motivation/quote
#   GET    /motivation/quote/random

"""Daily and random motivation quote routes."""

from __future__ import annotations

from datetime import date
from random import randrange

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.domains.motivation.quotes import QUOTES
from app.domains.motivation.resources import get_goggins_mp3_path
from app.domains.motivation.schemas import (
    GogginsTriggerResponse,
    MotivationQuoteResponse,
)
from app.domains.motivation.service import MotivationService
from app.middleware.auth_scopes import require_scope

router = APIRouter(prefix="/motivation", tags=["motivation"])
_svc = MotivationService()


@router.get(
    "/quote",
    response_model=MotivationQuoteResponse,
    dependencies=[Depends(require_scope("read:motivation"))],
)
async def daily_quote() -> MotivationQuoteResponse:
    index = date.today().toordinal() % len(QUOTES)
    return MotivationQuoteResponse(quote=QUOTES[index], index=index)


@router.get(
    "/quote/random",
    response_model=MotivationQuoteResponse,
    dependencies=[Depends(require_scope("read:motivation"))],
)
async def random_quote() -> MotivationQuoteResponse:
    index = randrange(len(QUOTES))
    return MotivationQuoteResponse(quote=QUOTES[index], index=index)


@router.post(
    "/trigger",
    response_model=GogginsTriggerResponse,
    dependencies=[Depends(require_scope("write:motivation"))],
)
async def trigger_goggins():
    """Serve the cached Goggins motivation audio file."""

    mp3_path = get_goggins_mp3_path()
    if not mp3_path:
        spoken = _svc.speak_quote()
        return GogginsTriggerResponse(
            triggered=bool(spoken.get("triggered")),
            error=spoken.get("error")
            if isinstance(spoken.get("error"), str)
            else "Goggins audio file not found",
        )
    return FileResponse(mp3_path, media_type="audio/mpeg", filename="goggins.mp3")
