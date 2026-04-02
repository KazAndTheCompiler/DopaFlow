from __future__ import annotations


def test_daily_motivation_quote_endpoint(client) -> None:
    response = client.get("/api/v2/motivation/quote")

    assert response.status_code == 200
    body = response.json()
    assert "quote" in body
    assert "index" in body


def test_random_motivation_quote_endpoint(client) -> None:
    response = client.get("/api/v2/motivation/quote/random")

    assert response.status_code == 200
    assert "quote" in response.json()
