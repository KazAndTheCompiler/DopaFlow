"""Pure badge progress helpers."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BadgeDefinition:
    stat_key: str
    target: int
    label: str | None = None


BADGE_REGISTRY: dict[str, BadgeDefinition] = {
    "first_task": BadgeDefinition(stat_key="tasks_done", target=1, label="First Task"),
    "tasks_10": BadgeDefinition(stat_key="tasks_done", target=10, label="10 Tasks"),
    "tasks_100": BadgeDefinition(stat_key="tasks_done", target=100, label="100 Tasks"),
    "streak_3": BadgeDefinition(stat_key="best_streak", target=3, label="3 Day Streak"),
    "streak_7": BadgeDefinition(stat_key="best_streak", target=7, label="7 Day Streak"),
    "streak_30": BadgeDefinition(stat_key="best_streak", target=30, label="30 Day Streak"),
    "focus_1h": BadgeDefinition(stat_key="focus_minutes", target=60, label="1 Hour Focused"),
    "focus_10h": BadgeDefinition(stat_key="focus_minutes", target=600, label="10 Hours Focused"),
    "journal_7": BadgeDefinition(stat_key="journal_streak", target=7, label="7 Journal Days"),
    "review_50": BadgeDefinition(stat_key="cards_rated", target=50, label="50 Reviews"),
    "level_5": BadgeDefinition(stat_key="level", target=5, label="Level 5"),
    "level_10": BadgeDefinition(stat_key="level", target=10, label="Level 10"),
}


def badge_progress(badge_id: str, stats: dict[str, int]) -> float:
    definition = BADGE_REGISTRY.get(badge_id)
    if definition is None:
        return 0.0
    return min(stats.get(definition.stat_key, 0) / definition.target, 1.0)


def newly_earned(badge_id: str, old_progress: float, new_progress: float) -> bool:
    return old_progress < 1.0 and new_progress >= 1.0
