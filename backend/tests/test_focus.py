from __future__ import annotations

from datetime import datetime, timezone


def start_session(client, **overrides):
    payload = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "duration_minutes": 25,
    }
    payload.update(overrides)
    response = client.post("/api/v2/focus/sessions", json=payload)
    assert response.status_code == 200
    return response.json()


def test_post_sessions_starts_focus_session(client) -> None:
    response = start_session(client, task_id="tsk_demo")

    assert response["status"] == "running"
    assert response["task_id"] == "tsk_demo"


def test_get_sessions_returns_started_session(client) -> None:
    start_session(client)

    response = client.get("/api/v2/focus/sessions")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_control_pauses_active_session(client) -> None:
    start_session(client)

    response = client.post("/api/v2/focus/sessions/control", json={"action": "paused"})

    assert response.status_code == 200
    assert response.json()["status"] == "paused"


def test_control_completed_ends_active_session(client) -> None:
    start_session(client)

    response = client.post("/api/v2/focus/sessions/control", json={"action": "completed"})
    history = client.get("/api/v2/focus/history")

    assert response.status_code == 200
    assert response.json()["status"] == "idle"
    assert history.json()[0]["status"] == "completed"


def test_status_endpoint_returns_current_focus_state(client) -> None:
    start_session(client, duration_minutes=15)

    response = client.get("/api/v2/focus/status")

    assert response.status_code == 200
    assert response.json()["duration_minutes"] == 15
    assert response.json()["status"] == "running"


def test_stats_endpoint_returns_summary_counts(client) -> None:
    start_session(client)
    client.post("/api/v2/focus/sessions/control", json={"action": "completed"})

    response = client.get("/api/v2/focus/stats")

    assert response.status_code == 200
    assert response.json()["total_sessions"] == 1
    assert response.json()["completion_rate"] == 100.0


def test_recommendation_returns_default_shape(client) -> None:
    response = client.get("/api/v2/focus/recommendation")

    assert response.status_code == 200
    assert "recommended_duration" in response.json()
    assert "peak_window" in response.json()

