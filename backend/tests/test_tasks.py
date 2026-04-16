from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

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

    response = client.patch(
        f"/api/v2/tasks/{task['id']}", json={"title": "Updated title"}
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated title"


def test_complete_task_marks_it_done(client) -> None:
    task = create_task(client)

    response = client.patch(f"/api/v2/tasks/{task['id']}/complete")

    assert response.status_code == 200
    assert response.json()["done"] is True
    assert response.json()["status"] == "done"


def test_complete_task_logs_gamification_failures_without_failing_request(
    client, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    from app.core import gamification_helpers

    task = create_task(client, title="Complete with logging")

    def explode_award(self, source: str, source_id: str | None = None) -> None:
        raise RuntimeError(f"boom:{source}:{source_id}")

    monkeypatch.setattr(
        gamification_helpers.GamificationService, "award", explode_award
    )
    caplog.set_level(logging.ERROR, logger="app.domains.tasks.service")

    response = client.patch(f"/api/v2/tasks/{task['id']}/complete")

    assert response.status_code == 200
    assert response.json()["done"] is True
    assert any(
        "Failed to award gamification for source=task_complete" in record.message
        and task["id"] in record.message
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
    response = client.post(
        "/api/v2/tasks/quick-add", data={"text": "Buy milk #shopping !2"}
    )

    assert response.status_code == 200
    parsed = response.json()
    assert parsed["title"] == "Buy milk"
    assert parsed["tags"] == ["shopping"]
    assert parsed["priority"] == 2


def test_quick_add_normalizes_recurrence_rule_field(client) -> None:
    response = client.post(
        "/api/v2/tasks/quick-add", json={"text": "Water plants every monday"}
    )

    assert response.status_code == 200
    parsed = response.json()
    assert parsed["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=MO"
    assert "rrule" not in parsed


def test_quick_add_returns_ambiguity_hints(client) -> None:
    response = client.post(
        "/api/v2/tasks/quick-add", json={"text": "Plan sprint next week"}
    )

    assert response.status_code == 200
    parsed = response.json()
    assert parsed["ambiguity"] is True
    assert parsed["ambiguity_hints"] == [
        "due date unclear: 'next week' defaulted to next week's local midnight"
    ]


def test_quick_add_accepts_user_timezone_for_relative_dates(client) -> None:
    response = client.post(
        "/api/v2/tasks/quick-add",
        json={"text": "Plan sprint tomorrow", "user_tz": "Europe/Copenhagen"},
    )

    assert response.status_code == 200
    parsed = response.json()
    assert parsed["due_at"].endswith("+02:00") or parsed["due_at"].endswith("+01:00")


def test_quick_add_uses_local_day_boundary_near_midnight(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 3, 25, 23, 30, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr(quick_add, "datetime", FrozenDateTime)

    parsed = quick_add.parse("Pay rent tomorrow 12:30am", user_tz="Europe/Copenhagen")

    assert parsed["due_at"] == "2026-03-27T00:30:00+01:00"


def test_quick_add_preserves_non_utc_timezone_offsets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr(quick_add, "datetime", FrozenDateTime)

    parsed = quick_add.parse("Send report in 2 days 9pm", user_tz="America/Los_Angeles")

    assert parsed["due_at"] == "2026-07-03T21:00:00-07:00"


def test_quick_add_does_not_treat_priority_keywords_inside_tags_as_priority(
    client,
) -> None:
    tagged = client.post(
        "/api/v2/tasks/quick-add", json={"text": "Review notes #urgent"}
    )
    bare = client.post("/api/v2/tasks/quick-add", json={"text": "Review notes urgent"})

    assert tagged.status_code == 200
    assert bare.status_code == 200
    assert tagged.json()["priority"] == 2
    assert tagged.json()["tags"] == ["urgent"]
    assert bare.json()["priority"] == 1


def test_bulk_complete_returns_updated_count(client) -> None:
    first = create_task(client, title="First")
    second = create_task(client, title="Second")

    response = client.post(
        "/api/v2/tasks/bulk/complete", json={"ids": [first["id"], second["id"]]}
    )

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

    response = client.post(
        "/api/v2/tasks/materialize-recurring", json={"window_hours": 24 * 365}
    )

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
    children = [
        item
        for item in tasks_response.json()
        if item.get("recurrence_parent_id") == task["id"]
    ]
    assert len(children) == 1
    assert children[0]["due_at"] == "2026-01-08T09:00:00+00:00"


def test_materialize_recurring_avoids_duplicate_child_when_title_collides(
    client,
) -> None:
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

    response = client.post(
        "/api/v2/tasks/materialize-recurring", json={"window_hours": 24 * 365}
    )

    assert response.status_code == 200
    assert response.json() == {"created": 1}

    tasks_response = client.get("/api/v2/tasks/", params={"search": "Weekly review"})
    assert tasks_response.status_code == 200
    children = [
        item
        for item in tasks_response.json()
        if item.get("recurrence_parent_id") == parent["id"]
    ]
    assert len(children) == 1
    assert children[0]["due_at"] == "2026-01-08T09:00:00+00:00"


def test_materialize_recurring_only_creates_completed_tasks_within_window(
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.tasks import repository as tasks_repository

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 1, 2, 0, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr(tasks_repository, "datetime", FrozenDateTime)

    within_window = create_task(
        client,
        title="Daily within window",
        done=True,
        recurrence_rule="FREQ=DAILY",
        due_at="2026-01-02T09:00:00+00:00",
    )
    create_task(
        client,
        title="Weekly outside window",
        done=True,
        recurrence_rule="FREQ=WEEKLY",
        due_at="2026-01-02T09:00:00+00:00",
    )
    create_task(
        client,
        title="Incomplete recurring",
        done=False,
        recurrence_rule="FREQ=DAILY",
        due_at="2026-01-02T09:00:00+00:00",
    )

    response = client.post(
        "/api/v2/tasks/materialize-recurring", json={"window_hours": 36}
    )

    assert response.status_code == 200
    assert response.json() == {"created": 1}

    tasks_response = client.get("/api/v2/tasks/")
    assert tasks_response.status_code == 200
    children = [
        item
        for item in tasks_response.json()
        if item.get("recurrence_parent_id") == within_window["id"]
    ]
    assert len(children) == 1
    assert children[0]["title"] == "Daily within window"
    assert children[0]["due_at"] == "2026-01-03T09:00:00+00:00"


def test_materialize_recurring_caps_instances_per_rule_per_run(
    db_path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.domains.tasks import repository as tasks_repository
    from app.domains.tasks.repository import TaskRepository

    repo = TaskRepository(str(db_path))

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr(tasks_repository, "datetime", FrozenDateTime)
    caplog.set_level(logging.WARNING, logger="app.domains.tasks.repository")

    base_due = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    for offset in range(501):
        repo.create_task(
            {
                "title": f"Hourly {offset}",
                "done": True,
                "status": "done",
                "recurrence_rule": "FREQ=HOURLY",
                "due_at": (base_due + timedelta(hours=offset)).isoformat(),
            },
        )

    result = repo.materialize_recurring(window_hours=24 * 365)

    assert result.created == 500

    tasks = repo.list_tasks()
    children = [task for task in tasks if task.recurrence_parent_id is not None]
    assert len(children) == 500
    assert any(
        "Recurring materialization hit 500-instance cap" in record.message
        and "FREQ=HOURLY" in record.message
        for record in caplog.records
    )


def test_materialize_recurring_daily_advances_25_hours_no_duplicates(
    db_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.tasks import repository as tasks_repository
    from app.domains.tasks.repository import TaskRepository

    repo = TaskRepository(str(db_path))

    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = base_time + timedelta(hours=25)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr(tasks_repository, "datetime", FrozenDateTime)

    repo.create_task(
        {
            "title": "Daily recurring",
            "done": True,
            "status": "done",
            "recurrence_rule": "FREQ=DAILY",
            "due_at": base_time.isoformat(),
        },
    )

    result = repo.materialize_recurring(window_hours=36)
    assert result.created == 1

    tasks = repo.list_tasks()
    children = [task for task in tasks if task.recurrence_parent_id is not None]
    assert len(children) == 1
    assert children[0].due_at == (base_time + timedelta(days=1)).isoformat()

    result2 = repo.materialize_recurring(window_hours=36)
    assert result2.created == 0

    tasks = repo.list_tasks()
    children = [task for task in tasks if task.recurrence_parent_id is not None]
    assert len(children) == 1


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
    children = [
        item
        for item in tasks_response.json()
        if item.get("recurrence_parent_id") == task["id"]
    ]
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
    today_due = (
        datetime.now(timezone.utc)
        .replace(hour=17, minute=0, second=0, microsecond=0)
        .isoformat()
    )
    tomorrow_due = (
        datetime.now(timezone.utc)
        .replace(hour=17, minute=0, second=0, microsecond=0)
        .isoformat()
    )
    today_task = create_task(client, title="Today", due_at=today_due)
    create_task(
        client, title="Later", due_at=tomorrow_due.replace(today_due[:10], "2099-01-01")
    )

    response = client.get("/api/v2/tasks/", params={"due_today": "true"})

    assert response.status_code == 200
    ids = {task["id"] for task in response.json()}
    assert today_task["id"] in ids


def test_add_subtask_appends_nested_task(client) -> None:
    task = create_task(client)

    response = client.post(
        f"/api/v2/tasks/{task['id']}/subtasks", json={"title": "Small step"}
    )

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


def test_parse_quick_add_today_converts_to_utc(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    parsed = parse_quick_add("Buy groceries today", user_tz="America/New_York")

    assert parsed["due_at"] is not None
    assert parsed["due_at"].endswith("+00:00")
    assert "2026-06-15" in parsed["due_at"]


def test_parse_quick_add_tomorrow_converts_to_utc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    parsed = parse_quick_add("Call dentist tomorrow", user_tz="Europe/Berlin")

    assert parsed["due_at"] is not None
    assert parsed["due_at"].endswith("+00:00")


def test_parse_quick_add_relative_dates_use_local_midnight(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 6, 15, 22, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    parsed = parse_quick_add("Submit report tomorrow", user_tz="Asia/Tokyo")

    assert parsed["due_at"] is not None
    assert parsed["due_at"].endswith("+00:00")
    # Jun 15 22:00 UTC = Jun 16 07:00 Tokyo (UTC+9)
    # "tomorrow" in Tokyo = Jun 17 local midnight = Jun 16 15:00 UTC
    assert parsed["due_at"] == "2026-06-16T15:00:00+00:00"


def test_parse_quick_add_weekday_resolves_in_user_tz(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            # Wednesday Jun 17 2026
            moment = datetime(2026, 6, 17, 5, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    parsed = parse_quick_add("Meeting monday", user_tz="US/Pacific")

    assert parsed["due_at"] is not None
    assert parsed["due_at"].endswith("+00:00")


def test_parse_quick_add_invalid_tz_defaults_to_utc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    parsed = parse_quick_add("Task today", user_tz="Invalid/Timezone")

    assert parsed["due_at"] is not None
    assert parsed["due_at"].endswith("+00:00")


def test_parse_quick_add_2359_utc_vs_utc2_midnight_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """At 23:59 UTC it is already 01:59 the next day in UTC+2."""
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            # 23:59 UTC Jun 15 → 01:59 Jun 16 in Europe/Berlin (UTC+2)
            moment = datetime(2026, 6, 15, 23, 59, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    parsed = parse_quick_add("Review PR today", user_tz="Europe/Berlin")

    assert parsed["due_at"] is not None
    assert parsed["due_at"].endswith("+00:00")
    # "today" in Berlin = Jun 16 local midnight = Jun 15 22:00 UTC
    assert parsed["due_at"] == "2026-06-15T22:00:00+00:00"


def test_parse_quick_add_urgent_tag_does_not_set_priority(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """#urgent is a tag; only bare 'urgent' sets priority=1."""
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    tagged = parse_quick_add("Fix build #urgent", user_tz="UTC")
    assert tagged["priority"] == 3
    assert "urgent" in tagged["tags"]

    bare = parse_quick_add("Fix build urgent", user_tz="UTC")
    assert bare["priority"] == 1


def test_parse_quick_add_next_week_weekday_is_ambiguous(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """ "next week Monday" should flag ambiguity since 'next week' matches first."""
    from app.domains.tasks.service import parse_quick_add

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            # Wednesday Jun 17 2026
            moment = datetime(2026, 6, 17, 12, 0, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz is not None else moment

    monkeypatch.setattr("app.domains.tasks.service.datetime", FrozenDateTime)

    parsed = parse_quick_add("Call client next week monday", user_tz="UTC")

    assert parsed["due_at"] is not None
    assert parsed["ambiguity"] is True
    assert any("next week" in h for h in parsed["ambiguity_hints"])
