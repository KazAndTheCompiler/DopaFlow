"""SQLite repository for focus sessions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.database import get_db, tx
from app.core.id_gen import focus_id


def create_session(db_path: str, task_id: str | None, duration_minutes: int) -> str:
    """Insert a focus session and return its ID."""

    identifier = focus_id()
    with tx(db_path) as conn:
        conn.execute(
            "INSERT INTO focus_sessions (id, task_id, started_at, duration_minutes, status) VALUES (?, ?, ?, ?, ?)",
            (identifier, task_id, datetime.now(timezone.utc).isoformat(), duration_minutes, "running"),
        )
    return identifier


def end_session(db_path: str, session_id: str, completed: bool) -> None:
    """Finish a focus session."""

    with tx(db_path) as conn:
        conn.execute(
            "UPDATE focus_sessions SET ended_at = ?, status = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), "completed" if completed else "stopped", session_id),
        )


def get_active_session(db_path: str) -> dict[str, Any] | None:
    """Read the active session singleton."""

    with get_db(db_path) as conn:
        row = conn.execute("SELECT * FROM focus_active_session WHERE id = 1").fetchone()
        return dict(row) if row else None


def write_active_session(db_path: str, **kwargs: Any) -> None:
    """Upsert the active session singleton."""

    with tx(db_path) as conn:
        conn.execute(
            """
            INSERT INTO focus_active_session (id, session_id, task_id, started_at, paused_duration_ms)
            VALUES (1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              session_id=excluded.session_id,
              task_id=excluded.task_id,
              started_at=excluded.started_at,
              paused_duration_ms=excluded.paused_duration_ms
            """,
            (
                kwargs.get("session_id"),
                kwargs.get("task_id"),
                kwargs.get("started_at", datetime.now(timezone.utc).isoformat()),
                kwargs.get("paused_duration_ms", 0),
            ),
        )


def clear_active_session(db_path: str) -> None:
    """Delete the active session singleton row."""

    with tx(db_path) as conn:
        conn.execute("DELETE FROM focus_active_session WHERE id = 1")


def get_session(db_path: str, session_id: str) -> dict[str, Any] | None:
    """Fetch a single focus session by ID."""

    with get_db(db_path) as conn:
        row = conn.execute(
            "SELECT fs.*, t.title AS task_title FROM focus_sessions fs LEFT JOIN tasks t ON t.id = fs.task_id WHERE fs.id = ?",
            (session_id,),
        ).fetchone()
        return dict(row) if row else None


def update_session_status(db_path: str, session_id: str, status: str) -> None:
    """Update the status column of a focus session."""

    with tx(db_path) as conn:
        conn.execute("UPDATE focus_sessions SET status = ? WHERE id = ?", (status, session_id))


def add_pause_duration(db_path: str, session_id: str, pause_ms: int) -> None:
    """Accumulate pause time into paused_duration_ms."""

    with tx(db_path) as conn:
        conn.execute(
            "UPDATE focus_sessions SET paused_duration_ms = paused_duration_ms + ? WHERE id = ?",
            (pause_ms, session_id),
        )


def list_sessions(db_path: str, limit: int = 30) -> list[dict[str, Any]]:
    """List recent focus sessions joined to task titles when available."""

    with get_db(db_path) as conn:
        rows = conn.execute(
            """
            SELECT fs.*, t.title AS task_title
            FROM focus_sessions fs
            LEFT JOIN tasks t ON t.id = fs.task_id
            ORDER BY fs.started_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def session_stats(db_path: str) -> dict[str, Any]:
    """Return aggregate focus statistics."""

    sessions = list_sessions(db_path, limit=500)
    today = datetime.now(timezone.utc).date().isoformat()
    completed = [session for session in sessions if session.get("status") == "completed"]
    today_sessions = [session for session in sessions if str(session["started_at"]).startswith(today)]
    total_minutes = sum(int(session.get("duration_minutes") or 0) for session in sessions)
    avg_minutes = round(total_minutes / len(sessions), 2) if sessions else 0
    completion_rate = round((len(completed) / len(sessions) * 100), 2) if sessions else 0
    return {
        "total_sessions": len(sessions),
        "today_sessions": len(today_sessions),
        "streak": len(today_sessions),
        "completion_rate": completion_rate,
        "avg_minutes": avg_minutes,
    }


def session_recommendation(db_path: str) -> dict[str, Any]:
    """Return a simple recommendation based on recent history."""

    sessions = list_sessions(db_path, limit=100)
    if not sessions:
        return {"peak_window": "09:00-11:00", "recommended_duration": 25}
    avg_minutes = round(sum(int(session.get("duration_minutes") or 25) for session in sessions) / len(sessions))
    return {"peak_window": "10:00-12:00", "recommended_duration": avg_minutes}
