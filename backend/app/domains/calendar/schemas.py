"""Pydantic schemas for the calendar domain."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class SyncStatus(str, Enum):
    """Sync status per ADR-0003."""

    local_only = "local_only"
    pending_sync = "pending_sync"
    synced = "synced"
    conflict = "conflict"
    error = "error"


class ConflictReason(str, Enum):
    """Enumerated conflict reasons for provider sync."""

    ownership_violation = "ownership_violation"
    readonly_source = "readonly_source"
    concurrent_shared_field = "concurrent_shared_field"
    delete_vs_update = "delete_vs_update"
    provider_remap = "provider_remap"
    integrity_conflict = "integrity_conflict"


class SyncConflict(BaseModel):
    """Conflict record created by sync reconciliation."""

    id: int
    object_id: str
    object_type: str
    conflict_reason: ConflictReason
    local_snapshot: dict[str, object] | None = None
    incoming_snapshot: dict[str, object] | None = None
    field_diffs: dict[str, object] | None = None
    owner: str
    source_context: dict[str, object] | None = None
    repair_hint: str | None = None
    blocking_severity: str = "non_blocking"
    detected_at: datetime
    resolved_at: datetime | None = None
    resolved_by: str | None = None


class SyncTombstone(BaseModel):
    """Deletion tombstone preserving internal identity."""

    id: int
    original_id: str
    object_type: str
    deleted_at: datetime
    deleted_by: str
    deletion_origin: str
    snapshot: dict[str, object] | None = None
    provider_id: str | None = None


class CalendarEvent(BaseModel):
    """Canonical calendar event model."""

    id: str
    title: str
    description: str | None = None
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    category: str | None = None
    recurrence: str | None = None
    source_type: str | None = None
    source_external_id: str | None = None
    source_instance_id: str | None = None
    source_origin_app: str | None = "dopaflow"
    sync_status: SyncStatus = SyncStatus.local_only
    provider_readonly: bool = False
    created_at: datetime
    updated_at: datetime


class CalendarEventCreate(BaseModel):
    """Payload for creating or syncing a calendar event."""

    title: str
    description: str | None = None
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    category: str | None = None
    recurrence: str | None = None
    source_type: str | None = None
    source_external_id: str | None = None
    source_instance_id: str | None = None


class GoogleSyncRequest(BaseModel):
    """Payload for triggering Google Calendar sync."""

    fetch_from: str | None = None


class MoveEventRequest(BaseModel):
    """Payload for moving a calendar event by a time delta."""

    delta_minutes: int
    auto_adjust: bool = False


class CalendarDeleteResponse(BaseModel):
    """Response after deleting a calendar event."""

    deleted: bool


class CalendarMoveResponse(BaseModel):
    """Response after moving a calendar event."""

    moved: bool
    error: str | None = None
    event: CalendarEvent | None = None
    adjusted: list[str] = []


class CalendarFeedEntry(BaseModel):
    """Event entry exposed through the shared calendar feed."""

    id: str
    source: str
    source_type: str
    source_id: str
    source_version: str
    dedupe_key: str
    conflict_score: float
    title: str
    description: str | None = None
    start_at: str
    at: str
    end_at: str
    all_day: bool
    category: str | None = None
    created_at: str
    updated_at: str
    read_only: bool
    editability_class: str


class CalendarFeedResponse(BaseModel):
    """Shared contract response for the calendar feed endpoint."""

    from_: str
    to: str
    entries: list[CalendarFeedEntry]
    owner: str


class CalendarTodayEntry(BaseModel):
    """Compact calendar entry used by the today schedule endpoint."""

    id: str
    title: str
    start_at: str
    end_at: str
    all_day: bool
    category: str | None = None


class CalendarTodayResponse(BaseModel):
    """Today schedule payload."""

    entries: list[CalendarTodayEntry | CalendarFeedEntry]
    available: bool
    source: str


class CalendarOAuthResponse(BaseModel):
    """Google Calendar OAuth handoff payload."""

    status: str
    url: str | None = None
    message: str | None = None


class CalendarSyncStatusResponse(BaseModel):
    """Calendar sync health summary."""

    status: str
    ok: bool | None = None
    conflicts: int | None = None
    imported: int | None = None
    note: str | None = None
