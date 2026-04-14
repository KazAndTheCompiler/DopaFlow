from __future__ import annotations

from datetime import date, timedelta


def create_habit(client, **overrides):
    payload = {
        "name": "Walk",
        "target_freq": 1,
        "target_period": "day",
        "color": "#22c55e",
    }
    payload.update(overrides)
    response = client.post("/api/v2/habits/", json=payload)
    assert response.status_code == 200
    return response.json()


def test_create_habit_returns_id(client) -> None:
    habit = create_habit(client)

    assert habit["id"].startswith("hab_")
    assert habit["name"] == "Walk"
    assert habit["current_streak"] == 0
    assert habit["completion_pct"] == 0


def test_list_habits_returns_created_habit(client) -> None:
    habit = create_habit(client)

    response = client.get("/api/v2/habits/")

    assert response.status_code == 200
    assert response.json()[0]["id"] == habit["id"]


def test_checkin_records_today_and_updates_streak(client) -> None:
    habit = create_habit(client)

    response = client.post(f"/api/v2/habits/{habit['id']}/checkin", json={})

    assert response.status_code == 200
    assert response.json()["current_streak"] >= 1
    assert response.json()["last_checkin_date"] == date.today().isoformat()


def test_multiple_same_day_checkins_can_exceed_100_percent(client) -> None:
    habit = create_habit(client, name="Tea", target_freq=5, target_period="day")

    for _ in range(10):
        response = client.post(f"/api/v2/habits/{habit['id']}/checkin", json={})
        assert response.status_code == 200

    refreshed = client.get("/api/v2/habits/").json()[0]

    assert refreshed["current_streak"] == 1
    assert refreshed["last_checkin_date"] == date.today().isoformat()
    assert refreshed["completion_count"] == 10
    assert refreshed["today_count"] == 10
    assert refreshed["completion_pct"] == 200.0


def test_logs_returns_habit_checkins(client) -> None:
    habit = create_habit(client)
    target_date = (date.today() - timedelta(days=1)).isoformat()
    client.post(
        f"/api/v2/habits/{habit['id']}/checkin", json={"checkin_date": target_date}
    )

    response = client.get(f"/api/v2/habits/{habit['id']}/logs")

    assert response.status_code == 200
    assert response.json()[0]["habit_id"] == habit["id"]
    assert response.json()[0]["checkin_date"] == target_date


def test_patch_updates_habit_name(client) -> None:
    habit = create_habit(client)

    response = client.patch(f"/api/v2/habits/{habit['id']}", json={"name": "Run"})

    assert response.status_code == 200
    assert response.json()["name"] == "Run"


def test_delete_habit_soft_deletes_record(client) -> None:
    habit = create_habit(client)

    response = client.delete(f"/api/v2/habits/{habit['id']}")

    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert client.get("/api/v2/habits/").json() == []


def test_today_summary_reports_done_count(client) -> None:
    first = create_habit(client, name="Read")
    create_habit(client, name="Meditate")
    client.post(f"/api/v2/habits/{first['id']}/checkin", json={})

    response = client.get("/api/v2/habits/today")

    assert response.status_code == 200
    assert response.json()["done"] == 1
    assert response.json()["missed"] == 1


def test_weekly_overview_returns_habits_grid(client) -> None:
    habit = create_habit(client)
    client.post(f"/api/v2/habits/{habit['id']}/checkin", json={})

    response = client.get("/api/v2/habits/weekly")

    assert response.status_code == 200
    assert response.json()["habits"][0]["id"] == habit["id"]


def test_insights_reports_windows_and_habit_count(client) -> None:
    habit = create_habit(client)
    client.post(f"/api/v2/habits/{habit['id']}/checkin", json={})

    response = client.get("/api/v2/habits/insights")

    assert response.status_code == 200
    assert response.json()["habit_count"] == 1
    assert "7d" in response.json()["windows"]


def test_freeze_and_unfreeze_toggle_freeze_until(client) -> None:
    habit = create_habit(client)
    freeze_until = (date.today() + timedelta(days=3)).isoformat()

    freeze_response = client.patch(
        f"/api/v2/habits/{habit['id']}/freeze", json={"freeze_until": freeze_until}
    )
    unfreeze_response = client.patch(f"/api/v2/habits/{habit['id']}/unfreeze")

    assert freeze_response.status_code == 200
    assert freeze_response.json()["freeze_until"] == freeze_until
    assert unfreeze_response.status_code == 200
    assert unfreeze_response.json()["freeze_until"] is None
