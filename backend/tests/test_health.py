from __future__ import annotations


def test_healthcheck_returns_ok(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_docs_are_available(client) -> None:
    response = client.get("/api/v2/docs")

    assert response.status_code == 200
    assert "Swagger UI" in response.text

