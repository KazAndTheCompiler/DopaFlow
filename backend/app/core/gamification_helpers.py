"""Shared helpers for fire-and-forget gamification awards."""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.domains.gamification.repository import GamificationRepository
from app.domains.gamification.service import GamificationService


def award(source: str, source_id: str | None = None, *, logger: logging.Logger | None = None) -> None:
    _log = logger or logging.getLogger(__name__)
    try:
        db = get_settings().db_path
        GamificationService(GamificationRepository(db)).award(source, source_id)
    except Exception:
        _log.exception(
            "Failed to award gamification for source=%s source_id=%s",
            source,
            source_id,
        )
