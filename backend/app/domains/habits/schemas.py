"""Pydantic schemas for the habits domain."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class HabitCreate(BaseModel):
    """Payload for creating or updating a habit."""

    name: str
    target_freq: int = 1
    target_period: str = "day"
    color: str = "var(--accent)"
    description: str | None = None
    freeze_until: str | None = None


class HabitRead(HabitCreate):
    """Serialized habit model with computed progress fields."""

    model_config = ConfigDict(extra="ignore")

    id: str
    created_at: str | None = None
    deleted_at: str | None = None
    current_streak: int = 0
    best_streak: int = 0
    last_checkin_date: str | None = None
    completion_pct: float = 0
    completion_count: int = 0
    today_count: int = 0
    progress: float = 0


class HabitPatch(BaseModel):
    """Patch payload for mutable habit fields."""

    name: str | None = None
    target_freq: int | None = None
    target_period: str | None = None
    description: str | None = None
    color: str | None = None
    freeze_until: str | None = None


class HabitCheckIn(BaseModel):
    """Payload for a habit completion event."""

    checkin_date: str | None = None
    checked_at: str | None = None


class HabitStats(BaseModel):
    """Habit statistics, including trend and mood correlation."""

    current_streak: int = 0
    best_streak: int = 0
    completion_pct: float = 0


class HabitTodaySummary(BaseModel):
    """Today's completion snapshot across habits."""

    done: int
    missed: int
    completion_pct: float


class HabitWeeklyDays(BaseModel):
    """Day-by-day completion flags for the weekly grid."""

    mon: bool
    tue: bool
    wed: bool
    thu: bool
    fri: bool
    sat: bool
    sun: bool


class HabitWeeklyItem(BaseModel):
    """One row in the weekly habits grid."""

    id: str
    name: str
    days: HabitWeeklyDays
    streak: int
    pct_7d: float


class HabitWeeklyOverview(BaseModel):
    """Weekly habits overview for the UI grid."""

    habits: list[HabitWeeklyItem]


class HabitInsights(BaseModel):
    """Rolling habit activity windows."""

    windows: dict[str, int]
    habit_count: int


class HabitGoalSummary(BaseModel):
    """Stored goal summary row for a habit."""

    model_config = ConfigDict(extra="ignore")

    id: str
    habit_id: str
    name: str
    period_start: str
    period_end: str | None = None
    target_count: int | None = None
    completed_count: int | None = None
    status: str | None = None


class HabitCheckinLog(BaseModel):
    """One persisted habit check-in."""

    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    habit_id: str
    checkin_date: str
    name: str | None = None


class DeleteResponse(BaseModel):
    """Simple delete acknowledgement."""

    deleted: bool


class HabitCorrelation(BaseModel):
    """Pairwise habit correlation result."""

    habit_a: str
    habit_b: str
    r: float
    interpretation: str
