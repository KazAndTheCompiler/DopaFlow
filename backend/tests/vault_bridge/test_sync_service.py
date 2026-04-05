"""Service-level tests for the vault bridge task sync behavior."""

from __future__ import annotations

from pathlib import Path

from app.domains.tasks import repository as tasks_repo
from app.domains.vault_bridge.sync_service import VaultSyncService
from app.domains.vault_bridge.schemas import TaskImportConfirmRequest


def _configure_vault(service: VaultSyncService, vault_root: Path) -> None:
    service.index_repo.update_config(
        {
            "vault_path": str(vault_root),
            "vault_enabled": "true",
            "tasks_folder": "Tasks",
            "daily_note_folder": "Daily",
        }
    )


def test_push_tasks_includes_completed_items(db_path: Path, tmp_path: Path) -> None:
    service = VaultSyncService(str(db_path))
    _configure_vault(service, tmp_path)

    tasks_repo.create_task(
        str(db_path),
        {
            "title": "Open loop",
            "status": "todo",
            "done": False,
            "priority": 2,
            "tags": ["work"],
        },
    )
    tasks_repo.create_task(
        str(db_path),
        {
            "title": "Finished loop",
            "status": "done",
            "done": True,
            "priority": 3,
            "tags": [],
        },
    )

    result = service.push_tasks()

    assert result.pushed == 1
    assert result.conflicts == 0
    inbox_file = tmp_path / "Tasks" / "Inbox.md"
    content = inbox_file.read_text(encoding="utf-8")
    assert "- [ ] Open loop" in content
    assert "- [x] Finished loop" in content


def test_push_tasks_marks_conflict_when_vault_and_app_both_drift(db_path: Path, tmp_path: Path) -> None:
    service = VaultSyncService(str(db_path))
    _configure_vault(service, tmp_path)

    created = tasks_repo.create_task(
        str(db_path),
        {
            "title": "Original title",
            "status": "todo",
            "done": False,
            "priority": 3,
            "tags": [],
        },
    )

    first_push = service.push_tasks()
    assert first_push.pushed == 1

    inbox_file = tmp_path / "Tasks" / "Inbox.md"
    inbox_file.write_text(
        inbox_file.read_text(encoding="utf-8").replace("Original title", "Vault-edited title"),
        encoding="utf-8",
    )
    tasks_repo.update_task(str(db_path), created["id"], {"title": "App-edited title"})

    second_push = service.push_tasks()

    assert second_push.pushed == 0
    assert second_push.skipped == 1
    assert second_push.conflicts == 1
    assert "Vault-edited title" in inbox_file.read_text(encoding="utf-8")

    conflicts = service.index_repo.list_conflicts()
    assert any(record.file_path == "Tasks/Inbox.md" for record in conflicts)


def test_preview_task_import_lists_importable_candidates(db_path: Path, tmp_path: Path) -> None:
    service = VaultSyncService(str(db_path))
    _configure_vault(service, tmp_path)

    tasks_dir = tmp_path / "Tasks"
    tasks_dir.mkdir(parents=True, exist_ok=True)
    (tasks_dir / "Inbox.md").write_text(
        "---\n"
        "dopaflow_type: task_collection\n"
        "dopaflow_scope: inbox\n"
        "project: Inbox\n"
        "---\n\n"
        "## Inbox\n\n"
        "- [ ] Preview this task\n",
        encoding="utf-8",
    )

    preview = service.preview_task_import()

    assert preview.total_scanned == 1
    assert preview.skipped == 0
    assert len(preview.importable) == 1
    assert preview.importable[0].title == "Preview this task"
    assert preview.importable[0].line_number == 9


def test_confirm_task_import_is_idempotent_by_source_locator(db_path: Path, tmp_path: Path) -> None:
    service = VaultSyncService(str(db_path))
    _configure_vault(service, tmp_path)

    tasks_dir = tmp_path / "Tasks"
    tasks_dir.mkdir(parents=True, exist_ok=True)
    source = tasks_dir / "Inbox.md"
    source.write_text(
        "---\n"
        "dopaflow_type: task_collection\n"
        "dopaflow_scope: inbox\n"
        "project: Inbox\n"
        "---\n\n"
        "## Inbox\n\n"
        "- [ ] Import once only\n",
        encoding="utf-8",
    )

    preview = service.preview_task_import()
    first = service.confirm_task_import(TaskImportConfirmRequest(candidates=preview.importable))
    second = service.confirm_task_import(TaskImportConfirmRequest(candidates=preview.importable))

    assert first.imported == 1
    assert second.imported == 0
    tasks = tasks_repo.list_tasks(str(db_path))
    assert len(tasks) == 1
    assert "df:" in source.read_text(encoding="utf-8")


def test_push_daily_tasks_section_preserves_existing_note_content(db_path: Path, tmp_path: Path) -> None:
    service = VaultSyncService(str(db_path))
    _configure_vault(service, tmp_path)

    tasks_repo.create_task(
        str(db_path),
        {
            "title": "Daily note task",
            "due_at": "2026-04-05T17:00:00+00:00",
            "priority": 2,
            "tags": ["vault"],
        },
    )

    daily_dir = tmp_path / "Daily"
    daily_dir.mkdir(parents=True, exist_ok=True)
    daily_file = daily_dir / "2026-04-05.md"
    daily_file.write_text("# Daily\n\nUser content stays here.\n", encoding="utf-8")

    result = service.push_daily_tasks_section("2026-04-05")

    assert result.pushed == 1
    body = daily_file.read_text(encoding="utf-8")
    assert "User content stays here." in body
    assert "<!-- dopaflow:tasks:start -->" in body
    assert "Daily note task" in body
