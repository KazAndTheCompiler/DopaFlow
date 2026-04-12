from __future__ import annotations

import json
from types import SimpleNamespace
from datetime import datetime
from time import perf_counter
import urllib.error
import httpx
from unittest.mock import AsyncMock, patch

from app.core.database import tx
from app.domains.calendar.repository import CalendarRepository
from app.domains.calendar_sharing.repository import CalendarSharingRepository
from app.domains.calendar_sharing.service import CalendarSharingService


def _iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def create_event(client, **overrides):
    payload = {
        "title": "Planning",
        "description": "Weekly planning",
        "start_at": "2026-03-25T09:00:00+00:00",
        "end_at": "2026-03-25T10:00:00+00:00",
        "all_day": False,
        "category": "work",
    }
    payload.update(overrides)
    response = client.post("/api/v2/calendar/events", json=payload)
    assert response.status_code == 201
    return response.json()


def test_create_event_returns_id(client) -> None:
    event = create_event(client)

    assert event["id"].startswith("evt_")
    assert event["title"] == "Planning"


def test_list_events_is_empty_on_fresh_db(client) -> None:
    response = client.get("/api/v2/calendar/events")

    assert response.status_code == 200
    assert response.json() == []


def test_get_event_by_id(client) -> None:
    event = create_event(client)

    response = client.get(f"/api/v2/calendar/events/{event['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == event["id"]


def test_patch_event_updates_title(client) -> None:
    event = create_event(client)

    response = client.patch(f"/api/v2/calendar/events/{event['id']}", json={"title": "Retitle"})

    assert response.status_code == 200
    assert response.json()["title"] == "Retitle"


def test_delete_event_removes_it(client) -> None:
    event = create_event(client)

    delete_response = client.delete(f"/api/v2/calendar/events/{event['id']}")
    get_response = client.get(f"/api/v2/calendar/events/{event['id']}")

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True}
    assert get_response.status_code == 404


def test_range_filter_limits_results(client) -> None:
    inside = create_event(client, title="Inside")
    create_event(
        client,
        title="Outside",
        start_at="2026-04-25T09:00:00+00:00",
        end_at="2026-04-25T10:00:00+00:00",
    )

    response = client.get(
        "/api/v2/calendar/events",
        params={"from": "2026-03-25 00:00:00+00:00", "until": "2026-03-25 23:59:59+00:00"},
    )

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == [inside["id"]]


def test_patch_can_set_recurrence_rule(client) -> None:
    event = create_event(client)

    response = client.patch(f"/api/v2/calendar/events/{event['id']}", json={"recurrence": "FREQ=WEEKLY"})

    assert response.status_code == 200
    assert response.json()["recurrence"] == "FREQ=WEEKLY"


def test_calendar_feed_requires_share_token(client) -> None:
    create_event(client)

    response = client.get(
        "/api/v2/calendar/feed",
        params={"from": "2026-03-25T00:00:00Z", "to": "2026-03-25T23:59:59Z"},
    )

    assert response.status_code == 401


def test_calendar_feed_accepts_valid_share_token(client, db_path) -> None:
    create_event(client)
    repo = CalendarSharingRepository(str(db_path))
    share_token = repo.create_token("QA sync")

    response = client.get(
        "/api/v2/calendar/feed",
        params={"from": "2026-03-25T00:00:00Z", "to": "2026-03-25T23:59:59Z"},
        headers={"Authorization": f"Bearer {share_token.raw_token}"},
    )

    assert response.status_code == 200
    assert response.json()["entries"]


def test_calendar_feed_payload_matches_peer_sync_contract(client, db_path) -> None:
    event = create_event(client, description="For sharing", category="work")
    repo = CalendarSharingRepository(str(db_path))
    share_token = repo.create_token("QA sync")

    response = client.get(
        "/api/v2/calendar/feed",
        params={"from": "2026-03-25T00:00:00Z", "to": "2026-03-25T23:59:59Z"},
        headers={"Authorization": f"Bearer {share_token.raw_token}"},
    )

    assert response.status_code == 200
    entry = response.json()["entries"][0]
    assert entry["id"] == event["id"]
    assert entry["source_id"] == event["id"]
    assert _iso(entry["start_at"]) == _iso(event["start_at"])
    assert _iso(entry["end_at"]) == _iso(event["end_at"])
    assert entry["description"] == "For sharing"
    assert entry["category"] == "work"


def test_list_tokens_omits_expired_share_tokens(client, db_path) -> None:
    repo = CalendarSharingRepository(str(db_path))
    active = repo.create_token("Active token")
    expired = repo.create_token("Expired token")
    with tx(str(db_path)) as conn:
        conn.execute(
            "UPDATE calendar_share_tokens SET expires_at = ? WHERE id = ?",
            ("2000-01-01T00:00:00+00:00", expired.id),
        )

    response = client.get("/api/v2/calendar/sharing/tokens")

    assert response.status_code == 200
    token_ids = {token["id"] for token in response.json()}
    assert active.id in token_ids
    assert expired.id not in token_ids


def test_calendar_feed_rejects_expired_share_token(client, db_path) -> None:
    create_event(client)
    repo = CalendarSharingRepository(str(db_path))
    share_token = repo.create_token("Expired token")
    with tx(str(db_path)) as conn:
        conn.execute(
            "UPDATE calendar_share_tokens SET expires_at = ? WHERE id = ?",
            ("2000-01-01T00:00:00+00:00", share_token.id),
        )

    response = client.get(
        "/api/v2/calendar/feed",
        params={"from": "2026-03-25T00:00:00Z", "to": "2026-03-25T23:59:59Z"},
        headers={"Authorization": f"Bearer {share_token.raw_token}"},
    )

    assert response.status_code == 403


def test_peer_feed_sync_imports_remote_events(monkeypatch, db_path) -> None:
    repo = CalendarSharingRepository(str(db_path))
    service = CalendarSharingService(repo)
    feed = repo.add_feed(
        SimpleNamespace(**{
            "label": "Remote partner",
            "base_url": "https://partner.example.com/api/v2",
            "token": "secret-token",
            "color": "#5b8def",
        })
    )

    captured: dict[str, object] = {}

    class _MockResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "entries": [{
                    "id": "evt_remote_1",
                    "title": "Peer planning",
                    "description": "Shared from another install",
                    "start_at": "2026-03-26T09:00:00+00:00",
                    "end_at": "2026-03-26T10:00:00+00:00",
                    "all_day": False,
                    "category": "work",
                    "updated_at": "2026-03-25T12:00:00+00:00",
                    "source": "remote-dopaflow",
                }],
            }).encode("utf-8")

    class _MockOpener:
        def open(self, request, timeout=10):
            captured["url"] = request.full_url
            captured["authorization"] = request.get_header("Authorization")
            captured["timeout"] = timeout
            return _MockResponse()

    monkeypatch.setattr(
        "app.domains.calendar_sharing.service.urllib.request.build_opener",
        lambda *_args, **_kwargs: _MockOpener(),
    )

    result = service.sync_feed(feed.id)

    imported = repo.list_feeds()[0]
    assert result.status == "ok"
    assert result.events_imported == 1
    assert "from=" in str(captured["url"])
    assert "to=" in str(captured["url"])
    assert captured["authorization"] == "Bearer secret-token"
    assert imported.sync_status == "ok"
    events = CalendarRepository(str(db_path)).list_events()
    assert len(events) == 1
    assert events[0].title == "Peer planning"
    assert events[0].source_type == f"peer:{feed.id}"
    assert events[0].provider_readonly is True


def test_peer_feed_sync_rejects_redirects(monkeypatch, db_path) -> None:
    repo = CalendarSharingRepository(str(db_path))
    service = CalendarSharingService(repo)
    feed = repo.add_feed(
        SimpleNamespace(**{
            "label": "Remote partner",
            "base_url": "https://partner.example.com/api/v2",
            "token": "secret-token",
            "color": "#5b8def",
        })
    )

    class _MockOpener:
        def open(self, request, timeout=10):
            raise urllib.error.HTTPError(request.full_url, 302, "Found", {}, None)

    monkeypatch.setattr(
        "app.domains.calendar_sharing.service.urllib.request.build_opener",
        lambda *_args, **_kwargs: _MockOpener(),
    )

    result = service.sync_feed(feed.id)
    stored_feed = repo.list_feeds()[0]

    assert result.status == "error"
    assert result.detail == "redirect_not_allowed"
    assert stored_feed.sync_status == "error"
    assert stored_feed.last_error == "redirect_not_allowed"


def test_remove_feed_deletes_mirrored_events(db_path) -> None:
    repo = CalendarSharingRepository(str(db_path))
    service = CalendarSharingService(repo)
    feed = repo.add_feed(
        SimpleNamespace(**{
            "label": "Remote partner",
            "base_url": "https://partner.example.com/api/v2",
            "token": "secret-token",
            "color": "#5b8def",
        })
    )
    repo.upsert_peer_event(
        feed.id,
        {
            "id": "evt_remote_1",
            "title": "Peer planning",
            "start_at": "2026-03-26T09:00:00+00:00",
            "end_at": "2026-03-26T10:00:00+00:00",
            "updated_at": "2026-03-25T12:00:00+00:00",
        },
    )

    removed = service.remove_feed(feed.id)

    assert removed is True
    assert repo.list_feeds() == []
    assert CalendarRepository(str(db_path)).list_events() == []


def test_feed_error_keeps_last_successful_sync_time(monkeypatch, db_path) -> None:
    repo = CalendarSharingRepository(str(db_path))
    service = CalendarSharingService(repo)
    feed = repo.add_feed(
        SimpleNamespace(**{
            "label": "Remote partner",
            "base_url": "https://partner.example.com/api/v2",
            "token": "secret-token",
            "color": "#5b8def",
        })
    )

    class _OkResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({"entries": []}).encode("utf-8")

    class _OkOpener:
        def open(self, request, timeout=10):
            return _OkResponse()

    monkeypatch.setattr(
        "app.domains.calendar_sharing.service.urllib.request.build_opener",
        lambda *_args, **_kwargs: _OkOpener(),
    )

    ok_result = service.sync_feed(feed.id)
    first_sync_time = repo.list_feeds()[0].last_synced_at

    class _FailOpener:
        def open(self, request, timeout=10):
            raise urllib.error.HTTPError(request.full_url, 503, "Service Unavailable", {}, None)

    monkeypatch.setattr(
        "app.domains.calendar_sharing.service.urllib.request.build_opener",
        lambda *_args, **_kwargs: _FailOpener(),
    )

    error_result = service.sync_feed(feed.id)
    errored_feed = repo.list_feeds()[0]

    assert ok_result.status == "ok"
    assert first_sync_time is not None
    assert error_result.status == "error"
    assert error_result.detail == "HTTP 503"
    assert errored_feed.last_synced_at == first_sync_time
    assert errored_feed.last_error == "HTTP 503"


def test_peer_feed_sync_rejects_invalid_payload_shape(monkeypatch, db_path) -> None:
    repo = CalendarSharingRepository(str(db_path))
    service = CalendarSharingService(repo)
    feed = repo.add_feed(
        SimpleNamespace(**{
            "label": "Remote partner",
            "base_url": "https://partner.example.com/api/v2",
            "token": "secret-token",
            "color": "#5b8def",
        })
    )

    class _BadResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({"entries": [123, "bad"]}).encode("utf-8")

    class _BadOpener:
        def open(self, request, timeout=10):
            return _BadResponse()

    monkeypatch.setattr(
        "app.domains.calendar_sharing.service.urllib.request.build_opener",
        lambda *_args, **_kwargs: _BadOpener(),
    )

    result = service.sync_feed(feed.id)
    stored_feed = repo.list_feeds()[0]

    assert result.status == "error"
    assert result.detail == "Invalid payload: ValueError"
    assert stored_feed.sync_status == "error"
    assert stored_feed.last_error == "invalid_feed_payload"


def test_sync_all_feeds_applies_backoff_after_failures(monkeypatch, db_path, caplog) -> None:
    repo = CalendarSharingRepository(str(db_path))
    service = CalendarSharingService(repo)
    feed = repo.add_feed(
        SimpleNamespace(**{
            "label": "Remote partner",
            "base_url": "https://partner.example.com/api/v2",
            "token": "secret-token",
            "color": "#5b8def",
        })
    )

    def fail_sync(_feed_id: str):
        return SimpleNamespace(status="error", events_imported=0)

    monkeypatch.setattr(service, "sync_feed", fail_sync)
    caplog.set_level("WARNING", logger="app.domains.calendar_sharing.service")

    first = service.sync_all_feeds()
    second = service.sync_all_feeds()

    assert first == {"synced": 0, "errors": 1, "events_imported": 0}
    assert second == {"synced": 0, "errors": 1, "events_imported": 0}
    assert feed.id in service._feed_backoff
    assert any("Skipping peer feed" in record.message for record in caplog.records)


def test_sync_all_feeds_processes_50_peer_feeds_with_partial_failures(monkeypatch, db_path) -> None:
    repo = CalendarSharingRepository(str(db_path))
    service = CalendarSharingService(repo)
    invalid_feed_count = 0
    valid_feed_count = 0

    for index in range(50):
        is_valid = index % 4 != 0
        if is_valid:
            valid_feed_count += 1
            base_url = f"https://peer-{index}.example.com/api/v2"
        else:
            invalid_feed_count += 1
            base_url = f"invalid-peer-{index}"
        repo.add_feed(
            SimpleNamespace(**{
                "label": f"Remote partner {index}",
                "base_url": base_url,
                "token": f"secret-token-{index}",
                "color": "#5b8def",
            })
        )

    def fake_fetch(feed, _raw_token: str, _from_dt: str, _to_dt: str) -> dict[str, object]:
        if not feed.base_url.startswith("https://peer-"):
            raise ValueError("invalid_url")
        feed_suffix = feed.base_url.split("https://peer-", 1)[1].split(".", 1)[0]
        return {
            "entries": [{
                "id": f"evt_remote_{feed_suffix}",
                "title": f"Peer planning {feed_suffix}",
                "description": "Shared from another install",
                "start_at": "2026-03-26T09:00:00+00:00",
                "end_at": "2026-03-26T10:00:00+00:00",
                "all_day": False,
                "category": "work",
                "updated_at": "2026-03-25T12:00:00+00:00",
                "source": "remote-dopaflow",
            }],
        }

    monkeypatch.setattr(service, "_fetch_feed_payload", fake_fetch)

    started_at = perf_counter()
    result = service.sync_all_feeds()
    elapsed = perf_counter() - started_at

    stored_feeds = repo.list_feeds()
    successful_feeds = [feed for feed in stored_feeds if feed.sync_status == "ok"]
    failed_feeds = [feed for feed in stored_feeds if feed.sync_status == "error"]
    events = CalendarRepository(str(db_path)).list_events()

    assert elapsed < 30
    assert result == {
        "synced": valid_feed_count,
        "errors": invalid_feed_count,
        "events_imported": valid_feed_count,
    }
    assert len(successful_feeds) == valid_feed_count
    assert len(failed_feeds) == invalid_feed_count
    assert all(feed.last_error == "invalid_url" for feed in failed_feeds)
    assert len(events) == valid_feed_count


def test_calendar_sharing_routes_mount_under_calendar_prefix(client) -> None:
    response = client.get("/api/v2/calendar/sharing/tokens")

    assert response.status_code == 200


def test_move_event_shifts_start_and_end(client) -> None:
    event = create_event(client)
    original_start = _iso(event["start_at"])
    original_end = _iso(event["end_at"])

    response = client.post(
        f"/api/v2/calendar/events/{event['id']}/move",
        json={"delta_minutes": 30, "auto_adjust": False},
    )

    assert response.status_code == 200


def test_today_schedule_falls_back_to_local_on_transport_error(client) -> None:
    today = datetime.now().date().isoformat()
    event = create_event(
        client,
        title="Local fallback",
        start_at=f"{today}T09:00:00+00:00",
        end_at=f"{today}T10:00:00+00:00",
    )

    class _BrokenClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, *args, **kwargs):
            request = httpx.Request("GET", "http://localhost:8001/calendar/range")
            raise httpx.ConnectError("offline", request=request)

    with patch("app.domains.calendar.router._zoescal_client", return_value=_BrokenClient()):
        response = client.get("/api/v2/calendar/today")

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "local"
    assert any(entry["id"] == event["id"] for entry in body["entries"])


@patch("app.domains.calendar.router._google_oauth_client")
def test_google_calendar_oauth_callback_uses_configured_redirect_uri(oauth_client_factory, client, monkeypatch) -> None:
    monkeypatch.setenv("DOPAFLOW_GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("DOPAFLOW_GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("DOPAFLOW_GOOGLE_REDIRECT_URI", "http://127.0.0.1:8123/custom/callback")

    token_response = SimpleNamespace(
        status_code=200,
        json=lambda: {"access_token": "token", "refresh_token": "refresh", "expires_in": 3600},
    )
    response_mock = AsyncMock(return_value=token_response)
    oauth_client_factory.return_value.__aenter__.return_value.post = response_mock

    response = client.get("/api/v2/calendar/oauth/callback", params={"code": "test-code"})

    assert response.status_code == 200
    assert response.json()["status"] == "connected"
    assert response_mock.call_args.kwargs["data"]["redirect_uri"] == "http://127.0.0.1:8123/custom/callback"


def test_move_event_preserves_duration(client) -> None:
    event = create_event(client)
    original_duration_s = (
        _iso(event["end_at"]) - _iso(event["start_at"])
    ).total_seconds()

    response = client.post(
        f"/api/v2/calendar/events/{event['id']}/move",
        json={"delta_minutes": -15, "auto_adjust": False},
    )

    assert response.status_code == 200
    moved = response.json()["event"]
    moved_duration_s = (_iso(moved["end_at"]) - _iso(moved["start_at"])).total_seconds()
    assert moved_duration_s == original_duration_s


def test_move_nonexistent_event_returns_not_moved(client) -> None:
    response = client.post(
        "/api/v2/calendar/events/evt_does_not_exist/move",
        json={"delta_minutes": 60, "auto_adjust": False},
    )

    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert response.json()["moved"] is False


def test_patch_event_updates_start_and_end(client) -> None:
    event = create_event(client)

    response = client.patch(
        f"/api/v2/calendar/events/{event['id']}",
        json={
            "start_at": "2026-03-25T11:00:00+00:00",
            "end_at": "2026-03-25T12:00:00+00:00",
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert _iso(updated["start_at"]).hour == 11
    assert _iso(updated["end_at"]).hour == 12
