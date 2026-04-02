"""Pure badge progress helpers."""

from __future__ import annotations


def badge_progress(badge_id: str, stats: dict[str, int]) -> float:
    mapping = {
        "first_task": ("tasks_done", 1),
        "tasks_10": ("tasks_done", 10),
        "tasks_100": ("tasks_done", 100),
        "streak_3": ("best_streak", 3),
        "streak_7": ("best_streak", 7),
        "streak_30": ("best_streak", 30),
        "focus_1h": ("focus_minutes", 60),
        "focus_10h": ("focus_minutes", 600),
        "journal_7": ("journal_streak", 7),
        "review_50": ("cards_rated", 50),
        "level_5": ("level", 5),
        "level_10": ("level", 10),
    }
    if badge_id not in mapping:
        return 0.0
    stat_key, target = mapping[badge_id]
    return min(stats.get(stat_key, 0) / target, 1.0)


def newly_earned(badge_id: str, old_progress: float, new_progress: float) -> bool:
    return old_progress < 1.0 and new_progress >= 1.0
