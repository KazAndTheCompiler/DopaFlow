from __future__ import annotations

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
