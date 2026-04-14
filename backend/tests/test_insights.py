from __future__ import annotations

AUTH_HEADERS = {"Authorization": "Bearer dev-local-key"}


def test_momentum_returns_score_payload(client) -> None:
    response = client.get("/api/v2/insights/momentum", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert "score" in response.json()


def test_weekly_digest_returns_expected_keys(client) -> None:
    response = client.get("/api/v2/insights/weekly-digest", headers=AUTH_HEADERS)

    assert response.status_code == 200
    digest = response.json()
    assert "title" in digest
    assert "highlights" in digest


def test_correlations_returns_list(client) -> None:
    response = client.get("/api/v2/insights/correlations", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert isinstance(response.json(), list)
