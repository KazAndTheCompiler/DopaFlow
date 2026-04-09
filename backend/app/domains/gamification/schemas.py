"""Pydantic schemas for the gamification domain."""

from __future__ import annotations

from pydantic import BaseModel


class XPAwardRequest(BaseModel):
    source: str
    source_id: str | None = None
    xp: int = 0


class PlayerLevelRead(BaseModel):
    total_xp: int
    level: int
    xp_to_next: int
    progress: float
    updated_at: str


class BadgeRead(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    earned_at: str | None = None
    progress: float
    target: int


class GamificationStatus(BaseModel):
    level: PlayerLevelRead
    badges: list[BadgeRead]
    earned_count: int
