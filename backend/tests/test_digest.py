from __future__ import annotations

import logging
import sqlite3
from datetime import date
from pathlib import Path

from app.core.database import tx
from app.domains.digest.repository import DigestRepository


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


def test_digest_optional_summaries_log_missing_tables(tmp_path: Path, caplog) -> None:
    db_path = tmp_path / "digest-minimal.sqlite"
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY, done INTEGER, due_at TEXT, created_at TEXT, updated_at TEXT, tags_json TEXT)")
        conn.execute("CREATE TABLE habits (id TEXT PRIMARY KEY, name TEXT, deleted_at TEXT)")
        conn.execute("CREATE TABLE habit_checkins (habit_id TEXT, name TEXT, checkin_date TEXT)")
        conn.execute("CREATE TABLE focus_sessions (started_at TEXT, duration_minutes INTEGER, status TEXT)")
        conn.execute("CREATE TABLE journal_entries (markdown_body TEXT, tags_json TEXT, emoji TEXT, entry_date TEXT, deleted_at TEXT)")
        conn.commit()
    finally:
        conn.close()

    repo = DigestRepository(str(db_path))
    today = date.today()
    caplog.set_level(logging.WARNING, logger="app.domains.digest.repository")

    nutrition = repo.nutrition_summary(today, today)
    review = repo.review_daily(today, today)

    assert nutrition["days_logged"] == 0
    assert review == {}
    assert any("Digest nutrition summary unavailable" in record.message for record in caplog.records)
    assert any("Digest review summary unavailable" in record.message for record in caplog.records)
