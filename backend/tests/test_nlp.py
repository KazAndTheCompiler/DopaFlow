"""Tests for the unified NLP engine."""

from __future__ import annotations

import logging

import pytest

from app.services.nlp import classify, fuzzy_task_match


class TestClassifyTaskCreate:
    """task.create intent detection — no prefix required."""

    def test_explicit_add_task(self) -> None:
        result = classify("add task buy milk tomorrow")
        assert result.intent == "task.create"
        assert result.confidence > 0.5

    def test_natural_language_no_prefix(self) -> None:
        result = classify("buy milk tomorrow")
        # Should still detect task.create via quick_add context words
        # Or at minimum not be "unknown" with high confidence
        # This is the key test — no prefix required
        assert result.intent == "task.create"

    def test_todo_keyword(self) -> None:
        result = classify("todo fix the bug by friday")
        assert result.entities.get("title") is not None

    def test_remind_me(self) -> None:
        result = classify("remind me to call mom tomorrow at 3pm")
        assert result.intent == "task.create"

    def test_i_need_to(self) -> None:
        result = classify("i need to finish the report")
        assert result.intent == "task.create"

    def test_follow_ups_present(self) -> None:
        result = classify("add task buy groceries")
        assert len(result.follow_ups) > 0

    def test_tts_response_present(self) -> None:
        result = classify("add task buy groceries")
        assert result.tts_response != ""

    def test_quick_add_fallback_logs_parser_failure(self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
        from app.services import quick_add

        def explode_parse(text: str):
            raise RuntimeError("parser unavailable")

        monkeypatch.setattr(quick_add, "parse", explode_parse)
        caplog.set_level(logging.ERROR, logger="app.services.nlp")

        result = classify("buy milk tomorrow")

        assert result.intent == "unknown"
        assert any("Quick-add fallback parsing failed" in record.message for record in caplog.records)


class TestClassifyTaskComplete:
    """task.complete intent detection."""

    def test_done_with(self) -> None:
        result = classify("done with buy milk")
        assert result.intent == "task.complete"

    def test_complete_task(self) -> None:
        result = classify("complete task finish report")
        assert result.intent == "task.complete"

    def test_mark_done(self) -> None:
        result = classify("mark done the grocery run")
        assert result.intent == "task.complete"


class TestClassifyJournal:
    """journal.create intent detection."""

    def test_write_journal(self) -> None:
        result = classify("journal today was a good day")
        assert result.intent == "journal.create"

    def test_log_entry(self) -> None:
        result = classify("log journal felt productive after morning walk")
        assert result.intent == "journal.create"

    def test_i_feel(self) -> None:
        result = classify("i feel great after the workout")
        # This has lower confidence but should still be detected
        assert result.intent == "journal.create"


class TestClassifyCalendar:
    """calendar.create intent detection."""

    def test_schedule_event(self) -> None:
        result = classify("schedule dentist tomorrow at 2pm for 45 minutes")
        assert result.intent == "calendar.create"
        assert result.entities.get("title") is not None
        assert result.entities.get("start_at") is not None

    def test_meeting(self) -> None:
        result = classify("meeting with Alex on Tuesday at 10am")
        assert result.intent == "calendar.create"

    def test_put_on_calendar(self) -> None:
        result = classify("put it on my calendar tomorrow at 3pm")
        assert result.intent == "calendar.create"

    def test_incomplete_without_time(self) -> None:
        result = classify("schedule dentist tomorrow")
        assert result.intent == "calendar.create"
        # Should not have start_at without a specific time
        assert result.entities.get("start_at") is None

    def test_24h_time_calendar(self) -> None:
        """Voice command with 24-hour time should produce valid start_at/end_at."""
        result = classify("calendar dentist tomorrow at 14:00 for 45 minutes")
        assert result.intent == "calendar.create"
        assert result.entities.get("start_at") is not None
        assert result.entities.get("end_at") is not None
        assert "14:00" in result.entities["start_at"]
        assert "14:45" in result.entities["end_at"]

    def test_late_night_event_does_not_overflow_midnight(self) -> None:
        """A 90-minute event at 23:00 must produce an end_at on the next day, not '24:30'."""
        result = classify("calendar late call tomorrow at 23:00 for 90 minutes")
        assert result.intent == "calendar.create"
        end_at = result.entities.get("end_at")
        assert end_at is not None
        # Must be parseable as a valid datetime
        from datetime import datetime
        parsed = datetime.fromisoformat(end_at.replace("Z", "+00:00"))
        assert parsed.hour == 0
        assert parsed.minute == 30


class TestClassifyFocus:
    """focus.start intent detection."""

    def test_start_focus(self) -> None:
        result = classify("start focus for 25 minutes")
        assert result.intent == "focus.start"
        assert result.entities.get("duration_minutes") == 25

    def test_pomodoro(self) -> None:
        result = classify("pomodoro")
        assert result.intent == "focus.start"

    def test_lets_work(self) -> None:
        result = classify("let's work")
        assert result.intent == "focus.start"

    def test_default_duration(self) -> None:
        result = classify("start focus")
        assert result.entities.get("duration_minutes") == 25

    def test_custom_duration(self) -> None:
        result = classify("focus for 45 minutes")
        assert result.entities.get("duration_minutes") == 45

    def test_lock_in(self) -> None:
        result = classify("lock in")
        assert result.intent == "focus.start"


class TestClassifyAlarm:
    """alarm.create intent detection."""

    def test_set_alarm(self) -> None:
        result = classify("set alarm at 8am")
        assert result.intent == "alarm.create"
        assert result.entities.get("alarm_time") == "08:00"

    def test_wake_me(self) -> None:
        result = classify("wake me up at 7:30")
        assert result.intent == "alarm.create"
        assert result.entities.get("alarm_time") == "07:30"


class TestClassifyHabit:
    """habit.checkin / habit.list intent detection."""

    def test_check_in_habit(self) -> None:
        result = classify("check in hydration")
        assert result.intent == "habit.checkin"

    def test_log_habit(self) -> None:
        result = classify("log habit exercise")
        assert result.intent == "habit.checkin"

    def test_show_habits(self) -> None:
        result = classify("show my habits")
        assert result.intent == "habit.list"

    def test_list_habits(self) -> None:
        result = classify("list habits")
        assert result.intent == "habit.list"


class TestClassifyMeta:
    """greeting / help / undo intent detection."""

    def test_greeting(self) -> None:
        result = classify("hello")
        assert result.intent == "greeting"
        assert result.tts_response != ""

    def test_good_morning(self) -> None:
        result = classify("good morning")
        assert result.intent == "greeting"

    def test_help(self) -> None:
        result = classify("help")
        assert result.intent == "help"

    def test_what_can_you_do(self) -> None:
        result = classify("what can you do")
        assert result.intent == "help"

    def test_undo(self) -> None:
        result = classify("undo that")
        assert result.intent == "undo"

    def test_take_back(self) -> None:
        result = classify("take that back")
        assert result.intent == "undo"


class TestClassifyUnknown:
    """Unknown / gibberish input."""

    def test_empty(self) -> None:
        result = classify("")
        assert result.intent == "unknown"
        assert result.confidence == 0.0

    def test_whitespace(self) -> None:
        result = classify("   ")
        assert result.intent == "unknown"

    def test_gibberish(self) -> None:
        result = classify("asdfghjkl qwerty")
        # Should return unknown with low confidence
        assert result.confidence < 0.5


class TestFuzzyTaskMatch:
    """Fuzzy task matching by word overlap."""

    def _make_tasks(self, titles: list[str]) -> list[dict[str, object]]:
        return [{"id": f"t{i}", "title": t} for i, t in enumerate(titles)]

    def test_exact_match(self) -> None:
        tasks = self._make_tasks(["buy milk", "call mom", "fix bug"])
        result = fuzzy_task_match("buy milk", tasks)
        assert len(result) == 1
        assert result[0]["title"] == "buy milk"

    def test_partial_match(self) -> None:
        tasks = self._make_tasks(["buy milk from store", "call mom", "fix the milk bug"])
        result = fuzzy_task_match("milk", tasks)
        assert len(result) >= 1
        titles = [t["title"] for t in result]
        assert "buy milk from store" in titles

    def test_no_match(self) -> None:
        tasks = self._make_tasks(["buy milk", "call mom"])
        result = fuzzy_task_match("xyz", tasks, min_score=0.5)
        assert len(result) == 0

    def test_containment_boosts_score(self) -> None:
        tasks = self._make_tasks(["finish the quarterly report", "buy groceries"])
        result = fuzzy_task_match("report", tasks)
        assert len(result) == 1
        assert result[0]["title"] == "finish the quarterly report"

    def test_empty_query(self) -> None:
        tasks = self._make_tasks(["buy milk"])
        result = fuzzy_task_match("", tasks)
        assert len(result) == 0


class TestClassifyPrecision:
    """Edge cases that could false-positive on destructive intents."""

    def test_i_feel_creates_journal_not_task(self) -> None:
        """'I felt good' should be journal, not task.create or task.complete."""
        result = classify("I felt really good after the run")
        assert result.intent == "journal.create"

    def test_dont_forget_creates_task(self) -> None:
        result = classify("don't forget to call mom")
        assert result.intent == "task.create"

    def test_meeting_keyword_creates_calendar(self) -> None:
        """The word 'meeting' should prefer calendar over other intents."""
        result = classify("set up a meeting with Sarah")
        assert result.intent == "calendar.create"

    def test_greeting_does_not_match_task(self) -> None:
        result = classify("good morning")
        assert result.intent == "greeting"

    def test_help_does_not_match_task(self) -> None:
        result = classify("help me")
        assert result.intent == "help"

    def test_search_does_not_match_task(self) -> None:
        result = classify("find my notes on sleep")
        assert result.intent == "search"

    def test_brain_dump_creates_journal(self) -> None:
        result = classify("brain dump: things I need to remember")
        assert result.intent == "journal.create"

    def test_lets_go_does_not_start_focus(self) -> None:
        """Casual 'let's go' without context should not start focus."""
        result = classify("let's go to the store")
        assert result.intent != "focus.start"

    def test_check_off_completes_task(self) -> None:
        result = classify("check it off")
        assert result.intent == "task.complete"

    def test_show_tasks_lists(self) -> None:
        result = classify("what's on my plate today")
        assert result.intent == "task.list"

    def test_recurrence_pattern_in_task(self) -> None:
        result = classify("add task water plants every monday")
        assert result.intent == "task.create"
        assert result.entities.get("recurrence_rule") is not None
