"""Pydantic schemas for board-oriented task views."""

from __future__ import annotations

from pydantic import BaseModel

from app.domains.tasks.schemas import Task


class BoardColumns(BaseModel):
    """Static kanban column labels."""

    columns: list[str]


class EisenhowerView(BaseModel):
    """Named Eisenhower quadrants for the board UI."""

    q1: list[Task]
    q2: list[Task]
    q3: list[Task]
    q4: list[Task]


class MatrixData(BaseModel):
    """Quadrant payload keyed by semantic names."""

    do: list[Task]
    schedule: list[Task]
    delegate: list[Task]
    eliminate: list[Task]
