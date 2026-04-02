"""Parse and execute command text with full date/priority extraction."""

from __future__ import annotations

import calendar
import re
from datetime import UTC, datetime, timedelta

from app.domains.commands.repository import CommandRepository

TASK_PREFIX_RE = re.compile(
    r"^\s*(?:add task|create task|new task|todo|to do|i need to|add to list|remind me)\s+",
    re.IGNORECASE,
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


def parse_intent(text: str) -> dict[str, object]:
    """Parse command text into intent + extracted fields."""
    text_lower = text.lower().strip()

    if any(
        phrase in text_lower
        for phrase in ["add task", "create task", "new task", "todo", "to do", "remind me", "i need to", "add to list"]
    ):
        source = TASK_PREFIX_RE.sub("", text).strip() or text.strip()
        due_at, source = _extract_due_date(source)
        priority, source = _extract_priority(source)
        title = _clean_task_title(source)
        return {
            "intent": "task.create",
            "confidence": 0.95,
            "extracted": {"title": title, "due_at": due_at, "priority": priority},
        }

    if any(phrase in text_lower for phrase in ["complete task", "done task", "mark done", "finish task"]):
        query = re.sub(
            r"\b(?:complete task|done task|mark done|finish task)\b", "", text, flags=re.IGNORECASE
        ).strip()
        return {"intent": "task.complete", "confidence": 0.9, "extracted": {"title": query}}

    if any(phrase in text_lower for phrase in ["focus", "pomodoro", "timer", "start focus"]):
        match = re.search(r"\b(\d+)\s*(?:min(?:utes?)?|m)\b", text_lower)
        duration = int(match.group(1)) if match else 25
        return {"intent": "focus.start", "confidence": 0.9, "extracted": {"duration_minutes": duration}}

    if any(phrase in text_lower for phrase in ["set alarm", "create alarm", "new alarm", "alarm at"]):
        match = re.search(r"\b(\d{1,2}:\d{2}(?:\s*[ap]m)?)\b", text_lower)
        alarm_time = match.group(1) if match else None
        return {"intent": "alarm.create", "confidence": 0.88, "extracted": {"alarm_time": alarm_time, "title": text}}

    if any(phrase in text_lower for phrase in ["list habits", "show habits", "my habits", "habits"]):
        return {"intent": "habit.list", "confidence": 0.95, "extracted": {}}

    return {"intent": "unknown", "confidence": 0.0, "extracted": {}}


class CommandService:
    @staticmethod
    def parse(text: str) -> dict[str, object]:
        return parse_intent(text)

    @staticmethod
    def preview(text: str) -> dict[str, object]:
        parsed = parse_intent(text)
        return {"mode": "dry-run", "parsed": parsed, "would_execute": parsed["intent"] != "unknown"}

    @staticmethod
    def execute(db_path: str, text: str, confirm: bool = False) -> dict[str, object]:
        """Execute parsed command and log result."""
        from app.core.database import run_migrations

        run_migrations(db_path)
        parsed = parse_intent(text)
        intent = str(parsed["intent"])
        extracted = dict(parsed.get("extracted") or {})

        if intent == "unknown":
            CommandRepository.add_log(db_path, text, intent, "error")
            return {"text": text, "intent": intent, "status": "error", "parsed": parsed}

        try:
            if intent == "task.create":
                from app.domains.tasks import repository as task_repo

                task_payload = {
                    "title": extracted.get("title") or text,
                    "due_at": extracted.get("due_at"),
                    "priority": int(extracted.get("priority") or 2),
                }
                result = task_repo.create_task(db_path, task_payload)
                CommandRepository.add_log(db_path, text, intent, "executed")
                return {"text": text, "intent": intent, "status": "executed", "result": result, "confidence": parsed["confidence"], "parsed": parsed}

            if intent == "task.complete":
                from app.domains.tasks import repository as task_repo

                query = (extracted.get("title") or "").strip().lower()
                open_tasks = [
                    t for t in task_repo.list_tasks(db_path, done=False)
                    if query and query in (t.get("title") or "").lower()
                ]
                if len(open_tasks) > 1:
                    return {"text": text, "intent": intent, "status": "ambiguous", "options": open_tasks[:5], "confidence": parsed["confidence"]}
                if len(open_tasks) == 1:
                    result = task_repo.complete_task(db_path, open_tasks[0]["id"])
                    CommandRepository.add_log(db_path, text, intent, "executed")
                    return {"text": text, "intent": intent, "status": "executed", "result": result, "confidence": parsed["confidence"], "parsed": parsed}
                CommandRepository.add_log(db_path, text, intent, "error")
                return {"text": text, "intent": intent, "status": "not_found", "confidence": parsed["confidence"]}

            if intent == "focus.start":
                from app.domains.focus import service as focus_svc

                result = focus_svc.start(int(extracted.get("duration_minutes") or 25), db_path)
                CommandRepository.add_log(db_path, text, intent, "executed")
                return {"text": text, "intent": intent, "status": "executed", "result": result, "confidence": parsed["confidence"], "parsed": parsed}

            if intent == "alarm.create":
                from app.domains.alarms import repository as alarm_repo

                alarm_time = extracted.get("alarm_time")
                if alarm_time:
                    result = alarm_repo.create_alarm(db_path, {"time": alarm_time, "title": extracted.get("title") or text, "kind": "alarm"})
                    CommandRepository.add_log(db_path, text, intent, "executed")
                    return {"text": text, "intent": intent, "status": "executed", "result": result, "confidence": parsed["confidence"], "parsed": parsed}
                CommandRepository.add_log(db_path, text, intent, "error")
                return {"text": text, "intent": intent, "status": "error", "error": "No alarm time found"}

            if intent == "habit.list":
                from app.domains.habits import repository as habit_repo

                habits = habit_repo.list_habits(db_path)
                CommandRepository.add_log(db_path, text, intent, "executed")
                return {"text": text, "intent": intent, "status": "executed", "result": {"habits": habits}, "confidence": parsed["confidence"], "parsed": parsed}

        except Exception as exc:  # noqa: BLE001
            CommandRepository.add_log(db_path, text, intent, "failed", str(exc))
            return {"text": text, "intent": intent, "status": "error", "error": str(exc)}

        CommandRepository.add_log(db_path, text, intent, "ok")
        return {"text": text, "intent": intent, "status": "executed", "confidence": parsed["confidence"], "parsed": parsed}
