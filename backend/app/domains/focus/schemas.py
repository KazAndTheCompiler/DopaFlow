"""Pydantic schemas for the focus domain."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class FocusSessionCreate(BaseModel):
    """Payload for starting a Pomodoro or deep-focus session."""

    task_id: str | None = None
    started_at: str | None = None
    duration_minutes: int = 25


class FocusSessionRead(FocusSessionCreate):
    """Serialized focus session returned from the API."""

    model_config = ConfigDict(extra="ignore")

    id: str
    paused_duration_ms: int = 0
    task_title: str | None = None
    ended_at: str | None = None
    status: str = "running"


class FocusControlRequest(BaseModel):
    """Payload for pausing, resuming, or ending the current session."""

    action: str
    ended_at: str | None = None


class FocusStatus(BaseModel):
    """Live focus timer state exposed by the service."""

    status: str
    duration_minutes: int
    started_at: str | None = None
    paused_at: str | None = None
    elapsed_seconds: int = 0
    log_id: str | None = None
    task_id: str | None = None


class FocusStats(BaseModel):
    """Aggregate focus statistics."""

    total_sessions: int
    today_sessions: int
    streak: int
    completion_rate: float
    avg_minutes: float


class FocusRecommendation(BaseModel):
    """Recommended next focus-session settings."""

    peak_window: str
    recommended_duration: int
