"""Shared helpers for fire-and-forget gamification awards."""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.domains.gamification.repository import GamificationRepository
from app.domains.gamification.service import GamificationService

logger = logging.getLogger(__name__)


def award(
    source: str, source_id: str | None = None, *, logger: logging.Logger | None = None
) -> None:
    """Award XP for an action. Logs errors but doesn't raise."""
    _log = logger or logging.getLogger(__name__)
    try:
        db = get_settings().db_path
        GamificationService(GamificationRepository(db)).award(source, source_id)
        _log.debug("Awarded gamification: source=%s source_id=%s", source, source_id)
    except Exception:
        # Log at ERROR level - gamification failures shouldn't break core functionality
        _log.exception(
            "Failed to award gamification for source=%s source_id=%s",
            source,
            source_id,
        )
        # Re-raise in development to catch issues early
        if get_settings().dev_auth and not get_settings().production:
            raise
