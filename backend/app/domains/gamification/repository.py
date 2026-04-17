"""Persistence helpers for the gamification domain."""

from __future__ import annotations

import time
from datetime import UTC, date, datetime, timedelta

from app.core.base_repository import BaseRepository
from app.domains.gamification.schemas import BadgeRead, PlayerLevelRead
from app.domains.gamification.xp_engine import (
    level_for,
    level_progress,
    xp_to_next_level,
)

_stats_cache: dict[str, tuple[float, dict]] = {}


def _consecutive_streak(dates: list[str]) -> int:
    if not dates:
        return 0
    days = sorted({date.fromisoformat(value) for value in dates}, reverse=True)
    streak = 0
    cursor = date.today()
    for day in days:
        if day == cursor:
            streak += 1
            cursor -= timedelta(days=1)
            continue
        if streak == 0 and day == cursor - timedelta(days=1):
            streak += 1
            cursor = day - timedelta(days=1)
            continue
        break
    return streak


def _best_habit_streak(rows: list[object]) -> int:
    by_habit: dict[str, list[str]] = {}
    for row in rows:
        habit_id = str(row["habit_id"])  # type: ignore[index]
        by_habit.setdefault(habit_id, []).append(str(row["checkin_date"]))  # type: ignore[index]
    best = 0
    for values in by_habit.values():
        ordered = sorted({date.fromisoformat(value) for value in values})
        current = 0
        prev: date | None = None
        for day in ordered:
            current = current + 1 if prev and day == prev + timedelta(days=1) else 1
            best = max(best, current)
            prev = day
    return best


class GamificationRepository(BaseRepository):
    def has_award_event_today(self, source: str, source_id: str | None) -> bool:
        if source_id is None:
            return False
        start_of_day = datetime.now(UTC).date().isoformat()
        with self.get_db_readonly() as conn:
            row = conn.execute(
                """
                SELECT 1
                FROM xp_ledger
                WHERE source = ?
                  AND source_id = ?
                  AND awarded_at >= ?
                LIMIT 1
                """,
                (source, source_id, start_of_day),
            ).fetchone()
        return row is not None

    def award_xp(self, source: str, source_id: str | None, xp: int) -> int:
        _stats_cache.pop(self.db_path, None)
        with self.tx() as conn:
            conn.execute(
                "INSERT INTO xp_ledger (source, source_id, xp) VALUES (?, ?, ?)",
                (source, source_id, xp),
            )
            conn.execute(
                """
                INSERT INTO player_level (id, total_xp, level, updated_at)
                VALUES (1, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                  total_xp = total_xp + excluded.total_xp,
                  updated_at = CURRENT_TIMESTAMP
                """,
                (xp,),
            )
            row = conn.execute(
                "SELECT total_xp FROM player_level WHERE id = 1"
            ).fetchone()
        return int(row["total_xp"]) if row else 0

    def set_level(self, level: int) -> None:
        with self.tx() as conn:
            conn.execute(
                "UPDATE player_level SET level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                (level,),
            )

    def get_level(self) -> PlayerLevelRead:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT total_xp, updated_at FROM player_level WHERE id = 1"
            ).fetchone()
        total_xp = int(row["total_xp"]) if row else 0
        return PlayerLevelRead(
            total_xp=total_xp,
            level=level_for(total_xp),
            xp_to_next=xp_to_next_level(total_xp),
            progress=level_progress(total_xp),
            updated_at=str(row["updated_at"]) if row else "",
        )

    def get_badges(self) -> list[BadgeRead]:
        with self.get_db_readonly() as conn:
            rows = conn.execute("SELECT * FROM badges ORDER BY id ASC").fetchall()
        return [BadgeRead(**dict(row)) for row in rows]

    def update_badge_progress(
        self, badge_id: str, progress: float, earned: bool
    ) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                UPDATE badges
                SET progress = ?, earned_at = CASE WHEN ? THEN COALESCE(earned_at, CURRENT_TIMESTAMP) ELSE earned_at END
                WHERE id = ?
                """,
                (round(progress, 4), int(earned), badge_id),
            )

    def aggregate_stats(self) -> dict[str, int]:
        cached = _stats_cache.get(self.db_path)
        now = time.monotonic()
        if cached is not None:
            expiry, stats = cached
            if now < expiry:
                return stats
        with self.get_db_readonly() as conn:
            tasks_done = int(
                conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL AND (done = 1 OR status = 'done')"
                ).fetchone()[0]
            )
            focus_minutes = int(
                conn.execute(
                    "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions WHERE status = 'completed'"
                ).fetchone()[0]
            )
            cards_rated = int(
                conn.execute(
                    "SELECT COALESCE(SUM(reviews_done), 0) FROM review_cards"
                ).fetchone()[0]
            )
            journal_dates = [
                str(row["entry_date"])
                for row in conn.execute(
                    "SELECT entry_date FROM journal_entries WHERE deleted_at IS NULL"
                ).fetchall()
            ]
            habit_rows = conn.execute(
                "SELECT habit_id, checkin_date FROM habit_checkins ORDER BY checkin_date ASC"
            ).fetchall()
        stats = {
            "tasks_done": tasks_done,
            "best_streak": _best_habit_streak(habit_rows),
            "focus_minutes": focus_minutes,
            "journal_streak": _consecutive_streak(journal_dates),
            "cards_rated": cards_rated,
        }
        _stats_cache[self.db_path] = (now + 60, stats)
        return stats
