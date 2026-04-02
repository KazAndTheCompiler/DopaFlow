"""Task-domain service helpers."""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.domains.gamification.repository import GamificationRepository
from app.domains.gamification.service import GamificationService
from app.domains.tasks import repository


def _award(source: str, source_id: str | None = None) -> None:
    try:
        db = get_settings().db_path
        GamificationService(GamificationRepository(db)).award(source, source_id)
    except Exception:
        pass


def complete_task(db_path: str, task_id: str) -> dict[str, Any] | None:
    """Mark a task complete and award XP."""

    task = repository.complete_task(db_path, task_id)
    if task is not None:
        _award("task_complete", task_id)
    return task


def _weekday_target(name: str) -> datetime:
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
    now = datetime.now(timezone.utc)
    target = weekdays[name]
    delta = (target - now.weekday()) % 7
    delta = 7 if delta == 0 else delta
    return now + timedelta(days=delta)


def parse_quick_add(text: str) -> dict[str, Any]:
    """
    Parse natural language task input.

    Returns a normalized task-create dict with ambiguity hints.
    """

    original = text.strip()
    working = original
    lowered = original.lower()
    priority = 3
    ambiguity = False
    tags = re.findall(r"#([\w-]+)", working)
    working = re.sub(r"#([\w-]+)", "", working).strip()

    if any(token in lowered for token in ["urgent", "!!", " p1"]):
        priority = 1
    elif any(token in lowered for token in ["high", "!", " p2"]):
        priority = 2

    due_at: str | None = None
    now = datetime.now(timezone.utc)
    if "today" in lowered:
        due_at = now.replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
        working = re.sub(r"\btoday\b", "", working, flags=re.IGNORECASE).strip()
    elif "tomorrow" in lowered:
        due_at = (now + timedelta(days=1)).replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
        working = re.sub(r"\btomorrow\b", "", working, flags=re.IGNORECASE).strip()
    elif match := re.search(r"in (\d+) days", lowered):
        due_at = (now + timedelta(days=int(match.group(1)))).replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
        working = re.sub(r"in \d+ days", "", working, flags=re.IGNORECASE).strip()
    elif "next week" in lowered:
        due_at = (now + timedelta(days=7)).replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
        working = re.sub(r"next week", "", working, flags=re.IGNORECASE).strip()
        ambiguity = True
    else:
        for weekday in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
            if weekday in lowered:
                due_at = _weekday_target(weekday).replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
                working = re.sub(weekday, "", working, flags=re.IGNORECASE).strip()
                ambiguity = True
                break

    recurrence_rule = None
    if any(token in lowered for token in ["every day", "daily"]):
        recurrence_rule = "FREQ=DAILY"
    elif any(token in lowered for token in ["every week", "weekly"]):
        recurrence_rule = "FREQ=WEEKLY"
    elif match := re.search(r"every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)", lowered):
        recurrence_rule = f"FREQ=WEEKLY;BYDAY={match.group(1)[:2].upper()}"

    return {
        "title": re.sub(r"\s+", " ", working).strip(" -,") or original,
        "due_at": due_at,
        "priority": priority,
        "tags": tags,
        "recurrence_rule": recurrence_rule,
        "ambiguity": ambiguity,
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
                "tags": [tag.strip() for tag in (row.get("Labels") or "").split(",") if tag.strip()],
            }
        )
    return rows
