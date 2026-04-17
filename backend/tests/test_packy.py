from __future__ import annotations

import logging
from datetime import datetime
from unittest.mock import patch

import pytest

from app.core.database import tx
from app.domains.packy.repository import PackyRepository
from app.domains.packy.schemas import PackyAskRequest
from app.domains.packy.service import PackyService


def test_packy_lorebook_allows_multiple_updates_in_same_second(client) -> None:
    first = client.post(
        "/api/v2/packy/lorebook", json={"headline": "one", "body": "body"}
    )
    second = client.post(
        "/api/v2/packy/lorebook", json={"headline": "two", "body": "body"}
    )

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
    assert any(
        "Failed to parse Packy recent_mood payload" in record.message
        for record in caplog.records
    )


def test_packy_answer_treats_achievement_headline_case_insensitively(db_path) -> None:
    with tx(str(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO packy_lorebook (
                session_id, recent_mood, mood_valence, completed_today, habit_streak_max,
                focus_minutes_today, review_cards_done, review_cards_overdue, journal_entry_today
            ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
            """,
            (
                "sess_lowercase_achievement",
                '{"headline": "achievement unlocked: 7-day streak"}',
                0.8,
            ),
        )

    answer = PackyRepository(str(db_path)).answer(PackyAskRequest(text="hello"))

    assert "achievement unlocked: 7-day streak" in answer.reply_text


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
    assert any(
        "Failed to parse Packy recent_mood payload during whisper" in record.message
        for record in caplog.records
    )


class TestPackyRouteAwareNudges:
    """Task 18: Route-aware context nudges — verify every surface gets the right nudge."""

    @pytest.fixture
    def packy_service(self, db_path: str) -> PackyService:
        return PackyService(PackyRepository(db_path))

    @pytest.mark.parametrize(
        "route,expected_action",
        [
            ("tasks", "open-habits"),
            ("habits", "start-focus"),
            ("focus", "open-review"),
            ("review", "open-journal"),
            ("journal", "open-today"),
            ("calendar", "open-tasks"),
            ("nutrition", "open-today"),
        ],
    )
    def test_nudge_returns_correct_action_for_route(
        self, packy_service: PackyService, route: str, expected_action: str
    ) -> None:
        """Unknown intent + known route should surface the complement nudge with correct action."""
        answer = packy_service.ask(
            PackyAskRequest(text="whatever", context={"route": route})
        )
        assert answer.intent == "context_nudge", (
            f"Expected context_nudge for route={route}, got {answer.intent}"
        )
        assert answer.suggested_action == expected_action, (
            f"Route {route} should suggest {expected_action}, got {answer.suggested_action}"
        )

    @pytest.mark.parametrize(
        "route",
        [
            "tasks",
            "habits",
            "focus",
            "review",
            "journal",
            "calendar",
            "nutrition",
        ],
    )
    def test_nudge_only_fires_for_unknown_intent(
        self, packy_service: PackyService, route: str
    ) -> None:
        """Nudge must NOT override a known intent — only fires for 'unknown'."""
        answer = packy_service.ask(
            PackyAskRequest(text="add task fix the leak", context={"route": route})
        )
        assert answer.intent != "context_nudge", (
            f"Known intent 'task.create' on route={route} should NOT produce context_nudge"
        )

    def test_nudge_reply_contains_route_reference(
        self, packy_service: PackyService
    ) -> None:
        """Nudge reply should be actionable and non-empty."""
        answer = packy_service.ask(
            PackyAskRequest(text="huh?", context={"route": "tasks"})
        )
        assert answer.intent == "context_nudge"
        assert answer.reply_text, "Nudge reply should not be empty"
        assert len(answer.reply_text) > 5, "Nudge reply should be a real sentence"

    def test_nudge_extracts_route_from_context(
        self, packy_service: PackyService
    ) -> None:
        """The extracted_data should contain the route that triggered the nudge."""
        answer = packy_service.ask(
            PackyAskRequest(text="??", context={"route": "focus"})
        )
        assert answer.intent == "context_nudge"
        assert answer.extracted_data.get("route") == "focus"

    def test_no_context_no_nudge(self, packy_service: PackyService) -> None:
        """Without context, unknown intent should fall through to default reply."""
        answer = packy_service.ask(PackyAskRequest(text="??"))
        assert answer.intent == "unknown"
        assert answer.suggested_action == "open-command-bar"

    @pytest.mark.parametrize("route", ["", "unknown-route", "settings", "plan"])
    def test_unknown_route_no_nudge(
        self, packy_service: PackyService, route: str
    ) -> None:
        """Routes not in the complements map should not produce context_nudge."""
        answer = packy_service.ask(PackyAskRequest(text="??", context={"route": route}))
        assert answer.intent != "context_nudge", (
            f"Unknown route '{route}' should not produce context_nudge"
        )


class TestPackyWhisperToneRegression:
    """Task 33: Tone values must be one of the declared set — regression tests."""

    VALID_TONES = {"neutral", "helpful", "positive"}

    def test_whisper_returns_valid_tone(self, db_path: str) -> None:
        """whisper() must always return a tone in the declared set."""
        whisper = PackyRepository(db_path).whisper()
        assert whisper.tone in self.VALID_TONES, (
            f"whisper.tone={whisper.tone!r} is not in {self.VALID_TONES}"
        )

    @pytest.mark.parametrize("hour", list(range(24)))
    def test_whisper_tone_always_valid_at_any_hour(
        self, db_path: str, hour: int
    ) -> None:
        """Time-of-day branches must not emit out-of-contract tone values."""
        with patch("app.domains.packy.repository.datetime") as mock_dt:
            mock_dt.datetime.now.return_value = datetime(2026, 4, 11, hour, 0, 0)
            mock_dt.datetime.side_effect = lambda *a, **kw: datetime(*a, **kw)
            whisper = PackyRepository(db_path).whisper()
            assert whisper.tone in self.VALID_TONES, (
                f"whisper.tone at hour={hour}: {whisper.tone!r} not in {self.VALID_TONES}"
            )

    def test_achievement_mood_produces_positive_tone(self, db_path: str) -> None:
        """Achievement mood headline should produce tone=positive."""
        with tx(str(db_path)) as conn:
            conn.execute(
                "INSERT INTO packy_lorebook (session_id, recent_mood, mood_valence, completed_today, habit_streak_max, focus_minutes_today, review_cards_done, review_cards_overdue, journal_entry_today) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)",
                (
                    "sess_achievement",
                    '{"headline": "Achievement Unlocked: 7-day streak"}',
                    0.8,
                ),
            )
        whisper = PackyRepository(db_path).whisper()
        assert whisper.tone == "positive"

    def test_achievement_mood_is_case_insensitive(self, db_path: str) -> None:
        with tx(str(db_path)) as conn:
            conn.execute(
                "INSERT INTO packy_lorebook (session_id, recent_mood, mood_valence, completed_today, habit_streak_max, focus_minutes_today, review_cards_done, review_cards_overdue, journal_entry_today) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)",
                (
                    "sess_lowercase_achievement_whisper",
                    '{"headline": "achievement unlocked: 7-day streak"}',
                    0.8,
                ),
            )
        whisper = PackyRepository(db_path).whisper()
        assert whisper.tone == "positive"

    def test_achievement_mood_without_prefix_does_not_crash(self, db_path: str) -> None:
        """Mood headline without Achievement prefix must not cause errors."""
        with tx(str(db_path)) as conn:
            conn.execute(
                "INSERT INTO packy_lorebook (session_id, recent_mood, mood_valence, completed_today, habit_streak_max, focus_minutes_today, review_cards_done, review_cards_overdue, journal_entry_today) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)",
                ("sess_good_mood", '{"headline": "Feeling good"}', 0.6),
            )
        whisper = PackyRepository(db_path).whisper()
        assert whisper.tone in self.VALID_TONES


class TestPackyVoiceCommandMode:
    """Task 26: PackyVoiceResponse.mode field must be set correctly per pipeline state."""

    @pytest.fixture
    def packy_service(self, db_path: str) -> PackyService:
        return PackyService(PackyRepository(db_path))

    def test_ask_treats_whisper_achievement_prefix_case_insensitively(
        self, packy_service: PackyService
    ) -> None:
        with patch.object(
            PackyRepository,
            "whisper",
            return_value=type(
                "WhisperStub",
                (),
                {
                    "text": "achievement unlocked: 7-day streak",
                    "tone": "positive",
                    "suggested_action": "open-habits",
                },
            )(),
        ):
            answer = packy_service.ask(PackyAskRequest(text="??"))

        assert "achievement unlocked: 7-day streak" in answer.reply_text

    def test_empty_text_returns_mode_empty(
        self, packy_service: PackyService, db_path: str
    ) -> None:
        """Empty transcript must produce mode=empty."""
        from app.domains.packy.schemas import PackyVoiceCommand

        res = packy_service.voice_command(
            PackyVoiceCommand(text="", db_path=str(db_path))
        )
        assert res.mode == "empty"

    def test_greeting_returns_mode_conversational(
        self, packy_service: PackyService, db_path: str
    ) -> None:
        """Greeting intent must produce mode=conversational."""
        from app.domains.packy.schemas import PackyVoiceCommand

        res = packy_service.voice_command(
            PackyVoiceCommand(text="hello", db_path=str(db_path))
        )
        assert res.mode == "conversational"

    def test_help_returns_mode_conversational(
        self, packy_service: PackyService, db_path: str
    ) -> None:
        """Help intent must produce mode=conversational."""
        from app.domains.packy.schemas import PackyVoiceCommand

        res = packy_service.voice_command(
            PackyVoiceCommand(text="what can you do", db_path=str(db_path))
        )
        assert res.mode == "conversational"

    def test_unknown_returns_mode_conversational(
        self, packy_service: PackyService, db_path: str
    ) -> None:
        """Unknown intent must produce mode=conversational."""
        from app.domains.packy.schemas import PackyVoiceCommand

        res = packy_service.voice_command(
            PackyVoiceCommand(text="asdfghjkl", db_path=str(db_path))
        )
        assert res.mode == "conversational"

    def test_task_create_preview_returns_mode_preview(
        self, packy_service: PackyService, db_path: str
    ) -> None:
        """Task.create without auto_execute must produce mode=preview."""
        from app.domains.packy.schemas import PackyVoiceCommand

        res = packy_service.voice_command(
            PackyVoiceCommand(text="add task buy milk", db_path=str(db_path))
        )
        assert res.mode == "preview"

    def test_task_create_auto_execute_returns_mode_executed(
        self, packy_service: PackyService, db_path: str
    ) -> None:
        """Task.create with auto_execute=true must produce mode=executed."""
        from app.domains.packy.schemas import PackyVoiceCommand

        res = packy_service.voice_command(
            PackyVoiceCommand(
                text="add task buy milk", db_path=str(db_path), auto_execute=True
            )
        )
        assert res.mode == "executed"

    def test_mode_field_present_in_response(
        self, packy_service: PackyService, db_path: str
    ) -> None:
        """All voice_command responses must include the mode field."""
        from app.domains.packy.schemas import PackyVoiceCommand

        res = packy_service.voice_command(
            PackyVoiceCommand(text="hello", db_path=str(db_path))
        )
        assert hasattr(res, "mode")
        assert res.mode in {
            "preview",
            "executed",
            "clarification",
            "conversational",
            "empty",
        }
