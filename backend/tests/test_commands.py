from __future__ import annotations


def test_execute_command_endpoint_returns_intent(client) -> None:
    response = client.post("/api/v2/commands/execute", json={"text": "add task finish docs"})

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
    assert history[0]["intent"] in {"habit.list", "task.create", "focus.start", "unknown"}
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
    response = client.post("/api/v2/commands/execute", json={"text": "journal today felt clearer after walking"})

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "journal.create"
    assert body["status"] == "executed"
    assert body["result"]["markdown_body"] == "today felt clearer after walking"


def test_execute_calendar_command_creates_event(client) -> None:
    response = client.post("/api/v2/commands/execute", json={"text": "calendar dentist tomorrow at 14:00 for 45 minutes"})

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "calendar.create"
    assert body["status"] == "executed"
    assert body["result"]["title"] == "dentist"


def test_execute_calendar_command_without_time_returns_incomplete(client) -> None:
    response = client.post("/api/v2/commands/execute", json={"text": "calendar dentist tomorrow"})

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "calendar.create"
    assert body["status"] == "incomplete"


def test_execute_command_preserves_voice_source_in_history(client) -> None:
    execute_response = client.post("/api/v2/commands/execute", json={"text": "journal voice note test", "source": "voice"})
    history_response = client.get("/api/v2/commands/history")

    assert execute_response.status_code == 200
    assert history_response.status_code == 200
    assert history_response.json()[0]["source"] == "voice"


def test_execute_command_rejects_unknown_source(client) -> None:
    response = client.post("/api/v2/commands/execute", json={"text": "journal source test", "source": "clipboard"})

    assert response.status_code == 422
