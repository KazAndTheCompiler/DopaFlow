"""Schemas for health endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class HealthFeatures(BaseModel):
    webhooks: bool
    dev_auth: bool
    ai_commands: bool
    local_audio: bool
    trust_local_clients: bool
    enforce_auth: bool
    local_webhooks: bool


class HealthResponse(BaseModel):
    status: str
    version: str
    features: HealthFeatures
    db: str
    memory_depth_days: int
    uptime_seconds: int
    warnings: list[str]
    checked_at: str
