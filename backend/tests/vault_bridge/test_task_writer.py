"""Tests for the task writer and task reader round-trip."""

import pytest
from app.domains.tasks.schemas import Task
from app.domains.vault_bridge.task_writer import (
    render_task_line,
    render_task_collection,
    render_tasks_section,
)
from app.domains.vault_bridge.task_reader import parse_task_line, parse_task_collection
from pathlib import Path
import tempfile
import os

_NOW = "2026-01-01T00:00:00+00:00"


def _t(**fields):
    base = {"created_at": _NOW, "updated_at": _NOW, "sort_order": 0}
    base.update(fields)
    return Task.model_validate(base)


# ── render_task_line ──────────────────────────────────────────────────────────


class TestRenderTaskLine:
    def test_unchecked_todo(self):
        task = _t(
            id="tsk_abc",
            title="Buy groceries",
            done=False,
            status="todo",
            priority=3,
            tags=[],
        )
        line = render_task_line(task)
        assert line.startswith("- [ ]")
        assert "Buy groceries" in line
        assert "df:tsk_abc" in line

    def test_checked_done(self):
        task = _t(
            id="tsk_xyz",
            title="Done task",
            done=True,
            status="done",
            priority=3,
            tags=[],
        )
        line = render_task_line(task)
        assert line.startswith("- [x]")

    def test_due_date_included(self):
        task = _t(
            id="tsk_1",
            title="With due",
            done=False,
            status="todo",
            priority=3,
            tags=[],
            due_at="2026-04-10T17:00:00+00:00",
        )
        line = render_task_line(task)
        assert "due:2026-04-10" in line

    def test_priority_omitted_when_default(self):
        task = _t(id="tsk_1", title="T", done=False, status="todo", priority=3, tags=[])
        line = render_task_line(task)
        assert "p:" not in line

    def test_priority_included_when_not_default(self):
        task = _t(id="tsk_1", title="T", done=False, status="todo", priority=1, tags=[])
        line = render_task_line(task)
        assert "p:1" in line

    def test_tags_included(self):
        task = _t(
            id="tsk_2",
            title="T",
            done=False,
            status="todo",
            priority=3,
            tags=["work", "deep"],
        )
        line = render_task_line(task)
        assert "#work" in line
        assert "#deep" in line

    def test_comment_is_html(self):
        task = _t(id="tsk_3", title="T", done=False, status="todo", priority=3, tags=[])
        line = render_task_line(task)
        assert "<!--" in line
        assert "-->" in line


# ── parse_task_line ───────────────────────────────────────────────────────────


class TestParseTaskLine:
    def test_parse_unchecked(self):
        line = "- [ ] Buy groceries <!--df:tsk_abc-->"
        c = parse_task_line(line)
        assert c is not None
        assert c.title == "Buy groceries"
        assert c.done is False
        assert c.dopaflow_id == "tsk_abc"

    def test_parse_checked(self):
        line = "- [x] Done task <!--df:tsk_xyz-->"
        c = parse_task_line(line)
        assert c is not None
        assert c.done is True

    def test_parse_due_date(self):
        line = "- [ ] Task <!--df:tsk_1 due:2026-04-10-->"
        c = parse_task_line(line)
        assert c is not None
        assert c.due_str == "2026-04-10"

    def test_parse_priority(self):
        line = "- [ ] Task <!--df:tsk_1 p:2-->"
        c = parse_task_line(line)
        assert c is not None
        assert c.priority == 2

    def test_parse_tags(self):
        line = "- [ ] Task <!--df:tsk_1 #work #deep-->"
        c = parse_task_line(line)
        assert c is not None
        assert "work" in c.tags
        assert "deep" in c.tags

    def test_returns_none_for_heading(self):
        assert parse_task_line("## Heading") is None

    def test_returns_none_for_plain_text(self):
        assert parse_task_line("Just a paragraph.") is None

    def test_returns_none_for_empty(self):
        assert parse_task_line("") is None

    def test_no_comment_still_parses(self):
        """Plain checkbox line with no DopaFlow metadata still parses."""
        line = "- [ ] Plain task"
        c = parse_task_line(line)
        assert c is not None
        assert c.title == "Plain task"
        assert c.dopaflow_id is None


# ── round-trip ────────────────────────────────────────────────────────────────


class TestRoundTrip:
    def test_render_parse_round_trip(self):
        task = _t(
            id="tsk_rt",
            title="Round trip task",
            done=False,
            status="todo",
            priority=2,
            tags=["work"],
            due_at="2026-04-15T09:00:00+00:00",
        )
        line = render_task_line(task)
        candidate = parse_task_line(line)
        assert candidate is not None
        assert candidate.dopaflow_id == "tsk_rt"
        assert candidate.title == "Round trip task"
        assert candidate.done is False
        assert candidate.priority == 2
        assert "work" in candidate.tags
        assert candidate.due_str == "2026-04-15"

    def test_done_round_trip(self):
        task = _t(
            id="tsk_done", title="Done", done=True, status="done", priority=3, tags=[]
        )
        line = render_task_line(task)
        c = parse_task_line(line)
        assert c is not None
        assert c.done is True


# ── render_task_collection ────────────────────────────────────────────────────


class TestRenderTaskCollection:
    def test_contains_frontmatter(self):
        tasks = [
            _t(id="tsk_1", title="T1", done=False, status="todo", priority=3, tags=[])
        ]
        content = render_task_collection(tasks, "My Project", project_id="prj_abc")
        assert "---" in content
        assert "dopaflow_type: task_collection" in content
        assert "dopaflow_project_id: prj_abc" in content

    def test_contains_heading(self):
        content = render_task_collection([], "My Project")
        assert "## My Project" in content

    def test_empty_tasks_shows_placeholder(self):
        content = render_task_collection([], "Empty")
        assert "_No tasks._" in content

    def test_inbox_scope(self):
        content = render_task_collection([], "Inbox", scope="inbox")
        assert "dopaflow_scope: inbox" in content


# ── parse_task_collection (file-level) ───────────────────────────────────────


class TestParseTaskCollection:
    def _write_file(self, tmp_path: Path, filename: str, content: str) -> Path:
        f = tmp_path / filename
        f.write_text(content, encoding="utf-8")
        return f

    def test_parses_task_collection_file(self, tmp_path):
        tasks = [
            _t(
                id="tsk_1",
                title="Task one",
                done=False,
                status="todo",
                priority=3,
                tags=[],
            ),
            _t(
                id="tsk_2",
                title="Task two",
                done=True,
                status="done",
                priority=2,
                tags=["work"],
            ),
        ]
        content = render_task_collection(tasks, "Inbox", scope="inbox")
        f = self._write_file(tmp_path, "Inbox.md", content)
        candidates = parse_task_collection(f, tmp_path)
        assert len(candidates) == 2
        ids = {c.dopaflow_id for c in candidates}
        assert "tsk_1" in ids
        assert "tsk_2" in ids

    def test_skips_non_dopaflow_files(self, tmp_path):
        content = "## Some note\n\n- [ ] Just a task\n"
        f = self._write_file(tmp_path, "Notes.md", content)
        candidates = parse_task_collection(f, tmp_path)
        assert candidates == []

    def test_completion_status_preserved(self, tmp_path):
        tasks = [
            _t(
                id="tsk_done",
                title="Done",
                done=True,
                status="done",
                priority=3,
                tags=[],
            )
        ]
        content = render_task_collection(tasks, "Project")
        f = self._write_file(tmp_path, "Project.md", content)
        candidates = parse_task_collection(f, tmp_path)
        assert any(c.done is True for c in candidates)
