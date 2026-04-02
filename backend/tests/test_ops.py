from __future__ import annotations


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
