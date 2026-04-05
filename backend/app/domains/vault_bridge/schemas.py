"""Pydantic schemas for the vault bridge domain."""

from __future__ import annotations

from pydantic import BaseModel


class VaultConfig(BaseModel):
    """User-facing vault configuration."""

    vault_enabled: bool = False
    vault_path: str = ""
    daily_note_folder: str = "Daily"
    tasks_folder: str = "Tasks"
    review_folder: str = "Review"
    projects_folder: str = "Projects"
    attachments_folder: str = "Attachments"


class VaultConfigUpdate(BaseModel):
    """Partial update for vault configuration."""

    vault_enabled: bool | None = None
    vault_path: str | None = None
    daily_note_folder: str | None = None
    tasks_folder: str | None = None
    review_folder: str | None = None
    projects_folder: str | None = None
    attachments_folder: str | None = None


class VaultFileRecord(BaseModel):
    """A single entry in the vault file index."""

    id: int
    entity_type: str
    entity_id: str
    file_path: str
    file_hash: str | None = None
    last_synced_at: str | None = None
    last_direction: str | None = None
    sync_status: str = "idle"
    created_at: str


class VaultPushResult(BaseModel):
    """Result of a vault push operation."""

    pushed: int
    skipped: int
    conflicts: int
    errors: list[str]


class VaultPullResult(BaseModel):
    """Result of a vault pull operation."""

    imported: int
    updated: int
    conflicts: int
    errors: list[str]


class VaultRollbackResult(BaseModel):
    """Result of a single-file rollback."""

    rolled_back: bool
    file_path: str
    message: str


class VaultStatus(BaseModel):
    """Overall vault bridge status."""

    config: VaultConfig
    vault_reachable: bool
    total_indexed: int
    conflicts: int
    last_push_at: str | None = None
    last_pull_at: str | None = None


class VaultConflictPreview(BaseModel):
    """Preview payload for inspecting a conflicted vault file."""

    record: VaultFileRecord
    snapshot_body: str | None = None
    current_body: str | None = None
    current_exists: bool = False
    diff_lines: list[str] = []


class TaskImportCandidate(BaseModel):
    """A single task line from a vault file, ready for preview or import."""

    title: str
    done: bool = False
    due_str: str | None = None
    priority: int = 3
    tags: list[str] = []
    file_path: str               # vault-relative path (e.g. Tasks/Inbox.md)
    line_text: str               # original raw line — used to locate and rewrite on confirm
    line_number: int | None = None
    project_id: str | None = None
    project_name: str | None = None
    status: str = "importable"   # "importable" | "known" | "skipped"
    known_task_id: str | None = None   # set when status == "known"


class TaskImportPreview(BaseModel):
    """Result of a dry-run scan of vault task files."""

    importable: list[TaskImportCandidate]
    known: list[TaskImportCandidate]
    skipped: int
    total_scanned: int


class TaskImportConfirmRequest(BaseModel):
    """User-selected candidates to create as real DopaFlow tasks."""

    candidates: list[TaskImportCandidate]
