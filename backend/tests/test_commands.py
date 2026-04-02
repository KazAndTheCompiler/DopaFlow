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


def test_command_list_endpoint_returns_definitions(client) -> None:
    response = client.get("/api/v2/commands/list")

    assert response.status_code == 200
    body = response.json()
    assert "commands" in body
    assert any(command["id"] == "task_create" for command in body["commands"])
