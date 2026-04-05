"""FastAPI router for the vault bridge domain."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings_dependency
from app.middleware.auth_scopes import require_scope
from app.domains.vault_bridge.schemas import (
    TaskImportConfirmRequest,
    TaskImportPreview,
    VaultConfig,
    VaultConfigUpdate,
    VaultFileRecord,
    VaultPullResult,
    VaultPushResult,
    VaultRollbackResult,
    VaultStatus,
)
from app.domains.vault_bridge.sync_service import VaultSyncService

router = APIRouter(tags=["vault"])


def _svc(settings: Settings = Depends(get_settings_dependency)) -> VaultSyncService:
    return VaultSyncService(settings.db_path)


@router.get("/vault/status", response_model=VaultStatus, dependencies=[Depends(require_scope("read:journal"))])
def get_vault_status(svc: VaultSyncService = Depends(_svc)) -> VaultStatus:
    """Return current vault configuration and sync health."""
    return svc.get_status()


@router.get("/vault/config", response_model=VaultConfig, dependencies=[Depends(require_scope("read:journal"))])
def get_vault_config(svc: VaultSyncService = Depends(_svc)) -> VaultConfig:
    """Return vault configuration."""
    return svc.get_config()


@router.patch("/vault/config", response_model=VaultConfig, dependencies=[Depends(require_scope("write:journal"))])
def update_vault_config(
    payload: VaultConfigUpdate,
    svc: VaultSyncService = Depends(_svc),
) -> VaultConfig:
    """Update vault configuration. Validates vault_path if provided."""
    updates = payload.model_dump(exclude_unset=True)

    if "vault_path" in updates and updates["vault_path"]:
        if not svc.validate_vault_path(updates["vault_path"]):
            raise HTTPException(
                status_code=422,
                detail=f"vault_path does not exist or is not a directory: {updates['vault_path']}",
            )

    return svc.update_config(updates)


@router.post("/vault/push/journal", response_model=VaultPushResult, dependencies=[Depends(require_scope("write:journal"))])
def push_journal(svc: VaultSyncService = Depends(_svc)) -> VaultPushResult:
    """Push all DopaFlow journal entries to vault as Markdown daily notes."""
    return svc.push_journal()


@router.post("/vault/pull/journal", response_model=VaultPullResult, dependencies=[Depends(require_scope("write:journal"))])
def pull_journal(svc: VaultSyncService = Depends(_svc)) -> VaultPullResult:
    """Scan vault daily notes folder and import/update DopaFlow journal entries."""
    return svc.pull_journal()


@router.get("/vault/index", response_model=list[VaultFileRecord], dependencies=[Depends(require_scope("read:journal"))])
def list_index(
    entity_type: str | None = None,
    svc: VaultSyncService = Depends(_svc),
) -> list[VaultFileRecord]:
    """List all vault file index records, optionally filtered by entity type."""
    return svc.index_repo.list_records(entity_type=entity_type)


@router.get("/vault/conflicts", response_model=list[VaultFileRecord], dependencies=[Depends(require_scope("read:journal"))])
def list_conflicts(svc: VaultSyncService = Depends(_svc)) -> list[VaultFileRecord]:
    """List all files currently in conflict state."""
    return svc.index_repo.list_conflicts()


@router.post("/vault/rollback/{record_id}", response_model=VaultRollbackResult, dependencies=[Depends(require_scope("write:journal"))])
def rollback_file(
    record_id: int,
    svc: VaultSyncService = Depends(_svc),
) -> VaultRollbackResult:
    """Restore a vault file to its pre-push snapshot."""
    result = svc.rollback_file(record_id)
    if not result.rolled_back:
        raise HTTPException(status_code=409, detail=result.message)
    return result


@router.post("/vault/resolve/{file_path:path}", dependencies=[Depends(require_scope("write:journal"))])
def resolve_conflict(
    file_path: str,
    svc: VaultSyncService = Depends(_svc),
) -> dict:
    """Mark a conflict as resolved (user has handled it manually)."""
    svc.index_repo.resolve_conflict(file_path)
    return {"resolved": True, "file_path": file_path}


@router.post("/vault/push/tasks", response_model=VaultPushResult, dependencies=[Depends(require_scope("read:tasks"))])
def push_tasks(svc: VaultSyncService = Depends(_svc)) -> VaultPushResult:
    """Push DopaFlow tasks to vault as Obsidian-compatible Markdown task files."""
    return svc.push_tasks()


@router.post("/vault/pull/tasks", response_model=VaultPullResult, dependencies=[Depends(require_scope("write:tasks"))])
def pull_tasks(svc: VaultSyncService = Depends(_svc)) -> VaultPullResult:
    """Scan vault Tasks/ folder and sync completion status back to DopaFlow."""
    return svc.pull_tasks()


@router.post("/vault/push/daily-tasks/{date}", response_model=VaultPushResult, dependencies=[Depends(require_scope("read:tasks"))])
def push_daily_tasks_section(date: str, svc: VaultSyncService = Depends(_svc)) -> VaultPushResult:
    """Append or update the managed tasks section inside an existing daily note.

    Only modifies content between the dopaflow:tasks markers. All other content is untouched.
    """
    return svc.push_daily_tasks_section(date)


@router.get("/vault/tasks/import-preview", response_model=TaskImportPreview, dependencies=[Depends(require_scope("read:tasks"))])
def preview_task_import(svc: VaultSyncService = Depends(_svc)) -> TaskImportPreview:
    """Dry-run scan of vault task files.

    Returns importable (no DopaFlow ID), known (already mapped), and skipped counts.
    Does not modify anything.
    """
    return svc.preview_task_import()


@router.post("/vault/tasks/import-confirm", response_model=VaultPullResult, dependencies=[Depends(require_scope("write:tasks"))])
def confirm_task_import(
    payload: TaskImportConfirmRequest,
    svc: VaultSyncService = Depends(_svc),
) -> VaultPullResult:
    """Create DopaFlow tasks from confirmed vault task candidates.

    After creation, writes the new DopaFlow ID back into the vault file
    so repeated imports are idempotent.
    """
    return svc.confirm_task_import(payload)
