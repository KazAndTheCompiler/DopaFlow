"""Shared command intent and action vocabulary.

This module is the single source of truth for intent names and action strings
used across NLP, Packy, and command execution. All string literals for intents
and actions should be imported from here rather than hardcoded.
"""

from __future__ import annotations

from typing import Literal

# ---------------------------------------------------------------------------
# Command intents — must match NLP pattern keys in app/services/nlp.py
# ---------------------------------------------------------------------------

CommandIntent = Literal[
    "task.create",
    "task.complete",
    "task.list",
    "journal.create",
    "calendar.create",
    "focus.start",
    "alarm.create",
    "habit.checkin",
    "habit.create",
    "habit.list",
    "review.start",
    "search",
    "nutrition.log",
    "greeting",
    "help",
    "undo",
]

ALL_INTENTS: frozenset[str] = frozenset(
    [
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
        "greeting",
        "help",
        "undo",
    ]
)

# ---------------------------------------------------------------------------
# Route intent actions — navigation targets returned by Packy suggested_action
# ---------------------------------------------------------------------------

RouteIntentAction = Literal[
    "open-task-create",
    "open-tasks",
    "open-habits",
    "start-focus",
    "open-review",
    "open-journal",
    "open-calendar",
    "open-today",
    "open-search",
    "open-command-bar",
    "open-nutrition",
    "open-overview",
    "open-insights",
    "open-player",
    "open-gamification",
    "open-digest",
    "open-alarms",
]

ALL_ACTIONS: frozenset[str] = frozenset(
    [
        "open-task-create",
        "open-tasks",
        "open-habits",
        "start-focus",
        "open-review",
        "open-journal",
        "open-calendar",
        "open-today",
        "open-search",
        "open-command-bar",
        "open-nutrition",
        "open-overview",
        "open-insights",
        "open-player",
        "open-gamification",
        "open-digest",
        "open-alarms",
    ]
)

# ---------------------------------------------------------------------------
# Intent → action mapping  (same as RouteIntentAction intent → AppRoute)
# ---------------------------------------------------------------------------

INTENT_TO_ACTION: dict[CommandIntent, RouteIntentAction] = {
    "task.create": "open-task-create",
    "task.complete": "open-tasks",
    "task.list": "open-tasks",
    "journal.create": "open-journal",
    "calendar.create": "open-calendar",
    "focus.start": "start-focus",
    "alarm.create": "open-alarms",
    "habit.checkin": "open-habits",
    "habit.create": "open-habits",
    "habit.list": "open-habits",
    "review.start": "open-review",
    "search": "open-search",
    "nutrition.log": "open-nutrition",
}
