from __future__ import annotations

AUTH_HEADERS = {"Authorization": "Bearer dev-local-key"}


def test_packy_ask_returns_non_empty_reply(client) -> None:
    response = client.post("/api/v2/packy/ask", json={"text": "Help me focus"}, headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["reply_text"]


def test_packy_whisper_returns_text(client) -> None:
    response = client.get("/api/v2/packy/whisper", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["text"]


def test_packy_lorebook_returns_acknowledgement(client) -> None:
    response = client.post(
        "/api/v2/packy/lorebook",
        json={"session_id": "sess_1", "completed_today": 2, "focus_minutes_today": 30, "tags": ["deep-work"]},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"


def test_packy_momentum_returns_score(client) -> None:
    client.post(
        "/api/v2/packy/lorebook",
        json={"session_id": "sess_2", "completed_today": 1, "focus_minutes_today": 45, "tags": []},
        headers=AUTH_HEADERS,
    )

    response = client.get("/api/v2/packy/momentum", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert "score" in response.json()

