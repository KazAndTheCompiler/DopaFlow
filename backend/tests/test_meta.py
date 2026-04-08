from __future__ import annotations

from app.core.version import APP_VERSION, SCHEMA_VERSION


def test_meta_summary_endpoint(client) -> None:
    response = client.get("/api/v2/meta")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == APP_VERSION
    assert body["schema_version"] == SCHEMA_VERSION


def test_meta_version_endpoint(client) -> None:
    response = client.get("/api/v2/meta/version")

    assert response.status_code == 200
    assert response.json()["app_version"] == APP_VERSION
