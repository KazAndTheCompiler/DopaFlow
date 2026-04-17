"""
Parse and execute command text with full date/priority extraction.

Uses the unified NLP engine for intent classification. No prefix required.
Supports fuzzy task matching, undo, and follow-up suggestions.
"""

from __future__ import annotations

import calendar
import re
from datetime import UTC, datetime, timedelta

from app.domains.commands.execution import detect_actionable_chain, execute_command
from app.domains.commands.repository import CommandRepository
from app.services import nlp, quick_add

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


def _clean_task_title(text: str) -> str:
    cleaned = re.sub(r"\bby\b\s*$", " ", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-")
    return cleaned or "Untitled task"


def _upcoming_weekday(
    base: datetime, weekday_name: str, *, next_week: bool
) -> datetime:
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
        stripped = text.lower().strip()
        if stripped == prefix:
            return ""
        if stripped.startswith(f"{prefix} "):
            return text.strip()[len(prefix) :].strip()
    return text.strip()


def _extract_calendar_datetimes(text: str) -> tuple[str | None, str | None, str]:
    now = datetime.now(UTC)
    lowered = text.lower()
    start_dt: datetime | None = None
    end_dt: datetime | None = None

    date_match = re.search(r"\b(today|tomorrow)\b", lowered)
    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", lowered)
    duration_match = re.search(
        r"\bfor\s+(\d+)\s*(minutes?|hours?|mins?|hrs?)\b", lowered
    )

    if date_match:
        base = (
            now.date()
            if date_match.group(1) == "today"
            else (now + timedelta(days=1)).date()
        )
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
            delta = (
                timedelta(hours=amount)
                if unit.startswith(("hour", "hr"))
                else timedelta(minutes=amount)
            )
            end_dt = start_dt + delta
        else:
            end_dt = start_dt + timedelta(hours=1)

    cleaned = text
    cleaned = re.sub(r"\b(today|tomorrow)\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\bfor\s+\d+\s*(?:minutes?|hours?|mins?|hrs?)\b",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\bat\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b", " ", cleaned, flags=re.IGNORECASE
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-")

    start = start_dt.isoformat().replace("+00:00", "Z") if start_dt else None
    end = end_dt.isoformat().replace("+00:00", "Z") if end_dt else None
    return start, end, cleaned


def _parse_journal_command(text: str) -> dict[str, object]:
    body = (
        _strip_command_word(text, ("journal entry", "log journal", "journal"))
        or "Untitled journal entry"
    )
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


def detect_command_word(text: str) -> str | None:
    """Legacy: detect explicit command word prefix."""
    lowered = text.lower().strip()
    for prefix, canonical in COMMAND_WORD_ALIASES:
        if lowered == prefix or lowered.startswith(f"{prefix} "):
            return canonical
    return None


def parse_intent(text: str) -> dict[str, object]:
    """Parse command text into intent plus extracted fields."""
    result = nlp.classify(text)
    extracted = dict(result.entities)

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


def _preview_task_complete(
    text: str, parsed: dict[str, object], db_path: str
) -> dict[str, object]:
    from app.domains.tasks import repository as task_repo

    query = str((parsed.get("extracted") or {}).get("query") or "").strip().lower()
    open_tasks = task_repo.list_tasks(db_path, done=False)
    open_tasks_dicts = [t.model_dump() for t in open_tasks]
    exact_matches = [
        task for task in open_tasks if query and query in (task.title or "").lower()
    ]

    if len(exact_matches) == 1:
        match = exact_matches[0]
        return {
            "would_execute": True,
            "status": "ok",
            "result": {"id": match.id, "title": match.title},
            "message": f'Will complete: "{match.title}".',
        }

    fuzzy = nlp.fuzzy_task_match(query, open_tasks_dicts, min_score=0.35)
    if len(fuzzy) == 1:
        match = fuzzy[0]
        return {
            "would_execute": True,
            "status": "ok",
            "result": {"id": match.get("id"), "title": match.get("title")},
            "message": f'Will complete: "{match.get("title", "")}".',
        }
    if len(fuzzy) > 1:
        return {
            "would_execute": False,
            "status": "ambiguous",
            "options": [
                {"id": task.get("id"), "title": task.get("title")} for task in fuzzy[:5]
            ],
            "message": f"I found {len(fuzzy)} matching tasks. Which one?",
        }
    return {
        "would_execute": False,
        "status": "not_found",
        "message": "I couldn't find a matching task. Try the exact title?",
    }


def _preview_habit_checkin(
    text: str, parsed: dict[str, object], db_path: str
) -> dict[str, object]:
    from app.domains.habits import repository as habit_repo

    del text
    habit_name = (
        str((parsed.get("extracted") or {}).get("habit_name") or "").strip().lower()
    )
    habits = habit_repo.list_habits(db_path)
    matched = [
        habit for habit in habits if habit_name in (habit.get("name") or "").lower()
    ]

    if len(matched) == 1:
        habit = matched[0]
        return {
            "would_execute": True,
            "status": "ok",
            "result": {"id": habit.get("id"), "name": habit.get("name")},
            "message": f'Will check in: "{habit.get("name", "")}".',
        }
    if len(matched) > 1:
        return {
            "would_execute": False,
            "status": "ambiguous",
            "options": [
                {"id": habit.get("id"), "name": habit.get("name")}
                for habit in matched[:5]
            ],
            "message": f"Found {len(matched)} habits matching that. Which one?",
        }
    if habits:
        names = ", ".join(habit.get("name", "") for habit in habits[:5])
        return {
            "would_execute": False,
            "status": "not_found",
            "message": f"Which habit? You have: {names}.",
        }
    return {
        "would_execute": False,
        "status": "not_found",
        "message": "No habits yet. Create one first?",
    }


def _preview_habit_create(
    text: str, parsed: dict[str, object], db_path: str
) -> dict[str, object]:
    from app.domains.habits import repository as habit_repo

    entities = dict(parsed.get("extracted") or {})
    name = str(entities.get("name") or "").strip()
    if not name:
        name_match = re.search(
            r"(?:add|create|new|start)\s+(?:a\s+)?(?:habit|streak|routine)\s+(?:for|called|named|:)\s+(\w+(?:\s+\w+)?)",
            text,
            re.IGNORECASE,
        )
        name = (
            name_match.group(1).strip()
            if name_match
            else re.sub(
                r"^\b(?:add|create|new|start)\s+(?:a\s+)?(?:habit|streak|routine)\s+(?:for|called|named|:)?\s*",
                "",
                text,
                flags=re.IGNORECASE,
            ).strip()
        )

    if not name:
        return {
            "would_execute": False,
            "status": "needs_name",
            "message": "What should I call the new habit?",
        }

    habits = habit_repo.list_habits(db_path)
    if any(h.get("name", "").lower() == name.lower() for h in habits):
        return {
            "would_execute": False,
            "status": "duplicate",
            "message": f'A habit called "{name}" already exists.',
        }

    return {
        "would_execute": True,
        "status": "ok",
        "result": {"name": name, "target_freq": 1, "target_period": "day"},
        "message": f'Will create habit: "{name}".',
    }


def _preview_undo(db_path: str) -> dict[str, object]:
    supported = {"task.create", "task.complete", "calendar.create"}
    history = CommandRepository.history(db_path, limit=10)

    for entry in history:
        if (
            entry.get("status") != "executed"
            or entry.get("intent") == "undo"
            or entry.get("undone_at")
        ):
            continue
        intent = str(entry.get("intent") or "")
        if intent in supported:
            return {
                "would_execute": True,
                "status": "ok",
                "result": {
                    "intent": intent,
                    "entry_id": entry.get("id"),
                    "target": entry.get("result"),
                },
                "message": f"Will undo the last {intent} action.",
            }
        return {
            "would_execute": False,
            "status": "unsupported",
            "result": {"intent": intent, "entry_id": entry.get("id")},
            "message": f"Can't undo '{intent}' actions yet.",
        }

    return {
        "would_execute": False,
        "status": "nothing_to_undo",
        "message": "Nothing to undo.",
    }


class CommandService:
    @staticmethod
    def detect_command_word(text: str) -> str | None:
        return detect_command_word(text)

    @staticmethod
    def parse(text: str) -> dict[str, object]:
        return parse_intent(text)

    @staticmethod
    def preview(text: str, db_path: str | None = None) -> dict[str, object]:
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
        compound_parts = detect_actionable_chain(text, parser=parse_intent)
        if compound_parts is not None:
            preview["would_execute"] = False
            preview["status"] = "unsupported"
            preview["message"] = (
                "Multiple actions in one command are disabled for now. Say one concrete action at a time."
            )
            preview["parts"] = compound_parts
            return preview
        if intent == "unknown":
            preview["message"] = (
                "I didn't catch that. Try something like 'add task buy milk' or 'start focus'."
            )
            return preview
        if intent in {"greeting", "help"}:
            preview["message"] = parsed.get("tts_response", "")
            return preview
        if intent == "calendar.create":
            extracted = dict(parsed.get("extracted") or {})
            if not extracted.get("start_at") or not extracted.get("end_at"):
                preview["would_execute"] = False
                preview["status"] = "needs_datetime"
                preview["message"] = (
                    f'I got the event name: "{extracted.get("title", "")}". What date and time?'
                )
                return preview
        if db_path and intent == "task.complete":
            preview.update(_preview_task_complete(text, parsed, db_path))
            return preview
        if db_path and intent == "habit.checkin":
            preview.update(_preview_habit_checkin(text, parsed, db_path))
            return preview
        if db_path and intent == "habit.create":
            preview.update(_preview_habit_create(text, parsed, db_path))
            return preview
        if db_path and intent == "undo":
            preview.update(_preview_undo(db_path))
            return preview
        return preview

    @staticmethod
    def execute(
        db_path: str, text: str, confirm: bool = False, *, source: str = "text"
    ) -> dict[str, object]:
        """Execute parsed command text."""
        return execute_command(db_path, text, confirm, source, parser=parse_intent)
