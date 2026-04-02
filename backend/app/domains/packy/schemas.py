"""Pydantic schemas for the Packy assistant domain."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PackyAskRequest(BaseModel):
    """Payload for Packy's primary assistant endpoint."""

    text: str
    context: dict[str, object] = Field(default_factory=dict)
    session_id: str | None = None


class PackyAnswer(BaseModel):
    """Assistant response payload."""

    intent: str
    extracted_data: dict[str, object] = Field(default_factory=dict)
    reply_text: str
    suggested_action: str | None = None


class PackyLorebookRequest(BaseModel):
    """Payload for updating Packy's contextual lorebook."""

    session_id: str = "default"
    headline: str | None = None
    body: str | None = None
    recent_mood: dict[str, object] | None = None
    active_task: dict[str, object] | None = None
    completed_today: int | None = None
    habit_streak: int | None = None
    focus_minutes_today: int | None = None
    tags: list[str] = Field(default_factory=list)


class PackyWhisper(BaseModel):
    """Proactive tip surfaced in the shell status bar."""

    text: str
    tone: str = "neutral"
    suggested_action: str | None = None


class MomentumScore(BaseModel):
    """Momentum score used across Packy and insights."""

    score: int
    delta_vs_yesterday: int = 0
    components: dict[str, float] = Field(default_factory=dict)
    level: str = "building"
    summary: str
