"""Pydantic schemas for the goals domain."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GoalMilestone(BaseModel):
    """One milestone inside a goal."""

    id: str
    label: str
    done: bool = False
    completed_at: str | None = None


class Goal(BaseModel):
    """Serialized goal with embedded milestones."""

    id: str
    title: str
    description: str | None = None
    horizon: str = "quarter"
    milestones: list[GoalMilestone] = Field(default_factory=list)
    created_at: str
    updated_at: str
    done: bool = False


class GoalCreate(BaseModel):
    """Payload for creating a goal."""

    title: str
    description: str | None = None
    horizon: str = "quarter"
    milestone_labels: list[str] = Field(default_factory=list)


class GoalMilestoneCreate(BaseModel):
    """Payload for appending a milestone to a goal."""

    label: str


class OkResponse(BaseModel):
    """Simple ok acknowledgement."""

    ok: bool
