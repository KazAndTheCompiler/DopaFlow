"""Pure XP and level helpers."""

from __future__ import annotations

XP_TABLE = {
    "task_complete": 10,
    "habit_checkin": 8,
    "focus_session": 15,
    "review_card": 5,
    "journal_entry": 12,
    "streak_milestone": 25,
}

LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5700, 7500]


def xp_for(source: str) -> int:
    return XP_TABLE.get(source, 5)


def level_for(total_xp: int) -> int:
    for i, threshold in enumerate(reversed(LEVEL_THRESHOLDS)):
        if total_xp >= threshold:
            return len(LEVEL_THRESHOLDS) - i
    return 1


def xp_to_next_level(total_xp: int) -> int:
    level = level_for(total_xp)
    if level >= len(LEVEL_THRESHOLDS):
        return 0
    return LEVEL_THRESHOLDS[level] - total_xp


def level_progress(total_xp: int) -> float:
    level = level_for(total_xp)
    floor = 0 if level <= 1 else LEVEL_THRESHOLDS[level - 1]
    if level >= len(LEVEL_THRESHOLDS):
        return 1.0
    ceiling = LEVEL_THRESHOLDS[level]
    return round((total_xp - floor) / max(ceiling - floor, 1), 4)
