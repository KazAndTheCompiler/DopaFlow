from __future__ import annotations

import logging
import sqlite3
from pathlib import Path

from app.core.config import Settings, get_settings
from app.domains.health.service import HealthService
from app.domains.ops.service import OpsService


def test_healthcheck_returns_ok(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_live_returns_ok(client) -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_are_available(client) -> None:
    response = client.get("/api/v2/docs")

    assert response.status_code == 200
    assert "Swagger UI" in response.text


def test_health_payload_defaults_trust_local_clients_to_false(monkeypatch) -> None:
    monkeypatch.delenv("ZOESTM_TRUST_LOCAL_CLIENTS", raising=False)
    monkeypatch.delenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", raising=False)

    payload = HealthService.get_status(get_settings().db_path)

    assert payload["features"]["trust_local_clients"] is False
    assert all("TRUST_LOCAL_CLIENTS" not in warning for warning in payload["warnings"])


def test_ops_config_defaults_trust_local_clients_to_false(monkeypatch, db_path) -> None:
    monkeypatch.delenv("ZOESTM_TRUST_LOCAL_CLIENTS", raising=False)
    monkeypatch.delenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", raising=False)

    payload = OpsService(Settings(db_path=str(db_path))).get_config()

    assert payload["trust_local_clients"] is False


def test_ops_config_prefers_dopaflow_env_flags_over_legacy(
    monkeypatch, db_path
) -> None:
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "false")
    monkeypatch.setenv("ZOESTM_DEV_AUTH", "true")
    monkeypatch.setenv("DOPAFLOW_ENFORCE_AUTH", "true")
    monkeypatch.setenv("ZOESTM_ENFORCE_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", "false")
    monkeypatch.setenv("ZOESTM_TRUST_LOCAL_CLIENTS", "true")

    payload = OpsService(Settings(db_path=str(db_path))).get_config()

    assert payload["dev_auth"] is False
    assert payload["enforce_auth"] is True
    assert payload["trust_local_clients"] is False


def test_health_payload_prefers_dopaflow_env_flags_over_legacy(monkeypatch) -> None:
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "false")
    monkeypatch.setenv("ZOESTM_DEV_AUTH", "true")
    monkeypatch.setenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", "false")
    monkeypatch.setenv("ZOESTM_TRUST_LOCAL_CLIENTS", "true")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "true")
    monkeypatch.setenv("ZOESTM_DISABLE_LOCAL_AUDIO", "false")
    monkeypatch.setenv("DOPAFLOW_ENFORCE_AUTH", "true")
    monkeypatch.setenv("ZOESTM_ENFORCE_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_ALLOW_LOCAL_WEBHOOK_TARGETS", "true")
    monkeypatch.setenv("ZOESTM_ALLOW_LOCAL_WEBHOOK_TARGETS", "false")

    payload = HealthService.get_status(get_settings().db_path)

    assert payload["features"]["dev_auth"] is False
    assert payload["features"]["trust_local_clients"] is False
    assert payload["features"]["local_audio"] is False
    assert payload["features"]["enforce_auth"] is True
    assert payload["features"]["local_webhooks"] is True


def test_health_memory_depth_gracefully_handles_missing_table(
    monkeypatch, tmp_path: Path
) -> None:
    from app.core.config import get_settings

    db_path = tmp_path / "health-minimal.sqlite"
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY)")
        conn.commit()
    finally:
        conn.close()

    monkeypatch.setenv("DOPAFLOW_DB_PATH", str(db_path))
    get_settings.cache_clear()

    payload = HealthService.get_status(str(db_path))

    assert payload["db"] == "ok"
    assert payload["memory_depth_days"] == 0


def test_health_ready_returns_ready(client) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "reason": None}


def test_health_ready_returns_503_when_no_alembic_version(
    monkeypatch, tmp_path: Path
) -> None:
    """A database with only a _migrations table but no alembic_version should
    return not_ready because the Alembic stamp hasn't been applied yet, and
    pending SQL migrations are detected via the legacy fallback."""

    import app.core.database as db_mod

    db_path = tmp_path / "health-pending.sqlite"
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            "CREATE TABLE _migrations (filename TEXT PRIMARY KEY, "
            "checksum TEXT NOT NULL DEFAULT '')"
        )
        conn.commit()
    finally:
        conn.close()

    # Create a temporary migration directory with one unapplied migration
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    migration = migrations_dir / "001_pending.sql"
    migration.write_text(
        "CREATE TABLE sample (id INTEGER PRIMARY KEY);\n", encoding="utf-8"
    )

    # Monkeypatch the database module's _migrations_dir to use our temp dir
    # (the service lazy-imports from app.core.database)
    original_dir = db_mod._migrations_dir
    db_mod._migrations_dir = lambda: migrations_dir
    try:
        payload = HealthService.get_ready(str(db_path))
    finally:
        db_mod._migrations_dir = original_dir

    assert payload["status"] == "not_ready"
    assert payload["reason"] == f"pending migration: {migration.name}"