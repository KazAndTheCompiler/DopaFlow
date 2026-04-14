"""Persistence helpers for the insights domain."""

from __future__ import annotations

from datetime import date, timedelta

from app.core.database import get_db
from app.domains.insights.schemas import CorrelationInsight, WeeklyDigest
from app.domains.packy.schemas import MomentumScore


class InsightsRepository:
    """Aggregate read models spanning tasks, habits, mood, and notifications."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def momentum(self) -> MomentumScore:
        """Return a current momentum score."""

        with get_db(self.db_path) as conn:
            tasks_done = int(
                conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE done = 1 AND updated_at >= datetime('now', '-7 days')"
                ).fetchone()[0]
            )
            habits_kept = int(
                conn.execute(
                    "SELECT COUNT(*) FROM habit_checkins WHERE checkin_date >= date('now', '-7 days')"
                ).fetchone()[0]
            )
            focus_mins = int(
                conn.execute(
                    "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions WHERE started_at >= datetime('now', '-7 days')"
                ).fetchone()[0]
            )

        task_pct = min(tasks_done / 10.0, 1.0)
        habit_pct = min(habits_kept / 14.0, 1.0)
        focus_pct = min(focus_mins / 120.0, 1.0)
        score = round((task_pct + habit_pct + focus_pct) / 3 * 100)
        return MomentumScore(
            score=score,
            summary=f"{tasks_done} tasks done, {habits_kept} habit check-ins, {focus_mins}m focus this week",
        )

    def weekly_digest(self) -> WeeklyDigest:
        """Return a weekly digest summary from live activity data."""

        with get_db(self.db_path) as conn:
            tasks_done = int(
                conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE done = 1 AND updated_at >= datetime('now', '-7 days')"
                ).fetchone()[0]
            )
            tasks_created = int(
                conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE created_at >= datetime('now', '-7 days')"
                ).fetchone()[0]
            )
            habits_kept = int(
                conn.execute(
                    "SELECT COUNT(*) FROM habit_checkins WHERE checkin_date >= date('now', '-7 days')"
                ).fetchone()[0]
            )
            focus_row = conn.execute(
                "SELECT COUNT(*), COALESCE(SUM(duration_minutes), 0) FROM focus_sessions WHERE started_at >= datetime('now', '-7 days')"
            ).fetchone()
            focus_sessions = int(focus_row[0])
            focus_mins = int(focus_row[1])
            journal_entries = int(
                conn.execute(
                    "SELECT COUNT(*) FROM journal_entries WHERE created_at >= datetime('now', '-7 days') AND deleted_at IS NULL"
                ).fetchone()[0]
            )

        highlights = [
            f"{tasks_done} tasks completed this week",
            f"{tasks_created} tasks added this week",
            f"{habits_kept} habit check-ins logged",
            f"{focus_sessions} focus sessions ({focus_mins}m total)",
            f"{journal_entries} journal entries written",
        ]
        return WeeklyDigest(
            title=f"Week of {date.today().strftime('%b %d')}", highlights=highlights
        )

    def correlations(self) -> list[CorrelationInsight]:
        """Return sample habit-mood correlation insights."""

        with get_db(self.db_path) as conn:
            habits = conn.execute(
                "SELECT id, name FROM habits WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 5"
            ).fetchall()
            if not habits:
                return []

            start_day = date.today() - timedelta(days=29)
            days = [(start_day + timedelta(days=i)).isoformat() for i in range(30)]
            insights: list[CorrelationInsight] = []
            for habit in habits:
                checkin_rows = conn.execute(
                    "SELECT checkin_date FROM habit_checkins WHERE habit_id = ? AND checkin_date >= ?",
                    (habit["id"], start_day.isoformat()),
                ).fetchall()
                checked_days = {str(row["checkin_date"]) for row in checkin_rows}

                checked_focus = conn.execute(
                    """
                    SELECT COALESCE(AVG(duration_minutes), 0)
                    FROM focus_sessions
                    WHERE DATE(started_at) IN ({})
                    """.format(",".join("?" for _ in checked_days))
                    if checked_days
                    else "SELECT 0",
                    tuple(sorted(checked_days)),
                ).fetchone()[0]
                unchecked_days = [day for day in days if day not in checked_days]
                unchecked_focus = conn.execute(
                    """
                    SELECT COALESCE(AVG(duration_minutes), 0)
                    FROM focus_sessions
                    WHERE DATE(started_at) IN ({})
                    """.format(",".join("?" for _ in unchecked_days))
                    if unchecked_days
                    else "SELECT 0",
                    tuple(unchecked_days),
                ).fetchone()[0]
                _focus_gap = float(checked_focus or 0) - float(unchecked_focus or 0)
                pearson_r = round(len(checked_days) / 30.0, 2)
                interpretation = (
                    "High"
                    if pearson_r > 0.6
                    else "Moderate"
                    if pearson_r > 0.3
                    else "Low"
                )
                insights.append(
                    CorrelationInsight(
                        metric=f"{habit['name']} check-in rate",
                        pearson_r=pearson_r,
                        interpretation=interpretation,
                    )
                )
            return insights
