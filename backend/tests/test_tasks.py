from __future__ import annotations

from datetime import datetime, timezone
import logging

import pytest


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


def test_complete_task_logs_gamification_failures_without_failing_request(client, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    from app.domains.tasks import service as task_service

    task = create_task(client, title="Complete with logging")

    def explode_award(self, source: str, source_id: str | None = None) -> None:
        raise RuntimeError(f"boom:{source}:{source_id}")

    monkeypatch.setattr(task_service.GamificationService, "award", explode_award)
    caplog.set_level(logging.ERROR, logger="app.domains.tasks.service")

    response = client.patch(f"/api/v2/tasks/{task['id']}/complete")

    assert response.status_code == 200
    assert response.json()["done"] is True
    assert any(
        "Failed to award gamification for source=task_complete" in record.message and task["id"] in record.message
        for record in caplog.records
    )


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


def test_quick_add_normalizes_recurrence_rule_field(client) -> None:
    response = client.post("/api/v2/tasks/quick-add", json={"text": "Water plants every monday"})

    assert response.status_code == 200
    parsed = response.json()
    assert parsed["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=MO"
    assert "rrule" not in parsed


def test_bulk_complete_returns_updated_count(client) -> None:
    first = create_task(client, title="First")
    second = create_task(client, title="Second")

    response = client.post("/api/v2/tasks/bulk/complete", json={"ids": [first["id"], second["id"]]})

    assert response.status_code == 200
    assert response.json() == {"updated": 2}


def test_materialize_recurring_accepts_json_window_hours(client) -> None:
    create_task(
        client,
        title="Weekly review",
        done=True,
        recurrence_rule="FREQ=WEEKLY",
        due_at="2026-01-01T09:00:00+00:00",
    )

    response = client.post("/api/v2/tasks/materialize-recurring", json={"window_hours": 24 * 365})

    assert response.status_code == 200
    assert response.json() == {"created": 1}


def test_complete_task_creates_next_weekday_instance_from_rrule(client) -> None:
    task = create_task(
        client,
        title="Water plants",
        done=False,
        recurrence_rule="FREQ=WEEKLY;BYDAY=MO,TH",
        due_at="2026-01-05T09:00:00+00:00",
    )

    response = client.patch(f"/api/v2/tasks/{task['id']}/complete")

    assert response.status_code == 200
    tasks_response = client.get("/api/v2/tasks/", params={"search": "Water plants"})
    assert tasks_response.status_code == 200
    children = [item for item in tasks_response.json() if item.get("recurrence_parent_id") == task["id"]]
    assert len(children) == 1
    assert children[0]["due_at"] == "2026-01-08T09:00:00+00:00"


def test_materialize_recurring_avoids_duplicate_child_when_title_collides(client) -> None:
    parent = create_task(
        client,
        title="Weekly review",
        done=True,
        recurrence_rule="FREQ=WEEKLY",
        due_at="2026-01-01T09:00:00+00:00",
    )
    create_task(
        client,
        title="Weekly review",
        done=False,
        recurrence_rule=None,
        due_at="2026-01-08T09:00:00+00:00",
    )

    response = client.post("/api/v2/tasks/materialize-recurring", json={"window_hours": 24 * 365})

    assert response.status_code == 200
    assert response.json() == {"created": 1}

    tasks_response = client.get("/api/v2/tasks/", params={"search": "Weekly review"})
    assert tasks_response.status_code == 200
    children = [item for item in tasks_response.json() if item.get("recurrence_parent_id") == parent["id"]]
    assert len(children) == 1
    assert children[0]["due_at"] == "2026-01-08T09:00:00+00:00"


def test_complete_task_does_not_create_duplicate_recurring_child(client) -> None:
    task = create_task(
        client,
        title="Daily standup",
        done=False,
        recurrence_rule="FREQ=DAILY",
        due_at="2026-01-01T09:00:00+00:00",
    )

    first_response = client.patch(f"/api/v2/tasks/{task['id']}/complete")
    second_response = client.patch(f"/api/v2/tasks/{task['id']}/complete")

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    tasks_response = client.get("/api/v2/tasks/", params={"search": "Daily standup"})
    assert tasks_response.status_code == 200
    children = [item for item in tasks_response.json() if item.get("recurrence_parent_id") == task["id"]]
    assert len(children) == 1


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
