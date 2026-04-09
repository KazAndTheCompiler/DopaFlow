"""Schemas for ops diagnostics and import endpoints."""

from __future__ import annotations

from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

MAX_OPS_IMPORT_BYTES = 5 * 1024 * 1024


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
    package: str = Field(min_length=2, max_length=MAX_OPS_IMPORT_BYTES)
    checksum: str = Field(min_length=16, max_length=128)
    dry_run: bool = False


class TursoTestIn(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    token: str = Field(min_length=1, max_length=4096)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"libsql", "https"}:
            raise ValueError("url must use libsql:// or https://")
        if not parsed.netloc:
            raise ValueError("url must include a host")
        return value


class TursoTestResult(BaseModel):
    ok: bool
    error: str | None = None


class ScopeTokenCreateIn(BaseModel):
    scopes: list[str] = Field(min_length=1, max_length=64)
    subject: str = Field(default="ops-issued", min_length=1, max_length=120)
    ttl_seconds: int = Field(default=3600, ge=60, le=60 * 60 * 24 * 30)


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


class OpsTokenRevocation(BaseModel):
    revoked: bool


class OpsExportManifest(BaseModel):
    schema_version: str
    app_version: str


class OpsExportPayload(BaseModel):
    manifest: OpsExportManifest
    tasks: list[dict[str, object]]
    commands: list[dict[str, object]]
    habits: list[dict[str, object]]
    journal: list[dict[str, object]]
    decks: list[dict[str, object]]
    cards: list[dict[str, object]]
    nutrition_log: list[dict[str, object]]


class OpsExportResponse(BaseModel):
    checksum: str
    payload: OpsExportPayload


class OpsBackupVerification(BaseModel):
    valid: bool
    tables: list[str]
    migration_version: str | None = None
    error: str | None = None


class OpsRestoreResponse(BaseModel):
    ok: bool
    message: str


class OpsSeedResponse(BaseModel):
    seeded: bool
    message: str


class OpsImportSummary(BaseModel):
    tasks: int
    habits: int
    dry_run: bool
    applied: bool


class OpsImportResponse(BaseModel):
    status: str
    summary: OpsImportSummary
    conflicts: list[object]


class OpsReconcileResponse(BaseModel):
    status: str
    dispatched: int
