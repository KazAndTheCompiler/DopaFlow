from __future__ import annotations


def test_meta_summary_endpoint(client) -> None:
    response = client.get("/api/v2/meta")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "2.0.7"
    assert body["schema_version"] == "v2"


def test_meta_version_endpoint(client) -> None:
    response = client.get("/api/v2/meta/version")

    assert response.status_code == 200
    assert response.json()["app_version"] == "2.0.7"
