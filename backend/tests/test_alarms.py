from __future__ import annotations

AUTH_HEADERS = {"Authorization": "Bearer dev-local-key"}


def create_alarm(client, **overrides):
    payload = {
        "at": "2099-01-01T09:00:00+00:00",
        "title": "Wake up",
        "kind": "tts",
        "tts_text": "Time to start",
        "muted": False,
    }
    payload.update(overrides)
    response = client.post("/api/v2/alarms", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 201
    return response.json()


def test_list_alarms_is_empty_on_fresh_db(client) -> None:
    response = client.get("/api/v2/alarms", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == []


def test_list_upcoming_alarms_returns_created_alarm(client) -> None:
    alarm = create_alarm(client)

    response = client.get("/api/v2/alarms/upcoming", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert any(item["id"] == alarm["id"] for item in response.json())


def test_create_alarm_returns_id_and_time_fields(client) -> None:
    alarm = create_alarm(client)

    assert alarm["id"].startswith("alm_")
    assert alarm["at"] == "2099-01-01T09:00:00+00:00"


def test_get_alarm_by_id(client) -> None:
    alarm = create_alarm(client)

    response = client.get(f"/api/v2/alarms/{alarm['id']}", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["title"] == "Wake up"


def test_patch_alarm_updates_title(client) -> None:
    alarm = create_alarm(client)

    response = client.patch(f"/api/v2/alarms/{alarm['id']}", json={"title": "Updated alarm"}, headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["title"] == "Updated alarm"


def test_delete_alarm_removes_alarm_and_get_returns_404(client) -> None:
    alarm = create_alarm(client)

    delete_response = client.delete(f"/api/v2/alarms/{alarm['id']}", headers=AUTH_HEADERS)
    get_response = client.get(f"/api/v2/alarms/{alarm['id']}", headers=AUTH_HEADERS)

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True}
    assert get_response.status_code == 404


def test_trigger_alarm_records_last_fired_at(client) -> None:
    alarm = create_alarm(client)

    trigger_response = client.post(f"/api/v2/alarms/{alarm['id']}/trigger", headers=AUTH_HEADERS)
    get_response = client.get(f"/api/v2/alarms/{alarm['id']}", headers=AUTH_HEADERS)

    assert trigger_response.status_code == 200
    assert trigger_response.json()["fired"] is True
    assert get_response.json()["last_fired_at"] is not None


def test_scheduler_status_reports_upcoming_alarm(client) -> None:
    alarm = create_alarm(client)

    response = client.get("/api/v2/alarms/scheduler/status", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["running"] is True
    assert response.json()["next_alarm_id"] == alarm["id"]
