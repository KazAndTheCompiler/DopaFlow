"""Task-domain service helpers."""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.gamification_helpers import award as award_gamification
from app.domains.tasks import repository
from app.domains.tasks.schemas import Task

logger = logging.getLogger(__name__)


def complete_task(db_path: str, task_id: str) -> Task | None:
    """Mark a task complete and award XP."""

    task = repository.complete_task(db_path, task_id)
    if task is not None:
        award_gamification("task_complete", task_id, logger=logger)
    return task


def _weekday_target(name: str, now: datetime) -> datetime:
    """Return the next occurrence of the requested weekday."""

    weekdays = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    target = weekdays[name]
    delta = (target - now.weekday()) % 7
    delta = 7 if delta == 0 else delta
    return now + timedelta(days=delta)


def parse_quick_add(text: str, user_tz: str = "UTC") -> dict[str, Any]:
    """
    Parse natural language task input.

    Returns a normalized task-create dict with ambiguity hints.
    """

    original = text.strip()
    working = original
    lowered = original.lower()
    priority = 3
    ambiguity = False
    ambiguity_hints: list[str] = []
    tags = re.findall(r"#([\w-]+)", working)
    working = re.sub(r"#([\w-]+)", "", working).strip()
    lowered_no_tags = re.sub(r"#([\w-]+)", "", lowered).strip()

    if any(token in lowered_no_tags for token in ["urgent", "!!", " p1"]):
        priority = 1
    elif any(token in lowered_no_tags for token in ["high", "!", " p2"]):
        priority = 2

    due_at: str | None = None
    try:
        tz = ZoneInfo(user_tz)
    except ZoneInfoNotFoundError:
        tz = timezone.utc
    now = datetime.now(tz)

    def _to_utc_iso(local_dt: datetime) -> str:
        return local_dt.astimezone(timezone.utc).isoformat()

    if "today" in lowered_no_tags:
        due_at = _to_utc_iso(now.replace(hour=0, minute=0, second=0, microsecond=0))
        working = re.sub(r"\btoday\b", "", working, flags=re.IGNORECASE).strip()
    elif "tomorrow" in lowered_no_tags:
        due_at = _to_utc_iso(
            (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        working = re.sub(r"\btomorrow\b", "", working, flags=re.IGNORECASE).strip()
    elif match := re.search(r"in (\d+) days", lowered_no_tags):
        due_at = _to_utc_iso(
            (now + timedelta(days=int(match.group(1)))).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        )
        working = re.sub(r"in \d+ days", "", working, flags=re.IGNORECASE).strip()
    elif "next week" in lowered_no_tags:
        due_at = _to_utc_iso(
            (now + timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        working = re.sub(r"next week", "", working, flags=re.IGNORECASE).strip()
        ambiguity = True
        ambiguity_hints.append(
            "due date unclear: 'next week' defaulted to next week's local midnight"
        )
    else:
        for weekday in (
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ):
            if weekday in lowered_no_tags:
                due_at = _to_utc_iso(
                    _weekday_target(weekday, now).replace(
                        hour=0, minute=0, second=0, microsecond=0
                    )
                )
                working = re.sub(weekday, "", working, flags=re.IGNORECASE).strip()
                ambiguity = True
                ambiguity_hints.append(
                    f"due date inferred from weekday '{weekday}' and defaulted to local midnight"
                )
                break

    recurrence_rule = None
    if any(token in lowered_no_tags for token in ["every day", "daily"]):
        recurrence_rule = "FREQ=DAILY"
    elif any(token in lowered_no_tags for token in ["every week", "weekly"]):
        recurrence_rule = "FREQ=WEEKLY"
    elif match := re.search(
        r"every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
        lowered_no_tags,
    ):
        recurrence_rule = f"FREQ=WEEKLY;BYDAY={match.group(1)[:2].upper()}"

    return {
        "title": re.sub(r"\s+", " ", working).strip(" -,") or original,
        "due_at": due_at,
        "priority": priority,
        "tags": tags,
        "recurrence_rule": recurrence_rule,
        "ambiguity": ambiguity,
        "ambiguity_hints": ambiguity_hints,
    }


def import_tasks_csv(content: str) -> list[dict[str, Any]]:
    """Parse a Todoist-like CSV export into task payloads."""

    rows = []
    reader = csv.DictReader(io.StringIO(content))
    for row in reader:
        rows.append(
            {
                "title": row.get("Content") or row.get("title") or "Imported task",
                "description": row.get("Description") or row.get("description"),
                "due_at": row.get("Date") or row.get("due_at"),
                "priority": int(row.get("Priority") or 3),
                "tags": [
                    tag.strip()
                    for tag in (row.get("Labels") or "").split(",")
                    if tag.strip()
                ],
            }
        )
    return rows
