from __future__ import annotations

from app.core.database import tx


def test_search_returns_task_and_journal_matches(client, db_path) -> None:
    with tx(str(db_path)) as conn:
        conn.execute(
            "INSERT INTO tasks (id, title, description) VALUES ('search_task', 'Searchable task', 'Needle text')"
        )
        conn.execute(
            "INSERT INTO journal_entries (id, markdown_body, emoji, entry_date, tags_json) VALUES ('search_entry', 'Needle journal body', NULL, '2026-03-26', '[]')"
        )

    response = client.get("/api/v2/search", params={"q": "Needle"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "Needle"
    result_types = {result["type"] for result in payload["results"]}
    assert "task" in result_types
    assert "journal" in result_types


def test_search_empty_query_is_rejected(client) -> None:
    response = client.get("/api/v2/search", params={"q": ""})

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_type_filter_limits_results(client, db_path) -> None:
    with tx(str(db_path)) as conn:
        conn.execute(
            "INSERT INTO tasks (id, title) VALUES ('search_task_only', 'Needle task only')"
        )
        conn.execute(
            "INSERT INTO journal_entries (id, markdown_body, emoji, entry_date, tags_json) VALUES ('search_journal_only', 'Needle journal only', NULL, '2026-03-26', '[]')"
        )

    response = client.get("/api/v2/search", params={"q": "Needle", "types": "tasks"})

    assert response.status_code == 200
    assert all(result["type"] == "task" for result in response.json()["results"])
