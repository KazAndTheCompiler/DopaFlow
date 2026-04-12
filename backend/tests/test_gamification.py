from __future__ import annotations

import logging

import pytest

AUTH_HEADERS = {"Authorization": "Bearer dev-local-key"}


def test_gamification_award_returns_level_payload(client) -> None:
    response = client.post("/api/v2/gamification/award", json={"source": "task_complete", "source_id": "tsk_1"}, headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["total_xp"] == 10
    assert response.json()["level"] == 1


def test_gamification_status_returns_level_and_badges(client) -> None:
    response = client.get("/api/v2/gamification/status", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert "level" in body
    assert "badges" in body


def test_gamification_badges_returns_seeded_badges(client) -> None:
    response = client.get("/api/v2/gamification/badges", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert len(response.json()) == 12


def test_gamification_reaches_level_two_after_enough_awards(client) -> None:
    for idx in range(10):
        response = client.post(
            "/api/v2/gamification/award",
            json={"source": "task_complete", "source_id": f"tsk_{idx}"},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    assert response.json()["level"] == 2


def test_gamification_award_is_idempotent_per_source_id_per_day(
    client,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG, logger="app.domains.gamification.service")

    first = client.post(
        "/api/v2/gamification/award",
        json={"source": "task_complete", "source_id": "tsk_same"},
        headers=AUTH_HEADERS,
    )
    second = client.post(
        "/api/v2/gamification/award",
        json={"source": "task_complete", "source_id": "tsk_same"},
        headers=AUTH_HEADERS,
    )
    status = client.get("/api/v2/gamification/status", headers=AUTH_HEADERS)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["total_xp"] == 10
    assert second.json()["total_xp"] == 10
    assert status.json()["level"]["total_xp"] == 10
    assert any("Skipping duplicate gamification award" in record.message for record in caplog.records)


def test_gamification_award_counter_tracks_successful_awards_only(client) -> None:
    first = client.post(
        "/api/v2/gamification/award",
        json={"source": "task_complete", "source_id": "tsk_counter"},
        headers=AUTH_HEADERS,
    )
    duplicate = client.post(
        "/api/v2/gamification/award",
        json={"source": "task_complete", "source_id": "tsk_counter"},
        headers=AUTH_HEADERS,
    )
    ready = client.get("/health/ready")

    assert first.status_code == 200
    assert duplicate.status_code == 200
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"


def test_habit_checkins_unlock_streak_three_badge(client) -> None:
    habit = client.post(
        "/api/v2/habits/",
        json={"name": "Walk", "target_freq": 1, "target_period": "day", "color": "#22c55e"},
        headers=AUTH_HEADERS,
    ).json()
    for checkin_date in ("2026-03-24", "2026-03-25", "2026-03-26"):
        response = client.post(
            f"/api/v2/habits/{habit['id']}/checkin",
            json={"checkin_date": checkin_date},
            headers=AUTH_HEADERS,
        )
        assert response.status_code == 200

    badges = client.get("/api/v2/gamification/badges", headers=AUTH_HEADERS).json()
    streak_badge = next(badge for badge in badges if badge["id"] == "streak_3")
    assert streak_badge["earned_at"] is not None


def test_gamification_award_idempotency_single_row_in_db(db_path) -> None:
    import sqlite3

    from app.domains.gamification.repository import GamificationRepository
    from app.domains.gamification.service import GamificationService

    repo = GamificationRepository(str(db_path))
    svc = GamificationService(repo)

    first = svc.award("task_complete", "task-123")
    second = svc.award("task_complete", "task-123")

    assert first.total_xp == 10
    assert second.total_xp == 10

    conn = sqlite3.connect(str(db_path))
    try:
        row = conn.execute(
            "SELECT COUNT(*) FROM xp_ledger WHERE source = ? AND source_id = ?",
            ("task_complete", "task-123"),
        ).fetchone()
        assert row[0] == 1
    finally:
        conn.close()


def test_gamification_logs_packy_notification_failure_without_failing_award(
    client,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.domains.packy.service import PackyService

    def explode_lorebook(self, payload) -> None:
        raise RuntimeError("packy unavailable")

    monkeypatch.setattr(PackyService, "lorebook", explode_lorebook)
    caplog.set_level(logging.ERROR, logger="app.domains.gamification.service")

    habit = client.post(
        "/api/v2/habits/",
        json={"name": "Stretch", "target_freq": 1, "target_period": "day", "color": "#22c55e"},
        headers=AUTH_HEADERS,
    ).json()

    for checkin_date in ("2026-03-24", "2026-03-25", "2026-03-26"):
        response = client.post(
            f"/api/v2/habits/{habit['id']}/checkin",
            json={"checkin_date": checkin_date},
            headers=AUTH_HEADERS,
        )
        assert response.status_code == 200

    assert any("Failed to notify Packy about earned badge=streak_3" in record.message for record in caplog.records)
