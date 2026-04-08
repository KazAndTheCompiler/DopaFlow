"""Business logic for the gamification domain."""

from __future__ import annotations

import logging

from app.domains.gamification.badge_engine import badge_progress, newly_earned
from app.domains.gamification.repository import GamificationRepository
from app.domains.gamification.schemas import BadgeRead, PlayerLevelRead
from app.domains.gamification.xp_engine import level_for, xp_for

logger = logging.getLogger(__name__)


class GamificationService:
    def __init__(self, repository: GamificationRepository) -> None:
        self.repo = repository

    def _notify_packy(self, badge: BadgeRead) -> None:
        try:
            from app.domains.packy.repository import PackyRepository
            from app.domains.packy.schemas import PackyLorebookRequest
            from app.domains.packy.service import PackyService

            packy = PackyService(PackyRepository(self.repo.db_path))
            packy.lorebook(
                PackyLorebookRequest(
                    session_id="achievement_badges",
                    headline=f"Achievement unlocked: {badge.name}",
                    body=(
                        f"Player earned '{badge.name}' ({badge.description}). "
                        f"Icon: {badge.icon}. Acknowledge this milestone in future responses."
                    ),
                    tags=[badge.id],
                )
            )
        except Exception:
            logger.exception("Failed to notify Packy about earned badge=%s", badge.id)

    def award(self, source: str, source_id: str | None = None) -> PlayerLevelRead:
        xp = xp_for(source)
        new_total = self.repo.award_xp(source, source_id, xp)
        self.repo.set_level(level_for(new_total))
        stats = self.repo.aggregate_stats()
        stats["level"] = level_for(new_total)
        for badge in self.repo.get_badges():
            if badge.earned_at:
                continue
            new_progress = badge_progress(badge.id, stats)
            if new_progress != badge.progress:
                earned = newly_earned(badge.id, badge.progress, new_progress)
                self.repo.update_badge_progress(badge.id, new_progress, earned)
                if earned:
                    self._notify_packy(BadgeRead(**{**badge.model_dump(), "progress": round(new_progress, 4), "earned_at": "earned"}))
        return self.repo.get_level()

    def get_badges(self) -> list[BadgeRead]:
        return self.repo.get_badges()

    def get_status(self) -> dict[str, object]:
        badges = self.repo.get_badges()
        return {
            "level": self.repo.get_level(),
            "badges": badges,
            "earned_count": sum(1 for badge in badges if badge.earned_at),
        }
