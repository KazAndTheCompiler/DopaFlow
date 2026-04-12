from __future__ import annotations

import pytest

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


def test_trigger_alarm_audio_returns_typed_shape(client) -> None:
    alarm = create_alarm(client, title="Audio alarm", tts_text="Wake up now")

    response = client.post(f"/api/v2/alarms/{alarm['id']}/trigger-audio", headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"stream_url", "spoke", "error"}
    assert body["spoke"] == "Wake up now"


def test_trigger_alarm_error_response_does_not_leak_exception_details(
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.alarms import router as alarms_router_module

    alarm = create_alarm(client)

    def explode(self, identifier: str):
        raise RuntimeError(f"boom from /tmp/private/{identifier}")

    monkeypatch.setattr(alarms_router_module.AlarmsService, "trigger_alarm", explode)

    response = client.post(f"/api/v2/alarms/{alarm['id']}/trigger", headers=AUTH_HEADERS)

    assert response.status_code == 500
    assert response.json() == {"detail": "Alarm trigger failed"}
    assert "traceback" not in response.text.lower()
    assert "/tmp/private" not in response.text
    assert "RuntimeError" not in response.text


def test_resolve_alarm_url_error_does_not_leak_exception_info(
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.player.service import PlayerService

    def explode(self, url: str):
        raise ConnectionError(f"DNS lookup failed for {url} at /etc/resolv.conf")

    monkeypatch.setattr(PlayerService, "resolve_url", explode)

    response = client.post(
        "/api/v2/alarms/resolve-url?url=https://example.com",
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 422
    body = response.json()
    assert "detail" in body
    assert "traceback" not in response.text.lower()
    assert "Traceback" not in response.text
    assert "ConnectionError" not in response.text
    assert "/etc/" not in response.text
    assert "/home/" not in response.text
    assert "/tmp/" not in response.text


def test_trigger_alarm_audio_with_invalid_id_does_not_leak_exception_info(client) -> None:
    response = client.post(
        "/api/v2/alarms/alm_nonexistent/trigger-audio",
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    body = response.json()
    assert "traceback" not in response.text.lower()
    assert "Traceback" not in response.text
    assert "Exception" not in response.text
    assert "/home/" not in response.text
    assert "/tmp/" not in response.text
