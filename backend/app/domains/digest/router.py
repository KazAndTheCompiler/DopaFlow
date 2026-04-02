"""Digest routes."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.domains.digest.service import DigestService
from app.middleware.auth_scopes import require_scope

router = APIRouter(prefix="/digest", tags=["digest"])


@router.get("/today", dependencies=[Depends(require_scope("read:digest"))])
@router.get("/daily", dependencies=[Depends(require_scope("read:digest"))])  # v1 alias
async def digest_today(date: str | None = Query(None)) -> dict[str, object]:
    """Get daily digest for today or a specified date (YYYY-MM-DD)."""
    target_date = datetime.strptime(date, "%Y-%m-%d").date() if date else None
    return DigestService.daily_digest(target_date)


@router.get("/week", dependencies=[Depends(require_scope("read:digest"))])
@router.get("/weekly", dependencies=[Depends(require_scope("read:digest"))])  # v1 alias
async def digest_week(week_start: str | None = Query(None)) -> dict[str, object]:
    """Get weekly digest starting from week_start (YYYY-MM-DD) or current week."""
    week_start_date = datetime.strptime(week_start, "%Y-%m-%d").date() if week_start else None
    return DigestService.weekly_digest(week_start_date)
