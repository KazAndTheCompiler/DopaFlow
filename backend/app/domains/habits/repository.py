"""SQLite repository for habits."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from app.core.database import get_db, tx
from app.core.id_gen import habit_id


def _date_key(value: str) -> str:
    return value[:10]


def compute_streak(checkin_dates: list[str]) -> tuple[int, int]:
    """Return the current and best streak from sorted ISO date strings."""

    if not checkin_dates:
        return 0, 0
    days = sorted({date.fromisoformat(_date_key(value)) for value in checkin_dates})
    best = 1
    current = 1
    for prev, curr in zip(days, days[1:]):
        if curr == prev + timedelta(days=1):
            current += 1
        elif curr != prev:
            best = max(best, current)
            current = 1
    best = max(best, current)
    today = date.today()
    current_streak = 0
    streak = 0
    for day in reversed(days):
        if day == today - timedelta(days=streak) or (streak == 0 and day == today):
            streak += 1
            current_streak = streak
        else:
            break
    return current_streak, best


def _habit_with_stats(conn, row) -> dict[str, Any]:
    """Attach streak and completion statistics to a habit row."""

    logs = [log["checkin_date"] for log in conn.execute("SELECT checkin_date FROM habit_checkins WHERE habit_id = ? ORDER BY checkin_date", (row["id"],)).fetchall()]
    current_streak, best_streak = compute_streak(logs)
    last_checkin_date = _date_key(logs[-1]) if logs else None
    period_days = 7 if row["target_period"] == "week" else 1
    window_start = (date.today() - timedelta(days=period_days - 1)).isoformat()
    completed = sum(1 for value in logs if _date_key(value) >= window_start)
    target = max(1, row["target_freq"])
    completion_pct = round((completed / target) * 100, 2)
    today_count = sum(1 for value in logs if _date_key(value) == date.today().isoformat())
    return {
        **dict(row),
        "current_streak": current_streak,
        "best_streak": best_streak,
        "last_checkin_date": last_checkin_date,
        "completion_pct": completion_pct,
        "completion_count": completed,
        "today_count": today_count,
        "progress": completed / target,
    }


def list_habits(db_path: str) -> list[dict[str, Any]]:
    """List active habits with computed streak metrics."""

    with get_db(db_path) as conn:
        rows = conn.execute("SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY created_at ASC").fetchall()
        return [_habit_with_stats(conn, row) for row in rows]


def get_habit(db_path: str, habit_identifier: str) -> dict[str, Any] | None:
    """Return one habit by ID."""

    with get_db(db_path) as conn:
        row = conn.execute("SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL", (habit_identifier,)).fetchone()
        return _habit_with_stats(conn, row) if row else None


def add_habit(db_path: str, name: str, target_freq: int, target_period: str, color: str) -> dict[str, Any]:
    """Create a habit row."""

    identifier = habit_id()
    with tx(db_path) as conn:
        conn.execute(
            "INSERT INTO habits (id, name, target_freq, target_period, color) VALUES (?, ?, ?, ?, ?)",
            (identifier, name, target_freq, target_period, color),
        )
    created = get_habit(db_path, identifier)
    if created is None:
        raise RuntimeError("Habit creation failed")
    return created


def update_habit(db_path: str, habit_identifier: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    """Patch mutable habit fields."""

    current = get_habit(db_path, habit_identifier)
    if current is None:
        return None
    merged = {**current, **payload}
    with tx(db_path) as conn:
        conn.execute(
            """
            UPDATE habits
            SET name = ?, target_freq = ?, target_period = ?, description = ?, color = ?, freeze_until = ?
            WHERE id = ?
            """,
            (
                merged["name"],
                merged["target_freq"],
                merged["target_period"],
                merged.get("description"),
                merged.get("color"),
                merged.get("freeze_until"),
                habit_identifier,
            ),
        )
    return get_habit(db_path, habit_identifier)


def delete_habit(db_path: str, habit_identifier: str) -> bool:
    """Soft-delete a habit."""

    with tx(db_path) as conn:
        result = conn.execute("UPDATE habits SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL", (habit_identifier,))
        return result.rowcount > 0


def log_checkin(db_path: str, habit_identifier: str, checkin_date: str | None = None) -> dict[str, Any]:
    """Insert a check-in event."""

    target_date = checkin_date or datetime.now(UTC).isoformat()
    checkin_identifier = habit_id()
    with tx(db_path) as conn:
        conn.execute(
            """
            INSERT INTO habit_checkins (id, habit_id, checkin_date)
            VALUES (?, ?, ?)
            """,
            (checkin_identifier, habit_identifier, target_date),
        )
    habit = get_habit(db_path, habit_identifier)
    if habit is None:
        raise RuntimeError("Habit check-in failed")
    return habit


def delete_checkin(db_path: str, habit_identifier: str, checkin_date: str) -> bool:
    """Delete one habit check-in."""

    with tx(db_path) as conn:
        result = conn.execute(
            "DELETE FROM habit_checkins WHERE habit_id = ? AND substr(checkin_date, 1, 10) = ?",
            (habit_identifier, checkin_date[:10]),
        )
        return result.rowcount > 0


def get_logs(db_path: str, limit: int = 2000) -> list[dict[str, Any]]:
    """Return recent habit logs."""

    with get_db(db_path) as conn:
        rows = conn.execute(
            """
            SELECT hc.*, h.name
            FROM habit_checkins hc
            JOIN habits h ON h.id = hc.habit_id
            ORDER BY checkin_date DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_logs_for_habit(db_path: str, habit_identifier: str) -> list[dict[str, Any]]:
    """Return all check-ins for one habit."""

    with get_db(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM habit_checkins WHERE habit_id = ? ORDER BY checkin_date DESC",
            (habit_identifier,),
        ).fetchall()
        return [dict(row) for row in rows]


def goals_summary(db_path: str) -> list[dict[str, Any]]:
    """Return goal progress rows."""

    with get_db(db_path) as conn:
        rows = conn.execute(
            """
            SELECT hg.*, h.name
            FROM habit_goals hg
            JOIN habits h ON h.id = hg.habit_id
            ORDER BY hg.period_start DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]
