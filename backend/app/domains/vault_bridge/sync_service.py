"""Orchestrate push/pull/conflict detection for the vault bridge."""

from __future__ import annotations

import difflib
import hashlib
from pathlib import Path

from app.domains.journal.repository import JournalRepository
from app.domains.journal.schemas import JournalEntryCreate
from app.domains.vault_bridge.index_repository import VaultIndexRepository
from app.domains.vault_bridge.reader import scan_journal_notes
from app.domains.vault_bridge.schemas import (
    TaskImportCandidate,
    TaskImportConfirmRequest,
    TaskImportPreview,
    VaultConfig,
    VaultConflictPreview,
    VaultPullResult,
    VaultPushResult,
    VaultRollbackResult,
    VaultStatus,
)
from app.domains.vault_bridge.section_manager import inject_section
from app.domains.vault_bridge.task_reader import scan_task_collections, scan_task_files
from app.domains.vault_bridge.task_writer import (
    render_task_collection,
    render_tasks_section,
    rewrite_task_id_in_file,
    slugify,
    write_task_collection,
)
from app.domains.vault_bridge.writer import render_journal_note, write_journal_entry


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def _diff_lines(snapshot_body: str | None, current_body: str | None) -> list[str]:
    before = (snapshot_body or "").splitlines()
    after = (current_body or "").splitlines()
    return list(
        difflib.unified_diff(
            before,
            after,
            fromfile="dopaflow_snapshot",
            tofile="vault_current",
            lineterm="",
            n=2,
        )
    )


class VaultSyncService:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self.index_repo = VaultIndexRepository(db_path)
        self.journal_repo = JournalRepository(db_path)

    # lazy imports to avoid circular deps at module load time
    def _tasks_repo(self):  # type: ignore[return]
        from app.domains.tasks import repository as tasks_repo

        return tasks_repo

    def _projects_repo(self):  # type: ignore[return]
        from app.domains.projects import repository as proj_repo

        return proj_repo

    # ── config ────────────────────────────────────────────────────────────────

    def get_config(self) -> VaultConfig:
        return self.index_repo.get_config()

    def update_config(self, updates: dict) -> VaultConfig:
        str_updates = {k: str(v) for k, v in updates.items() if v is not None}
        return self.index_repo.update_config(str_updates)

    def validate_vault_path(self, path: str) -> bool:
        """Return True if the path exists and looks like a directory."""
        return Path(path).is_dir()

    # ── status ────────────────────────────────────────────────────────────────

    def get_status(self) -> VaultStatus:
        config = self.index_repo.get_config()
        records = self.index_repo.list_records()
        conflicts = self.index_repo.list_conflicts()

        vault_reachable = False
        if config.vault_path:
            vault_reachable = Path(config.vault_path).is_dir()

        return VaultStatus(
            config=config,
            vault_reachable=vault_reachable,
            total_indexed=len(records),
            conflicts=len(conflicts),
            last_push_at=self.index_repo.latest_sync_time("push"),
            last_pull_at=self.index_repo.latest_sync_time("pull"),
        )

    # ── push (DopaFlow → vault) ───────────────────────────────────────────────

    def push_journal(self) -> VaultPushResult:
        """Write all journal entries to the vault as daily note files."""
        config = self.index_repo.get_config()
        if not config.vault_path:
            return VaultPushResult(
                pushed=0,
                skipped=0,
                conflicts=0,
                errors=["vault_path is not configured"],
            )
        if not Path(config.vault_path).is_dir():
            return VaultPushResult(
                pushed=0, skipped=0, conflicts=0, errors=["vault path does not exist"]
            )

        entries = self.journal_repo.list_entries()
        pushed = 0
        skipped = 0
        conflicts = 0
        errors: list[str] = []

        for entry in entries:
            try:
                rendered_content = render_journal_note(entry)
                # Check for conflict before writing if the target file is unknown
                # or has drifted since the last indexed sync.
                rel_path = f"{config.daily_note_folder}/{entry.date}.md"
                existing_record = self.index_repo.get_by_file_path(rel_path)
                abs_path = Path(config.vault_path) / rel_path

                if abs_path.exists() and existing_record is None:
                    conflicts += 1
                    skipped += 1
                    continue

                if abs_path.exists() and existing_record:
                    disk_hash = _hash(abs_path.read_text(encoding="utf-8"))
                    current_app_hash = _hash(rendered_content)
                    if (
                        disk_hash != existing_record.file_hash
                        and current_app_hash != existing_record.file_hash
                    ):
                        self.index_repo.mark_conflict(rel_path)
                        conflicts += 1
                        skipped += 1
                        continue

                file_path, content_hash, previous = write_journal_entry(entry, config)
                self.index_repo.upsert_record(
                    entity_type="journal",
                    entity_id=entry.id,
                    file_path=file_path,
                    file_hash=content_hash,
                    direction="push",
                    snapshot_body=previous
                    if previous is not None
                    else rendered_content,
                )
                pushed += 1
            except Exception as exc:
                errors.append(f"{entry.date}: {exc}")

        return VaultPushResult(
            pushed=pushed, skipped=skipped, conflicts=conflicts, errors=errors
        )

    # ── pull (vault → DopaFlow) ───────────────────────────────────────────────

    def pull_journal(self) -> VaultPullResult:
        """Scan vault daily notes and import/update DopaFlow journal entries."""
        config = self.index_repo.get_config()
        if not config.vault_path:
            return VaultPullResult(
                imported=0,
                updated=0,
                conflicts=0,
                errors=["vault_path is not configured"],
            )
        if not Path(config.vault_path).is_dir():
            return VaultPullResult(
                imported=0, updated=0, conflicts=0, errors=["vault path does not exist"]
            )

        candidates = scan_journal_notes(config)
        imported = 0
        updated = 0
        conflicts = 0
        errors: list[str] = []

        for candidate in candidates:
            if not candidate.date:
                continue
            try:
                existing_record = self.index_repo.get_by_file_path(candidate.file_path)

                existing_entry = self.journal_repo.get_entry(candidate.date)
                if (
                    existing_record
                    and existing_record.file_hash != candidate.file_hash
                    and existing_entry
                ):
                    current_app_hash = _hash(render_journal_note(existing_entry))
                    if current_app_hash != existing_record.file_hash:
                        self.index_repo.mark_conflict(candidate.file_path)
                        conflicts += 1
                        continue

                # Create or update the DopaFlow entry
                payload = JournalEntryCreate(
                    markdown_body=candidate.markdown_body,
                    emoji=candidate.emoji,
                    date=candidate.date,
                    tags=candidate.tags,
                )

                if existing_entry:
                    patch = {
                        "markdown_body": candidate.markdown_body,
                        "emoji": candidate.emoji,
                        "tags": candidate.tags,
                    }
                    self.journal_repo.update_entry(existing_entry.id, patch)
                    updated += 1
                    entity_id = existing_entry.id
                else:
                    created_entry = self.journal_repo.save_entry(payload)
                    imported += 1
                    entity_id = created_entry.id

                self.index_repo.upsert_record(
                    entity_type="journal",
                    entity_id=entity_id,
                    file_path=candidate.file_path,
                    file_hash=candidate.file_hash,
                    direction="pull",
                )
            except Exception as exc:
                errors.append(f"{candidate.file_path}: {exc}")

        return VaultPullResult(
            imported=imported, updated=updated, conflicts=conflicts, errors=errors
        )

    # ── rollback ──────────────────────────────────────────────────────────────

    def rollback_file(self, record_id: int) -> VaultRollbackResult:
        """Restore a vault file to its pre-push snapshot."""
        config = self.index_repo.get_config()
        records = self.index_repo.list_records()
        record = next((r for r in records if r.id == record_id), None)

        if not record:
            return VaultRollbackResult(
                rolled_back=False, file_path="", message="Record not found"
            )

        snapshot = self.index_repo.get_snapshot(record_id)
        if snapshot is None:
            return VaultRollbackResult(
                rolled_back=False,
                file_path=record.file_path,
                message="No snapshot available for this file",
            )

        abs_path = Path(config.vault_path) / record.file_path
        try:
            abs_path.write_text(snapshot, encoding="utf-8")
            self.index_repo.resolve_conflict(record.file_path)
            return VaultRollbackResult(
                rolled_back=True,
                file_path=record.file_path,
                message=f"Restored snapshot to {record.file_path}",
            )
        except Exception as exc:
            return VaultRollbackResult(
                rolled_back=False,
                file_path=record.file_path,
                message=str(exc),
            )

    def get_conflict_preview(self, record_id: int) -> VaultConflictPreview:
        """Return the indexed snapshot and current vault file body for review."""
        record = self.index_repo.get_record(record_id)
        if record is None:
            raise FileNotFoundError("vault record not found")
        snapshot_body = self.index_repo.get_snapshot(record_id)

        config = self.index_repo.get_config()
        current_body: str | None = None
        current_exists = False
        if config.vault_path:
            abs_path = Path(config.vault_path) / record.file_path
            if abs_path.exists():
                current_body = abs_path.read_text(encoding="utf-8")
                current_exists = True

        return VaultConflictPreview(
            record=record,
            snapshot_body=snapshot_body,
            current_body=current_body,
            current_exists=current_exists,
            diff_lines=_diff_lines(snapshot_body, current_body),
        )

    # ── task bridge ───────────────────────────────────────────────────────────

    def push_tasks(self) -> VaultPushResult:
        """Group DopaFlow tasks by project and write one Markdown file per group.

        Inbox tasks (no project) go to Tasks/Inbox.md.
        Each project gets Tasks/<project-slug>.md.
        """
        config = self.index_repo.get_config()
        if not config.vault_path:
            return VaultPushResult(
                pushed=0,
                skipped=0,
                conflicts=0,
                errors=["vault_path is not configured"],
            )
        if not Path(config.vault_path).is_dir():
            return VaultPushResult(
                pushed=0, skipped=0, conflicts=0, errors=["vault path does not exist"]
            )

        tasks_repo = self._tasks_repo()
        projects_repo = self._projects_repo()

        all_tasks = tasks_repo.list_tasks(self.db_path)
        projects = {p["id"]: p for p in projects_repo.list_projects(self.db_path)}

        # Group tasks: inbox (no project) + one group per project
        by_project: dict[str | None, list] = {}
        for task in all_tasks:
            pid = task.project_id
            by_project.setdefault(pid, []).append(task)

        pushed = skipped = conflicts = 0
        errors: list[str] = []

        def _write_group(
            slug: str,
            project_name: str,
            tasks: list,
            project_id: str | None,
            scope: str | None,
        ) -> None:
            nonlocal pushed, skipped, conflicts
            try:
                rel_path = f"{config.tasks_folder}/{slug}.md"
                existing_record = self.index_repo.get_by_file_path(rel_path)
                abs_path = Path(config.vault_path) / rel_path

                if abs_path.exists() and existing_record is None:
                    self.index_repo.mark_conflict(rel_path)
                    conflicts += 1
                    skipped += 1
                    return

                rendered_content = render_task_collection(
                    tasks,
                    project_name,
                    project_id=project_id,
                    scope=scope,
                )

                if abs_path.exists() and existing_record:
                    disk_hash = _hash(abs_path.read_text(encoding="utf-8"))
                    current_app_hash = _hash(rendered_content)
                    if (
                        existing_record.file_hash is not None
                        and disk_hash != existing_record.file_hash
                        and current_app_hash != existing_record.file_hash
                    ):
                        self.index_repo.mark_conflict(rel_path)
                        conflicts += 1
                        skipped += 1
                        return

                file_path, content_hash, previous = write_task_collection(
                    tasks,
                    slug,
                    project_name,
                    config,
                    project_id=project_id,
                    scope=scope,
                )
                self.index_repo.upsert_record(
                    entity_type="task",
                    entity_id=project_id or "inbox",
                    file_path=file_path,
                    file_hash=content_hash,
                    direction="push",
                    snapshot_body=previous
                    if previous is not None
                    else rendered_content,
                )
                pushed += 1
            except Exception as exc:
                errors.append(f"{slug}: {exc}")

        # Inbox
        inbox_tasks = by_project.get(None, [])
        _write_group("Inbox", "Inbox", inbox_tasks, None, "inbox")

        # Per-project
        for pid, tasks in by_project.items():
            if pid is None:
                continue
            project = projects.get(pid)
            if not project:
                continue
            slug = slugify(project["name"]) or pid
            _write_group(slug, project["name"], tasks, pid, None)

        return VaultPushResult(
            pushed=pushed, skipped=skipped, conflicts=conflicts, errors=errors
        )

    def pull_tasks(self) -> VaultPullResult:
        """Scan vault Tasks/ folder and sync checkbox changes back to DopaFlow.

        Only updates completion status for tasks with a known dopaflow_id.
        Does not create new DopaFlow tasks from vault (import only on explicit request).
        """
        config = self.index_repo.get_config()
        if not config.vault_path:
            return VaultPullResult(
                imported=0,
                updated=0,
                conflicts=0,
                errors=["vault_path is not configured"],
            )
        if not Path(config.vault_path).is_dir():
            return VaultPullResult(
                imported=0, updated=0, conflicts=0, errors=["vault path does not exist"]
            )

        vault_root = Path(config.vault_path)
        candidates = scan_task_collections(vault_root, config.tasks_folder)
        tasks_repo = self._tasks_repo()

        updated = imported = conflicts = 0
        errors: list[str] = []

        for candidate in candidates:
            if not candidate.dopaflow_id:
                continue
            try:
                task = tasks_repo.get_task(self.db_path, candidate.dopaflow_id)
                if not task:
                    continue

                # Sync completion status back
                if bool(task.done) != candidate.done:
                    tasks_repo.update_task(
                        self.db_path,
                        candidate.dopaflow_id,
                        {
                            "done": candidate.done,
                            "status": "done" if candidate.done else "todo",
                        },
                    )
                    updated += 1
            except Exception as exc:
                errors.append(f"{candidate.dopaflow_id}: {exc}")

        return VaultPullResult(
            imported=imported, updated=updated, conflicts=conflicts, errors=errors
        )

    # ── daily note task section ───────────────────────────────────────────────

    def push_daily_tasks_section(self, date: str) -> VaultPushResult:
        """Append or update the managed task section inside a daily note.

        Only modifies content between the dopaflow:tasks section markers.
        Journal body and any user-added content outside the markers is untouched.
        """
        config = self.index_repo.get_config()
        if not config.vault_path:
            return VaultPushResult(
                pushed=0,
                skipped=0,
                conflicts=0,
                errors=["vault_path is not configured"],
            )
        if not Path(config.vault_path).is_dir():
            return VaultPushResult(
                pushed=0, skipped=0, conflicts=0, errors=["vault path does not exist"]
            )

        tasks_repo = self._tasks_repo()
        # Get tasks due on this date (or earlier, undone)
        from datetime import datetime, timezone

        try:
            target = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            return VaultPushResult(
                pushed=0, skipped=0, conflicts=0, errors=[f"invalid date: {date}"]
            )

        all_tasks = tasks_repo.list_tasks(self.db_path, done=False)
        due_tasks = [t for t in all_tasks if t.due_at and t.due_at[:10] <= date]

        tasks_section_body = "## Today's Tasks\n\n" + render_tasks_section(due_tasks)

        rel_path = f"{config.daily_note_folder}/{date}.md"
        abs_path = Path(config.vault_path) / rel_path

        if not abs_path.exists():
            return VaultPushResult(
                pushed=0,
                skipped=1,
                conflicts=0,
                errors=[f"daily note not found: {rel_path}"],
            )

        previous = abs_path.read_text(encoding="utf-8")
        updated_content = inject_section(previous, "tasks", tasks_section_body)
        abs_path.write_text(updated_content, encoding="utf-8")

        new_hash = _hash(updated_content)
        self.index_repo.upsert_record(
            entity_type="journal",
            entity_id=date,
            file_path=rel_path,
            file_hash=new_hash,
            direction="push",
            snapshot_body=previous,
        )

        return VaultPushResult(pushed=1, skipped=0, conflicts=0, errors=[])

    # ── task import (preview + confirm) ──────────────────────────────────────

    def preview_task_import(self) -> TaskImportPreview:
        """Scan vault task files and classify each task line without modifying anything.

        Returns three categories:
        - importable: lines with no DopaFlow ID (not yet in DopaFlow)
        - known: lines with a DopaFlow ID that resolves to an existing task
        - skipped: blank, headings, placeholder text
        """
        config = self.index_repo.get_config()
        if not config.vault_path or not Path(config.vault_path).is_dir():
            return TaskImportPreview(
                importable=[], known=[], skipped=0, total_scanned=0
            )

        vault_root = Path(config.vault_path)
        all_candidates = scan_task_files(vault_root, config.tasks_folder)
        tasks_repo = self._tasks_repo()

        importable: list[TaskImportCandidate] = []
        known: list[TaskImportCandidate] = []
        skipped = 0
        total_scanned = len(all_candidates)

        for c in all_candidates:
            if not c.title or c.title.strip() in ("_No tasks._",):
                skipped += 1
                continue

            candidate = TaskImportCandidate(
                title=c.title,
                done=c.done,
                due_str=c.due_str,
                priority=c.priority,
                tags=c.tags,
                file_path=c.file_path,
                line_text=c.line_text if hasattr(c, "line_text") else "",
                line_number=c.line_number,
                project_id=c.project_id,
                project_name=c.project_name,
            )

            if c.dopaflow_id:
                task = tasks_repo.get_task(self.db_path, c.dopaflow_id)
                if task:
                    candidate.status = "known"
                    candidate.known_task_id = c.dopaflow_id
                    known.append(candidate)
                else:
                    # ID present but task not found — treat as importable
                    candidate.status = "importable"
                    importable.append(candidate)
            else:
                candidate.status = "importable"
                importable.append(candidate)

        return TaskImportPreview(
            importable=importable,
            known=known,
            skipped=skipped,
            total_scanned=total_scanned,
        )

    def confirm_task_import(self, request: TaskImportConfirmRequest) -> VaultPullResult:
        """Create DopaFlow tasks from the confirmed candidates and write IDs back to vault files.

        Skips candidates whose title already exists as a DopaFlow task (duplicate guard).
        After creating each task, rewrites the source line in the vault file to add the new ID.
        """
        config = self.index_repo.get_config()
        tasks_repo = self._tasks_repo()
        vault_root = Path(config.vault_path) if config.vault_path else None

        imported = 0
        errors: list[str] = []

        for c in request.candidates:
            try:
                source_external_id = f"{c.file_path}:{c.line_number or c.line_text}"
                existing_task = tasks_repo.get_task_by_source_id(
                    self.db_path, source_external_id
                )
                if existing_task is not None:
                    continue

                # Create the task
                payload: dict = {
                    "title": c.title,
                    "done": c.done,
                    "status": "done" if c.done else "todo",
                    "priority": c.priority,
                    "tags": c.tags,
                    "source_type": "vault",
                    "source_external_id": source_external_id,
                }
                if c.due_str:
                    payload["due_at"] = f"{c.due_str}T17:00:00+00:00"
                if c.project_id:
                    payload["project_id"] = c.project_id

                new_task = tasks_repo.create_task(self.db_path, payload)
                new_id = new_task.id
                imported += 1

                # Write the ID back into the vault file
                if vault_root and c.line_text and c.file_path:
                    abs_path = vault_root / c.file_path
                    if abs_path.exists():
                        rewritten = rewrite_task_id_in_file(
                            abs_path,
                            c.line_text,
                            new_id,
                            line_number=c.line_number,
                        )
                        if not rewritten:
                            errors.append(
                                f"{c.title}: failed to write DopaFlow ID back to vault file"
                            )
                    else:
                        errors.append(
                            f"{c.title}: source vault file not found during ID write-back"
                        )
                else:
                    errors.append(
                        f"{c.title}: missing source line metadata for ID write-back"
                    )

            except Exception as exc:
                errors.append(f"{c.title}: {exc}")

        return VaultPullResult(
            imported=imported,
            updated=0,
            conflicts=0,
            errors=errors,
        )
