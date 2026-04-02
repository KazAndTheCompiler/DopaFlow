"""Pydantic schemas for the calendar_sharing domain."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ShareToken(BaseModel):
    """Share token for calendar access."""

    id: str
    label: str
    scopes: str
    allow_write: bool
    created_at: datetime
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None


class ShareTokenCreate(BaseModel):
    """Payload for creating a share token."""

    label: str
    expires_in_days: int | None = Field(default=30, ge=1, le=3650)


class ShareTokenCreated(ShareToken):
    """Share token with raw token revealed once."""

    raw_token: str


class PeerFeed(BaseModel):
    """Peer feed for importing shared calendar events."""

    id: str
    label: str
    base_url: str
    color: str
    sync_status: str
    allow_write: bool
    last_synced_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime


class PeerFeedCreate(BaseModel):
    """Payload for adding a peer feed."""

    label: str
    base_url: str
    token: str
    color: str = "#6366f1"


class PeerFeedUpdate(BaseModel):
    """Payload for updating a peer feed."""

    label: str | None = None
    color: str | None = None


class PeerFeedSyncResult(BaseModel):
    """Result of syncing a peer feed."""

    feed_id: str
    events_imported: int
    conflicts: int
    status: str
    detail: str | None = None
