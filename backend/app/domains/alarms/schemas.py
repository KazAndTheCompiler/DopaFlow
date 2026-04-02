"""Pydantic schemas for the alarms domain."""

from __future__ import annotations

from pydantic import BaseModel


class AlarmCreate(BaseModel):
    """Payload for scheduling an alarm."""

    at: str
    title: str
    kind: str = "tts"
    tts_text: str | None = None
    youtube_link: str | None = None
    muted: bool = False


class AlarmRead(AlarmCreate):
    """Serialized alarm configuration."""

    id: str
    last_fired_at: str | None = None


class AlarmTriggerResponse(BaseModel):
    """Response after manually triggering an alarm."""

    alarm_id: str
    fired: bool
    message: str


class AlarmSchedulerStatus(BaseModel):
    """Scheduler heartbeat payload for desktop status indicators."""

    running: bool
    active_alarm_id: str | None = None
    next_alarm_id: str | None = None
    next_alarm_at: str | None = None
