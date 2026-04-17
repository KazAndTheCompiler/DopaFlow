"""Persistence helpers for the alarms domain."""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.database import get_db, tx
from app.core.id_gen import alarm_id
from app.domains.alarms.schemas import AlarmCreate, AlarmRead, AlarmSchedulerStatus


def _row_to_alarm(row: object) -> AlarmRead:
    """Convert a SQLite Row to AlarmRead."""
    try:
        _event_id = row["event_id"]  # type: ignore[index]
    except (IndexError, KeyError):
        _event_id = None
    return AlarmRead(
        id=row["id"],  # type: ignore[index]
        at=row["at"],  # type: ignore[index]
        title=row["title"],  # type: ignore[index]
        kind=row["kind"],  # type: ignore[index]
        tts_text=row["tts_text"],  # type: ignore[index]
        youtube_link=row["youtube_link"],  # type: ignore[index]
        muted=bool(row["muted"]),  # type: ignore[index]
        last_fired_at=row["last_fired_at"],  # type: ignore[index]
        event_id=_event_id,
    )


class AlarmsRepository:
    """Read and write scheduled alarms and trigger queue items."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def list_alarms(self) -> list[AlarmRead]:
        """Return all non-deleted alarms ordered by scheduled time."""

        with get_db(self.db_path) as conn:
            rows = conn.execute("SELECT * FROM alarms ORDER BY at ASC").fetchall()
            return [_row_to_alarm(row) for row in rows]

    def list_upcoming(self) -> list[AlarmRead]:
        """Return upcoming unmuted alarms ordered by scheduled time."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM alarms
                WHERE muted = 0
                  AND at >= datetime('now', '-1 day')
                ORDER BY at ASC
                """
            ).fetchall()
            return [_row_to_alarm(row) for row in rows]

    def get_alarm(self, identifier: str) -> AlarmRead | None:
        """Fetch a single alarm by ID."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM alarms WHERE id = ?", (identifier,)
            ).fetchone()
            return _row_to_alarm(row) if row else None

    def create_alarm(self, payload: AlarmCreate) -> AlarmRead:
        """Insert a new alarm record."""

        new_id = alarm_id()
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO alarms (id, at, title, kind, tts_text, youtube_link, muted, event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id,
                    payload.at,
                    payload.title,
                    payload.kind,
                    payload.tts_text,
                    payload.youtube_link,
                    int(payload.muted),
                    payload.event_id,
                ),
            )
        return self.get_alarm(new_id)  # type: ignore[return-value]

    def update_alarm(self, identifier: str, patch: dict) -> AlarmRead | None:
        """Partially update an alarm."""

        alarm = self.get_alarm(identifier)
        if alarm is None:
            return None
        merged = alarm.model_dump()
        merged.update({k: v for k, v in patch.items() if v is not None})
        with tx(self.db_path) as conn:
            conn.execute(
                """
                UPDATE alarms
                SET at = ?, title = ?, kind = ?, tts_text = ?, youtube_link = ?, muted = ?
                WHERE id = ?
                """,
                (
                    merged["at"],
                    merged["title"],
                    merged["kind"],
                    merged.get("tts_text"),
                    merged.get("youtube_link"),
                    int(merged.get("muted", False)),
                    identifier,
                ),
            )
        return self.get_alarm(identifier)

    def delete_alarm(self, identifier: str) -> bool:
        """Delete an alarm record."""

        with tx(self.db_path) as conn:
            result = conn.execute("DELETE FROM alarms WHERE id = ?", (identifier,))
            return result.rowcount > 0

    def list_by_event(self, event_id: str) -> list[AlarmRead]:
        """Return all alarms linked to a calendar event."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM alarms WHERE event_id = ? ORDER BY at ASC",
                (event_id,),
            ).fetchall()
            return [_row_to_alarm(row) for row in rows]

    def delete_by_event(self, event_id: str) -> int:
        """Delete all alarms linked to a calendar event. Return count deleted."""

        with tx(self.db_path) as conn:
            result = conn.execute("DELETE FROM alarms WHERE event_id = ?", (event_id,))
            return result.rowcount

    def touch_alarm(self, identifier: str) -> None:
        """Record a fire timestamp."""

        now = datetime.now(timezone.utc).isoformat()
        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE alarms SET last_fired_at = ? WHERE id = ?",
                (now, identifier),
            )

    def scheduler_status(self) -> AlarmSchedulerStatus:
        """Return next pending alarm for scheduler health display."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT id, at FROM alarms
                WHERE at >= CURRENT_TIMESTAMP AND muted = 0
                ORDER BY at ASC LIMIT 1
                """
            ).fetchone()
            if row:
                return AlarmSchedulerStatus(
                    running=True,
                    next_alarm_id=str(row["id"]),
                    next_alarm_at=str(row["at"]),
                )
            return AlarmSchedulerStatus(running=False)
