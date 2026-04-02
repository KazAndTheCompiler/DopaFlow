"""Pydantic schemas for the insights domain."""

from __future__ import annotations

from pydantic import BaseModel


class WeeklyDigest(BaseModel):
    """Summary payload for the weekly digest surface."""

    title: str
    highlights: list[str]


class CorrelationInsight(BaseModel):
    """Correlation metric between two user signals."""

    metric: str
    pearson_r: float | None = None
    interpretation: str

