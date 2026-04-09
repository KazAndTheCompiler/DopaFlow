"""Pydantic schemas for the tasks domain."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SubTask(BaseModel):
    """ADR-0013 flat JSON subtask payload."""

    id: str
    title: str
    done: bool = False


class Task(BaseModel):
    """Canonical task model with stable prefixed IDs."""

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    description: str | None = None
    due_at: str | None = None
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
    source_instance_id: str | None = None
    project_id: str | None = None
    dependencies: list["TaskDependency"] = Field(default_factory=list)
    created_at: str
    updated_at: str


class TaskCreate(BaseModel):
    """Payload for creating a task or quick-add draft."""

    title: str
    description: str | None = None
    due_at: str | None = None
    priority: int = 3
    estimated_minutes: int | None = None
    tags: list[str] = Field(default_factory=list)
    subtasks: list[SubTask] = Field(default_factory=list)
    recurrence_rule: str | None = None
    recurrence_parent_id: str | None = None
    source_type: str | None = None
    source_external_id: str | None = None
    source_instance_id: str | None = None
    project_id: str | None = None
    status: Literal["todo", "in_progress", "done", "cancelled"] = "todo"
    done: bool = False
    actual_minutes: int | None = None
    sort_order: int = 0


class TaskUpdate(BaseModel):
    """Patchable task fields."""

    title: str | None = None
    description: str | None = None
    due_at: str | None = None
    priority: int | None = None
    status: Literal["todo", "in_progress", "done", "cancelled"] | None = None
    done: bool | None = None
    estimated_minutes: int | None = None
    sort_order: int | None = None
    subtasks: list[SubTask] | None = None
    tags: list[str] | None = None
    recurrence_rule: str | None = None
    recurrence_parent_id: str | None = None
    actual_minutes: int | None = None
    source_type: str | None = None
    source_external_id: str | None = None
    source_instance_id: str | None = None
    project_id: str | None = None


class TaskQuickAddRequest(BaseModel):
    """Quick-add request containing a freeform natural language prompt."""

    text: str = Field(..., min_length=1)
    commit: bool = False


class TaskListResponse(BaseModel):
    """Container for task list responses."""

    items: list[Task]


class TaskDependency(BaseModel):
    """Resolved dependency reference for a task."""

    id: str
    title: str


class TaskTemplate(BaseModel):
    """Saved task template."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    title: str
    priority: int = 3
    tags: list[str] = Field(default_factory=list)
    estimated_minutes: int | None = None
    recurrence_rule: str | None = None


class TaskTemplateCreate(BaseModel):
    """Payload for creating a task template."""

    name: str
    title: str
    priority: int = 3
    tags: list[str] = Field(default_factory=list)
    estimated_minutes: int | None = None
    recurrence_rule: str | None = None


class TaskQuickAddPreview(BaseModel):
    """Parsed quick-add preview before commit."""

    model_config = ConfigDict(extra="ignore")

    title: str | None = None
    description: str | None = None
    due_at: str | None = None
    priority: int | None = None
    estimated_minutes: int | None = None
    tags: list[str] = Field(default_factory=list)
    subtasks: list[SubTask] = Field(default_factory=list)
    recurrence_rule: str | None = None
    project_id: str | None = None
    done: bool | None = None
    status: Literal["todo", "in_progress", "done", "cancelled"] | None = None


class CreatedCountResponse(BaseModel):
    """Simple count payload for create/import flows."""

    created: int


class UpdatedCountResponse(BaseModel):
    """Simple count payload for bulk update flows."""

    updated: int


class DeleteResponse(BaseModel):
    """Simple delete acknowledgement."""

    deleted: bool


class OkResponse(BaseModel):
    """Simple ok acknowledgement."""

    ok: bool


class TaskContext(BaseModel):
    """Cross-domain context attached to one task."""

    last_touched_days_ago: int | None = None
    focus_sessions: int
    focus_minutes_total: int
    journal_connections: int


class TaskTimeLog(BaseModel):
    """A task time tracking entry."""

    model_config = ConfigDict(extra="ignore")

    id: str
    task_id: str
    started_at: str | None = None
    ended_at: str | None = None
    duration_m: int | None = None


Task.model_rebuild()
