"""Tests for the task import preview/confirm flow."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from app.domains.tasks import repository as tasks_repo
from app.domains.vault_bridge.sync_service import VaultSyncService
from app.domains.vault_bridge.task_writer import render_task_collection, rewrite_task_id_in_file
from app.domains.vault_bridge.task_reader import parse_task_line, parse_task_collection, parse_task_file
from app.domains.vault_bridge.schemas import (
    TaskImportCandidate,
    TaskImportConfirmRequest,
    TaskImportPreview,
)


# ── rewrite_task_id_in_file ──────────────────────���────────────────────────────

class TestRewriteTaskId:
    def _make_file(self, tmp_path: Path, content: str) -> Path:
        f = tmp_path / "Tasks.md"
        f.write_text(content, encoding="utf-8")
        return f

    def test_adds_id_comment_to_plain_line(self, tmp_path):
        content = "- [ ] Buy milk\n"
        f = self._make_file(tmp_path, content)
        result = rewrite_task_id_in_file(f, "- [ ] Buy milk", "tsk_new")
        assert result is True
        updated = f.read_text()
        assert "df:tsk_new" in updated
        assert "Buy milk" in updated

    def test_injects_id_into_existing_comment(self, tmp_path):
        content = "- [ ] Task <!--due:2026-04-10-->\n"
        f = self._make_file(tmp_path, content)
        result = rewrite_task_id_in_file(f, "- [ ] Task <!--due:2026-04-10-->", "tsk_abc")
        assert result is True
        updated = f.read_text()
        assert "df:tsk_abc" in updated

    def test_returns_false_when_line_not_found(self, tmp_path):
        content = "- [ ] Something else\n"
        f = self._make_file(tmp_path, content)
        result = rewrite_task_id_in_file(f, "- [ ] Not present", "tsk_xyz")
        assert result is False

    def test_returns_false_for_missing_file(self, tmp_path):
        missing = tmp_path / "nonexistent.md"
        result = rewrite_task_id_in_file(missing, "- [ ] Task", "tsk_1")
        assert result is False

    def test_idempotent_guard_on_round_trip(self, tmp_path):
        """After rewrite, re-parsing the line should find the new ID."""
        original = "- [ ] Round trip task"
        content = original + "\n"
        f = self._make_file(tmp_path, content)
        rewrite_task_id_in_file(f, original, "tsk_rt")
        new_content = f.read_text()
        # Find the updated line and parse it
        for line in new_content.splitlines():
            if "Round trip task" in line:
                c = parse_task_line(line)
                assert c is not None
                assert c.dopaflow_id == "tsk_rt"
                break

    def test_preserves_other_lines(self, tmp_path):
        content = "# Heading\n\n- [ ] Task A\n- [ ] Task B\n"
        f = self._make_file(tmp_path, content)
        rewrite_task_id_in_file(f, "- [ ] Task A", "tsk_a")
        updated = f.read_text()
        assert "# Heading" in updated
        assert "Task B" in updated

    def test_matches_first_occurrence_only(self, tmp_path):
        """Duplicate lines: only the first should get the ID."""
        content = "- [ ] Duplicate\n- [ ] Duplicate\n"
        f = self._make_file(tmp_path, content)
        rewrite_task_id_in_file(f, "- [ ] Duplicate", "tsk_dup")
        lines = f.read_text().splitlines()
        ids_found = sum(1 for l in lines if "df:tsk_dup" in l)
        assert ids_found == 1

    def test_can_target_specific_duplicate_line(self, tmp_path):
        content = "- [ ] Duplicate\n- [ ] Duplicate\n"
        f = self._make_file(tmp_path, content)
        result = rewrite_task_id_in_file(f, "- [ ] Duplicate", "tsk_dup", line_number=2)
        assert result is True
        lines = f.read_text().splitlines()
        assert "df:tsk_dup" not in lines[0]
        assert "df:tsk_dup" in lines[1]


# ── TaskImportCandidate schema ────────────────────────────────���───────────────

class TestTaskImportCandidateSchema:
    def test_defaults(self):
        c = TaskImportCandidate(
            title="Test",
            file_path="Tasks/Inbox.md",
            line_text="- [ ] Test",
        )
        assert c.done is False
        assert c.priority == 3
        assert c.status == "importable"
        assert c.known_task_id is None

    def test_known_status(self):
        c = TaskImportCandidate(
            title="Known",
            file_path="Tasks/Inbox.md",
            line_text="- [ ] Known <!--df:tsk_abc-->",
            status="known",
            known_task_id="tsk_abc",
        )
        assert c.status == "known"
        assert c.known_task_id == "tsk_abc"


# ── TaskImportPreview schema ──────────────────────────���───────────────────────

class TestTaskImportPreview:
    def test_empty(self):
        p = TaskImportPreview(importable=[], known=[], skipped=0, total_scanned=0)
        assert p.importable == []

    def test_counts(self):
        importable = [
            TaskImportCandidate(title="A", file_path="f", line_text="- [ ] A"),
            TaskImportCandidate(title="B", file_path="f", line_text="- [ ] B"),
        ]
        known = [
            TaskImportCandidate(title="C", file_path="f", line_text="- [ ] C <!--df:tsk_1-->", status="known", known_task_id="tsk_1"),
        ]
        p = TaskImportPreview(importable=importable, known=known, skipped=2, total_scanned=5)
        assert len(p.importable) == 2
        assert len(p.known) == 1
        assert p.skipped == 2
        assert p.total_scanned == 5


# ── TaskImportConfirmRequest ─────────────────────────────���────────────────────

class TestTaskImportConfirmRequest:
    def test_empty_candidates(self):
        req = TaskImportConfirmRequest(candidates=[])
        assert req.candidates == []

    def test_with_candidates(self):
        c = TaskImportCandidate(title="T", file_path="Tasks/Inbox.md", line_text="- [ ] T")
        req = TaskImportConfirmRequest(candidates=[c])
        assert len(req.candidates) == 1
        assert req.candidates[0].title == "T"


# ── Integration: render → parse → classify ────────────────────��──────────────

class TestImportRoundTrip:
    def test_rendered_tasks_are_known_after_push(self, tmp_path):
        """Tasks with df: IDs should classify as 'known', not 'importable'."""
        tasks = [
            {"id": "tsk_101", "title": "Known task", "done": False, "status": "todo", "priority": 3, "tags": []},
        ]
        content = render_task_collection(tasks, "My Project", project_id="prj_1")
        f = tmp_path / "MyProject.md"
        f.write_text(content, encoding="utf-8")
        candidates = parse_task_collection(f, tmp_path)
        assert len(candidates) == 1
        assert candidates[0].dopaflow_id == "tsk_101"
        # Since it has a df: ID, an import flow would classify it as "known"

    def test_plain_tasks_are_importable(self, tmp_path):
        """Tasks without df: IDs (written by user in Obsidian) should have no dopaflow_id."""
        content = (
            "---\ndopaflow_type: task_collection\nproject: Manual\n---\n\n"
            "## Manual\n\n"
            "- [ ] Hand-written task\n"
            "- [ ] Another task\n"
        )
        f = tmp_path / "Manual.md"
        f.write_text(content, encoding="utf-8")
        candidates = parse_task_collection(f, tmp_path)
        assert len(candidates) == 2
        for c in candidates:
            assert c.dopaflow_id is None
            assert c.line_text  # line_text preserved for rewrite
            assert c.line_number is not None

    def test_plain_non_dopaflow_markdown_file_can_be_parsed_for_import(self, tmp_path):
        content = (
            "# Project Scratchpad\n\n"
            "- [ ] Plain vault task\n"
            "- [x] Another plain vault task\n"
        )
        f = tmp_path / "Scratchpad.md"
        f.write_text(content, encoding="utf-8")

        candidates = parse_task_file(f, tmp_path, require_dopaflow=False)

        assert len(candidates) == 2
        assert candidates[0].project_name == "Scratchpad"
        assert candidates[0].dopaflow_id is None
        assert candidates[0].line_number == 3


def _configure_vault(service: VaultSyncService, vault_root: Path) -> None:
    service.index_repo.update_config(
        {
            "vault_path": str(vault_root),
            "vault_enabled": "true",
            "tasks_folder": "Tasks",
        }
    )


class TestImportService:
    def test_confirm_import_is_idempotent_by_source_locator(self, db_path, tmp_path):
        service = VaultSyncService(str(db_path))
        _configure_vault(service, tmp_path)

        tasks_dir = tmp_path / "Tasks"
        tasks_dir.mkdir(parents=True, exist_ok=True)
        task_file = tasks_dir / "Inbox.md"
        task_file.write_text(
            "---\n"
            "dopaflow_type: task_collection\n"
            "dopaflow_scope: inbox\n"
            "project: Inbox\n"
            "---\n\n"
            "## Inbox\n\n"
            "- [ ] Imported once\n",
            encoding="utf-8",
        )

        preview = service.preview_task_import()
        assert len(preview.importable) == 1

        first = service.confirm_task_import(TaskImportConfirmRequest(candidates=preview.importable))
        second = service.confirm_task_import(TaskImportConfirmRequest(candidates=preview.importable))

        assert first.imported == 1
        assert second.imported == 0
        tasks = tasks_repo.list_tasks(str(db_path))
        assert len(tasks) == 1

    def test_confirm_import_reports_write_back_failure(self, db_path, tmp_path):
        service = VaultSyncService(str(db_path))
        _configure_vault(service, tmp_path)

        candidate = TaskImportCandidate(
            title="Missing source line",
            file_path="Tasks/Missing.md",
            line_text="- [ ] Missing source line",
            line_number=1,
        )

        result = service.confirm_task_import(TaskImportConfirmRequest(candidates=[candidate]))

        assert result.imported == 1
        assert any("source vault file not found" in error for error in result.errors)
