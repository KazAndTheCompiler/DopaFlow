from __future__ import annotations

import logging
import sqlite3
from datetime import date, timedelta
from pathlib import Path

from app.core.config import Settings
from app.core.database import tx
from app.domains.digest.repository import DigestRepository


def _assert_digest_score_bounds(body: dict[str, object]) -> None:
    assert 0 <= body["score"] <= 100
    assert 0 <= body["momentum_score"] <= 100
    assert isinstance(body["momentum_label"], str)
    assert body["momentum_label"].strip()


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
    assert "nutrition" in body
    assert "correlations" in body


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

    repo = DigestRepository(Settings(db_path=str(db_path)))
    today = date.today()
    caplog.set_level(logging.WARNING, logger="app.domains.digest.repository")

    nutrition = repo.nutrition_summary(today, today)
    review = repo.review_daily(today, today)

    assert nutrition["days_logged"] == 0
    assert review == {}
    assert any("Digest nutrition summary unavailable" in record.message for record in caplog.records)
    assert any("Digest review summary unavailable" in record.message for record in caplog.records)


def test_digest_today_endpoint_returns_typed_nested_shapes(client, db_path) -> None:
    today = date.today().isoformat()
    with tx(str(db_path)) as conn:
        conn.execute(
            "INSERT INTO tasks (id, title, done, updated_at, created_at, tags_json) VALUES ('dig_task_2', 'Tagged task', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[\"deep\"]')"
        )
        conn.execute(
            "INSERT INTO journal_entries (id, markdown_body, emoji, entry_date, tags_json) VALUES ('dig_entry_2', 'More digest words here', '🙂', ?, '[\"reflect\"]')",
            (today,),
        )

    response = client.get("/api/v2/digest/today")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["tasks"]["top_tags"], list)
    assert "by_habit" in body["habits"]
    assert "mood_distribution" in body["journal"]
    assert "days_logged" in body["nutrition"]
    assert isinstance(body["correlations"], list)


def test_digest_today_ignores_tasks_created_before_last_7_days(client, db_path) -> None:
    with tx(str(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO tasks (id, title, done, updated_at, created_at)
            VALUES ('dig_old_task', 'Old task', 1, CURRENT_TIMESTAMP, datetime('now', '-30 days'))
            """
        )

    response = client.get("/api/v2/digest/today")

    assert response.status_code == 200
    body = response.json()
    assert body["tasks"]["completed"] == 0
    assert body["tasks"]["created"] == 0
    assert body["momentum_score"] == 0.0


def test_digest_today_score_stays_non_negative_with_zero_tasks(client) -> None:
    response = client.get("/api/v2/digest/today")

    assert response.status_code == 200
    body = response.json()
    _assert_digest_score_bounds(body)
    assert body["score"] >= 0


def test_digest_today_score_caps_at_100_when_all_tasks_are_completed(client, db_path) -> None:
    with tx(str(db_path)) as conn:
        for index in range(5):
            conn.execute(
                """
                INSERT INTO tasks (id, title, done, due_at, updated_at, created_at, tags_json)
                VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]')
                """,
                (
                    f"dig_done_task_{index}",
                    f"Completed task {index}",
                    date.today().isoformat(),
                ),
            )

    response = client.get("/api/v2/digest/today")

    assert response.status_code == 200
    body = response.json()
    _assert_digest_score_bounds(body)
    assert body["score"] <= 100


def test_digest_today_score_stays_bounded_with_mixed_overdue_and_completed_tasks(client, db_path) -> None:
    with tx(str(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO tasks (id, title, done, due_at, updated_at, created_at, tags_json)
            VALUES ('dig_mix_done', 'Completed task', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]')
            """,
            (date.today().isoformat(),),
        )
        conn.execute(
            """
            INSERT INTO tasks (id, title, done, due_at, updated_at, created_at, tags_json)
            VALUES ('dig_mix_overdue', 'Overdue task', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]')
            """,
            (date.today().isoformat(),),
        )

    response = client.get("/api/v2/digest/today")

    assert response.status_code == 200
    body = response.json()
    _assert_digest_score_bounds(body)
    assert body["tasks"]["overdue"] >= 1


def test_digest_week_score_stays_bounded_with_zero_journal_entries(client, db_path) -> None:
    week_start = date.today() - timedelta(days=date.today().weekday())
    with tx(str(db_path)) as conn:
        for index in range(3):
            conn.execute(
                """
                INSERT INTO tasks (id, title, done, due_at, updated_at, created_at, tags_json)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]')
                """,
                (
                    f"dig_week_task_{index}",
                    f"Week task {index}",
                    int(index % 2 == 0),
                    week_start.isoformat(),
                ),
            )

    response = client.get("/api/v2/digest/week", params={"week_start": week_start.isoformat()})

    assert response.status_code == 200
    body = response.json()
    _assert_digest_score_bounds(body)
    assert body["journal"]["entries_written"] == 0
