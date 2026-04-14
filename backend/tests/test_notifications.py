from __future__ import annotations

AUTH_HEADERS = {"Authorization": "Bearer dev-local-key"}


def create_notification(client, **overrides):
    payload = {"level": "info", "title": "Inbox item", "body": "Read me"}
    payload.update(overrides)
    response = client.post("/api/v2/notifications/", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200
    return response.json()


def test_list_notifications_is_empty_on_fresh_db(client) -> None:
    response = client.get("/api/v2/notifications/", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == []


def test_create_notification_returns_record(client) -> None:
    notification = create_notification(client)

    assert notification["id"].startswith("ntf_")
    assert notification["title"] == "Inbox item"
    assert notification["read"] is False
    assert notification["archived"] is False


def test_create_notification_is_immediately_visible_without_duplicates(client) -> None:
    created = create_notification(client, title="Race guard", body="Inserted once")

    listed = client.get("/api/v2/notifications/", headers=AUTH_HEADERS)

    assert listed.status_code == 200
    matching = [item for item in listed.json() if item["id"] == created["id"]]
    assert len(matching) == 1
    assert matching[0] == created


def test_mark_read_updates_unread_count(client) -> None:
    notification = create_notification(client)

    read_response = client.post(
        f"/api/v2/notifications/{notification['id']}/read", headers=AUTH_HEADERS
    )
    unread_response = client.get(
        "/api/v2/notifications/unread-count", headers=AUTH_HEADERS
    )

    assert read_response.status_code == 200
    assert read_response.json() == {"ok": True}
    assert unread_response.json()["count"] == 0


def test_mark_all_read_returns_updated_count_shape(client) -> None:
    create_notification(client, title="First")
    create_notification(client, title="Second")

    response = client.post("/api/v2/notifications/read-all", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == {"count": 2}


def test_archive_missing_notification_returns_404(client) -> None:
    response = client.post(
        "/api/v2/notifications/ntf_missing/archive", headers=AUTH_HEADERS
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Notification not found"


def test_delete_notification_removes_item(client) -> None:
    notification = create_notification(client)

    delete_response = client.delete(
        f"/api/v2/notifications/{notification['id']}", headers=AUTH_HEADERS
    )
    list_response = client.get("/api/v2/notifications/", headers=AUTH_HEADERS)

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True}
    assert list_response.json() == []


def test_insert_then_query_no_race_duplicates(client) -> None:
    """Regression guard for re-query-after-insert race condition."""
    created = create_notification(
        client, title="Race condition test", body="Should appear exactly once"
    )

    listed = client.get("/api/v2/notifications/", headers=AUTH_HEADERS)

    assert listed.status_code == 200
    items = listed.json()
    matching = [item for item in items if item["id"] == created["id"]]
    assert len(matching) == 1
    assert matching[0]["title"] == "Race condition test"
    assert matching[0]["body"] == "Should appear exactly once"
    assert matching[0]["level"] == "info"
    assert matching[0]["read"] is False
    assert matching[0]["archived"] is False
