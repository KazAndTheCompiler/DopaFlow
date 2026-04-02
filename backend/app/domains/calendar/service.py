"""Business logic for the calendar domain."""

from __future__ import annotations

from app.domains.calendar.repository import CalendarRepository
from app.domains.calendar.schemas import CalendarEvent, CalendarEventCreate, GoogleSyncRequest, MoveEventRequest, SyncConflict


class CalendarService:
    """Coordinate local events, recurrence, and Google Calendar synchronization."""

    def __init__(self, repository: CalendarRepository) -> None:
        self.repository = repository

    def list_events(
        self,
        from_dt: str | None = None,
        until_dt: str | None = None,
        category: str | None = None,
    ) -> list[CalendarEvent]:
        """Return events with optional date-range and category filters."""

        return self.repository.list_events(from_dt=from_dt, until_dt=until_dt, category=category)

    def get_event(self, identifier: str) -> CalendarEvent | None:
        """Fetch a single event."""

        return self.repository.get_event(identifier)

    def create_event(self, payload: CalendarEventCreate) -> CalendarEvent:
        """Create a calendar event."""

        return self.repository.create_event(payload)

    def update_event(self, identifier: str, patch: dict) -> CalendarEvent | None:
        """Update a calendar event."""

        return self.repository.update_event(identifier, patch)

    def delete_event(self, identifier: str) -> bool:
        """Delete a calendar event."""

        return self.repository.delete_event(identifier)

    def move_event(self, identifier: str, payload: MoveEventRequest) -> dict[str, object]:
        """Move an event by delta_minutes; optionally shift conflicting events forward."""
        from datetime import timedelta
        event = self.get_event(identifier)
        if event is None:
            return {"moved": False, "error": "Event not found"}
        delta = timedelta(minutes=payload.delta_minutes)
        new_start = event.start_at + delta
        new_end = event.end_at + delta
        self.update_event(identifier, {"start_at": new_start.isoformat(), "end_at": new_end.isoformat()})
        adjusted: list[str] = []
        if payload.auto_adjust:
            duration = event.end_at - event.start_at
            overlapping = self.repository.list_events(
                from_dt=new_start.isoformat(),
                until_dt=new_end.isoformat(),
            )
            for other in overlapping:
                if other.id == identifier:
                    continue
                if other.provider_readonly:
                    continue
                other_duration = other.end_at - other.start_at
                bumped_start = new_end
                bumped_end = bumped_start + other_duration
                self.update_event(other.id, {"start_at": bumped_start.isoformat(), "end_at": bumped_end.isoformat()})
                adjusted.append(other.id)
        updated = self.get_event(identifier)
        return {"moved": True, "event": updated, "adjusted": adjusted}

    def sync_google(self, payload: GoogleSyncRequest) -> dict[str, object]:
        """Start a Google Calendar sync flow."""

        return self.repository.sync_google(payload)

    def list_conflicts(self) -> list[SyncConflict]:
        """Return unresolved sync conflicts."""

        return self.repository.list_conflicts()

    def resolve_conflict(self, identifier: int, repair_hint: str) -> SyncConflict | None:
        """Resolve a single sync conflict."""

        return self.repository.resolve_conflict(identifier, repair_hint)

    def sync_status(self) -> dict[str, object]:
        """Return overall sync health summary."""

        unresolved = self.repository.list_conflicts()
        return {
            "ok": len(unresolved) == 0,
            "conflicts": len(unresolved),
            "status": "healthy" if not unresolved else "attention",
        }
