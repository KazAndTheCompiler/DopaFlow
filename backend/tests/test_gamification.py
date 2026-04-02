from __future__ import annotations

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
