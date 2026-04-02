"""Pydantic schemas for the tasks domain."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SubTask(BaseModel):
    """ADR-0013 flat JSON subtask payload."""

    id: str
    title: str
    done: bool = False


class Task(BaseModel):
    """Canonical task model with stable prefixed IDs."""

    id: str
    title: str
    description: str | None = None
    due_at: datetime | None = None
    priority: int = 3
    status: Literal["todo", "in_progress", "done", "cancelled"] = "todo"
    done: bool = False
    estimated_minutes: int | None = None
    actual_minutes: int | None = None
    recurrence_rule: str | None = None
    recurrence_parent_id: str | None = None
    sort_order: int = 0
    subtasks: list[SubTask] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    source_type: str | None = None
    source_external_id: str | None = None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    """Payload for creating a task or quick-add draft."""

    title: str
    description: str | None = None
    due_at: datetime | None = None
    priority: int = 3
    estimated_minutes: int | None = None
    tags: list[str] = Field(default_factory=list)
    subtasks: list[SubTask] = Field(default_factory=list)
    recurrence_rule: str | None = None


class TaskUpdate(BaseModel):
    """Patchable task fields."""

    title: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    priority: int | None = None
    status: Literal["todo", "in_progress", "done", "cancelled"] | None = None
    done: bool | None = None
    estimated_minutes: int | None = None
    sort_order: int | None = None
    subtasks: list[SubTask] | None = None
    tags: list[str] | None = None


class TaskQuickAddRequest(BaseModel):
    """Quick-add request containing a freeform natural language prompt."""

    text: str = Field(..., min_length=1)


class TaskListResponse(BaseModel):
    """Container for task list responses."""

    items: list[Task]
