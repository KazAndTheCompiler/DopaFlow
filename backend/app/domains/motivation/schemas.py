"""Schemas for motivation endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class GogginsTriggerResponse(BaseModel):
    triggered: bool
    file_size: int | None = None
    error: str | None = None
