from __future__ import annotations

import logging
import os
import tempfile

import pytest


def create_entry(client, **overrides):
    payload = {
        "date": "2026-03-25",
        "markdown_body": "Daily note",
        "emoji": "🙂",
        "tags": ["daily"],
    }
    payload.update(overrides)
    response = client.post("/api/v2/journal/entries", json=payload)
    assert response.status_code == 201
    return response.json()


def test_create_entry_returns_id(client) -> None:
    entry = create_entry(client)

    assert entry["id"].startswith("jrn_")
    assert entry["date"] == "2026-03-25"


def test_list_entries_returns_saved_entries(client) -> None:
    entry = create_entry(client)

    response = client.get("/api/v2/journal/entries")

    assert response.status_code == 200
    assert response.json()[0]["id"] == entry["id"]


def test_get_entry_by_id(client) -> None:
    entry = create_entry(client)

    response = client.get(f"/api/v2/journal/entries/{entry['id']}")

    assert response.status_code == 200
    assert response.json()["markdown_body"] == "Daily note"


def test_saving_same_date_updates_entry_and_increments_version(client) -> None:
    first = create_entry(client)

    response = client.post(
        "/api/v2/journal/entries",
        json={
            "date": "2026-03-25",
            "markdown_body": "Updated body",
            "emoji": None,
            "tags": ["daily", "updated"],
        },
    )

    assert response.status_code == 201
    assert response.json()["id"] == first["id"]
    assert response.json()["version"] == 2
    assert response.json()["markdown_body"] == "Updated body"


def test_delete_entry_removes_it_from_reads(client) -> None:
    entry = create_entry(client)

    delete_response = client.delete(f"/api/v2/journal/entries/{entry['id']}")
    get_response = client.get(f"/api/v2/journal/entries/{entry['id']}")

    assert delete_response.status_code == 200
    assert delete_response.json()["deleted"] is True
    assert get_response.status_code == 404


def test_graph_and_backlinks_return_wikilink_structure(client) -> None:
    target = create_entry(client, date="2026-03-24", markdown_body="Target day")
    source = create_entry(
        client, date="2026-03-25", markdown_body="Links to [[2026-03-24]]"
    )

    graph_response = client.get("/api/v2/journal/graph")
    backlinks_response = client.get("/api/v2/journal/2026-03-24/backlinks")

    assert graph_response.status_code == 200
    assert any(node["id"] == "2026-03-24" for node in graph_response.json()["nodes"])
    assert any(
        edge["source"] == source["id"] for edge in graph_response.json()["edges"]
    )
    assert backlinks_response.json() == [source["id"]]
    assert target["id"].startswith("jrn_")


def test_backup_status_and_trigger_create_markdown_backup(client, tmp_path) -> None:
    create_entry(client)

    status_response = client.get("/api/v2/journal/backup-status")
    trigger_response = client.post(
        "/api/v2/journal/backup/trigger", params={"date": "2026-03-25"}
    )

    assert status_response.status_code == 200
    assert trigger_response.status_code == 200
    backup_file = (
        tmp_path / ".local" / "share" / "DopaFlow" / "journal-backup" / "2026-03-25.md"
    )
    assert backup_file.exists()
    assert "Daily note" in backup_file.read_text(encoding="utf-8")


def test_trigger_backup_skips_when_integrity_check_fails(
    client,
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.domains.journal import service as journal_service

    create_entry(client)

    class FakeConnection:
        def execute(self, sql: str):
            assert sql == "PRAGMA integrity_check"
            return self

        def fetchone(self):
            return ("corrupt",)

        def close(self) -> None:
            return None

    class FakeContext:
        def __enter__(self):
            return FakeConnection()

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(journal_service, "get_db", lambda _db_path: FakeContext())
    caplog.set_level(logging.WARNING, logger="app.domains.journal.service")

    response = client.post(
        "/api/v2/journal/backup/trigger", params={"date": "2026-03-25"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "Database integrity check failed — backup skipped",
        "backed_up_date": None,
        "status": "skipped_integrity_fail",
    }
    backup_file = (
        tmp_path / ".local" / "share" / "DopaFlow" / "journal-backup" / "2026-03-25.md"
    )
    assert not backup_file.exists()
    assert any(
        "database integrity_check failed" in record.message for record in caplog.records
    )


def test_create_entry_logs_gamification_failure_without_failing_save(
    client,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.core import gamification_helpers

    def explode_award(self, source: str, source_id: str | None = None):
        raise RuntimeError("xp unavailable")

    monkeypatch.setattr(
        gamification_helpers.GamificationService, "award", explode_award
    )
    caplog.set_level(logging.ERROR, logger="app.domains.journal.service")

    response = client.post(
        "/api/v2/journal/entries",
        json={
            "date": "2026-03-26",
            "markdown_body": "Logged anyway",
            "emoji": "🙂",
            "tags": ["daily"],
        },
    )

    assert response.status_code == 201
    assert response.json()["id"].startswith("jrn_")
    assert any(
        "Failed to award gamification for source=journal_entry" in record.message
        for record in caplog.records
    )


def test_journal_template_apply_and_export_today_return_typed_shapes(client) -> None:
    create_entry(client, date="2026-03-25", markdown_body="Export me")

    template_response = client.post(
        "/api/v2/journal/templates",
        json={"name": "Morning", "body": "Prompt body", "tags": ["prompt"]},
    )
    assert template_response.status_code == 201
    template_id = template_response.json()["id"]

    apply_response = client.post(f"/api/v2/journal/templates/{template_id}/apply")
    assert apply_response.status_code == 200
    assert apply_response.json() == {"body": "Prompt body", "tags": ["prompt"]}

    export_response = client.post("/api/v2/journal/export-today")
    assert export_response.status_code == 200
    export_body = export_response.json()
    assert set(export_body) == {"path", "entry_count"}


def test_export_range_closes_zip_buffer_on_failure(
    monkeypatch: pytest.MonkeyPatch, db_path
) -> None:
    from app.core.config import Settings
    from app.domains.journal.repository import JournalRepository
    from app.domains.journal.schemas import JournalEntryCreate
    from app.domains.journal.service import JournalService

    temp_paths: list[str] = []
    original_named_temporary_file = tempfile.NamedTemporaryFile

    def tracking_named_temporary_file(*args, **kwargs):
        tmp = original_named_temporary_file(*args, **kwargs)
        temp_paths.append(tmp.name)
        return tmp

    def explode(self, _name: str, _data: str) -> None:
        raise RuntimeError("zip failed")

    service = JournalService(JournalRepository(Settings(db_path=str(db_path))))
    service.save_entry(
        JournalEntryCreate(
            date="2026-03-25",
            markdown_body="Export me",
            emoji="🙂",
            tags=["daily"],
        )
    )
    monkeypatch.setattr(
        "app.domains.journal.service.tempfile.NamedTemporaryFile",
        tracking_named_temporary_file,
    )
    monkeypatch.setattr("app.domains.journal.service.zipfile.ZipFile.writestr", explode)

    with pytest.raises(RuntimeError, match="zip failed"):
        service.export_range("2026-03-25", "2026-03-25", fmt="zip")

    assert temp_paths
    assert all(not os.path.exists(path) for path in temp_paths)
