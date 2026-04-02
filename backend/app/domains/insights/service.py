"""Business logic for the insights domain."""

from __future__ import annotations

from app.domains.insights.repository import InsightsRepository
from app.domains.insights.schemas import CorrelationInsight, WeeklyDigest
from app.domains.packy.schemas import MomentumScore


class InsightsService:
    """Coordinate momentum, correlation analysis, and weekly digest generation."""

    def __init__(self, repository: InsightsRepository) -> None:
        self.repository = repository

    def momentum(self) -> MomentumScore:
        """Return the cross-domain momentum score."""

        return self.repository.momentum()

    def weekly_digest(self) -> WeeklyDigest:
        """Return the weekly digest."""

        return self.repository.weekly_digest()

    def correlations(self) -> list[CorrelationInsight]:
        """Return trend correlations."""

        return self.repository.correlations()

