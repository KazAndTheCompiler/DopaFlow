"""Pydantic schemas for the projects domain."""

from __future__ import annotations

from pydantic import BaseModel, RootModel


class Project(BaseModel):
    """Serialized project row."""

    id: str
    name: str
    color: str | None = None
    icon: str | None = None
    archived: bool = False
    sort_order: int = 0
    created_at: str
    updated_at: str


class ProjectCreate(BaseModel):
    """Payload for creating a project."""

    name: str
    color: str = "#6366f1"
    icon: str = "▣"
    sort_order: int = 0


class ProjectPatch(BaseModel):
    """Patch payload for projects."""

    name: str | None = None
    color: str | None = None
    icon: str | None = None
    archived: bool | None = None
    sort_order: int | None = None


class DeleteResponse(BaseModel):
    """Simple delete acknowledgement."""

    deleted: bool


class ProjectTaskCounts(RootModel[dict[str, int]]):
    """Task counts keyed by project id."""
