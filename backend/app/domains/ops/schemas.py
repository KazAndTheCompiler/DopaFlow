"""Schemas for ops diagnostics and import endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class OpsStatsResponse(BaseModel):
    tasks: int
    habits: int
    journal_entries: int


class OpsSyncStatus(BaseModel):
    db_path: str
    db_size_bytes: int
    entry_count: int
    last_backup_at: str | None = None


class OpsConfigResponse(BaseModel):
    dev_auth: bool
    enforce_auth: bool
    trust_local_clients: bool
    db_path: str
    webhook_http_delivery: bool


class OpsImportIn(BaseModel):
    package: str
    checksum: str
    dry_run: bool = False


class TursoTestIn(BaseModel):
    url: str
    token: str


class TursoTestResult(BaseModel):
    ok: bool
    error: str | None = None


class ScopeTokenCreateIn(BaseModel):
    scopes: list[str]
    subject: str = "ops-issued"
    ttl_seconds: int = 3600


class ScopeTokenIssued(BaseModel):
    id: str
    token: str
    expires_in: int
    scopes: list[str]
    subject: str
    token_type: str = "Bearer"


class ScopeTokenRead(BaseModel):
    id: str
    subject: str
    scopes: list[str]
    issued_at: str
    expires_at: str
    revoked_at: str | None = None
    last_used_at: str | None = None
