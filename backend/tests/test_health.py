from __future__ import annotations

import logging
import sqlite3
from pathlib import Path

from app.domains.health.service import HealthService
from app.domains.ops.service import OpsService


def test_healthcheck_returns_ok(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_docs_are_available(client) -> None:
    response = client.get("/api/v2/docs")

    assert response.status_code == 200
    assert "Swagger UI" in response.text


def test_health_payload_defaults_trust_local_clients_to_false(monkeypatch) -> None:
    monkeypatch.delenv("ZOESTM_TRUST_LOCAL_CLIENTS", raising=False)
    monkeypatch.delenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", raising=False)

    payload = HealthService.get_status()

    assert payload["features"]["trust_local_clients"] is False
    assert all("TRUST_LOCAL_CLIENTS" not in warning for warning in payload["warnings"])


def test_ops_config_defaults_trust_local_clients_to_false(monkeypatch, db_path) -> None:
    monkeypatch.delenv("ZOESTM_TRUST_LOCAL_CLIENTS", raising=False)
    monkeypatch.delenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", raising=False)

    payload = OpsService(str(db_path)).get_config()

    assert payload["trust_local_clients"] is False


def test_ops_config_prefers_dopaflow_env_flags_over_legacy(monkeypatch, db_path) -> None:
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "false")
    monkeypatch.setenv("ZOESTM_DEV_AUTH", "true")
    monkeypatch.setenv("DOPAFLOW_ENFORCE_AUTH", "true")
    monkeypatch.setenv("ZOESTM_ENFORCE_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", "false")
    monkeypatch.setenv("ZOESTM_TRUST_LOCAL_CLIENTS", "true")

    payload = OpsService(str(db_path)).get_config()

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

    payload = HealthService.get_status()

    assert payload["features"]["dev_auth"] is False
    assert payload["features"]["trust_local_clients"] is False
    assert payload["features"]["local_audio"] is False
    assert payload["features"]["enforce_auth"] is True
    assert payload["features"]["local_webhooks"] is True


def test_health_logs_missing_journal_table_for_memory_depth(monkeypatch, tmp_path: Path, caplog) -> None:
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
    caplog.set_level(logging.WARNING, logger="app.domains.health.service")

    payload = HealthService.get_status()

    assert payload["db"] == "ok"
    assert payload["memory_depth_days"] == 0
    assert any("Health memory depth unavailable" in record.message for record in caplog.records)
