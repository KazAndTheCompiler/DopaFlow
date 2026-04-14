"""Ops diagnostics, backup, export, and import endpoints."""

from __future__ import annotations

import json
from contextlib import suppress
from datetime import UTC, datetime
from pathlib import Path
from secrets import compare_digest

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.core.config import Settings, get_settings_dependency
from app.domains.ops.schemas import (
    MAX_OPS_IMPORT_BYTES,
    OpsBackupVerification,
    OpsConfigResponse,
    OpsExportPayload,
    OpsExportResponse,
    OpsImportIn,
    OpsImportResponse,
    OpsReconcileResponse,
    OpsRestoreResponse,
    OpsSeedResponse,
    OpsStatsResponse,
    OpsSyncStatus,
    OpsTokenRevocation,
    ScopeTokenCreateIn,
    ScopeTokenIssued,
    ScopeTokenRead,
    TursoTestIn,
    TursoTestResult,
)
from app.domains.ops.service import OpsService
from app.middleware.auth_scopes import (
    SCOPES,
    create_scope_token,
    list_scope_tokens,
    require_scope,
    revoke_scope_token,
    verify_scope_token,
)
from app.services.upload_security import validate_upload

MAX_EXPORT_RESPONSE_BYTES = 25 * 1024 * 1024


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> OpsService:
    return OpsService(settings)


async def require_ops_secret(
    settings: Settings = Depends(get_settings_dependency),
    x_ops_secret: str | None = Header(default=None),
) -> None:
    if not settings.ops_secret:
        raise HTTPException(status_code=503, detail="Ops secret is not configured")
    if not x_ops_secret or not compare_digest(x_ops_secret, settings.ops_secret):
        raise HTTPException(status_code=403, detail="Invalid ops secret")


router = APIRouter(
    prefix="/ops",
    tags=["ops"],
    dependencies=[Depends(require_ops_secret)],
)


def _ensure_export_size_within_limit(content: bytes, *, label: str) -> bytes:
    if len(content) > MAX_EXPORT_RESPONSE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"{label} exceeds the {MAX_EXPORT_RESPONSE_BYTES // (1024 * 1024)} MB export limit",
        )
    return content


# ── diagnostics ───────────────────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=OpsStatsResponse,
    dependencies=[Depends(require_scope("read:ops"))],
)
async def stats(svc: OpsService = Depends(_svc)) -> OpsStatsResponse:
    """Get entity counts across key domains."""
    return OpsStatsResponse(**svc.get_stats())


@router.get(
    "/sync-status",
    response_model=OpsSyncStatus,
    dependencies=[Depends(require_scope("read:ops"))],
)
async def sync_status(svc: OpsService = Depends(_svc)) -> OpsSyncStatus:
    """Get database size and basic sync diagnostics."""
    return OpsSyncStatus(**svc.get_sync_status())


@router.get(
    "/config",
    response_model=OpsConfigResponse,
    dependencies=[Depends(require_scope("read:ops"))],
)
async def config(svc: OpsService = Depends(_svc)) -> OpsConfigResponse:
    """Get safe runtime config details."""
    return OpsConfigResponse(**svc.get_config())


@router.post(
    "/turso-test",
    response_model=TursoTestResult,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def turso_test(payload: TursoTestIn) -> TursoTestResult:
    """Test a Turso libsql connection using provided credentials."""
    try:
        import libsql_experimental as libsql  # type: ignore[import-untyped]

        conn = libsql.connect(payload.url, auth_token=payload.token)
        conn.execute("SELECT 1")
        conn.close()
        return TursoTestResult(ok=True, error=None)
    except ImportError:
        return TursoTestResult(
            ok=False, error="libsql-experimental not installed on this server"
        )
    except Exception as exc:
        return TursoTestResult(ok=False, error=str(exc))


@router.post(
    "/auth-tokens",
    response_model=ScopeTokenIssued,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def issue_scope_token(
    payload: ScopeTokenCreateIn,
    settings: Settings = Depends(get_settings_dependency),
) -> ScopeTokenIssued:
    """Issue a signed bearer token for remote scoped API access."""
    unknown = sorted(set(payload.scopes) - set(SCOPES))
    if unknown:
        raise HTTPException(
            status_code=422, detail=f"Unknown scopes: {', '.join(unknown)}"
        )
    if payload.ttl_seconds < 60 or payload.ttl_seconds > 60 * 60 * 24 * 30:
        raise HTTPException(
            status_code=422, detail="ttl_seconds must be between 60 and 2592000"
        )
    token = create_scope_token(
        payload.scopes,
        subject=payload.subject.strip() or "ops-issued",
        ttl_seconds=payload.ttl_seconds,
        settings=settings,
    )
    claims = verify_scope_token(token, settings=settings)
    return ScopeTokenIssued(
        id=str(claims["jti"]),
        token=token,
        expires_in=payload.ttl_seconds,
        scopes=sorted(set(payload.scopes)),
        subject=str(claims["sub"]),
    )


@router.get(
    "/auth-tokens",
    response_model=list[ScopeTokenRead],
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def list_issued_scope_tokens(
    settings: Settings = Depends(get_settings_dependency),
) -> list[ScopeTokenRead]:
    """List issued signed bearer tokens and their lifecycle state."""
    return [ScopeTokenRead(**item) for item in list_scope_tokens(settings=settings)]


@router.delete(
    "/auth-tokens/{token_id}",
    response_model=OpsTokenRevocation,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def revoke_issued_scope_token(
    token_id: str,
    settings: Settings = Depends(get_settings_dependency),
) -> OpsTokenRevocation:
    """Revoke a previously issued signed bearer token."""
    if not revoke_scope_token(token_id, settings=settings):
        raise HTTPException(status_code=404, detail="Scope token not found")
    return OpsTokenRevocation(revoked=True)


# ── export ────────────────────────────────────────────────────────────────────


@router.get(
    "/export",
    response_model=OpsExportResponse,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def export_data(svc: OpsService = Depends(_svc)) -> OpsExportResponse:
    """Full JSON export of all app data with SHA-256 checksum."""
    import hashlib

    payload = svc.export_payload()
    blob = json.dumps(payload, sort_keys=True, default=str)
    checksum = hashlib.sha256(blob.encode("utf-8")).hexdigest()
    return OpsExportResponse(checksum=checksum, payload=OpsExportPayload(**payload))


@router.get("/export/download", dependencies=[Depends(require_scope("admin:ops"))])
async def export_data_download(svc: OpsService = Depends(_svc)) -> Response:
    """Download full data export as a JSON file."""
    payload = svc.export_payload()
    blob = json.dumps(payload, sort_keys=True, indent=2, default=str)
    content = _ensure_export_size_within_limit(
        blob.encode("utf-8"), label="JSON export"
    )
    today = datetime.now(UTC).date().isoformat()
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="dopaflow-backup-{today}.json"'
        },
    )


@router.get("/export/all", dependencies=[Depends(require_scope("admin:ops"))])
async def export_all_zip(svc: OpsService = Depends(_svc)) -> Response:
    """Download full export as a ZIP archive (tasks, habits, journal, alarms, nutrition)."""
    today = datetime.now(UTC).date().isoformat()
    zip_bytes = _ensure_export_size_within_limit(
        svc.export_all_zip(), label="ZIP export"
    )
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="dopaflow-export-{today}.zip"'
        },
    )


# ── backup / restore ──────────────────────────────────────────────────────────


@router.get("/backup/db", dependencies=[Depends(require_scope("admin:ops"))])
async def backup_db(svc: OpsService = Depends(_svc)) -> Response:
    """Download a live SQLite backup of the database."""
    try:
        tmp_path, filename = svc.backup_db()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Backup failed: {exc}") from exc
    try:
        content = _ensure_export_size_within_limit(
            Path(tmp_path).read_bytes(), label="Database backup"
        )
    finally:
        with suppress(OSError):
            Path(tmp_path).unlink()
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/backup/verify",
    response_model=OpsBackupVerification,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def verify_backup(file: UploadFile = File(...)) -> OpsBackupVerification:
    """Verify a SQLite backup file without restoring it."""
    content, _ = validate_upload(
        file,
        kind="sqlite",
        allowed_suffixes={".db", ".sqlite", ".sqlite3"},
        allowed_content_types={
            "application/octet-stream",
            "application/x-sqlite3",
            "application/vnd.sqlite3",
        },
        default_max_bytes=50 * 1024 * 1024,
    )
    svc = OpsService("")  # db_path not needed for verify
    return OpsBackupVerification(**svc.verify_backup(content))


@router.post(
    "/restore/db",
    response_model=OpsRestoreResponse,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def restore_db(
    file: UploadFile = File(...), settings: Settings = Depends(get_settings_dependency)
) -> OpsRestoreResponse:
    """Restore the database from a previously downloaded backup file."""
    content, _ = validate_upload(
        file,
        kind="sqlite",
        allowed_suffixes={".db", ".sqlite", ".sqlite3"},
        allowed_content_types={
            "application/octet-stream",
            "application/x-sqlite3",
            "application/vnd.sqlite3",
        },
        default_max_bytes=50 * 1024 * 1024,
    )
    svc = OpsService(str(settings.db_path))
    try:
        return OpsRestoreResponse(**svc.restore_db(content))
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Operation failed: {type(exc).__name__}"
        ) from exc


# ── seed / import / reconcile ─────────────────────────────────────────────────


@router.post(
    "/seed",
    response_model=OpsSeedResponse,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def seed_first_run(svc: OpsService = Depends(_svc)) -> OpsSeedResponse:
    """Seed sample data on first run (no-op if data already exists)."""
    return OpsSeedResponse(**svc.seed_first_run())


@router.post(
    "/import",
    response_model=OpsImportResponse,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def import_data(
    payload: OpsImportIn, svc: OpsService = Depends(_svc)
) -> OpsImportResponse:
    """Import a previously exported data package (checksum-verified)."""
    if len(payload.package.encode("utf-8")) > MAX_OPS_IMPORT_BYTES:
        raise HTTPException(
            status_code=413, detail="Import payload exceeds the 5 MB request limit"
        )
    try:
        return OpsImportResponse(
            **svc.import_data(
                payload.package, payload.checksum, dry_run=payload.dry_run
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"Invalid request: {type(exc).__name__}"
        ) from exc


@router.post(
    "/integrations/reconcile",
    response_model=OpsReconcileResponse,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def reconcile(
    limit: int = Query(default=100, ge=1, le=1000),
) -> OpsReconcileResponse:
    """Trigger webhook outbox reconciliation."""
    try:
        from app.domains.integrations.service import IntegrationsService

        dispatched = IntegrationsService.dispatch_outbox(limit)
        return OpsReconcileResponse(status="ok", dispatched=dispatched)
    except Exception:
        return OpsReconcileResponse(status="ok", dispatched=0)
