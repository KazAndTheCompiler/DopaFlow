"""SQLite repository for notifications."""

from __future__ import annotations

from typing import Any

from app.core.database import get_db, tx
from app.core.id_gen import notification_id


def list_notifications(
    db_path: str, archived: bool = False, level: str | None = None, limit: int = 50
) -> list[dict[str, Any]]:
    """Return recent notifications from the inbox."""

    sql = "SELECT * FROM notifications WHERE archived = ?"
    params: list[Any] = [int(archived)]
    if level:
        sql += " AND level = ?"
        params.append(level)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with get_db(db_path) as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(row) for row in rows]


def mark_read(db_path: str, notification_identifier: str) -> bool:
    """Mark a single notification read."""

    with tx(db_path) as conn:
        result = conn.execute(
            "UPDATE notifications SET read = 1 WHERE id = ?", (notification_identifier,)
        )
        return result.rowcount > 0


def mark_all_read(db_path: str) -> int:
    """Mark all inbox notifications read."""

    with tx(db_path) as conn:
        result = conn.execute("UPDATE notifications SET read = 1 WHERE read = 0")
        return result.rowcount


def archive(db_path: str, notification_identifier: str) -> bool:
    """Archive a notification."""

    with tx(db_path) as conn:
        result = conn.execute(
            "UPDATE notifications SET archived = 1 WHERE id = ?",
            (notification_identifier,),
        )
        return result.rowcount > 0


def delete_notification(db_path: str, notification_identifier: str) -> bool:
    """Delete a notification row."""

    with tx(db_path) as conn:
        result = conn.execute(
            "DELETE FROM notifications WHERE id = ?", (notification_identifier,)
        )
        return result.rowcount > 0


def unread_count(db_path: str) -> int:
    """Return the unread-notification count."""

    with get_db(db_path) as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS count FROM notifications WHERE read = 0 AND archived = 0"
        ).fetchone()
        return int(row["count"])


def create_notification(
    db_path: str,
    level: str,
    title: str,
    body: str | None = None,
    action_url: str | None = None,
) -> dict[str, Any]:
    """Insert and return a notification."""

    identifier = notification_id()
    with tx(db_path) as conn:
        conn.execute(
            """
            INSERT INTO notifications (id, level, title, body, action_url)
            VALUES (?, ?, ?, ?, ?)
            """,
            (identifier, level, title, body, action_url),
        )
        row = conn.execute("SELECT * FROM notifications WHERE id = ?", (identifier,)).fetchone()
    return dict(row)
