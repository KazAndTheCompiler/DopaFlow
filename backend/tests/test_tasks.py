from __future__ import annotations

from datetime import datetime, timezone


def create_task(client, **overrides):
    payload = {
        "title": "Write tests",
        "priority": 2,
        "tags": ["backend"],
    }
    payload.update(overrides)
    response = client.post("/api/v2/tasks/", json=payload)
    assert response.status_code == 200
    return response.json()


def test_create_task_returns_task_with_id(client) -> None:
    task = create_task(client)

    assert task["id"].startswith("tsk_")
    assert task["title"] == "Write tests"


def test_list_tasks_is_empty_on_fresh_db(client) -> None:
    response = client.get("/api/v2/tasks/")

    assert response.status_code == 200
    assert response.json() == []


def test_get_task_by_id(client) -> None:
    task = create_task(client, title="Get me")

    response = client.get(f"/api/v2/tasks/{task['id']}")

    assert response.status_code == 200
    assert response.json()["title"] == "Get me"


def test_patch_task_updates_title(client) -> None:
    task = create_task(client)

    response = client.patch(f"/api/v2/tasks/{task['id']}", json={"title": "Updated title"})

    assert response.status_code == 200
    assert response.json()["title"] == "Updated title"


def test_complete_task_marks_it_done(client) -> None:
    task = create_task(client)

    response = client.patch(f"/api/v2/tasks/{task['id']}/complete")

    assert response.status_code == 200
    assert response.json()["done"] is True
    assert response.json()["status"] == "done"


def test_delete_task_removes_it_and_follow_up_get_is_404(client) -> None:
    task = create_task(client)

    delete_response = client.delete(f"/api/v2/tasks/{task['id']}")
    get_response = client.get(f"/api/v2/tasks/{task['id']}")

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True}
    assert get_response.status_code == 404


def test_quick_add_parses_tags_and_priority(client) -> None:
    response = client.post("/api/v2/tasks/quick-add", data={"text": "Buy milk #shopping !2"})

    assert response.status_code == 200
    parsed = response.json()
    assert parsed["title"] == "Buy milk"
    assert parsed["tags"] == ["shopping"]
    assert parsed["priority"] == 2


def test_bulk_complete_returns_updated_count(client) -> None:
    first = create_task(client, title="First")
    second = create_task(client, title="Second")

    response = client.post("/api/v2/tasks/bulk/complete", json={"ids": [first["id"], second["id"]]})

    assert response.status_code == 200
    assert response.json() == {"updated": 2}


def test_done_false_filter_returns_only_incomplete_tasks(client) -> None:
    active = create_task(client, title="Open")
    completed = create_task(client, title="Closed")
    client.patch(f"/api/v2/tasks/{completed['id']}/complete")

    response = client.get("/api/v2/tasks/", params={"done": "false"})

    assert response.status_code == 200
    ids = {task["id"] for task in response.json()}
    assert active["id"] in ids
    assert completed["id"] not in ids


def test_due_today_filter_returns_only_today_tasks(client) -> None:
    today_due = datetime.now(timezone.utc).replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
    tomorrow_due = datetime.now(timezone.utc).replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
    today_task = create_task(client, title="Today", due_at=today_due)
    create_task(client, title="Later", due_at=tomorrow_due.replace(today_due[:10], "2099-01-01"))

    response = client.get("/api/v2/tasks/", params={"due_today": "true"})

    assert response.status_code == 200
    ids = {task["id"] for task in response.json()}
    assert today_task["id"] in ids


def test_add_subtask_appends_nested_task(client) -> None:
    task = create_task(client)

    response = client.post(f"/api/v2/tasks/{task['id']}/subtasks", json={"title": "Small step"})

    assert response.status_code == 200
    assert response.json()["subtasks"][0]["title"] == "Small step"


def test_start_time_log_returns_started_entry(client) -> None:
    task = create_task(client)

    response = client.post(f"/api/v2/tasks/{task['id']}/time/start")

    assert response.status_code == 200
    assert response.json()["task_id"] == task["id"]
    assert "started_at" in response.json()


def test_search_endpoint_filters_by_tag(client) -> None:
    tagged = create_task(client, title="Tagged", tags=["alpha"])
    create_task(client, title="Other", tags=["beta"])

    response = client.get("/api/v2/tasks/search", params={"tag": "alpha"})

    assert response.status_code == 200
    assert [task["id"] for task in response.json()] == [tagged["id"]]
