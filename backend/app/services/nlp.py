"""
Unified NLP engine for voice and text command parsing.

Pattern-based intent classifier with weighted scoring and entity extraction.
No prefix required — "buy milk tomorrow" works as well as "task buy milk tomorrow".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

# ---------------------------------------------------------------------------
# Intent patterns: (compiled_regex, weight)
# Higher weight = stronger signal.  Multiple matches stack.
# ---------------------------------------------------------------------------

_INTENT_PATTERNS: dict[str, list[tuple[re.Pattern[str], float]]] = {
    # --- task ---
    "task.create": [
        (re.compile(r"\b(?:add|create|new|make)\s+(?:a\s+)?(?:task|todo|reminder|to-?do)\b", re.I), 1.0),
        (re.compile(r"\b(?:todo|to do|to-do|task)\b", re.I), 0.8),
        (re.compile(r"\bi\s+(?:need|have)\s+to\b", re.I), 0.7),
        (re.compile(r"\bremind\s+me\b", re.I), 0.7),
        (re.compile(r"\badd\s+to\s+(?:my\s+)?(?:list|tasks)\b", re.I), 0.8),
        (re.compile(r"\bdon'?t\s+forget\s+to\b", re.I), 0.7),
        (re.compile(r"\bmake\s+sure\s+(?:i|I)\s+", re.I), 0.6),
        (re.compile(r"\bi\s+(?:should|must|gotta|need\s+to|have\s+to)\s+", re.I), 0.6),
        (re.compile(r"\bgotta\s+", re.I), 0.5),
    ],
    "task.complete": [
        (re.compile(r"\b(?:complete|finish|done|check\s*off|mark\s+(?:as\s+)?done|mark\s+complete)\b.*\b(?:task|todo|item)\b", re.I), 1.0),
        (re.compile(r"\b(?:completed?|finished|done\s+with|mark\s+done|mark\s+(?:as\s+)?done)\s+", re.I), 0.9),
        (re.compile(r"\bcheck\s+(?:it\s+)?off\b", re.I), 0.9),
        (re.compile(r"\b(?:cross|strike)\s+(?:it\s+)?off\b", re.I), 0.7),
        (re.compile(r"\b(?:just\s+)?finished\s+", re.I), 0.6),
    ],
    "task.list": [
        (re.compile(r"\b(?:show|list|what(?:'s| is)|display|view)\s+(?:my\s+)?(?:tasks?|to-?dos?|todos?)\b", re.I), 1.0),
        (re.compile(r"\bwhat\s+(?:do\s+)?i\s+(?:need|have)\s+to\s+do\b", re.I), 0.9),
        (re.compile(r"\bwhat'?s\s+(?:on\s+)?(?:my\s+)?(?:plate|agenda|schedule)\b", re.I), 0.8),
        (re.compile(r"\bwhat\s+do\s+i\s+have\s+coming\s+up\b", re.I), 0.8),
    ],
    # --- journal ---
    "journal.create": [
        (re.compile(r"\b(?:write|log|create|add|make)\s+(?:a\s+)?(?:journal|entry|note|log|diary)\b", re.I), 1.0),
        (re.compile(r"\b(?:journal|diary|reflect|brain\s*dump)\b", re.I), 0.8),
        (re.compile(r"\bi\s+(?:feel|felt|am feeling|was)\b", re.I), 0.5),
        (re.compile(r"\bbrain\s*dump\b", re.I), 1.0),
        (re.compile(r"\b(?:capture|jot\s+down|write\s+down)\s+(?:a\s+)?(?:thought|idea|note)\b", re.I), 0.7),
    ],
    # --- calendar ---
    "calendar.create": [
        (re.compile(r"\b(?:schedule|calendar|event|meeting|appointment)\b", re.I), 0.9),
        (re.compile(r"\b(?:book|block|reserve)\s+(?:a\s+)?(?:time|slot|hour|minute)\b", re.I), 0.8),
        (re.compile(r"\b(?:put|add)\s+(?:it|this|that)\s+(?:on|in)\s+(?:my\s+)?(?:calendar|schedule)\b", re.I), 0.9),
        (re.compile(r"\b(?:set\s+up|plan)\s+(?:a\s+)?(?:meeting|call|event)\b", re.I), 0.9),
        (re.compile(r"\b(?:i\s+)?have\s+(?:a\s+)?(?:meeting|call|appointment)\s+(?:at|on|with)\b", re.I), 0.7),
    ],
    # --- focus ---
    "focus.start": [
        (re.compile(r"\b(?:start|begin|launch|do|run)\s+(?:a\s+)?(?:focus|pomodoro|deep\s*work|work\s*session|timer)\b", re.I), 1.0),
        (re.compile(r"\b(?:focus|pomodoro|deep\s*work|flow\s*state)\b", re.I), 0.7),
        (re.compile(r"\blet'?s\s+(?:focus|work|get\s+to\s+work)\b", re.I), 0.6),
        (re.compile(r"\b(?:lock\s+in|heads?\s*down|zone\s+in)\b", re.I), 0.7),
        (re.compile(r"\btime\s+to\s+(?:focus|work|get\s+shit\s+done)\b", re.I), 0.7),
    ],
    # --- alarm ---
    "alarm.create": [
        (re.compile(r"\b(?:set|create|add|make)\s+(?:an?\s+)?(?:alarm|reminder|wake-?up)\b", re.I), 1.0),
        (re.compile(r"\bwake\s+me\s+(?:up\s+)?at\b", re.I), 0.9),
        (re.compile(r"\bremind\s+me\s+(?:at|in)\b", re.I), 0.9),
        (re.compile(r"\b(?:alarm|wake-?up)\s+(?:at|for)\b", re.I), 0.8),
    ],
    # --- habit ---
    "habit.checkin": [
        (re.compile(r"\b(?:check\s*in|log|track|did|completed?)\s+(?:my\s+)?(?:habit|streak)\b", re.I), 1.0),
        (re.compile(r"\b(?:check\s*in|check|tick|mark)\s+(?:off\s+)?(?:my\s+)?\w+", re.I), 0.8),
        (re.compile(r"\b(?:check|tick|mark)\s+(?:off\s+)?(?:my\s+)?(?:habit|exercise|hydrat|read|sleep|meditat|meds?)\b", re.I), 0.9),
    ],
    "habit.list": [
        (re.compile(r"\b(?:show|list|view|display)\s+(?:my\s+)?habits?\b", re.I), 1.0),
        (re.compile(r"\bwhat(?:'s| is)\s+(?:my\s+)?habit\s+(?:status|progress|streak)\b", re.I), 0.9),
    ],
    # --- review ---
    "review.start": [
        (re.compile(r"\b(?:start|begin|do|review|study|practice|quiz)\s+(?:a\s+)?(?:review|flashcard|deck|card|study)\b", re.I), 1.0),
        (re.compile(r"\b(?:review|flashcard|spaced\s*repetition|study\s*session)\b", re.I), 0.7),
    ],
    # --- search ---
    "search": [
        (re.compile(r"\b(?:search|find|look\s*(?:up|for)|where(?:'s| is)|locate|query)\s+(?:for\s+)?(.+)", re.I), 1.0),
        (re.compile(r"\b(?:what|where)\s+(?:did\s+)?(?:i\s+)?(?:write|put|save|note|log)\b", re.I), 0.8),
    ],
    # --- nutrition ---
    "nutrition.log": [
        (re.compile(r"\b(?:log|add|track|ate|eaten|had|drink|drank)\s+(?:a\s+)?(?:food|meal|snack|calorie|water|coffee|tea|breakfast|lunch|dinner)\b", re.I), 0.9),
        (re.compile(r"\b(?:log|track|add)\s+(?:a\s+)?(?:.+)\s+(?:to\s+)?(?:food|nutrition|meal|calorie)\b", re.I), 0.8),
    ],
    # --- greeting / meta ---
    "greeting": [
        (re.compile(r"\b(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|howdy|sup|yo)\b", re.I), 0.9),
    ],
    "help": [
        (re.compile(r"\b(?:help|what\s+can\s+(?:you|i)\s+do|commands?|options?|how\s+(?:do|does|to))\b", re.I), 0.9),
    ],
    # --- undo ---
    "undo": [
        (re.compile(r"\b(?:undo|reverse|take\s+(?:that\s+)?back|revert|cancel\s+(?:that|the\s+last))\b", re.I), 1.0),
    ],
}


# ---------------------------------------------------------------------------
# Simple word-overlap matcher for tasks when no explicit intent keyword
# ---------------------------------------------------------------------------

def _word_overlap_score(query: str, target: str) -> float:
    """Return 0..1 overlap between query words and target words."""
    q = set(re.findall(r"\w+", query.lower()))
    t = set(re.findall(r"\w+", target.lower()))
    if not q or not t:
        return 0.0
    return len(q & t) / max(len(q), len(t))


def fuzzy_task_match(query: str, tasks: list[dict[str, Any]], *, min_score: float = 0.4) -> list[dict[str, Any]]:
    """Return tasks sorted by fuzzy match score against query, best first."""
    query = (query or "").strip()
    if not query:
        return []
    scored: list[tuple[float, dict[str, Any]]] = []
    for task in tasks:
        title = str(task.get("title") or "")
        score = _word_overlap_score(query, title)
        # Also check containment
        if query.lower() in title.lower():
            score = max(score, 0.8)
        if title.lower() in query.lower():
            score = max(score, 0.7)
        if score >= min_score:
            scored.append((score, task))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [t for _, t in scored]


# ---------------------------------------------------------------------------
# Entity extraction
# ---------------------------------------------------------------------------

def _extract_time(text: str) -> tuple[int, int] | None:
    """Pull HH:MM from text.  Returns (hour, minute) or None."""
    if m := re.search(r"\b(\d{1,2}):(\d{2})\s*(am|pm)?\b", text, re.I):
        h, mi = int(m.group(1)), int(m.group(2))
        if m.group(3) and m.group(3).lower() == "pm" and h != 12:
            h += 12
        elif m.group(3) and m.group(3).lower() == "am" and h == 12:
            h = 0
        return (h, mi)
    if m := re.search(r"\b(\d{1,2})\s*(am|pm)\b", text, re.I):
        h = int(m.group(1))
        if m.group(2).lower() == "pm" and h != 12:
            h += 12
        elif m.group(2).lower() == "am" and h == 12:
            h = 0
        return (h, 0)
    return None


def _extract_duration(text: str) -> int | None:
    """Pull duration in minutes from text like 'for 45 minutes' or '25 min'."""
    if m := re.search(r"\bfor\s+(\d+)\s*(?:minutes?|mins?|m)\b", text, re.I):
        return int(m.group(1))
    if m := re.search(r"\bfor\s+(\d+)\s*(?:hours?|hrs?|h)\b", text, re.I):
        return int(m.group(1)) * 60
    if m := re.search(r"\b(\d+)\s*(?:minutes?|mins?)\b", text, re.I):
        return int(m.group(1))
    if m := re.search(r"\b(\d+)\s*(?:hours?|hrs?)\b", text, re.I):
        return int(m.group(1)) * 60
    return None


def _extract_date(text: str) -> str | None:
    """Pull a date string from text.  Returns ISO date or None."""
    now = datetime.now(UTC)
    low = text.lower()
    if "today" in low:
        return now.date().isoformat()
    if "tomorrow" in low or "tmrw" in low:
        return (now + timedelta(days=1)).date().isoformat()
    if "next week" in low:
        return (now + timedelta(days=7)).date().isoformat()
    # weekdays
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    if m := re.search(r"\b(?:this\s+)?(" + "|".join(weekdays) + r")\b", low):
        target = weekdays.index(m.group(1))
        delta = (target - now.weekday()) % 7 or 7
        return (now + timedelta(days=delta)).date().isoformat()
    if m := re.search(r"\bnext\s+(" + "|".join(weekdays) + r")\b", low):
        target = weekdays.index(m.group(1))
        delta = (target - now.weekday()) % 7 or 7
        return (now + timedelta(days=delta)).date().isoformat()
    # ISO date
    if m := re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text):
        return m.group(1)
    # "in N days"
    if m := re.search(r"\bin\s+(\d+)\s+days?\b", low):
        return (now + timedelta(days=int(m.group(1)))).date().isoformat()
    return None


def _extract_priority(text: str) -> int:
    """Return priority 1-4 from text cues.  Default 2."""
    low = text.lower()
    if re.search(r"\b(?:urgent|asap|critical|high\s*priority|must\s+do|right\s+now)\b", low):
        return 1
    if re.search(r"!high|!1", low):
        return 1
    if re.search(r"\b(?:low\s*priority|no\s+rush|when\s+(?:i\s+)?get\s+(?:a\s+)?chance)\b", low):
        return 3
    if re.search(r"!low|!3", low):
        return 3
    if re.search(r"\b(?:backlog|someday|maybe|if\s+time|one\s+day)\b", low):
        return 4
    if re.search(r"!4", low):
        return 4
    if re.search(r"!med|!2", low):
        return 2
    return 2


def _extract_tags(text: str) -> list[str]:
    return re.findall(r"#(\w+)", text)


# ---------------------------------------------------------------------------
# Command-word strip helpers (backward compat)
# ---------------------------------------------------------------------------

_STRIP_PREFIXES = (
    "add task", "create task", "new task", "todo", "to do", "task",
    "journal entry", "log journal", "journal",
    "schedule", "calendar", "event",
    "complete task", "done task", "mark done", "finish task",
    "focus", "pomodoro",
    "set alarm", "create alarm", "alarm",
    "check in habit", "log habit", "check in",
    "show habits", "list habits",
)


def _strip_known_prefix(text: str) -> str:
    """Remove leading command words so entity extraction works on the body."""
    low = text.lower().strip()
    for prefix in _STRIP_PREFIXES:
        if low == prefix:
            return ""
        if low.startswith(f"{prefix} "):
            return text.strip()[len(prefix):].strip()
    return text.strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@dataclass
class NLPResult:
    """Result of NLP intent classification and entity extraction."""
    intent: str
    confidence: float
    entities: dict[str, Any] = field(default_factory=dict)
    follow_ups: list[str] = field(default_factory=list)
    tts_response: str = ""


def classify(text: str, *, context: dict[str, Any] | None = None) -> NLPResult:
    """
    Classify user text into an intent with extracted entities.

    No prefix required.  Works for both typed and spoken input.
    """
    text = (text or "").strip()
    if not text:
        return NLPResult(intent="unknown", confidence=0.0)

    # 1. Score all intents
    scores: dict[str, float] = {}
    for intent, patterns in _INTENT_PATTERNS.items():
        for pattern, weight in patterns:
            if pattern.search(text):
                scores[intent] = scores.get(intent, 0.0) + weight

    # 2. Pick best intent
    if not scores:
        # Fallback: try quick_add parse — if it extracts a real title + date/priority/rrule, assume task.create
        from app.services import quick_add
        try:
            parsed = quick_add.parse(text)
            has_signal = (
                parsed.get("due_at")
                or parsed.get("priority") != 2
                or parsed.get("rrule")
            )
            if parsed.get("title") and has_signal:
                title = parsed["title"]
                rrule = parsed.get("rrule")
                tts = f'Recurring task created: "{title}".' if rrule else f'Task added: "{title}".'
                return NLPResult(
                    intent="task.create",
                    confidence=0.6,
                    entities={
                        "title": title,
                        "due_at": parsed.get("due_at"),
                        "priority": int(parsed.get("priority") or 2),
                        "tags": parsed.get("tags") or [],
                        "rrule": rrule,
                    },
                    follow_ups=["Add another task?", "Start a focus session?"],
                    tts_response=tts,
                )
        except Exception:
            pass
        return NLPResult(
            intent="unknown",
            confidence=0.0,
            tts_response="I didn't catch that. Try saying something like 'add task buy milk' or 'start focus'.",
        )

    best_intent = max(scores, key=lambda k: scores[k])
    raw_conf = min(scores[best_intent] / 2.0, 1.0)  # normalise 0..1
    confidence = round(raw_conf, 2)

    # 3. Entity extraction
    body = _strip_known_prefix(text)
    entities: dict[str, Any] = {}
    follow_ups: list[str] = []
    tts_response = ""

    if best_intent == "task.create":
        from app.services import quick_add
        parsed = quick_add.parse(body or text)
        estimated = _extract_duration(text)
        entities = {
            "title": parsed.get("title") or body or text,
            "due_at": parsed.get("due_at"),
            "priority": int(parsed.get("priority") or 2),
            "tags": parsed.get("tags") or [],
            "rrule": parsed.get("rrule"),
            "estimated_minutes": estimated,
        }
        follow_ups = ["Add another task?", "Start a focus session on this?", "Anything else?"]
        # Build varied TTS
        title = entities["title"]
        if entities.get("rrule"):
            tts_response = f'Recurring task created: "{title}".'
        elif entities.get("due_at"):
            tts_response = f'Task created: "{title}".'
        else:
            tts_response = f'Task added: "{title}".'

    elif best_intent == "task.complete":
        entities = {"query": body or text}
        follow_ups = ["Another one done?", "Check your habits?"]
        tts_response = "Checked off. Nice work."

    elif best_intent == "task.list":
        entities = {"filter": body or "all"}
        follow_ups = ["Focus on the top priority?", "Add a new task?"]
        tts_response = "Here's your task list."

    elif best_intent == "journal.create":
        entities = {
            "body": body or text,
            "date": datetime.now(UTC).date().isoformat(),
            "tags": _extract_tags(text),
        }
        follow_ups = ["Write another entry?", "Check your streak?"]
        tts_response = "Journal entry saved."

    elif best_intent == "calendar.create":
        date_str = _extract_date(text)
        time_str = _extract_time(text)
        duration = _extract_duration(text)
        start_dt = None
        end_dt = None
        if date_str and time_str:
            start_dt = f"{date_str}T{time_str[0]:02d}:{time_str[1]:02d}:00Z"
            dur_min = duration or 60
            h, m = time_str
            total_min = h * 60 + m + dur_min
            end_dt = f"{date_str}T{total_min // 60:02d}:{total_min % 60:02d}:00Z"
        title_clean = re.sub(r"\b(today|tomorrow|next\s+\w+|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|for\s+\d+\s*(?:minutes?|hours?|mins?|hrs?))\b", "", body or text, flags=re.I).strip()
        title_clean = re.sub(r"\s+", " ", title_clean).strip(" ,.;:-") or body or "Untitled event"
        entities = {
            "title": title_clean,
            "start_at": start_dt,
            "end_at": end_dt,
            "date": date_str,
            "time": f"{time_str[0]:02d}:{time_str[1]:02d}" if time_str else None,
            "duration_minutes": duration,
        }
        follow_ups = ["Add another event?", "Block focus time before this?"]
        if start_dt:
            tts_response = f'Booked: {title_clean}.'
        else:
            tts_response = f"I got '{title_clean}'. When's it happening?"

    elif best_intent == "focus.start":
        dur = _extract_duration(text) or 25
        entities = {"duration_minutes": dur}
        follow_ups = ["Take a break after?", "Log what you accomplished?"]
        tts_response = f"{dur} minutes on the clock. Go."

    elif best_intent == "alarm.create":
        time_str = _extract_time(text)
        date_str = _extract_date(text)
        entities = {
            "alarm_time": f"{time_str[0]:02d}:{time_str[1]:02d}" if time_str else None,
            "date": date_str,
            "title": re.sub(r"\b(?:set|create|alarm|at|for)\b", "", text, flags=re.I).strip() or "Alarm",
        }
        follow_ups = ["Set another alarm?"]
        if time_str:
            tts_response = f'Alarm set for {time_str[0]:02d}:{time_str[1]:02d}.'
        else:
            tts_response = "What time should I set the alarm?"

    elif best_intent == "habit.checkin":
        entities = {"habit_name": body or text}
        follow_ups = ["Check another habit?", "How's your streak?"]
        tts_response = "Habit checked in."

    elif best_intent == "habit.list":
        entities = {}
        follow_ups = ["Check in a habit?", "Start a focus session?"]
        tts_response = "Here's your habit tracker."

    elif best_intent == "review.start":
        entities = {"deck": body or None}
        follow_ups = ["Review another deck?"]
        tts_response = "Cards are ready. Let's review."

    elif best_intent == "search":
        query = body or text
        # Strip leading search words
        query = re.sub(r"^\b(?:search|find|look\s*(?:up|for)|where(?:'s| is)|locate)\s+(?:for\s+)?", "", query, flags=re.I).strip()
        entities = {"query": query}
        follow_ups = ["Open the result?"]
        tts_response = f"Looking for '{query}'."

    elif best_intent == "nutrition.log":
        entities = {"text": body or text}
        follow_ups = ["Log another item?"]
        tts_response = "Nutrition logged."

    elif best_intent == "greeting":
        hour = datetime.now(UTC).hour
        if hour < 12:
            tts_response = "Morning! What's on the agenda?"
        elif hour < 17:
            tts_response = "Hey! What do you need?"
        elif hour < 21:
            tts_response = "Evening. Still going strong?"
        else:
            tts_response = "Hey. Wrapping up for the night?"
        follow_ups = ["Show today's overview?", "Start a focus session?", "Check your habits?"]

    elif best_intent == "help":
        tts_response = "I can create tasks, log journals, schedule events, start focus sessions, set alarms, check habits, and more. Just say it naturally."
        follow_ups = ["Create a task", "Start focus", "Check habits"]

    elif best_intent == "undo":
        entities = {}
        follow_ups = ["What did I do today?"]
        tts_response = "Undoing your last action."

    else:
        tts_response = ""

    return NLPResult(
        intent=best_intent,
        confidence=confidence,
        entities=entities,
        follow_ups=follow_ups,
        tts_response=tts_response,
    )
