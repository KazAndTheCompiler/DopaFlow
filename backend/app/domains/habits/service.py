"""Service helpers for habits analytics."""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import date, timedelta

from app.core.gamification_helpers import award as award_gamification
from app.domains.habits.repository import HabitRepository
from app.domains.habits.schemas import (
    HabitCorrelation,
    HabitTodaySummary,
    HabitWeeklyDays,
    HabitWeeklyItem,
    HabitWeeklyOverview,
)

logger = logging.getLogger(__name__)


def checkin(
    repo: HabitRepository | str, habit_id: str, target_date: str | None = None
) -> dict:
    """Record a habit check-in and award XP."""

    if isinstance(repo, str):
        repo = HabitRepository(repo)
    habit = repo.log_checkin(habit_id, target_date)
    checkin_source_id = (
        f"{habit_id}:{habit.get('last_checkin_date') or target_date or 'unknown'}"
    )
    award_gamification("habit_checkin", checkin_source_id, logger=logger)
    current_streak = int(habit.get("current_streak", 0))
    if current_streak > 0 and current_streak % 7 == 0:
        award_gamification(
            "streak_milestone",
            f"{habit_id}:streak:{current_streak}",
            logger=logger,
        )
    return habit


def weekly_overview(
    logs: list[dict], habit_names: dict[str, str], meta: dict[str, dict]
) -> HabitWeeklyOverview:
    """Build a weekly habit grid for the UI."""

    window = [date.today() - timedelta(days=offset) for offset in range(6, -1, -1)]
    by_habit: dict[str, set[str]] = defaultdict(set)
    for log in logs:
        by_habit[log["habit_id"]].add(str(log["checkin_date"])[:10])
    items = []
    for habit_id, name in habit_names.items():
        days = {
            day.strftime("%a").lower(): day.isoformat() in by_habit.get(habit_id, set())
            for day in window
        }
        info = meta.get(habit_id, {})
        items.append(
            HabitWeeklyItem(
                id=habit_id,
                name=name,
                days=HabitWeeklyDays(**days),
                streak=info.get("current_streak", 0),
                pct_7d=info.get("completion_pct", 0),
            )
        )
    return HabitWeeklyOverview(habits=items)


def pearson_correlation(
    logs: list[dict], habit_names: dict[str, str]
) -> list[HabitCorrelation]:
    """Compute pairwise Pearson correlations between habit check-in vectors."""

    dates = sorted({str(log["checkin_date"])[:10] for log in logs})
    by_habit: dict[str, set[str]] = defaultdict(set)
    for log in logs:
        by_habit[log["habit_id"]].add(str(log["checkin_date"])[:10])
    results = []
    habit_ids = sorted(habit_names)
    for index, left in enumerate(habit_ids):
        for right in habit_ids[index + 1 :]:
            xs = [1 if day in by_habit[left] else 0 for day in dates]
            ys = [1 if day in by_habit[right] else 0 for day in dates]
            n = len(xs)
            if n == 0:
                r = 0.0
            else:
                sum_x = sum(xs)
                sum_y = sum(ys)
                sum_xy = sum(x * y for x, y in zip(xs, ys))
                sum_x2 = sum(x * x for x in xs)
                sum_y2 = sum(y * y for y in ys)
                denom = math.sqrt((n * sum_x2 - sum_x**2) * (n * sum_y2 - sum_y**2))
                r = 0.0 if denom == 0 else (n * sum_xy - sum_x * sum_y) / denom
            interpretation = (
                "positive" if r > 0.15 else "negative" if r < -0.15 else "neutral"
            )
            results.append(
                HabitCorrelation(
                    habit_a=habit_names[left],
                    habit_b=habit_names[right],
                    r=round(r, 4),
                    interpretation=interpretation,
                )
            )
    return results


def today_summary(repo: HabitRepository | str) -> HabitTodaySummary:
    """Return today's habit completion summary."""

    if isinstance(repo, str):
        repo = HabitRepository(repo)
    habits = repo.list_habits()
    today = date.today().isoformat()
    done = sum(1 for habit in habits if habit.get("last_checkin_date") == today)
    missed = max(len(habits) - done, 0)
    completion_pct = round((done / len(habits) * 100) if habits else 0.0, 2)
    return HabitTodaySummary(done=done, missed=missed, completion_pct=completion_pct)
