from __future__ import annotations

import logging

from app.core.database import tx


def test_packy_lorebook_allows_multiple_updates_in_same_second(client) -> None:
    first = client.post("/api/v2/packy/lorebook", json={"headline": "one", "body": "body"})
    second = client.post("/api/v2/packy/lorebook", json={"headline": "two", "body": "body"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] != second.json()["id"]


def test_packy_answer_logs_invalid_recent_mood_payload(db_path, caplog) -> None:
    from app.domains.packy.repository import PackyRepository
    from app.domains.packy.schemas import PackyAskRequest

    with tx(str(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO packy_lorebook (
                session_id, recent_mood, mood_valence, completed_today, habit_streak_max,
                focus_minutes_today, review_cards_done, review_cards_overdue, journal_entry_today
            ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
            """,
            ("sess_bad_mood", "{not-json", 0.0),
        )

    caplog.set_level(logging.WARNING, logger="app.domains.packy.repository")
    answer = PackyRepository(str(db_path)).answer(PackyAskRequest(text="hello"))

    assert "Packy heard you." in answer.reply_text
    assert any("Failed to parse Packy recent_mood payload" in record.message for record in caplog.records)


def test_packy_whisper_logs_invalid_recent_mood_payload(db_path, caplog) -> None:
    from app.domains.packy.repository import PackyRepository

    with tx(str(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO packy_lorebook (
                session_id, recent_mood, mood_valence, completed_today, habit_streak_max,
                focus_minutes_today, review_cards_done, review_cards_overdue, journal_entry_today
            ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
            """,
            ("sess_bad_mood_whisper", "{not-json", 0.0),
        )

    caplog.set_level(logging.WARNING, logger="app.domains.packy.repository")
    whisper = PackyRepository(str(db_path)).whisper()

    assert whisper.text
    assert any("Failed to parse Packy recent_mood payload during whisper" in record.message for record in caplog.records)
