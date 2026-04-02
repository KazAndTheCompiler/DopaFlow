"""Schemas for journal templates only."""

from __future__ import annotations

from pydantic import BaseModel, Field


class JournalTemplateCreate(BaseModel):
    name: str
    body: str = ""
    tags: list[str] = Field(default_factory=list)


class JournalTemplateRead(JournalTemplateCreate):
    id: str
    created_at: str
