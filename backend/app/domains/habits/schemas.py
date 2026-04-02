"""Pydantic schemas for the habits domain."""

from __future__ import annotations

from pydantic import BaseModel


class HabitCreate(BaseModel):
    """Payload for creating or updating a habit."""

    name: str
    target_freq: int = 1
    target_period: str = "day"
    color: str = "var(--accent)"
    freeze_until: str | None = None


class HabitRead(HabitCreate):
    """Serialized habit model."""

    id: int
    streak_days: int = 0


class HabitCheckIn(BaseModel):
    """Payload for a habit completion event."""

    habit_id: int
    checked_at: str
    mood_score: int | None = None


class HabitStats(BaseModel):
    """Habit statistics, including trend and mood correlation."""

    streak_days: int
    completion_rate: float
    mood_correlation: float | None = None

