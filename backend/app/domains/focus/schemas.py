"""Pydantic schemas for the focus domain."""

from __future__ import annotations

from pydantic import BaseModel


class FocusSessionCreate(BaseModel):
    """Payload for starting a Pomodoro or deep-focus session."""

    task_id: str | None = None
    started_at: str
    duration_minutes: int = 25


class FocusSessionRead(FocusSessionCreate):
    """Serialized focus session returned from the API."""

    id: str
    ended_at: str | None = None
    status: str = "running"


class FocusControlRequest(BaseModel):
    """Payload for pausing, resuming, or ending the current session."""

    action: str
    ended_at: str | None = None
