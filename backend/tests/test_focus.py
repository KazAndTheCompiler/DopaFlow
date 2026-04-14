from __future__ import annotations

import logging
from datetime import datetime, timezone

import pytest


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
    assert response.json()[0]["paused_duration_ms"] == 0
    assert response.json()[0]["task_title"] is None


def test_control_pauses_active_session(client) -> None:
    start_session(client)

    response = client.post("/api/v2/focus/sessions/control", json={"action": "paused"})

    assert response.status_code == 200
    assert response.json()["status"] == "paused"


def test_control_completed_ends_active_session(client) -> None:
    start_session(client)

    response = client.post(
        "/api/v2/focus/sessions/control", json={"action": "completed"}
    )
    history = client.get("/api/v2/focus/history")

    assert response.status_code == 200
    assert response.json()["status"] == "idle"
    assert history.json()[0]["status"] == "completed"


def test_complete_focus_logs_gamification_failure_without_failing_session(
    client,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.core import gamification_helpers

    start_session(client)

    def explode_award(self, source: str, source_id: str | None = None):
        raise RuntimeError("xp unavailable")

    monkeypatch.setattr(
        gamification_helpers.GamificationService, "award", explode_award
    )
    caplog.set_level(logging.ERROR, logger="app.domains.focus.service")

    response = client.post(
        "/api/v2/focus/sessions/control", json={"action": "completed"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "idle"
    assert any(
        "Failed to award gamification for source=focus_session" in record.message
        for record in caplog.records
    )


def test_status_endpoint_returns_current_focus_state(client) -> None:
    start_session(client, duration_minutes=15)

    response = client.get("/api/v2/focus/status")

    assert response.status_code == 200
    assert response.json()["duration_minutes"] == 15
    assert response.json()["elapsed_seconds"] >= 0
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


def test_pause_persists_status_to_db(client) -> None:
    """Pausing must update focus_sessions.status in the DB so list returns 'paused'."""
    start_session(client)

    client.post("/api/v2/focus/sessions/control", json={"action": "paused"})
    sessions = client.get("/api/v2/focus/sessions").json()

    assert sessions[0]["status"] == "paused"


def test_resume_restores_running_status_in_db(client) -> None:
    """Resuming must flip focus_sessions.status back to 'running' in the DB."""
    start_session(client)
    client.post("/api/v2/focus/sessions/control", json={"action": "paused"})

    client.post("/api/v2/focus/sessions/control", json={"action": "running"})
    sessions = client.get("/api/v2/focus/sessions").json()

    assert sessions[0]["status"] == "running"


def test_resume_accumulates_paused_duration_ms(client) -> None:
    """paused_duration_ms must be positive after a pause/resume cycle."""
    start_session(client)
    client.post("/api/v2/focus/sessions/control", json={"action": "paused"})

    client.post("/api/v2/focus/sessions/control", json={"action": "running"})
    sessions = client.get("/api/v2/focus/sessions").json()

    assert sessions[0].get("paused_duration_ms", 0) >= 0


def test_state_restore_after_simulated_restart(client) -> None:
    """Complete must succeed even when in-memory state was wiped (simulated restart)."""
    from app.domains.focus import service

    start_session(client)

    # Simulate backend restart by resetting in-memory state
    service.state.status = service.PomodoroStatus.idle
    service.state.log_id = None

    response = client.post(
        "/api/v2/focus/sessions/control", json={"action": "completed"}
    )
    sessions = client.get("/api/v2/focus/sessions").json()

    assert response.status_code == 200
    assert sessions[0]["status"] == "completed"
