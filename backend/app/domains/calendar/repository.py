"""Persistence helpers for the calendar domain."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx

from app.core.database import get_db, tx
from app.core.id_gen import event_id
from app.domains.calendar.schemas import CalendarEvent, CalendarEventCreate, ConflictReason, GoogleSyncRequest, SyncConflict, SyncStatus

logger = logging.getLogger(__name__)


def _row_to_event(row: object) -> CalendarEvent:
    """Convert a SQLite Row to CalendarEvent."""
    return CalendarEvent(
        id=row["id"],  # type: ignore[index]
        title=row["title"],  # type: ignore[index]
        description=row["description"],  # type: ignore[index]
        start_at=row["start_at"],  # type: ignore[index]
        end_at=row["end_at"],  # type: ignore[index]
        all_day=bool(row["all_day"]),  # type: ignore[index]
        category=row["category"],  # type: ignore[index]
        recurrence=row["recurrence"],  # type: ignore[index]
        source_type=row["source_type"],  # type: ignore[index]
        source_external_id=row["source_external_id"],  # type: ignore[index]
        source_instance_id=row["source_instance_id"],  # type: ignore[index]
        source_origin_app=row["source_origin_app"],  # type: ignore[index]
        sync_status=SyncStatus(row["sync_status"] or "local_only"),  # type: ignore[index]
        provider_readonly=bool(row["provider_readonly"]),  # type: ignore[index]
        created_at=row["created_at"],  # type: ignore[index]
        updated_at=row["updated_at"],  # type: ignore[index]
    )


def _row_to_conflict(row: object) -> SyncConflict:
    """Convert a SQLite Row to SyncConflict."""
    def _json(val: object) -> object:
        return json.loads(val) if val else None

    return SyncConflict(
        id=int(row["id"]),  # type: ignore[index]
        object_id=str(row["object_id"]),  # type: ignore[index]
        object_type=str(row["object_type"]),  # type: ignore[index]
        conflict_reason=ConflictReason(row["conflict_reason"]),  # type: ignore[index]
        local_snapshot=_json(row["local_snapshot"]),  # type: ignore[index]
        incoming_snapshot=_json(row["incoming_snapshot"]),  # type: ignore[index]
        field_diffs=_json(row["field_diffs"]),  # type: ignore[index]
        owner=str(row["owner"]),  # type: ignore[index]
        source_context=_json(row["source_context"]),  # type: ignore[index]
        repair_hint=row["repair_hint"],  # type: ignore[index]
        blocking_severity=str(row["blocking_severity"]),  # type: ignore[index]
        detected_at=datetime.fromisoformat(str(row["detected_at"])),  # type: ignore[index]
        resolved_at=datetime.fromisoformat(str(row["resolved_at"])) if row["resolved_at"] else None,  # type: ignore[index]
        resolved_by=row["resolved_by"],  # type: ignore[index]
    )


class CalendarRepository:
    """Read and write local calendar events and sync metadata."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def store_google_token(self, access_token: str, refresh_token: str | None, expires_at: str) -> None:
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, stored_at)
                VALUES ('google_calendar', ?, ?, ?, 'calendar.readonly', datetime('now'))
                ON CONFLICT(provider) DO UPDATE SET
                    access_token = excluded.access_token,
                    refresh_token = excluded.refresh_token,
                    expires_at = excluded.expires_at,
                    scope = excluded.scope,
                    stored_at = datetime('now')
                """,
                (access_token, refresh_token, expires_at),
            )

    def get_google_token(self) -> dict[str, object] | None:
        with get_db(self.db_path) as conn:
            row = conn.execute("SELECT * FROM oauth_tokens WHERE provider = 'google_calendar'").fetchone()
        return dict(row) if row else None

    def list_events(
        self,
        from_dt: str | None = None,
        until_dt: str | None = None,
        category: str | None = None,
    ) -> list[CalendarEvent]:
        """Return events with optional date-range and category filters."""

        with get_db(self.db_path) as conn:
            query = "SELECT * FROM calendar_events WHERE 1=1"
            params: list[object] = []
            if from_dt:
                query += " AND datetime(end_at) >= datetime(?)"
                params.append(from_dt)
            if until_dt:
                query += " AND datetime(start_at) <= datetime(?)"
                params.append(until_dt)
            if category:
                query += " AND category = ?"
                params.append(category)
            query += " ORDER BY start_at ASC"
            rows = conn.execute(query, params).fetchall()
            return [_row_to_event(row) for row in rows]

    def get_event(self, identifier: str) -> CalendarEvent | None:
        """Fetch a single event by ID or google_event_id."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM calendar_events WHERE id = ? OR google_event_id = ?",
                (identifier, identifier),
            ).fetchone()
            return _row_to_event(row) if row else None

    def create_event(self, payload: CalendarEventCreate) -> CalendarEvent:
        """Insert a new calendar event."""

        new_id = event_id()
        now = datetime.now(timezone.utc).isoformat()
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO calendar_events
                    (id, title, description, start_at, end_at, all_day, category,
                     recurrence, source_type, source_external_id, source_instance_id,
                     sync_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local_only', ?, ?)
                """,
                (
                    new_id, payload.title, payload.description,
                    str(payload.start_at), str(payload.end_at),
                    int(payload.all_day), payload.category,
                    payload.recurrence, payload.source_type,
                    payload.source_external_id, payload.source_instance_id,
                    now, now,
                ),
            )
        return self.get_event(new_id)  # type: ignore[return-value]

    def update_event(self, identifier: str, patch: dict) -> CalendarEvent | None:
        """Update mutable event fields."""

        existing = self.get_event(identifier)
        if existing is None:
            return None
        merged = existing.model_dump()
        merged.update({k: v for k, v in patch.items() if v is not None})
        now = datetime.now(timezone.utc).isoformat()
        with tx(self.db_path) as conn:
            conn.execute(
                """
                UPDATE calendar_events
                SET title = ?, description = ?, start_at = ?, end_at = ?, all_day = ?,
                    category = ?, recurrence = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    merged["title"], merged.get("description"),
                    str(merged["start_at"]), str(merged["end_at"]),
                    int(merged.get("all_day", False)),
                    merged.get("category"), merged.get("recurrence"),
                    now, identifier,
                ),
            )
        return self.get_event(identifier)

    def delete_event(self, identifier: str) -> bool:
        """Hard-delete a calendar event."""

        with tx(self.db_path) as conn:
            result = conn.execute("DELETE FROM calendar_events WHERE id = ?", (identifier,))
            return result.rowcount > 0

    def list_conflicts(self) -> list[SyncConflict]:
        """Return unresolved sync conflicts."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY detected_at DESC"
            ).fetchall()
            return [_row_to_conflict(row) for row in rows]

    def resolve_conflict(self, identifier: int, repair_hint: str) -> SyncConflict | None:
        """Mark a conflict as resolved."""

        now = datetime.now(timezone.utc).isoformat()
        with tx(self.db_path) as conn:
            result = conn.execute(
                "UPDATE sync_conflicts SET repair_hint = ?, resolved_at = ?, resolved_by = 'user' WHERE id = ?",
                (repair_hint, now, identifier),
            )
            if result.rowcount == 0:
                return None
            row = conn.execute("SELECT * FROM sync_conflicts WHERE id = ?", (identifier,)).fetchone()
            return _row_to_conflict(row)

    def sync_google(self, payload: GoogleSyncRequest) -> dict[str, object]:
        """Fetch Google Calendar events using stored OAuth tokens."""

        token_row = self.get_google_token()
        if token_row is None:
            return {"status": "not_connected", "note": "complete OAuth flow first"}

        params = {
            "timeMin": f"{payload.fetch_from}T00:00:00Z" if payload.fetch_from else None,
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": "50",
        }
        params = {key: value for key, value in params.items() if value is not None}
        response = httpx.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {token_row['access_token']}"},
            params=params,
            timeout=15,
        )
        if response.status_code == 401:
            return {"status": "token_expired", "note": "re-authenticate"}

        imported = 0
        items = response.json().get("items", []) if response.status_code == 200 else []
        for item in items:
            try:
                start = item.get("start", {})
                end = item.get("end", {})
                start_at = start.get("dateTime") or f"{start.get('date')}T00:00:00+00:00"
                end_at = end.get("dateTime") or f"{end.get('date')}T00:00:00+00:00"
                with tx(self.db_path) as conn:
                    now = datetime.now(timezone.utc).isoformat()
                    conn.execute(
                        """
                        INSERT INTO calendar_events
                            (id, title, description, start_at, end_at, all_day, category,
                             source_type, source_external_id, sync_status, provider_readonly, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 1, ?, ?)
                        ON CONFLICT(id) DO NOTHING
                        """,
                        (
                            event_id(),
                            item.get("summary") or "Google event",
                            item.get("description"),
                            start_at,
                            end_at,
                            int("date" in start and "dateTime" not in start),
                            "work",
                            "google_calendar",
                            item.get("id"),
                            now,
                            now,
                        ),
                    )
                imported += 1
            except Exception:
                logger.exception("Failed to import Google Calendar event: %s", item.get("summary", "unknown"))
        return {"status": "synced", "imported": imported}
