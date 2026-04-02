"""Schemas for meta introspection endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class VersionResponse(BaseModel):
    version: str
    app_version: str


class MetaResponse(BaseModel):
    version: str
    app_version: str
    schema_version: str = "v2"
