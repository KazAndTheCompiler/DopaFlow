"""Execution and undo helpers for command actions."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Callable

from app.domains.commands.repository import CommandRepository
from app.services import nlp

ParsedCommand = dict[str, object]
IntentParser = Callable[[str], ParsedCommand]

NON_ACTIONABLE_INTENTS = frozenset({"unknown", "greeting", "help"})
ACTIONABLE_INTENTS = frozenset(
    {
        "task.create",
        "task.complete",
        "task.list",
        "journal.create",
        "calendar.create",
        "focus.start",
        "alarm.create",
        "habit.checkin",
        "habit.list",
        "review.start",
        "search",
        "nutrition.log",
    }
)


def detect_actionable_chain(
    text: str, *, parser: IntentParser
) -> list[dict[str, str]] | None:
    """Return compound parts when a command appears to ask for multiple actions."""
    if len(text.split()) < 4:
        return None

    parts = re.split(r"\s+and\s+", text, flags=re.IGNORECASE)
    if len(parts) < 2:
        return None

    actionable_parts: list[dict[str, str]] = []
    for part in parts:
        candidate = part.strip()
        if not candidate:
            continue
        intent = str(parser(candidate)["intent"])
        if intent in ACTIONABLE_INTENTS:
            actionable_parts.append({"text": candidate, "intent": intent})

    return actionable_parts if len(actionable_parts) >= 2 else None


def execute_command(
    db_path: str, text: str, confirm: bool, source: str, *, parser: IntentParser
) -> dict[str, object]:
    """Execute parsed command text, including compound command chaining."""
    parsed = parser(text)
    intent = str(parsed["intent"])

    if intent in NON_ACTIONABLE_INTENTS:
        return {
            "text": text,
            "intent": intent,
            "status": "ok",
            "reply": parsed.get("tts_response", ""),
            "follow_ups": parsed.get("follow_ups", []),
            "confidence": parsed["confidence"],
        }

    compound_parts = detect_actionable_chain(text, parser=parser)
    if compound_parts is not None:
        CommandRepository.add_log(
            db_path,
            text,
            "compound",
            "unsupported",
            source=source,
            result={"parts": compound_parts},
        )
        return {
            "text": text,
            "intent": "compound",
            "status": "unsupported",
            "confidence": parsed["confidence"],
            "parts": compound_parts,
            "reply": "I can only run one concrete action at a time right now. Say each action separately.",
            "follow_ups": ["Try the first action only.", "Then say the second action."],
        }

    return execute_single(db_path, text, confirm, source, parser=parser, parsed=parsed)


def execute_single(
    db_path: str,
    text: str,
    confirm: bool,
    source: str,
    *,
    parser: IntentParser,
    parsed: ParsedCommand | None = None,
) -> dict[str, object]:
    """Execute a single parsed command."""
    del confirm
    parsed = parsed or parser(text)
    intent = str(parsed["intent"])
    extracted = dict(parsed.get("extracted") or {})

    if intent == "undo":
        return _handle_undo(db_path, text, source)

    try:
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
            CommandRepository.add_log(
                db_path, text, intent, "executed", source=source, result=undo_result
            )
            return _response(text, intent, parsed, result=result)

        if intent == "task.complete":
            from app.domains.tasks import repository as task_repo

            query = (extracted.get("query") or "").strip().lower()
            open_tasks = task_repo.list_tasks(db_path, done=False)
            exact_matches = [
                task
                for task in open_tasks
                if query and query in (task.get("title") or "").lower()
            ]

            if len(exact_matches) == 1:
                match = exact_matches[0]
                result = task_repo.complete_task(db_path, match["id"])
                undo_result = {"id": match["id"], "title": match.get("title", "")}
                CommandRepository.add_log(
                    db_path, text, intent, "executed", source=source, result=undo_result
                )
                return _response(
                    text,
                    intent,
                    parsed,
                    result=result,
                    reply=f'Checked off: "{match.get("title", "")}".',
                )

            fuzzy = nlp.fuzzy_task_match(query, open_tasks, min_score=0.35)
            if len(fuzzy) == 1:
                match = fuzzy[0]
                result = task_repo.complete_task(db_path, match["id"])
                undo_result = {"id": match["id"], "title": match.get("title", "")}
                CommandRepository.add_log(
                    db_path, text, intent, "executed", source=source, result=undo_result
                )
                return _response(
                    text,
                    intent,
                    parsed,
                    result=result,
                    reply=f'Checked off: "{match.get("title", "")}".',
                )
            if len(fuzzy) > 1:
                return {
                    "text": text,
                    "intent": intent,
                    "status": "ambiguous",
                    "options": [
                        {"id": task.get("id"), "title": task.get("title")}
                        for task in fuzzy[:5]
                    ],
                    "confidence": parsed["confidence"],
                    "reply": f"I found {len(fuzzy)} matching tasks. Which one?",
                }

            CommandRepository.add_log(db_path, text, intent, "not_found", source=source)
            return {
                "text": text,
                "intent": intent,
                "status": "not_found",
                "confidence": parsed["confidence"],
                "reply": "I couldn't find a matching task. Try the exact title?",
            }

        if intent == "task.list":
            from app.domains.tasks import repository as task_repo

            tasks = task_repo.list_tasks(db_path, done=False)
            CommandRepository.add_log(db_path, text, intent, "executed", source=source)
            return _response(
                text,
                intent,
                parsed,
                result={"tasks": tasks[:20], "total": len(tasks)},
                reply=f"You have {len(tasks)} open task{'s' if len(tasks) != 1 else ''}.",
            )

        if intent == "journal.create":
            from app.domains.journal.repository import JournalRepository
            from app.domains.journal.schemas import JournalEntryCreate
            from app.domains.journal.service import JournalService

            payload = JournalEntryCreate(
                markdown_body=str(
                    extracted.get("markdown_body") or extracted.get("body") or text
                ),
                date=str(extracted.get("date") or datetime.now(UTC).date().isoformat()),
                emoji=extracted.get("emoji"),
                tags=list(extracted.get("tags") or []),
            )
            result = JournalService(JournalRepository(db_path)).save_entry(payload)
            result_dict = result.model_dump()
            CommandRepository.add_log(
                db_path, text, intent, "executed", source=source, result=result_dict
            )
            return _response(text, intent, parsed, result=result_dict)

        if intent == "calendar.create":
            from app.domains.calendar.repository import CalendarRepository
            from app.domains.calendar.schemas import CalendarEventCreate
            from app.domains.calendar.service import CalendarService

            if not extracted.get("start_at") or not extracted.get("end_at"):
                CommandRepository.add_log(
                    db_path,
                    text,
                    intent,
                    "incomplete",
                    "missing_datetime",
                    source=source,
                )
                return {
                    "text": text,
                    "intent": intent,
                    "status": "needs_datetime",
                    "error": "Missing event date or time",
                    "confidence": parsed["confidence"],
                    "reply": parsed.get("tts_response", ""),
                    "extracted": extracted,
                }
            payload = CalendarEventCreate(
                title=str(extracted.get("title") or "Untitled event"),
                description=extracted.get("description"),
                start_at=datetime.fromisoformat(
                    str(extracted["start_at"]).replace("Z", "+00:00")
                ),
                end_at=datetime.fromisoformat(
                    str(extracted["end_at"]).replace("Z", "+00:00")
                ),
                all_day=bool(extracted.get("all_day") or False),
            )
            result = CalendarService(CalendarRepository(db_path)).create_event(payload)
            event_dict = result.model_dump()
            undo_result = {
                "id": event_dict.get("id", ""),
                "title": event_dict.get("title", ""),
            }
            CommandRepository.add_log(
                db_path, text, intent, "executed", source=source, result=undo_result
            )
            return _response(text, intent, parsed, result=event_dict)

        if intent == "focus.start":
            from app.domains.focus import service as focus_svc

            result = focus_svc.start(
                int(extracted.get("duration_minutes") or 25),
                str(extracted.get("task_id")) if extracted.get("task_id") else None,
            )
            CommandRepository.add_log(db_path, text, intent, "executed", source=source)
            return _response(text, intent, parsed, result=result)

        if intent == "alarm.create":
            from app.domains.alarms import repository as alarm_repo

            alarm_time = extracted.get("alarm_time")
            if alarm_time:
                result = alarm_repo.create_alarm(
                    db_path,
                    {
                        "time": alarm_time,
                        "title": extracted.get("title") or text,
                        "kind": "alarm",
                    },
                )
                CommandRepository.add_log(
                    db_path, text, intent, "executed", source=source
                )
                return _response(text, intent, parsed, result=result)
            CommandRepository.add_log(db_path, text, intent, "error", source=source)
            return {
                "text": text,
                "intent": intent,
                "status": "error",
                "error": "No alarm time found",
                "reply": "I need a time. What time should I set the alarm?",
            }

        if intent == "habit.checkin":
            from app.domains.habits import repository as habit_repo

            habits = habit_repo.list_habits(db_path)
            habit_name = (extracted.get("habit_name") or "").strip().lower()
            matched = [
                habit
                for habit in habits
                if habit_name in (habit.get("name") or "").lower()
            ]
            if len(matched) == 1:
                result = habit_repo.checkin(db_path, matched[0]["id"])
                CommandRepository.add_log(
                    db_path, text, intent, "executed", source=source
                )
                return _response(
                    text,
                    intent,
                    parsed,
                    result=result,
                    reply=f'Checked in: "{matched[0].get("name", "")}". Nice streak!',
                )
            if len(matched) > 1:
                return {
                    "text": text,
                    "intent": intent,
                    "status": "ambiguous",
                    "options": [
                        {"id": habit.get("id"), "name": habit.get("name")}
                        for habit in matched[:5]
                    ],
                    "confidence": parsed["confidence"],
                    "reply": f"Found {len(matched)} habits matching that. Which one?",
                }
            if habits:
                names = ", ".join(habit.get("name", "") for habit in habits[:5])
                return {
                    "text": text,
                    "intent": intent,
                    "status": "not_found",
                    "confidence": parsed["confidence"],
                    "reply": f"Which habit? You have: {names}.",
                }
            return {
                "text": text,
                "intent": intent,
                "status": "not_found",
                "confidence": parsed["confidence"],
                "reply": "No habits yet. Create one first?",
            }

        if intent == "habit.list":
            from app.domains.habits import repository as habit_repo

            habits = habit_repo.list_habits(db_path)
            CommandRepository.add_log(db_path, text, intent, "executed", source=source)
            return _response(text, intent, parsed, result={"habits": habits})

        if intent == "review.start":
            CommandRepository.add_log(db_path, text, intent, "executed", source=source)
            return _response(text, intent, parsed, result={"action": "open_review"})

        if intent == "search":
            CommandRepository.add_log(db_path, text, intent, "executed", source=source)
            return _response(
                text, intent, parsed, result={"query": extracted.get("query", text)}
            )

        if intent == "nutrition.log":
            CommandRepository.add_log(db_path, text, intent, "executed", source=source)
            return _response(
                text,
                intent,
                parsed,
                result={"action": "log_nutrition", "text": extracted.get("text", text)},
            )

    except Exception as exc:  # noqa: BLE001
        CommandRepository.add_log(
            db_path, text, intent, "failed", str(exc), source=source
        )
        return {
            "text": text,
            "intent": intent,
            "status": "error",
            "error": str(exc),
            "reply": "Something went wrong. Try again?",
        }

    CommandRepository.add_log(db_path, text, intent, "ok", source=source)
    return _response(text, intent, parsed)


def _response(
    text: str,
    intent: str,
    parsed: ParsedCommand,
    *,
    result: object | None = None,
    reply: str | None = None,
) -> dict[str, object]:
    from pydantic import BaseModel

    response: dict[str, object] = {
        "text": text,
        "intent": intent,
        "status": "executed",
        "confidence": parsed["confidence"],
        "reply": reply if reply is not None else parsed.get("tts_response", ""),
        "follow_ups": parsed.get("follow_ups", []),
    }
    if result is not None:
        if isinstance(result, BaseModel):
            response["result"] = result.model_dump()
        else:
            response["result"] = result
    return response


def _handle_undo(db_path: str, text: str, source: str) -> dict[str, object]:
    """Undo the most recent supported command that has not already been undone."""
    history = CommandRepository.history(db_path, limit=10)
    for entry in history:
        if entry.get("status") != "executed" or entry.get("intent") == "undo":
            continue
        if entry.get("undone_at"):
            continue
        return _undo_entry(db_path, entry, text, source)
    return {
        "text": text,
        "intent": "undo",
        "status": "nothing_to_undo",
        "reply": "Nothing to undo.",
    }


def _undo_entry(
    db_path: str, entry: dict[str, object], text: str, source: str
) -> dict[str, object]:
    """Reverse a single command log entry."""
    intent = str(entry.get("intent", ""))
    try:
        if intent == "task.create":
            from app.domains.tasks import repository as task_repo

            result = entry.get("result")
            if isinstance(result, dict) and result.get("id"):
                task_repo.delete_task(db_path, result["id"])
                CommandRepository.mark_undone(db_path, str(entry["id"]))
                CommandRepository.add_log(
                    db_path, text, "undo", "executed", source=source
                )
                return {
                    "text": text,
                    "intent": "undo",
                    "status": "executed",
                    "reply": f'Undone. Removed task: "{result.get("title", "")}".',
                    "undone": entry,
                }
        elif intent == "calendar.create":
            from app.domains.calendar.repository import CalendarRepository

            result = entry.get("result")
            if isinstance(result, dict) and result.get("id"):
                CalendarRepository(db_path).delete_event(result["id"])
                CommandRepository.mark_undone(db_path, str(entry["id"]))
                CommandRepository.add_log(
                    db_path, text, "undo", "executed", source=source
                )
                return {
                    "text": text,
                    "intent": "undo",
                    "status": "executed",
                    "reply": f'Undone. Removed event: "{result.get("title", "")}".',
                    "undone": entry,
                }
        elif intent == "task.complete":
            from app.domains.tasks import repository as task_repo

            result = entry.get("result")
            if isinstance(result, dict) and result.get("id"):
                task_repo.uncomplete_task(db_path, result["id"])
                CommandRepository.mark_undone(db_path, str(entry["id"]))
                CommandRepository.add_log(
                    db_path, text, "undo", "executed", source=source
                )
                return {
                    "text": text,
                    "intent": "undo",
                    "status": "executed",
                    "reply": f'Undone. Reopened task: "{result.get("title", "")}".',
                    "undone": entry,
                }
    except Exception as exc:  # noqa: BLE001
        return {
            "text": text,
            "intent": "undo",
            "status": "error",
            "error": str(exc),
            "reply": "Undo failed. The action may have already been modified.",
        }
    return {
        "text": text,
        "intent": "undo",
        "status": "unsupported",
        "reply": f"Can't undo '{intent}' actions yet.",
    }
