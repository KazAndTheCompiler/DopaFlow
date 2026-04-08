"""
Parse and execute command text with full date/priority extraction.

Uses the unified NLP engine for intent classification.  No prefix required.
Supports fuzzy task matching, undo, and follow-up suggestions.
"""

from __future__ import annotations

import calendar
import re
from datetime import UTC, datetime, timedelta

from app.domains.commands.repository import CommandRepository
from app.services import quick_add, nlp

# ---------------------------------------------------------------------------
# Legacy alias detection (backward compat)
# ---------------------------------------------------------------------------

COMMAND_WORD_ALIASES: tuple[tuple[str, str], ...] = (
    ("add task", "task"),
    ("todo", "task"),
    ("task", "task"),
    ("journal entry", "journal"),
    ("log journal", "journal"),
    ("journal", "journal"),
    ("schedule", "calendar"),
    ("event", "calendar"),
    ("calendar", "calendar"),
)

WEEKDAY_TO_INDEX = {name: index for index, name in enumerate(calendar.day_name)}

TASK_PRIORITY_PATTERNS: list[tuple[re.Pattern[str], int]] = [
    (re.compile(r"\b(?:high priority|urgent|critical|high)\b", re.IGNORECASE), 1),
    (re.compile(r"\b(?:low priority|low)\b", re.IGNORECASE), 3),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clean_task_title(text: str) -> str:
    cleaned = re.sub(r"\bby\b\s*$", " ", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-")
    return cleaned or "Untitled task"


def _upcoming_weekday(base: datetime, weekday_name: str, *, next_week: bool) -> datetime:
    target = WEEKDAY_TO_INDEX[weekday_name.capitalize()]
    delta = (target - base.weekday()) % 7
    if delta == 0 or next_week:
        delta = delta or 7
    return base + timedelta(days=delta)


def _extract_due_date(text: str) -> tuple[str | None, str]:
    now = datetime.now(UTC)
    lowered = text.lower()
    if "by tomorrow" in lowered:
        due = (now + timedelta(days=1)).date().isoformat()
        return due, re.sub(r"\bby\s+tomorrow\b", " ", text, flags=re.IGNORECASE)
    if "by today" in lowered:
        due = now.date().isoformat()
        return due, re.sub(r"\bby\s+today\b", " ", text, flags=re.IGNORECASE)

    match = re.search(
        r"\bby\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        due = _upcoming_weekday(now, match.group(1), next_week=True).date().isoformat()
        return due, text[: match.start()] + " " + text[match.end() :]

    match = re.search(
        r"\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        due = _upcoming_weekday(now, match.group(1), next_week=False).date().isoformat()
        return due, text[: match.start()] + " " + text[match.end() :]

    match = re.search(r"\bby\s+(\d{4}-\d{2}-\d{2})\b", text, flags=re.IGNORECASE)
    if match:
        try:
            due = datetime.strptime(match.group(1), "%Y-%m-%d").date().isoformat()
            return due, text[: match.start()] + " " + text[match.end() :]
        except ValueError:
            pass

    match = re.search(r"\bby\s+(\d{1,2}/\d{1,2}/\d{4})\b", text, flags=re.IGNORECASE)
    if match:
        try:
            due = datetime.strptime(match.group(1), "%d/%m/%Y").date().isoformat()
            return due, text[: match.start()] + " " + text[match.end() :]
        except ValueError:
            pass

    return None, text


def _extract_priority(text: str) -> tuple[int, str]:
    for pattern, priority in TASK_PRIORITY_PATTERNS:
        match = pattern.search(text)
        if match:
            cleaned = text[: match.start()] + " " + text[match.end() :]
            return priority, cleaned
    return 2, text


def _strip_command_word(text: str, prefixes: tuple[str, ...]) -> str:
    for prefix in prefixes:
        if text.lower().strip() == prefix:
            return ""
        if text.lower().strip().startswith(f"{prefix} "):
            return text.strip()[len(prefix) :].strip()
    return text.strip()


def _extract_calendar_datetimes(text: str) -> tuple[str | None, str | None, str]:
    now = datetime.now(UTC)
    lowered = text.lower()
    start_dt: datetime | None = None
    end_dt: datetime | None = None

    date_match = re.search(r"\b(today|tomorrow)\b", lowered)
    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", lowered)
    duration_match = re.search(r"\bfor\s+(\d+)\s*(minutes?|hours?|mins?|hrs?)\b", lowered)

    if date_match:
        base = now.date() if date_match.group(1) == "today" else (now + timedelta(days=1)).date()
    else:
        base = None

    if base and time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or 0)
        meridiem = (time_match.group(3) or "").lower()
        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        start_dt = datetime(base.year, base.month, base.day, hour, minute, tzinfo=UTC)
        if duration_match:
            amount = int(duration_match.group(1))
            unit = duration_match.group(2).lower()
            delta = timedelta(hours=amount) if unit.startswith("hour") or unit.startswith("hr") else timedelta(minutes=amount)
            end_dt = start_dt + delta
        else:
            end_dt = start_dt + timedelta(hours=1)

    cleaned = text
    cleaned = re.sub(r"\b(today|tomorrow)\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bfor\s+\d+\s*(?:minutes?|hours?|mins?|hrs?)\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bat\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-")

    return start_dt.isoformat().replace("+00:00", "Z") if start_dt else None, end_dt.isoformat().replace("+00:00", "Z") if end_dt else None, cleaned


# ---------------------------------------------------------------------------
# Legacy parsers (kept for backward compat with detect_command_word path)
# ---------------------------------------------------------------------------


def _parse_journal_command(text: str) -> dict[str, object]:
    body = _strip_command_word(text, ("journal entry", "log journal", "journal"))
    body = body or "Untitled journal entry"
    today = datetime.now(UTC).date().isoformat()
    return {
        "intent": "journal.create",
        "confidence": 0.95,
        "extracted": {"date": today, "markdown_body": body, "emoji": None, "tags": []},
    }


def _parse_calendar_command(text: str) -> dict[str, object]:
    source = _strip_command_word(text, ("schedule", "calendar", "event"))
    start_at, end_at, title = _extract_calendar_datetimes(source)
    return {
        "intent": "calendar.create",
        "confidence": 0.9 if start_at and end_at and title else 0.55,
        "extracted": {
            "title": title or source or "Untitled event",
            "start_at": start_at,
            "end_at": end_at,
            "all_day": False,
            "description": None,
        },
    }


def _parse_task_command(text: str) -> dict[str, object]:
    source = _strip_command_word(text, ("add task", "todo", "task"))
    parsed = quick_add.parse(source)
    return {
        "intent": "task.create",
        "confidence": 0.95,
        "extracted": {
            "title": parsed.get("title") or source or "Untitled task",
            "due_at": parsed.get("due_at"),
            "priority": int(parsed.get("priority") or 2),
            "tags": parsed.get("tags") or [],
        },
    }


# ---------------------------------------------------------------------------
# Main public API — uses NLP engine
# ---------------------------------------------------------------------------


def detect_command_word(text: str) -> str | None:
    """Legacy: detect explicit command word prefix."""
    lowered = text.lower().strip()
    for prefix, canonical in COMMAND_WORD_ALIASES:
        if lowered == prefix or lowered.startswith(f"{prefix} "):
            return canonical
    return None


def parse_intent(text: str) -> dict[str, object]:
    """
    Parse command text into intent + extracted fields.

    Uses the NLP engine first.  Falls back to legacy prefix detection.
    """
    result = nlp.classify(text)
    extracted = dict(result.entities)

    # Map NLP intents to legacy extracted field names
    if result.intent == "journal.create":
        extracted["markdown_body"] = extracted.get("body", text)
        extracted.setdefault("emoji", None)
        extracted.setdefault("tags", [])

    return {
        "intent": result.intent,
        "confidence": result.confidence,
        "extracted": extracted,
        "follow_ups": result.follow_ups,
        "tts_response": result.tts_response,
    }


# ---------------------------------------------------------------------------
# CommandService class
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Command chaining: "X and Y" → execute both
# ---------------------------------------------------------------------------

ACTIONABLE_INTENTS = frozenset({
    "task.create", "task.complete", "task.list",
    "journal.create", "calendar.create",
    "focus.start", "alarm.create",
    "habit.checkin", "habit.list",
    "review.start", "search", "nutrition.log",
})


def _try_chain_execute(db_path: str, text: str, confirm: bool, source: str) -> dict[str, object] | None:
    """
    Try splitting text on " and " and executing each part separately.
    Returns compound result if 2+ actionable parts found, None otherwise.
    """
    # Don't chain if text is short (avoid false positives like "milk and bread")
    if len(text.split()) < 4:
        return None

    # Split on " and " — keep it case-insensitive
    parts = re.split(r"\s+and\s+", text, flags=re.IGNORECASE)
    if len(parts) < 2:
        return None

    # Classify each part to see if they're separate commands
    classified = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        result = nlp.classify(part)
        if result.intent in ACTIONABLE_INTENTS:
            classified.append((part, result.intent, result))

    # Only chain if 2+ parts have actionable intents
    if len(classified) < 2:
        return None

    # Execute each part sequentially
    results = []
    replies = []
    for part_text, _part_intent, _part_result in classified:
        # Recursively execute each part (without chaining to avoid infinite loop)
        inner = CommandService._execute_single(db_path, part_text, confirm, source)
        results.append(inner)
        if inner.get("reply"):
            replies.append(str(inner["reply"]))

    # Combine replies
    combined_reply = " ".join(replies) if replies else "All done."
    successful = sum(1 for r in results if r.get("status") == "executed")

    return {
        "text": text,
        "intent": "compound",
        "status": "executed" if successful == len(results) else "partial",
        "results": results,
        "reply": combined_reply,
        "follow_ups": ["Anything else?", "Check your tasks?"],
    }


class CommandService:
    @staticmethod
    def detect_command_word(text: str) -> str | None:
        return detect_command_word(text)

    @staticmethod
    def parse(text: str) -> dict[str, object]:
        return parse_intent(text)

    @staticmethod
    def preview(text: str) -> dict[str, object]:
        parsed = parse_intent(text)
        intent = str(parsed["intent"])
        preview: dict[str, object] = {
            "mode": "dry-run",
            "parsed": parsed,
            "would_execute": intent not in ("unknown", "greeting", "help"),
            "status": "ok" if intent not in ("unknown", "greeting", "help") else intent,
            "follow_ups": parsed.get("follow_ups", []),
            "tts_response": parsed.get("tts_response", ""),
        }
        if intent == "unknown":
            preview["message"] = "I didn't catch that. Try something like 'add task buy milk' or 'start focus'."
            return preview
        if intent == "greeting":
            preview["message"] = parsed.get("tts_response", "")
            return preview
        if intent == "help":
            preview["message"] = parsed.get("tts_response", "")
            return preview
        if intent == "calendar.create":
            extracted = dict(parsed.get("extracted") or {})
            if not extracted.get("start_at") or not extracted.get("end_at"):
                preview["would_execute"] = False
                preview["status"] = "needs_datetime"
                preview["message"] = f'I got the event name: "{extracted.get("title", "")}". What date and time?'
                return preview
        return preview

    @staticmethod
    def execute(db_path: str, text: str, confirm: bool = False, *, source: str = "text") -> dict[str, object]:
        """Execute parsed command. Tries chaining first, then single execution."""
        parsed = parse_intent(text)
        intent = str(parsed["intent"])

        # --- non-actionable intents ---
        if intent in ("unknown", "greeting", "help"):
            return {
                "text": text,
                "intent": intent,
                "status": "ok",
                "reply": parsed.get("tts_response", ""),
                "follow_ups": parsed.get("follow_ups", []),
                "confidence": parsed["confidence"],
            }

        # --- command chaining: split "X and Y" into multiple commands ---
        chain_result = _try_chain_execute(db_path, text, confirm, source)
        if chain_result is not None:
            return chain_result

        # --- single command execution ---
        return CommandService._execute_single(db_path, text, confirm, source)

    @staticmethod
    def _execute_single(db_path: str, text: str, confirm: bool, source: str) -> dict[str, object]:
        """Execute a single parsed command (no chaining)."""
        parsed = parse_intent(text)
        intent = str(parsed["intent"])
        extracted = dict(parsed.get("extracted") or {})

        # --- undo ---
        if intent == "undo":
            return CommandService._handle_undo(db_path, text, source)

        try:
            # --- task.create ---
            if intent == "task.create":
                from app.domains.tasks import repository as task_repo

                task_payload: dict[str, object] = {
                    "title": extracted.get("title") or text,
                    "due_at": extracted.get("due_at"),
                    "priority": int(extracted.get("priority") or 2),
                    "tags": extracted.get("tags") or [],
                }
                recurrence_rule = extracted.get("recurrence_rule") or extracted.get("rrule")
                if recurrence_rule:
                    task_payload["recurrence_rule"] = recurrence_rule
                result = task_repo.create_task(db_path, task_payload)
                undo_result = {"id": result["id"], "title": result.get("title", "")}
                CommandRepository.add_log(db_path, text, intent, "executed", source=source, result=undo_result)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": result, "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                    "parsed": parsed,
                }

            # --- task.complete (with fuzzy matching) ---
            if intent == "task.complete":
                from app.domains.tasks import repository as task_repo

                query = (extracted.get("query") or "").strip().lower()
                open_tasks = task_repo.list_tasks(db_path, done=False)

                # Exact substring first
                exact_matches = [t for t in open_tasks if query and query in (t.get("title") or "").lower()]

                if len(exact_matches) == 1:
                    result = task_repo.complete_task(db_path, exact_matches[0]["id"])
                    undo_result = {"id": exact_matches[0]["id"], "title": exact_matches[0].get("title", "")}
                    CommandRepository.add_log(db_path, text, intent, "executed", source=source, result=undo_result)
                    title = exact_matches[0].get("title", "")
                    return {
                        "text": text, "intent": intent, "status": "executed",
                        "result": result, "confidence": parsed["confidence"],
                        "reply": f'Checked off: "{title}".',
                        "follow_ups": parsed.get("follow_ups", []),
                    }

                # Fuzzy fallback
                fuzzy = nlp.fuzzy_task_match(query, open_tasks, min_score=0.35)
                if len(fuzzy) == 1:
                    result = task_repo.complete_task(db_path, fuzzy[0]["id"])
                    undo_result = {"id": fuzzy[0]["id"], "title": fuzzy[0].get("title", "")}
                    CommandRepository.add_log(db_path, text, intent, "executed", source=source, result=undo_result)
                    title = fuzzy[0].get("title", "")
                    return {
                        "text": text, "intent": intent, "status": "executed",
                        "result": result, "confidence": parsed["confidence"],
                        "reply": f'Checked off: "{title}".',
                        "follow_ups": parsed.get("follow_ups", []),
                    }
                if len(fuzzy) > 1:
                    return {
                        "text": text, "intent": intent, "status": "ambiguous",
                        "options": [{"id": t.get("id"), "title": t.get("title")} for t in fuzzy[:5]],
                        "confidence": parsed["confidence"],
                        "reply": f"I found {len(fuzzy)} matching tasks. Which one?",
                    }

                CommandRepository.add_log(db_path, text, intent, "not_found", source=source)
                return {
                    "text": text, "intent": intent, "status": "not_found",
                    "confidence": parsed["confidence"],
                    "reply": "I couldn't find a matching task. Try the exact title?",
                }

            # --- task.list ---
            if intent == "task.list":
                from app.domains.tasks import repository as task_repo

                tasks = task_repo.list_tasks(db_path, done=False)
                CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": {"tasks": tasks[:20], "total": len(tasks)},
                    "confidence": parsed["confidence"],
                    "reply": f'You have {len(tasks)} open task{"s" if len(tasks) != 1 else ""}.',
                    "follow_ups": parsed.get("follow_ups", []),
                }

            # --- journal.create ---
            if intent == "journal.create":
                from app.domains.journal.repository import JournalRepository
                from app.domains.journal.schemas import JournalEntryCreate
                from app.domains.journal.service import JournalService

                payload = JournalEntryCreate(
                    markdown_body=str(extracted.get("markdown_body") or extracted.get("body") or text),
                    date=str(extracted.get("date") or datetime.now(UTC).date().isoformat()),
                    emoji=extracted.get("emoji"),
                    tags=list(extracted.get("tags") or []),
                )
                result = JournalService(JournalRepository(db_path)).save_entry(payload)
                CommandRepository.add_log(db_path, text, intent, "executed", source=source, result=result.model_dump() if hasattr(result, "model_dump") else None)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": result.model_dump(), "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                }

            # --- calendar.create ---
            if intent == "calendar.create":
                from app.domains.calendar.repository import CalendarRepository
                from app.domains.calendar.schemas import CalendarEventCreate
                from app.domains.calendar.service import CalendarService

                if not extracted.get("start_at") or not extracted.get("end_at"):
                    CommandRepository.add_log(db_path, text, intent, "incomplete", "missing_datetime", source=source)
                    return {
                        "text": text, "intent": intent, "status": "needs_datetime",
                        "error": "Missing event date or time",
                        "confidence": parsed["confidence"],
                        "reply": parsed.get("tts_response", ""),
                        "extracted": extracted,
                    }
                payload = CalendarEventCreate(
                    title=str(extracted.get("title") or "Untitled event"),
                    description=extracted.get("description"),
                    start_at=datetime.fromisoformat(str(extracted["start_at"]).replace("Z", "+00:00")),
                    end_at=datetime.fromisoformat(str(extracted["end_at"]).replace("Z", "+00:00")),
                    all_day=bool(extracted.get("all_day") or False),
                )
                result = CalendarService(CalendarRepository(db_path)).create_event(payload)
                event_dict = result.model_dump()
                undo_result = {"id": event_dict.get("id", ""), "title": event_dict.get("title", "")}
                CommandRepository.add_log(db_path, text, intent, "executed", source=source, result=undo_result)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": event_dict, "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                }

            # --- focus.start ---
            if intent == "focus.start":
                from app.domains.focus import service as focus_svc

                result = focus_svc.start(int(extracted.get("duration_minutes") or 25), db_path)
                CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": result, "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                }

            # --- alarm.create ---
            if intent == "alarm.create":
                from app.domains.alarms import repository as alarm_repo

                alarm_time = extracted.get("alarm_time")
                if alarm_time:
                    result = alarm_repo.create_alarm(db_path, {"time": alarm_time, "title": extracted.get("title") or text, "kind": "alarm"})
                    CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                    return {
                        "text": text, "intent": intent, "status": "executed",
                        "result": result, "confidence": parsed["confidence"],
                        "reply": parsed.get("tts_response", ""),
                        "follow_ups": parsed.get("follow_ups", []),
                    }
                CommandRepository.add_log(db_path, text, intent, "error", source=source)
                return {
                    "text": text, "intent": intent, "status": "error",
                    "error": "No alarm time found",
                    "reply": "I need a time. What time should I set the alarm?",
                }

            # --- habit.checkin ---
            if intent == "habit.checkin":
                from app.domains.habits import repository as habit_repo

                habits = habit_repo.list_habits(db_path)
                habit_name = (extracted.get("habit_name") or "").strip().lower()
                matched = [h for h in habits if habit_name in (h.get("name") or "").lower()]
                if len(matched) == 1:
                    result = habit_repo.checkin(db_path, matched[0]["id"])
                    CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                    return {
                        "text": text, "intent": intent, "status": "executed",
                        "result": result, "confidence": parsed["confidence"],
                        "reply": f'Checked in: "{matched[0].get("name", "")}". Nice streak!',
                        "follow_ups": parsed.get("follow_ups", []),
                    }
                if len(matched) > 1:
                    return {
                        "text": text, "intent": intent, "status": "ambiguous",
                        "options": [{"id": h.get("id"), "name": h.get("name")} for h in matched[:5]],
                        "confidence": parsed["confidence"],
                        "reply": f"Found {len(matched)} habits matching that. Which one?",
                    }
                if habits:
                    names = ", ".join(h.get("name", "") for h in habits[:5])
                    return {
                        "text": text, "intent": intent, "status": "not_found",
                        "confidence": parsed["confidence"],
                        "reply": f"Which habit? You have: {names}.",
                    }
                return {
                    "text": text, "intent": intent, "status": "not_found",
                    "confidence": parsed["confidence"],
                    "reply": "No habits yet. Create one first?",
                }

            # --- habit.list ---
            if intent == "habit.list":
                from app.domains.habits import repository as habit_repo

                habits = habit_repo.list_habits(db_path)
                CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": {"habits": habits}, "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                }

            # --- review.start ---
            if intent == "review.start":
                CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": {"action": "open_review"},
                    "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                }

            # --- search ---
            if intent == "search":
                CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": {"query": extracted.get("query", text)},
                    "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                }

            # --- nutrition.log ---
            if intent == "nutrition.log":
                CommandRepository.add_log(db_path, text, intent, "executed", source=source)
                return {
                    "text": text, "intent": intent, "status": "executed",
                    "result": {"action": "log_nutrition", "text": extracted.get("text", text)},
                    "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "follow_ups": parsed.get("follow_ups", []),
                }

        except Exception as exc:  # noqa: BLE001
            CommandRepository.add_log(db_path, text, intent, "failed", str(exc), source=source)
            return {
                "text": text, "intent": intent, "status": "error",
                "error": str(exc), "reply": "Something went wrong. Try again?",
            }

        CommandRepository.add_log(db_path, text, intent, "ok", source=source)
        return {
            "text": text, "intent": intent, "status": "executed",
            "confidence": parsed["confidence"],
            "reply": parsed.get("tts_response", ""),
            "follow_ups": parsed.get("follow_ups", []),
        }

    # -----------------------------------------------------------------------
    # Undo
    # -----------------------------------------------------------------------

    @staticmethod
    def _handle_undo(db_path: str, text: str, source: str) -> dict[str, object]:
        """Undo the last executed command."""
        history = CommandRepository.history(db_path, limit=10)
        # Find last executed (non-undo) command
        for entry in history:
            if entry.get("status") == "executed" and entry.get("intent") != "undo":
                return _undo_entry(db_path, entry, text, source)
        return {
            "text": text, "intent": "undo", "status": "nothing_to_undo",
            "reply": "Nothing to undo.",
        }


def _undo_entry(db_path: str, entry: dict[str, object], text: str, source: str) -> dict[str, object]:
    """Reverse a single command log entry."""
    intent = str(entry.get("intent", ""))
    try:
        if intent == "task.create":
            from app.domains.tasks import repository as task_repo
            result = entry.get("result")
            if isinstance(result, dict) and result.get("id"):
                task_repo.delete_task(db_path, result["id"])
                CommandRepository.add_log(db_path, text, "undo", "executed", source=source)
                return {
                    "text": text, "intent": "undo", "status": "executed",
                    "reply": f'Undone. Removed task: "{result.get("title", "")}".',
                    "undone": entry,
                }
        elif intent == "calendar.create":
            from app.domains.calendar.repository import CalendarRepository
            result = entry.get("result")
            if isinstance(result, dict) and result.get("id"):
                CalendarRepository(db_path).delete_event(result["id"])
                CommandRepository.add_log(db_path, text, "undo", "executed", source=source)
                return {
                    "text": text, "intent": "undo", "status": "executed",
                    "reply": f'Undone. Removed event: "{result.get("title", "")}".',
                    "undone": entry,
                }
        elif intent == "task.complete":
            from app.domains.tasks import repository as task_repo
            result = entry.get("result")
            if isinstance(result, dict) and result.get("id"):
                task_repo.uncomplete_task(db_path, result["id"])
                CommandRepository.add_log(db_path, text, "undo", "executed", source=source)
                return {
                    "text": text, "intent": "undo", "status": "executed",
                    "reply": f'Undone. Reopened task: "{result.get("title", "")}".',
                    "undone": entry,
                }
    except Exception as exc:  # noqa: BLE001
        return {
            "text": text, "intent": "undo", "status": "error",
            "error": str(exc), "reply": "Undo failed. The action may have already been modified.",
        }
    return {
        "text": text, "intent": "undo", "status": "unsupported",
        "reply": f"Can't undo '{intent}' actions yet.",
    }
