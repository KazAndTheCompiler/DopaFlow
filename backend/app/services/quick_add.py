"""Plain-text quick add parser ported from v1."""

from __future__ import annotations

import re
from calendar import monthrange
from datetime import UTC, datetime, timedelta
from datetime import datetime as real_datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

PRIORITY_MAP = {"!high": 1, "!1": 1, "!med": 2, "!2": 2, "!low": 3, "!3": 3, "!4": 4}
MAX_LEN = 280
DEFAULT_HOUR = 9
DEFAULT_MINUTE = 0
EVENING_HOUR = 20
WEEKDAY_NAMES = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)
MONTH_NAMES = (
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
)
MONTH_NUMBERS = {name: index + 1 for index, name in enumerate(MONTH_NAMES)}
TIME_RE = re.compile(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b", flags=re.IGNORECASE)
PRIORITY_PATTERNS: list[tuple[re.Pattern[str], int]] = [
    (
        re.compile(
            r"\b(?:urgent|asap|right now|critical|must do today)\b", re.IGNORECASE
        ),
        1,
    ),
    (
        re.compile(
            r"\b(?:when i get a chance|eventually|low priority|no rush)\b",
            re.IGNORECASE,
        ),
        3,
    ),
    (re.compile(r"\b(?:backlog|maybe|if time|one day|someday)\b", re.IGNORECASE), 4),
]

# ---------------------------------------------------------------------------
# Recurrence parsing
# ---------------------------------------------------------------------------
RECURRENCE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Specific weekdays: "every monday", "every tuesday and thursday"
    (
        re.compile(
            r"\bevery\s+((?:(?:and\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*)+)",
            re.I,
        ),
        "weekly",
    ),
    # "every weekday"
    (re.compile(r"\bevery\s+weekday\b", re.I), "weekday"),
    # "every day" / "daily"
    (re.compile(r"\b(?:every\s+day|daily)\b", re.I), "daily"),
    # "every week" / "weekly"
    (re.compile(r"\b(?:every\s+week|weekly)\b", re.I), "weekly"),
    # "every month" / "monthly"
    (re.compile(r"\b(?:every\s+month|monthly)\b", re.I), "monthly"),
    # "every year" / "yearly" / "annually"
    (re.compile(r"\b(?:every\s+year|yearly|annually)\b", re.I), "yearly"),
    # "every morning"
    (re.compile(r"\bevery\s+morning\b", re.I), "daily_morning"),
    # "every evening" / "every night"
    (re.compile(r"\bevery\s+(?:evening|night)\b", re.I), "daily_evening"),
    # "every hour" / "hourly"
    (re.compile(r"\b(?:every\s+hour|hourly)\b", re.I), "hourly"),
]


def _build_rrule(recurrence_type: str, text: str) -> str | None:
    """Build an RRULE string from the detected recurrence type."""
    if recurrence_type == "daily":
        return "FREQ=DAILY"
    if recurrence_type == "daily_morning":
        return "FREQ=DAILY;BYHOUR=9;BYMINUTE=0"
    if recurrence_type == "daily_evening":
        return "FREQ=DAILY;BYHOUR=20;BYMINUTE=0"
    if recurrence_type == "weekly":
        # Extract specific weekdays
        day_map = {
            "monday": "MO",
            "tuesday": "TU",
            "wednesday": "WE",
            "thursday": "TH",
            "friday": "FR",
            "saturday": "SA",
            "sunday": "SU",
        }
        days = re.findall(
            r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", text, re.I
        )
        if days:
            byday = ",".join(day_map[d.lower()] for d in days)
            return f"FREQ=WEEKLY;BYDAY={byday}"
        return "FREQ=WEEKLY"
    if recurrence_type == "weekday":
        return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    if recurrence_type == "monthly":
        return "FREQ=MONTHLY"
    if recurrence_type == "yearly":
        return "FREQ=YEARLY"
    if recurrence_type == "hourly":
        return "FREQ=HOURLY"
    return None


# Simple literal patterns for stripping recurrence words from the title
_RECURRENCE_STRIP_PATTERNS = [
    r"\bevery\s+(?:(?:and\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*)+",
    r"\bevery\s+weekday\b",
    r"\b(?:every\s+day|daily)\b",
    r"\b(?:every\s+week|weekly)\b",
    r"\b(?:every\s+month|monthly)\b",
    r"\b(?:every\s+year|yearly|annually)\b",
    r"\bevery\s+morning\b",
    r"\bevery\s+(?:evening|night)\b",
    r"\b(?:every\s+hour|hourly)\b",
]


def _parse_recurrence(text: str) -> tuple[str | None, list[str]]:
    """Detect recurrence patterns. Returns (rrule, strip_patterns)."""
    for pattern, recurrence_type in RECURRENCE_PATTERNS:
        if pattern.search(text):
            rrule = _build_rrule(recurrence_type, text)
            if rrule:
                # Use simple literal strip patterns (not the raw regex)
                matched_text = pattern.search(text).group(0)  # type: ignore[union-attr]
                return rrule, [re.escape(matched_text)]
    return None, []


def _parse_time_expr(text: str) -> tuple[int, int] | None:
    if match := re.search(
        r"\b(\d{1,2}):(\d{2})\s*(am|pm)\b", text, flags=re.IGNORECASE
    ):
        hour = int(match.group(1))
        minute = int(match.group(2))
        ampm = match.group(3).lower()
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        return (hour, minute)
    if match := re.search(r"\b(\d{1,2}):(\d{2})\b", text, flags=re.IGNORECASE):
        return (int(match.group(1)), int(match.group(2)))
    if match := re.search(r"\b(\d{1,2})\s*(am|pm)\b", text, flags=re.IGNORECASE):
        hour = int(match.group(1))
        ampm = match.group(2).lower()
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        return (hour, 0)
    return None


def _apply_time(
    base: datetime,
    explicit_time: tuple[int, int] | None,
    default_time: tuple[int, int] = (DEFAULT_HOUR, DEFAULT_MINUTE),
) -> datetime:
    hour, minute = explicit_time or default_time
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _resolve_next_weekday(now: datetime, weekday_name: str) -> datetime:
    target = WEEKDAY_NAMES.index(weekday_name)
    days = (target - now.weekday()) % 7 or 7
    return now + timedelta(days=days)


def _resolve_this_weekday(now: datetime, weekday_name: str) -> datetime:
    target = WEEKDAY_NAMES.index(weekday_name)
    return (now - timedelta(days=now.weekday())) + timedelta(days=target)


def _parse_ordinal_day(
    day_text: str, now: datetime, explicit_time: tuple[int, int] | None
) -> datetime | None:
    day = int(re.sub(r"(st|nd|rd|th)$", "", day_text, flags=re.IGNORECASE))
    year = now.year
    month = now.month
    while True:
        last_day = monthrange(year, month)[1]
        if day <= last_day:
            candidate = real_datetime(year, month, day, tzinfo=UTC)
            candidate = _apply_time(candidate, explicit_time)
            if candidate.date() > now.date():
                return candidate
        month += 1
        if month > 12:
            month = 1
            year += 1
        if year > now.year + 3:
            return None


def _parse_absolute_month_date(
    date_text: str, now: datetime, explicit_time: tuple[int, int] | None
) -> datetime | None:
    match = re.fullmatch(
        r"\s*([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?\s*",
        date_text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    month = MONTH_NUMBERS.get(match.group(1).lower())
    if month is None:
        return None
    year = int(match.group(3)) if match.group(3) else now.year
    try:
        candidate = real_datetime(year, month, int(match.group(2)), tzinfo=UTC)
    except ValueError:
        return None
    if match.group(3) is None and candidate.date() <= now.date():
        candidate = candidate.replace(year=candidate.year + 1)
    return _apply_time(candidate, explicit_time)


def _unique_datetimes(values: list[datetime]) -> list[datetime]:
    seen: set[str] = set()
    unique: list[datetime] = []
    for value in values:
        key = value.isoformat()
        if key not in seen:
            seen.add(key)
            unique.append(value)
    return unique


def _parse_priority(text: str) -> tuple[int, list[str]]:
    low = text.lower()
    low_without_tags = re.sub(r"#\w+", " ", low)
    strip_patterns = [r"!high", r"!med", r"!low", r"![1234]"]
    for token, priority in PRIORITY_MAP.items():
        if token in low:
            return priority, strip_patterns
    for pattern, priority in PRIORITY_PATTERNS:
        if pattern.search(low_without_tags):
            strip_patterns.append(pattern.pattern)
            return priority, strip_patterns
    return 2, strip_patterns


def _parse_due(text: str, now: datetime) -> tuple[list[datetime], list[str], list[str]]:
    low = text.lower()
    explicit_time = _parse_time_expr(text)
    candidates: list[datetime] = []
    strip_patterns: list[str] = []
    ambiguity_hints: list[str] = []

    def add_candidate(value: datetime, pattern: str) -> None:
        candidates.append(value)
        strip_patterns.append(pattern)

    for keyword, delta in (
        ("tomorrow", timedelta(days=1)),
        ("tmrw", timedelta(days=1)),
        ("next week", timedelta(days=7)),
    ):
        if keyword in low:
            add_candidate(
                _apply_time(now + delta, explicit_time, (0, 0)), re.escape(keyword)
            )
            if keyword == "next week":
                ambiguity_hints.append(
                    "due date unclear: 'next week' defaulted to next week's local midnight"
                )
    if re.search(r"\b(?:tonight|this evening)\b", low):
        base = now if now.hour < 18 else now + timedelta(days=1)
        add_candidate(
            _apply_time(base, explicit_time, (EVENING_HOUR, 0)),
            r"\b(?:tonight|this evening)\b",
        )
    if match := re.search(r"\bin\s+(\d+)\s+days?\b", low):
        add_candidate(
            _apply_time(now + timedelta(days=int(match.group(1))), explicit_time),
            r"\bin\s+\d+\s+days?\b",
        )
    if match := re.search(r"\bin\s+(\d+)\s*h(?:ours?)?\b", low):
        add_candidate(
            now + timedelta(hours=int(match.group(1))), r"\bin\s+\d+\s*h(?:ours?)?\b"
        )
    if match := re.search(r"\bin\s+(\d+)\s*min(?:utes?)?\b", low):
        add_candidate(
            now + timedelta(minutes=int(match.group(1))),
            r"\bin\s+\d+\s*min(?:utes?)?\b",
        )
    # "every monday" with a due date = first occurrence of that weekday
    if re.search(
        r"\bevery\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", low
    ):
        first_day = re.search(
            r"\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
            low,
        )
        if first_day:
            resolved = _resolve_next_weekday(now, first_day.group(1))
            add_candidate(
                _apply_time(resolved, explicit_time), r""
            )  # Don't strip — handled by recurrence
    for match in re.finditer(
        r"\b(?:(this|next|due|by)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        low,
    ):
        # Skip if it's part of "every <weekday> [and <weekday>]*" — handled by recurrence
        prefix_text = low[: match.start()]
        if prefix_text.rstrip().endswith("every"):
            continue
        if prefix_text.rstrip().endswith("and"):
            continue
        qualifier = (match.group(1) or "").strip()
        weekday_name = match.group(2)
        resolved = (
            _resolve_this_weekday(now, weekday_name)
            if qualifier == "this"
            else _resolve_next_weekday(now, weekday_name)
        )
        add_candidate(
            _apply_time(resolved, explicit_time, (0, 0)), re.escape(match.group(0))
        )
        ambiguity_hints.append(
            f"due date inferred from weekday '{weekday_name}' and defaulted to local midnight"
        )
    for match in re.finditer(r"\b(\d{4}-\d{2}-\d{2})\b", text):
        try:
            add_candidate(
                _apply_time(
                    real_datetime.strptime(match.group(1), "%Y-%m-%d").replace(
                        tzinfo=UTC
                    ),
                    explicit_time,
                ),
                re.escape(match.group(0)),
            )
        except ValueError:
            pass
    month_pattern = (
        r"\b(?:"
        + "|".join(MONTH_NAMES)
        + r")\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?\b"
    )
    for match in re.finditer(month_pattern, low):
        if parsed := _parse_absolute_month_date(match.group(0), now, explicit_time):
            add_candidate(parsed, re.escape(match.group(0)))
    for match in re.finditer(r"\b\d{1,2}(?:st|nd|rd|th)\b", low):
        if parsed := _parse_ordinal_day(match.group(0), now, explicit_time):
            add_candidate(parsed, re.escape(match.group(0)))
    return _unique_datetimes(candidates), strip_patterns, ambiguity_hints


def _clean_title(text: str, strip_patterns: list[str]) -> str:
    title = text
    for pattern in strip_patterns:
        if not pattern:
            continue
        title = re.sub(pattern, " ", title, flags=re.IGNORECASE)
    title = re.sub(r"#\w+", " ", title, flags=re.IGNORECASE)
    title = re.sub(TIME_RE, " ", title)
    title = re.sub(r"\s+", " ", title).strip(" ,;:-")
    edge_fillers = r"(?:by|on|at|due|before|after|for|the|this|next|every|of)"
    while True:
        next_title = re.sub(
            rf"^(?:{edge_fillers})\b\s*", "", title, flags=re.IGNORECASE
        )
        next_title = re.sub(
            rf"\s*\b(?:{edge_fillers})$", "", next_title, flags=re.IGNORECASE
        )
        next_title = re.sub(r"\s+", " ", next_title).strip(" ,;:-")
        if next_title == title:
            return next_title
        title = next_title


def parse(text: str, user_tz: str = "UTC") -> dict[str, object]:
    text = (text or "").strip()[:MAX_LEN]
    tags = re.findall(r"#(\w+)", text)
    priority, priority_strip_patterns = _parse_priority(text)
    recurrence_rule, recurrence_strip_patterns = _parse_recurrence(text)
    try:
        tz = ZoneInfo(user_tz)
    except ZoneInfoNotFoundError:
        tz = UTC
    now = datetime.now(tz)
    due_candidates, due_strip_patterns, ambiguity_hints = _parse_due(text, now)
    due = due_candidates[0].isoformat() if due_candidates else None
    title = _clean_title(
        text, priority_strip_patterns + due_strip_patterns + recurrence_strip_patterns
    )
    return {
        "title": title or text,
        "priority": int(priority),
        "tags": tags,
        "due_at": due,
        "recurrence_rule": recurrence_rule,
        "estimated_minutes": None,
        "ambiguity": bool(ambiguity_hints),
        "ambiguity_hints": ambiguity_hints,
    }
