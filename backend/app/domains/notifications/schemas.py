"""Pydantic schemas for the notifications domain."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class NotificationLevel(str, Enum):
    """Allowed notification levels for the unified inbox."""

    alarm = "alarm"
    habit = "habit"
    insight = "insight"
    system = "system"
    warn = "warn"
    info = "info"


class Notification(BaseModel):
    """Notification item persisted in the inbox."""

    id: str
    level: NotificationLevel
    title: str
    body: str | None = None
    read: bool = False
    archived: bool = False
    created_at: datetime
    action_url: str | None = None


class NotificationCreate(BaseModel):
    """Payload for creating a notification."""

    level: NotificationLevel
    title: str
    body: str | None = None
    action_url: str | None = None


class UnreadCount(BaseModel):
    """Unread notification counter payload."""

    count: int
