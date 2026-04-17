#!/usr/bin/env python3
"""
DopaFlow Backend Smoke Tests
==============================
Tests all core API surfaces end-to-end via the FastAPI ASGI transport.

Run from repo root:
  PYTHONPATH=backend \
    DOPAFLOW_DEV_AUTH=1 \
    DOPAFLOW_DB_PATH=/tmp/df-smoke.sqlite \
    DOPAFLOW_DISABLE_LOCAL_AUDIO=1 \
    DOPAFLOW_DISABLE_BACKGROUND_JOBS=1 \
    DOPAFLOW_DISABLE_RATE_LIMITS=1 \
    python3 backend/tests/smoke_test.py
"""

from __future__ import annotations

import asyncio
import os
import sys

os.environ.setdefault("DOPAFLOW_DEV_AUTH", "1")
os.environ.setdefault("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
os.environ.setdefault("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("DOPAFLOW_DISABLE_RATE_LIMITS", "1")

DB_PATH = os.environ.get("DOPAFLOW_DB_PATH", "/tmp/df-smoke.sqlite")
os.environ["DOPAFLOW_DB_PATH"] = DB_PATH

import httpx

from app.core.config import get_settings
from app.core.database import run_migrations
from app.main import create_app

get_settings.cache_clear()

try:
    os.remove(DB_PATH)
except FileNotFoundError:
    pass

run_migrations(DB_PATH, turso_url=None, turso_token=None)

app = create_app()


async def _areq(client, method, path, json=None):
    func = getattr(client, method.lower())
    return await (func(path, json=json) if json else func(path))


def rp(api_path, method="GET", json=None):
    transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 1))

    async def do():
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test", timeout=10
        ) as client:
            r = await _areq(client, method, api_path, json)
            return r.status_code, r.json()

    return asyncio.run(do())


def test_command_list():
    status, body = rp("/api/v2/commands/list")
    assert status == 200, f"command list failed: {body}"
    ids = [c["id"] for c in body["commands"]]
    for rid in [
        "task_create",
        "habit_checkin",
        "calendar_create",
        "alarm_create",
        "focus_start",
        "journal_create",
    ]:
        assert rid in ids, f"Missing command: {rid}"
    return len(ids)


def test_nl_task_create():
    status, body = rp(
        "/api/v2/commands/execute",
        "POST",
        {
            "text": "buy groceries tomorrow",
            "confirm": True,
            "source": "text",
        },
    )
    assert status == 200, f"task create failed: {body}"
    assert body["intent"] == "task.create"
    assert body["status"] == "executed"
    return body["result"]["id"]


def test_task_list():
    status, body = rp("/api/v2/tasks/")
    assert status == 200
    assert len(body) >= 1
    return len(body)


def test_tasks_quick_add():
    status, body = rp(
        "/api/v2/tasks/quick-add",
        "POST",
        {
            "text": "Review quarterly report by Friday",
            "commit": True,
        },
    )
    assert status == 200, f"quick-add failed: {body}"
    return body["id"]


def test_habit_create():
    status, body = rp(
        "/api/v2/habits/",
        "POST",
        {
            "name": "Morning walk",
            "target_freq": 1,
            "target_period": "day",
            "color": "#22c55e",
        },
    )
    assert status == 200, f"habit create failed: {body}"
    return body["id"]


def test_habit_checkin():
    hab_id = test_habit_create()
    status, body = rp(f"/api/v2/habits/{hab_id}/checkin", "POST", {})
    assert status == 200, f"checkin failed: {body}"
    assert body["current_streak"] >= 1


def test_calendar_create():
    status, body = rp(
        "/api/v2/calendar/events",
        "POST",
        {
            "title": "Team standup",
            "start_at": "2099-06-15T09:00:00+00:00",
            "end_at": "2099-06-15T09:30:00+00:00",
            "all_day": False,
            "category": "work",
        },
    )
    assert status == 201, f"calendar create failed: {body}"
    return body["id"]


def test_alarm_create():
    status, body = rp(
        "/api/v2/alarms",
        "POST",
        {
            "at": "2099-01-01T08:00:00+00:00",
            "title": "Wake up call",
            "kind": "tts",
            "tts_text": "Rise and shine",
            "muted": False,
        },
    )
    assert status == 201, f"alarm create failed: {body}"
    return body["id"]


def test_focus_session():
    status, body = rp(
        "/api/v2/focus/sessions",
        "POST",
        {
            "started_at": "2099-01-01T10:00:00+00:00",
            "duration_minutes": 5,
        },
    )
    assert status == 200, f"focus start failed: {body}"
    assert body["status"] == "running"

    status2, body2 = rp(
        "/api/v2/focus/sessions/control", "POST", {"action": "completed"}
    )
    assert status2 == 200
    assert body2["status"] == "completed"


def test_journal_create():
    status, body = rp(
        "/api/v2/journal/entries",
        "POST",
        {
            "date": "2099-01-01",
            "markdown_body": "Smoke test — all systems nominal.",
            "emoji": "✅",
            "tags": ["smoke-test"],
        },
    )
    assert status == 201, f"journal create failed: {body}"
    return body["id"]


def test_voice_module():
    from app.services.speech_to_text import transcribe_upload

    assert callable(transcribe_upload)


def test_undo():
    status, body = rp(
        "/api/v2/commands/execute",
        "POST",
        {
            "text": "add task undoable test",
            "confirm": True,
            "source": "text",
        },
    )
    assert body["status"] == "executed"

    status2, body2 = rp(
        "/api/v2/commands/execute",
        "POST",
        {
            "text": "undo",
            "confirm": True,
            "source": "text",
        },
    )
    assert status2 == 200
    assert body2["intent"] == "undo"
    assert body2["status"] == "executed"


def run(name, fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
        print(f"  ✓ {name}")
        return True
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"  FAIL {name}: {e}")
        return False


def main():
    print("\n=== DopaFlow Backend Smoke Tests ===\n")

    passed = 0
    failed = 0

    if run("Command list", test_command_list):
        passed += 1
    else:
        failed += 1

    if run("NL task create", test_nl_task_create):
        passed += 1
    else:
        failed += 1

    if run("Task list", test_task_list):
        passed += 1
    else:
        failed += 1

    if run("Tasks quick-add", test_tasks_quick_add):
        passed += 1
    else:
        failed += 1

    if run("Habit create", test_habit_create):
        passed += 1
    else:
        failed += 1

    if run("Habit checkin", test_habit_checkin):
        passed += 1
    else:
        failed += 1

    if run("Calendar create", test_calendar_create):
        passed += 1
    else:
        failed += 1

    if run("Alarm create", test_alarm_create):
        passed += 1
    else:
        failed += 1

    if run("Focus session", test_focus_session):
        passed += 1
    else:
        failed += 1

    if run("Journal create", test_journal_create):
        passed += 1
    else:
        failed += 1

    if run("Voice module", test_voice_module):
        passed += 1
    else:
        failed += 1

    if run("Undo", test_undo):
        passed += 1
    else:
        failed += 1

    print(f"\n{'=' * 40}")
    print(f"Results: {passed} passed, {failed} failed")
    if failed:
        print("❌ SMOKE TESTS FAILED")
        sys.exit(1)
    print("✅ ALL SMOKE TESTS PASSED\n")


if __name__ == "__main__":
    main()
