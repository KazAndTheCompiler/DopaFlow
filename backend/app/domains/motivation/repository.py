"""Minimal repository for motivation quotes."""

from __future__ import annotations

from app.domains.motivation.quotes import QUOTES


class MotivationRepository:
    """Expose the in-repo motivation quote list."""

    def list_quotes(self) -> list[str]:
        return list(QUOTES)
