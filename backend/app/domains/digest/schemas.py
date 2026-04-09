"""Schemas for digest endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class DigestTagCount(BaseModel):
    tag: str
    count: int


class DigestTaskSummary(BaseModel):
    completed: int
    created: int
    overdue: int
    completion_rate: float
    top_tags: list[DigestTagCount]


class DigestHabitSummaryItem(BaseModel):
    name: str
    done: int
    rate: float


class DigestHabitSummary(BaseModel):
    overall_rate: float
    by_habit: list[DigestHabitSummaryItem]
    best_habit: str
    worst_habit: str


class DigestFocusSummary(BaseModel):
    total_sessions: int
    total_minutes: int
    completion_rate: float
    best_day: str


class DigestJournalSummary(BaseModel):
    entries_written: int
    avg_word_count: float
    top_tags: list[DigestTagCount]
    mood_distribution: dict[str, int]


class DigestNutritionSummary(BaseModel):
    total_kcal: float
    avg_kcal: float
    days_logged: int
    protein_g: float
    fat_g: float
    carbs_g: float


class DigestCorrelation(BaseModel):
    type: str
    description: str
    confidence: str
    habit_name: str | None = None
    metric: str | None = None
    pearson_r: float | None = None
    direction: str | None = None
    delta_pct: int | None = None


class DailyDigestResponse(BaseModel):
    date: str
    tasks: DigestTaskSummary
    habits: DigestHabitSummary
    focus: DigestFocusSummary
    journal: DigestJournalSummary
    momentum_score: float
    momentum_label: str
    score: int
    tasks_completed_today: int
    focus_minutes_today: int
    habits_done_today: int
    habit_total: int
    nutrition: DigestNutritionSummary
    correlations: list[DigestCorrelation]


class WeeklyDigestResponse(BaseModel):
    week_start: str
    week_end: str
    tasks: DigestTaskSummary
    habits: DigestHabitSummary
    focus: DigestFocusSummary
    journal: DigestJournalSummary
    nutrition: DigestNutritionSummary
    correlations: list[DigestCorrelation]
    momentum_score: float
    momentum_label: str
    score: int
