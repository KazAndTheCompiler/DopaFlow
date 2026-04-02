from __future__ import annotations


def test_player_queue_defaults_empty(client) -> None:
    response = client.get("/api/v2/player/queue")

    assert response.status_code == 200
    assert response.json() == {"items": [], "count": 0}


def test_player_queue_round_trip(client) -> None:
    payload = {"items": [{"title": "Focus Track", "url": "https://example.invalid/audio"}]}
    saved = client.post("/api/v2/player/queue", json=payload)
    listed = client.get("/api/v2/player/queue")

    assert saved.status_code == 200
    assert listed.status_code == 200
    assert listed.json()["count"] == 1


def test_player_resolve_url_returns_valid_response_structure(client) -> None:
    response = client.post("/api/v2/player/resolve-url", json={"url": "https://youtube.com/watch?v=test"})

    assert response.status_code == 200
    body = response.json()
    assert "stream_url" in body
    assert "error" in body


def test_player_resolve_url_rejects_empty_url(client) -> None:
    response = client.post("/api/v2/player/resolve-url", json={"url": ""})

    assert response.status_code == 200
    body = response.json()
    assert body["stream_url"] is None
    assert body["error"] == "A URL is required"
