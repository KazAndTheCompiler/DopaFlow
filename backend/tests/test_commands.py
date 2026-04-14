from __future__ import annotations

from unittest.mock import patch


def test_execute_command_endpoint_returns_intent(client) -> None:
    response = client.post(
        "/api/v2/commands/execute", json={"text": "add task finish docs"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "task.create"
    assert body["status"] == "executed"


def test_command_history_endpoint_returns_logged_command(client) -> None:
    client.post("/api/v2/commands/execute", json={"text": "list habits"})

    response = client.get("/api/v2/commands/history")

    assert response.status_code == 200
    history = response.json()
    assert len(history) >= 1
    assert history[0]["intent"] in {
        "habit.list",
        "task.create",
        "focus.start",
        "unknown",
    }
    assert history[0]["source"] == "text"


def test_command_list_endpoint_returns_definitions(client) -> None:
    response = client.get("/api/v2/commands/list")

    assert response.status_code == 200
    body = response.json()
    assert "commands" in body
    assert any(command["id"] == "task_create" for command in body["commands"])
    assert any(command["id"] == "journal_create" for command in body["commands"])
    assert any(command["id"] == "calendar_create" for command in body["commands"])
    assert all(command["text"] for command in body["commands"])


def test_execute_journal_command_creates_entry(client) -> None:
    response = client.post(
        "/api/v2/commands/execute",
        json={"text": "journal today felt clearer after walking"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "journal.create"
    assert body["status"] == "executed"
    assert body["result"]["markdown_body"] == "today felt clearer after walking"


def test_execute_calendar_command_creates_event(client) -> None:
    response = client.post(
        "/api/v2/commands/execute",
        json={"text": "calendar dentist tomorrow at 14:00 for 45 minutes"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "calendar.create"
    assert body["status"] == "executed"
    assert body["result"]["title"] == "dentist"


def test_execute_calendar_command_without_time_returns_needs_datetime(client) -> None:
    response = client.post(
        "/api/v2/commands/execute", json={"text": "calendar dentist tomorrow"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "calendar.create"
    assert body["status"] == "needs_datetime"


def test_execute_command_preserves_voice_source_in_history(client) -> None:
    execute_response = client.post(
        "/api/v2/commands/execute",
        json={"text": "journal voice note test", "source": "voice"},
    )
    history_response = client.get("/api/v2/commands/history")

    assert execute_response.status_code == 200
    assert history_response.status_code == 200
    assert history_response.json()[0]["source"] == "voice"


def test_execute_command_rejects_unknown_source(client) -> None:
    response = client.post(
        "/api/v2/commands/execute",
        json={"text": "journal source test", "source": "clipboard"},
    )

    assert response.status_code == 422


# -----------------------------------------------------------------------
# Natural language commands (no prefix required)
# -----------------------------------------------------------------------


def test_natural_language_task_no_prefix(client) -> None:
    """NLP engine handles 'buy milk tomorrow' without 'task' prefix."""
    response = client.post(
        "/api/v2/commands/execute", json={"text": "buy milk tomorrow"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "task.create"
    assert body["status"] == "executed"


def test_execute_command_persists_recurrence_rule(client) -> None:
    response = client.post(
        "/api/v2/commands/execute", json={"text": "every monday water plants"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "task.create"
    assert body["result"]["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=MO"


def test_execute_command_does_not_run_migrations_on_hot_path(client) -> None:
    with patch("app.core.database.run_migrations") as run_migrations_mock:
        response = client.post(
            "/api/v2/commands/execute", json={"text": "add task finish docs"}
        )

    assert response.status_code == 200
    run_migrations_mock.assert_not_called()


def test_natural_language_focus_no_prefix(client) -> None:
    """NLP engine handles 'start focus for 30 minutes' without prefix."""
    response = client.post(
        "/api/v2/commands/execute", json={"text": "start focus for 30 minutes"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "focus.start"
    assert body["status"] == "executed"
    assert body["result"]["task_id"] is None


def test_natural_language_greeting(client) -> None:
    """Greeting returns a friendly reply without executing anything."""
    response = client.post("/api/v2/commands/execute", json={"text": "hello"})

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "greeting"
    assert body["status"] == "ok"
    assert "reply" in body


# -----------------------------------------------------------------------
# Preview with follow-ups
# -----------------------------------------------------------------------


def test_preview_includes_follow_ups(client) -> None:
    response = client.post(
        "/api/v2/commands/preview", json={"text": "add task buy groceries"}
    )

    assert response.status_code == 200
    body = response.json()
    assert "follow_ups" in body["parsed"]
    assert len(body["parsed"]["follow_ups"]) > 0


def test_preview_includes_tts_response(client) -> None:
    response = client.post(
        "/api/v2/commands/preview", json={"text": "add task buy groceries"}
    )

    assert response.status_code == 200
    body = response.json()
    assert "tts_response" in body
    assert body["tts_response"] != ""


# -----------------------------------------------------------------------
# Packy voice-command endpoint
# -----------------------------------------------------------------------


def test_packy_voice_command_returns_full_response(client) -> None:
    response = client.post(
        "/api/v2/packy/voice-command",
        json={"text": "add task buy milk tomorrow", "auto_execute": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "task.create"
    assert "confidence" in body
    assert "entities" in body
    assert "preview" in body
    assert "reply_text" in body
    assert "tts_text" in body
    assert "follow_ups" in body


def test_packy_voice_command_auto_execute(client) -> None:
    response = client.post(
        "/api/v2/packy/voice-command",
        json={"text": "add task buy milk", "auto_execute": True},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "task.create"
    assert body["status"] == "executed"
    assert body["execution_result"] is not None


def test_packy_voice_command_greeting(client) -> None:
    response = client.post(
        "/api/v2/packy/voice-command",
        json={"text": "hello", "auto_execute": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "greeting"
    assert body["tts_text"] != ""


def test_packy_voice_command_empty_text(client) -> None:
    response = client.post(
        "/api/v2/packy/voice-command",
        json={"text": "", "auto_execute": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "unknown"
    assert body["status"] == "empty"


def test_packy_voice_command_uses_db_aware_preview_for_ambiguous_task_complete(
    client,
) -> None:
    client.post("/api/v2/commands/execute", json={"text": "add task review inbox zero"})
    client.post(
        "/api/v2/commands/execute", json={"text": "add task review sprint plan"}
    )

    response = client.post(
        "/api/v2/packy/voice-command",
        json={"text": "complete review", "auto_execute": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ambiguous"
    assert body["preview"]["status"] == "ambiguous"
    assert body["preview"]["would_execute"] is False
    assert "Which one?" in body["reply_text"] or "Multiple" in body["reply_text"]


# -----------------------------------------------------------------------
# Undo — real reversal
# -----------------------------------------------------------------------


def test_undo_task_create_removes_task(client) -> None:
    """Create a task, undo it, verify the task is soft-deleted."""
    create_res = client.post(
        "/api/v2/commands/execute", json={"text": "add task undoable groceries"}
    )
    assert create_res.status_code == 200
    create_body = create_res.json()
    assert create_body["intent"] == "task.create"
    assert create_body["status"] == "executed"
    task_id = create_body["result"]["id"]

    # Undo
    undo_res = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert undo_res.status_code == 200
    undo_body = undo_res.json()
    assert undo_body["intent"] == "undo"
    assert undo_body["status"] == "executed"

    # Verify task was soft-deleted — fetch tasks should not include it
    tasks_res = client.get("/api/v2/tasks/")
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert not any(t["id"] == task_id for t in tasks)


def test_undo_task_complete_reopens_task(client) -> None:
    """Complete a task, undo it, verify the task is reopened."""
    create_res = client.post(
        "/api/v2/commands/execute", json={"text": "add task to reopen after done"}
    )
    task_id = create_res.json()["result"]["id"]

    complete_res = client.post(
        "/api/v2/commands/execute", json={"text": "complete to reopen"}
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["intent"] == "task.complete"
    assert complete_res.json()["status"] == "executed"

    # Undo the completion
    undo_res = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert undo_res.status_code == 200
    undo_body = undo_res.json()
    assert undo_body["intent"] == "undo"
    assert undo_body["status"] == "executed"

    # Verify task is open again
    tasks_res = client.get("/api/v2/tasks/")
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    reopened = [t for t in tasks if t["id"] == task_id]
    assert len(reopened) == 1
    assert reopened[0]["done"] is False


def test_undo_nothing_to_undo(client) -> None:
    """Undo when there's nothing to undo returns a clear message."""
    client.delete("/api/v2/commands/history")

    undo_res = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert undo_res.status_code == 200
    body = undo_res.json()
    assert body["intent"] == "undo"
    assert body["status"] == "nothing_to_undo"


def test_undo_consumes_entry_once(client) -> None:
    create_res = client.post(
        "/api/v2/commands/execute", json={"text": "add task one shot undo"}
    )
    assert create_res.status_code == 200
    assert create_res.json()["status"] == "executed"

    first_undo = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert first_undo.status_code == 200
    assert first_undo.json()["status"] == "executed"

    second_undo = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert second_undo.status_code == 200
    assert second_undo.json()["status"] == "nothing_to_undo"


def test_undo_skips_unsupported_intents(client) -> None:
    """Undo after a non-undoable command returns 'unsupported', not a crash."""
    client.delete("/api/v2/commands/history")
    journal_res = client.post(
        "/api/v2/commands/execute", json={"text": "journal test note about the weather"}
    )
    assert journal_res.json()["status"] == "executed"

    undo_res = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert undo_res.status_code == 200
    body = undo_res.json()
    assert body["intent"] == "undo"
    assert body["status"] == "unsupported"


def test_undo_does_not_retry_same_entry_twice(client) -> None:
    """Completed undo should mark the original command entry as spent."""
    create_res = client.post(
        "/api/v2/commands/execute", json={"text": "add task only undo once"}
    )
    assert create_res.status_code == 200

    first_undo = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert first_undo.status_code == 200
    assert first_undo.json()["status"] == "executed"

    second_undo = client.post("/api/v2/commands/execute", json={"text": "undo"})
    assert second_undo.status_code == 200
    assert second_undo.json()["status"] == "nothing_to_undo"

    history_res = client.get("/api/v2/commands/history")
    assert history_res.status_code == 200
    history = history_res.json()
    task_create = next(entry for entry in history if entry["intent"] == "task.create")
    assert task_create["undone_at"] is not None


def test_preview_incomplete_calendar_returns_needs_datetime(client) -> None:
    """Calendar without time should show 'needs_datetime' in preview."""
    response = client.post(
        "/api/v2/commands/preview", json={"text": "calendar dentist tomorrow"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "needs_datetime"


def test_preview_compound_command_is_unsupported(client) -> None:
    response = client.post(
        "/api/v2/commands/preview",
        json={"text": "add task meeting prep and set alarm 9am"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "unsupported"
    assert len(body["parts"]) == 2


def test_execute_compound_command_is_unsupported(client) -> None:
    response = client.post(
        "/api/v2/commands/execute",
        json={"text": "add task meeting prep and set alarm 9am"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "compound"
    assert body["status"] == "unsupported"

    tasks_res = client.get("/api/v2/tasks/")
    assert tasks_res.status_code == 200
    assert all(task["title"] != "meeting prep" for task in tasks_res.json())


def test_preview_complete_task_reports_exact_match(client) -> None:
    create_res = client.post(
        "/api/v2/commands/execute", json={"text": "add task preview exact match"}
    )
    assert create_res.status_code == 200

    response = client.post(
        "/api/v2/commands/preview", json={"text": "complete preview exact"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is True
    assert body["status"] == "ok"
    assert body["result"]["title"] == "preview exact match"


def test_preview_complete_task_reports_ambiguous_match(client) -> None:
    client.post("/api/v2/commands/execute", json={"text": "add task review inbox zero"})
    client.post(
        "/api/v2/commands/execute", json={"text": "add task review sprint plan"}
    )

    response = client.post("/api/v2/commands/preview", json={"text": "complete review"})

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "ambiguous"
    assert len(body["options"]) == 2


def test_preview_complete_task_reports_not_found(client) -> None:
    response = client.post(
        "/api/v2/commands/preview", json={"text": "complete missing task title"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "not_found"


def test_preview_habit_checkin_reports_exact_match(client) -> None:
    create_res = client.post(
        "/api/v2/habits/", json={"name": "Hydration", "target": 1, "unit": "glass"}
    )
    assert create_res.status_code == 200

    response = client.post(
        "/api/v2/commands/preview", json={"text": "check in hydration"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is True
    assert body["status"] == "ok"
    assert body["result"]["name"] == "Hydration"


def test_preview_habit_checkin_reports_ambiguous_match(client) -> None:
    client.post(
        "/api/v2/habits/",
        json={"name": "Hydration morning", "target": 1, "unit": "glass"},
    )
    client.post(
        "/api/v2/habits/",
        json={"name": "Hydration evening", "target": 1, "unit": "glass"},
    )

    response = client.post(
        "/api/v2/commands/preview", json={"text": "check in hydration"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "ambiguous"
    assert len(body["options"]) == 2


def test_preview_undo_reports_supported_entry(client) -> None:
    create_res = client.post(
        "/api/v2/commands/execute", json={"text": "add task preview undo target"}
    )
    assert create_res.status_code == 200

    response = client.post("/api/v2/commands/preview", json={"text": "undo"})

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is True
    assert body["status"] == "ok"
    assert body["result"]["intent"] == "task.create"


def test_preview_undo_reports_unsupported_entry(client) -> None:
    list_res = client.post("/api/v2/commands/execute", json={"text": "show habits"})
    assert list_res.status_code == 200
    assert list_res.json()["intent"] == "habit.list"
    assert list_res.json()["status"] == "executed"

    response = client.post("/api/v2/commands/preview", json={"text": "undo"})

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "unsupported"


def test_execute_incomplete_calendar_returns_needs_datetime(client) -> None:
    """Calendar without time should return 'needs_datetime' on execute."""
    response = client.post(
        "/api/v2/commands/execute", json={"text": "calendar dentist tomorrow"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "calendar.create"
    assert body["status"] == "needs_datetime"


def test_preview_greeting_not_executable(client) -> None:
    """Greeting should not be flagged as executable in preview."""
    response = client.post("/api/v2/commands/preview", json={"text": "hello"})

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "greeting"


def test_preview_unknown_not_executable(client) -> None:
    """Gibberish should not be flagged as executable in preview."""
    response = client.post("/api/v2/commands/preview", json={"text": "asdlkfj qwer"})

    assert response.status_code == 200
    body = response.json()
    assert body["would_execute"] is False
    assert body["status"] == "unknown"


def test_command_history_stores_result_json(client) -> None:
    """Command history entries for undoable intents include result data."""
    create_res = client.post(
        "/api/v2/commands/execute", json={"text": "add task history result check"}
    )
    assert create_res.json()["status"] == "executed"

    history_res = client.get("/api/v2/commands/history")
    assert history_res.status_code == 200
    history = history_res.json()
    create_entry = next((e for e in history if e["intent"] == "task.create"), None)
    assert create_entry is not None
    assert "result" in create_entry
    assert "id" in create_entry["result"]
