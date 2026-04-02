from __future__ import annotations

from datetime import date

from app.core.database import tx


def test_digest_today_endpoint_returns_expected_shape(client, db_path) -> None:
    today = date.today().isoformat()
    with tx(str(db_path)) as conn:
        conn.execute("INSERT INTO tasks (id, title, done, updated_at, created_at) VALUES ('dig_task', 'Digest task', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
        conn.execute(
            "INSERT INTO journal_entries (id, markdown_body, emoji, entry_date, tags_json) VALUES ('dig_entry', 'Digest entry', NULL, ?, '[]')",
            (today,),
        )

    response = client.get("/api/v2/digest/today")

    assert response.status_code == 200
    body = response.json()
    assert body["date"] == today
    assert "tasks" in body
    assert "journal" in body
    assert "score" in body


def test_digest_week_endpoint_returns_week_window(client) -> None:
    response = client.get("/api/v2/digest/week")

    assert response.status_code == 200
    body = response.json()
    assert "week_start" in body
    assert "week_end" in body
    assert "tasks" in body
    assert "focus" in body
