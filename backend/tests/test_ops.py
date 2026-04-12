from __future__ import annotations

import logging
import sqlite3
from pathlib import Path

import pytest

from app.core.config import Settings
from app.core.id_gen import validate_prefix
from app.domains.ops.service import OpsService


def test_ops_stats_endpoint_returns_expected_keys(client) -> None:
    response = client.get("/api/v2/ops/stats")

    assert response.status_code == 200
    assert set(response.json()) == {"tasks", "habits", "journal_entries"}


def test_ops_sync_status_endpoint_returns_db_path(client) -> None:
    response = client.get("/api/v2/ops/sync-status")

    assert response.status_code == 200
    assert "db_path" in response.json()


def test_ops_config_endpoint_returns_safe_config(client) -> None:
    response = client.get("/api/v2/ops/config")

    assert response.status_code == 200
    assert "db_path" in response.json()
    assert "webhook_http_delivery" in response.json()


def test_ops_export_endpoint_returns_typed_manifest_and_checksum(client) -> None:
    response = client.get("/api/v2/ops/export")

    assert response.status_code == 200
    body = response.json()
    assert len(body["checksum"]) == 64
    assert body["payload"]["manifest"]["schema_version"] == "v2"
    assert "tasks" in body["payload"]


def _sqlite_bytes(path: Path) -> bytes:
    return path.read_bytes()


def test_verify_backup_rejects_incompatible_schema(tmp_path: Path) -> None:
    restore_db = tmp_path / "restore.sqlite"
    conn = sqlite3.connect(restore_db)
    try:
        conn.execute("CREATE TABLE notes (id TEXT PRIMARY KEY)")
        conn.commit()
    finally:
        conn.close()

    result = OpsService(Settings(db_path=str(tmp_path / "unused.sqlite"))).verify_backup(_sqlite_bytes(restore_db))

    assert result["valid"] is False
    assert "missing required tables" in str(result["error"]).lower()


def test_restore_db_rejects_incompatible_schema_without_touching_live_db(db_path: Path) -> None:
    service = OpsService(Settings(db_path=str(db_path)))
    original_bytes = Path(db_path).read_bytes()

    invalid_restore = Path(db_path).with_name("invalid-restore.sqlite")
    conn = sqlite3.connect(invalid_restore)
    try:
        conn.execute("CREATE TABLE notes (id TEXT PRIMARY KEY)")
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(ValueError, match="missing required tables"):
        service.restore_db(_sqlite_bytes(invalid_restore))

    assert Path(db_path).read_bytes() == original_bytes


def test_seed_first_run_uses_domain_id_prefixes(db_path: Path) -> None:
    service = OpsService(Settings(db_path=str(db_path)))

    result = service.seed_first_run()

    assert result["seeded"] is True
    with sqlite3.connect(db_path) as conn:
        task_ids = [row[0] for row in conn.execute("SELECT id FROM tasks ORDER BY created_at").fetchall()]
        habit_ids = [row[0] for row in conn.execute("SELECT id FROM habits ORDER BY name").fetchall()]

    assert len(task_ids) == 2
    assert len(habit_ids) == 2
    assert all(validate_prefix(task_id_value, "tsk") for task_id_value in task_ids)
    assert all(validate_prefix(habit_id_value, "hab") for habit_id_value in habit_ids)


def test_ops_export_download_rejects_oversized_payload(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.domains.ops import router as ops_router_module

    monkeypatch.setattr(
        ops_router_module.OpsService,
        "export_payload",
        lambda self: {"data": "x" * (ops_router_module.MAX_EXPORT_RESPONSE_BYTES + 1024)},
    )

    response = client.get("/api/v2/ops/export/download")

    assert response.status_code == 413


def test_ops_export_zip_rejects_oversized_archive(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.domains.ops import router as ops_router_module

    monkeypatch.setattr(
        ops_router_module.OpsService,
        "export_all_zip",
        lambda self: b"x" * (ops_router_module.MAX_EXPORT_RESPONSE_BYTES + 1024),
    )

    response = client.get("/api/v2/ops/export/all")

    assert response.status_code == 413


def test_export_payload_logs_missing_optional_tables(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    db_path = tmp_path / "ops-minimal.sqlite"
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY, created_at TEXT)")
        conn.execute("CREATE TABLE habit_checkins (id TEXT PRIMARY KEY, checkin_date TEXT)")
        conn.execute("CREATE TABLE journal_entries (id TEXT PRIMARY KEY, entry_date TEXT, deleted_at TEXT)")
        conn.execute("CREATE TABLE review_decks (id TEXT PRIMARY KEY, created_at TEXT)")
        conn.execute("CREATE TABLE review_cards (id TEXT PRIMARY KEY, created_at TEXT)")
        conn.execute("CREATE TABLE alarms (id TEXT PRIMARY KEY, created_at TEXT)")
        conn.commit()
    finally:
        conn.close()

    service = OpsService(Settings(db_path=str(db_path)))
    caplog.set_level(logging.WARNING, logger="app.domains.ops.service")

    payload = service.export_payload()

    assert payload["nutrition_log"] == []
    assert payload["commands"] == []
    assert any("nutrition_log" in record.message for record in caplog.records)
    assert any("command_logs" in record.message for record in caplog.records)
