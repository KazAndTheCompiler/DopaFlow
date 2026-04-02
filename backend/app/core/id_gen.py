"""Stable, prefixed opaque IDs per ADR-0002."""

from __future__ import annotations

import random
import string
import time

_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_PREFIXES = {"tsk", "hab", "foc", "rev", "jrn", "evt", "blk", "rem", "ntf", "cmd", "alm", "shr", "pf"}


def _encode_base32(value: int, length: int) -> str:
    """Encode a positive integer into a fixed-length Crockford-style base32 string."""

    encoded = ""
    for _ in range(length):
        encoded = _CHARS[value % 32] + encoded
        value //= 32
    return encoded


def _ulid_suffix() -> str:
    """Generate a 26-char time-sortable random suffix (simplified ULID)."""

    ts = int(time.time() * 1000)
    ts_part = _encode_base32(ts, 10)
    rand_part = "".join(random.SystemRandom().choice(_CHARS) for _ in range(16))
    return ts_part + rand_part


def new_id(prefix: str) -> str:
    """Generate a new prefixed stable ID, for example `tsk` or `evt`."""

    if prefix not in _PREFIXES:
        raise ValueError(f"Unsupported ID prefix: {prefix}")
    return f"{prefix}_{_ulid_suffix()}"


def validate_prefix(identifier: str, expected: str) -> bool:
    """Return true when an identifier has the expected prefix and ULID-like suffix."""

    return identifier.startswith(f"{expected}_") and len(identifier) == len(expected) + 27


def task_id() -> str:
    """Generate a task ID."""

    return new_id("tsk")


def habit_id() -> str:
    """Generate a habit ID."""

    return new_id("hab")


def focus_id() -> str:
    """Generate a focus session ID."""

    return new_id("foc")


def review_card_id() -> str:
    """Generate a review card ID."""

    return new_id("rev")


def journal_id() -> str:
    """Generate a journal entry ID."""

    return new_id("jrn")


def event_id() -> str:
    """Generate a calendar event ID."""

    return new_id("evt")


def block_id() -> str:
    """Generate a time block ID."""

    return new_id("blk")


def reminder_id() -> str:
    """Generate a reminder ID."""

    return new_id("rem")


def notification_id() -> str:
    """Generate a notification ID."""

    return new_id("ntf")


def alarm_id() -> str:
    """Generate an alarm ID."""

    return new_id("alm")


def project_id() -> str:
    """Generate a project ID."""

    return new_id("prj")


def share_id() -> str:
    """Generate a calendar share ID."""

    return new_id("shr")


def peer_feed_id() -> str:
    """Generate a peer feed ID."""

    return new_id("pf")
