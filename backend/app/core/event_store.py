"""Append-only event store primitives."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class EventType(StrEnum):
    """Supported event categories for cross-domain activity tracking."""

    TASK_CREATED = "task.created"
    TASK_COMPLETED = "task.completed"
    HABIT_CHECKED_IN = "habit.checked_in"
    FOCUS_STARTED = "focus.started"
    REVIEW_COMPLETED = "review.completed"
    JOURNAL_SAVED = "journal.saved"
    CALENDAR_SYNCED = "calendar.synced"
    NOTIFICATION_CREATED = "notification.created"


@dataclass(slots=True)
class StoredEvent:
    """Normalized event payload returned from the event store."""

    id: int
    event_type: EventType
    aggregate_id: str
    payload: dict[str, Any]
    created_at: str


class EventStore:
    """Append-only event log backed by SQLite."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection
        self._ensure_table()

    def _ensure_table(self) -> None:
        """Create the event log table if it does not exist yet."""

        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS event_store (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                aggregate_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    def append(
        self, event_type: EventType, aggregate_id: str, payload: dict[str, Any]
    ) -> int:
        """Persist a new event and return its generated identifier."""

        cursor = self.connection.execute(
            """
            INSERT INTO event_store (event_type, aggregate_id, payload_json)
            VALUES (?, ?, ?)
            """,
            (event_type.value, aggregate_id, json.dumps(payload)),
        )
        return int(cursor.lastrowid)

    def query(
        self, aggregate_id: str | None = None, event_type: EventType | None = None
    ) -> list[StoredEvent]:
        """Fetch events filtered by aggregate or event type."""

        sql = "SELECT id, event_type, aggregate_id, payload_json, created_at FROM event_store WHERE 1 = 1"
        params: list[object] = []
        if aggregate_id:
            sql += " AND aggregate_id = ?"
            params.append(aggregate_id)
        if event_type:
            sql += " AND event_type = ?"
            params.append(event_type.value)
        sql += " ORDER BY id DESC"
        rows = self.connection.execute(sql, params).fetchall()
        return [
            StoredEvent(
                id=row["id"],
                event_type=EventType(row["event_type"]),
                aggregate_id=row["aggregate_id"],
                payload=json.loads(row["payload_json"]),
                created_at=row["created_at"],
            )
            for row in rows
        ]
