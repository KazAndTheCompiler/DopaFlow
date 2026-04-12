"""Digest composition service with Pearson correlation analysis."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.core.config import Settings
from app.core.database import get_db
from app.domains.digest.repository import DigestRepository
from app.domains.digest.schemas import (
    DailyDigestResponse,
    DigestCorrelation,
    DigestFocusSummary,
    DigestHabitSummary,
    DigestHabitSummaryItem,
    DigestJournalSummary,
    DigestNutritionSummary,
    DigestTagCount,
    DigestTaskSummary,
    WeeklyDigestResponse,
)


def _pearson(xs: list[float], ys: list[float]) -> float:
    if len(xs) != len(ys) or len(xs) < 2:
        return 0.0
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denom_x = sum((x - mean_x) ** 2 for x in xs) ** 0.5
    denom_y = sum((y - mean_y) ** 2 for y in ys) ** 0.5
    if not denom_x or not denom_y:
        return 0.0
    return numerator / (denom_x * denom_y)


def _confidence_for(value: float) -> str:
    magnitude = abs(value)
    if magnitude >= 0.75:
        return "high"
    if magnitude >= 0.55:
        return "medium"
    return "low"


_MOOD_MAP = {"😊": 5, "🙂": 4, "😐": 3, "😟": 2, "😢": 1, "😡": 2, "🤩": 5}


def _mood_score(emoji: str | None) -> int:
    return _MOOD_MAP.get((emoji or "").strip(), 3)


def _compute_correlations(
    start: date,
    end: date,
    task_daily: dict,
    habit_daily: dict,
    focus_daily: dict,
    journal_daily: dict,
    repo: DigestRepository,
) -> list[DigestCorrelation]:
    days = [
        (start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)
    ]
    if len(days) < 7:
        return []

    correlations: list[DigestCorrelation] = []
    focus_minutes = [float(focus_daily.get(day, {}).get("minutes", 0)) for day in days]

    try:
        with get_db(repo.settings) as conn:
            habits = conn.execute(
                "SELECT name FROM habits WHERE deleted_at IS NULL"
            ).fetchall()
            habit_names = [h["name"] for h in habits]
    except Exception:  # noqa: BLE001
        habit_names = []

    for name in habit_names:
        habit_series = [
            float(1 if habit_daily.get(day, {}).get("done", 0) > 0 else 0)
            for day in days
        ]
        pearson_r = _pearson(habit_series, focus_minutes)
        if abs(pearson_r) < 0.4:
            continue
        active_days = [i for i, v in enumerate(habit_series) if v > 0]
        baseline_days = [i for i, v in enumerate(habit_series) if v == 0]
        if not active_days or not baseline_days:
            continue
        avg_focus_active = sum(focus_minutes[i] for i in active_days) / len(active_days)
        avg_focus_base = sum(focus_minutes[i] for i in baseline_days) / len(
            baseline_days
        )
        delta_pct = round(
            ((avg_focus_active - avg_focus_base) / max(avg_focus_base, 1.0)) * 100
        )
        direction = "higher" if delta_pct >= 0 else "lower"
        correlations.append(
            DigestCorrelation(
                type="habit_vs_focus",
                habit_name=name,
                metric="focus_output",
                pearson_r=round(pearson_r, 3),
                direction=direction,
                delta_pct=delta_pct,
                description=f"{name.title()} → {abs(delta_pct)}% {direction} focus output",
                confidence=_confidence_for(pearson_r),
            )
        )

    journal_flags = [
        1.0 if journal_daily.get(day, {}).get("has_journal") else 0.0 for day in days
    ]
    task_completed = [
        float(task_daily.get(day, {}).get("completed", 0)) for day in days
    ]
    journal_task = _pearson(journal_flags, task_completed)
    journal_days = [i for i, v in enumerate(journal_flags) if v]
    non_journal_days = [i for i, v in enumerate(journal_flags) if not v]
    if journal_days and non_journal_days:
        avg_j = sum(task_completed[i] for i in journal_days) / len(journal_days)
        avg_o = sum(task_completed[i] for i in non_journal_days) / len(non_journal_days)
        if avg_o >= 0:
            delta_pct = ((avg_j - avg_o) / max(avg_o, 1.0)) * 100
            if abs(delta_pct) > 20:
                direction = "higher" if delta_pct > 0 else "lower"
                correlations.append(
                    DigestCorrelation(
                        type="journal_vs_tasks",
                        description=f"Task completion was {round(abs(delta_pct))}% {direction} on days with a journal entry.",
                        confidence=_confidence_for(
                            journal_task or (0.55 if abs(delta_pct) > 35 else 0.45)
                        ),
                    )
                )

    review_daily = repo.review_daily(start, end)
    focus_flags = [
        1.0 if focus_daily.get(day, {}).get("sessions", 0) > 0 else 0.0 for day in days
    ]
    review_scores = []
    enough_review_data = 0
    for day in days:
        cs = float(review_daily.get(day, {}).get("cards_seen", 0))
        ret = float(review_daily.get(day, {}).get("retained", 0))
        if cs > 0:
            enough_review_data += 1
            review_scores.append((ret / cs) * 100)
        else:
            review_scores.append(0.0)
    if enough_review_data >= 7:
        focus_review = _pearson(focus_flags, review_scores)
        fr_days = [i for i, v in enumerate(focus_flags) if v and review_scores[i] > 0]
        nfr_days = [
            i for i, v in enumerate(focus_flags) if not v and review_scores[i] > 0
        ]
        if fr_days and nfr_days:
            avg_fr = sum(review_scores[i] for i in fr_days) / len(fr_days)
            avg_nfr = sum(review_scores[i] for i in nfr_days) / len(nfr_days)
            if abs(avg_fr - avg_nfr) >= 10:
                direction = "higher" if avg_fr > avg_nfr else "lower"
                correlations.append(
                    DigestCorrelation(
                        type="focus_vs_review",
                        description=f"Review retention was {round(abs(avg_fr - avg_nfr))} points {direction} on days with a focus session.",
                        confidence=_confidence_for(focus_review or 0.45),
                    )
                )

    return sorted(correlations, key=lambda x: abs(x.pearson_r or 0), reverse=True)[:3]


def _build_task_summary(tasks: dict) -> DigestTaskSummary:
    return DigestTaskSummary(
        completed=int(tasks.get("completed") or 0),
        created=int(tasks.get("created") or 0),
        overdue=int(tasks.get("overdue") or 0),
        completion_rate=float(tasks.get("completion_rate") or 0),
        top_tags=[
            DigestTagCount(tag=t["tag"], count=t["count"])
            for t in tasks.get("top_tags", [])
        ],
    )


def _build_habit_summary(habits: dict) -> DigestHabitSummary:
    return DigestHabitSummary(
        overall_rate=float(habits.get("overall_rate") or 0),
        by_habit=[
            DigestHabitSummaryItem(
                name=h["name"], done=int(h["done"]), rate=float(h["rate"])
            )
            for h in habits.get("by_habit", [])
        ],
        best_habit=str(habits.get("best_habit") or ""),
        worst_habit=str(habits.get("worst_habit") or ""),
    )


def _build_focus_summary(focus: dict) -> DigestFocusSummary:
    return DigestFocusSummary(
        total_sessions=int(focus.get("total_sessions") or 0),
        total_minutes=int(focus.get("total_minutes") or 0),
        completion_rate=float(focus.get("completion_rate") or 0),
        best_day=str(focus.get("best_day") or ""),
    )


def _build_journal_summary(journal: dict) -> DigestJournalSummary:
    return DigestJournalSummary(
        entries_written=int(journal.get("entries_written") or 0),
        avg_word_count=float(journal.get("avg_word_count") or 0),
        top_tags=[
            DigestTagCount(tag=t["tag"], count=t["count"])
            for t in journal.get("top_tags", [])
        ],
        mood_distribution=dict(journal.get("mood_distribution") or {}),
    )


def _build_nutrition_summary(nutrition: dict) -> DigestNutritionSummary:
    return DigestNutritionSummary(
        total_kcal=float(nutrition.get("total_kcal") or 0),
        avg_kcal=float(nutrition.get("avg_kcal") or 0),
        days_logged=int(nutrition.get("days_logged") or 0),
        protein_g=float(nutrition.get("protein_g") or 0),
        fat_g=float(nutrition.get("fat_g") or 0),
        carbs_g=float(nutrition.get("carbs_g") or 0),
    )


class DigestService:
    @staticmethod
    def daily_digest(target_date: date | None = None, *, settings: Settings) -> DailyDigestResponse:
        """Build daily digest for a single day."""
        target_date = target_date or datetime.now(UTC).date()
        repo = DigestRepository(settings)
        tasks, _task_daily = repo.tasks_summary(target_date, target_date)
        habits, _habit_daily = repo.habits_summary(target_date, target_date)
        focus, _focus_daily = repo.focus_summary(target_date, target_date)
        journal, _journal_daily = repo.journal_summary(target_date, target_date)
        nutrition = repo.nutrition_summary(target_date, target_date)

        momentum_score = round(
            (
                float(tasks["completion_rate"]) * 0.35
                + float(habits["overall_rate"]) * 0.25
                + float(focus["completion_rate"]) * 0.2
            )
            / 100,
            3,
        )
        score = int(
            round(
                float(tasks["completion_rate"]) * 0.35
                + float(habits["overall_rate"]) * 0.25
                + float(focus["completion_rate"]) * 0.2
                + min(100, int(journal["entries_written"]) * 20) * 0.2
            )
        )
        habits_done_today = sum(
            int(item.get("done") or 0) for item in habits.get("by_habit", [])
        )

        return DailyDigestResponse(
            date=target_date.isoformat(),
            tasks=_build_task_summary(tasks),
            habits=_build_habit_summary(habits),
            focus=_build_focus_summary(focus),
            journal=_build_journal_summary(journal),
            momentum_score=momentum_score,
            momentum_label="rising"
            if momentum_score > 0.7
            else "steady"
            if momentum_score >= 0.4
            else "low",
            score=score,
            tasks_completed_today=int(tasks.get("completed") or 0),
            focus_minutes_today=int(focus.get("total_minutes") or 0),
            habits_done_today=habits_done_today,
            habit_total=len(habits.get("by_habit", [])),
            nutrition=_build_nutrition_summary(nutrition),
            correlations=[],
        )

    @staticmethod
    def weekly_digest(week_start: date | None = None, *, settings: Settings) -> WeeklyDigestResponse:
        """Build weekly digest with Pearson correlation analysis."""
        if not week_start:
            today = datetime.now(UTC).date()
            week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        repo = DigestRepository(settings)
        tasks, task_daily = repo.tasks_summary(week_start, week_end)
        habits, habit_daily = repo.habits_summary(week_start, week_end)
        focus, focus_daily = repo.focus_summary(week_start, week_end)
        journal, journal_daily = repo.journal_summary(week_start, week_end)
        nutrition = repo.nutrition_summary(week_start, week_end)

        correlations = _compute_correlations(
            week_start,
            week_end,
            task_daily,
            habit_daily,
            focus_daily,
            journal_daily,
            repo,
        )

        recent_days = [
            (week_end - timedelta(days=i)).isoformat() for i in range(6, -1, -1)
        ]
        weighted_total = 0.0
        weighted_score = 0.0
        for idx, day in enumerate(recent_days):
            task_norm = min(
                1.0,
                float(task_daily.get(day, {}).get("completed", 0))
                / max(float(task_daily.get(day, {}).get("created", 0)), 1.0),
            )
            habits_norm = float(habit_daily.get(day, {}).get("done", 0)) / max(
                float(habit_daily.get(day, {}).get("total", 0)), 1.0
            )
            focus_norm = min(
                1.0, float(focus_daily.get(day, {}).get("minutes", 0)) / 60.0
            )
            journal_norm = 1.0 if journal_daily.get(day, {}).get("has_journal") else 0.0
            day_score = (
                task_norm * 0.35
                + habits_norm * 0.25
                + focus_norm * 0.20
                + journal_norm * 0.20
            )
            weight = 0.9 ** (len(recent_days) - idx - 1)
            weighted_total += weight
            weighted_score += day_score * weight

        momentum_score = round(
            (weighted_score / weighted_total) if weighted_total else 0.0, 3
        )
        score = int(
            round(
                float(tasks["completion_rate"]) * 0.35
                + float(habits["overall_rate"]) * 0.25
                + float(focus["completion_rate"]) * 0.2
                + min(100, int(journal["entries_written"]) * 20) * 0.2
            )
        )

        return WeeklyDigestResponse(
            week_start=week_start.isoformat(),
            week_end=week_end.isoformat(),
            tasks=_build_task_summary(tasks),
            habits=_build_habit_summary(habits),
            focus=_build_focus_summary(focus),
            journal=_build_journal_summary(journal),
            nutrition=_build_nutrition_summary(nutrition),
            correlations=correlations,
            momentum_score=momentum_score,
            momentum_label="rising"
            if momentum_score > 0.7
            else "steady"
            if momentum_score >= 0.4
            else "low",
            score=score,
        )
