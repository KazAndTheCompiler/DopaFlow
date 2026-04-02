"""Pomodoro state machine and focus-domain orchestration."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from app.core.config import get_settings
from app.domains.gamification.repository import GamificationRepository
from app.domains.gamification.service import GamificationService
from app.domains.focus import repository


class PomodoroStatus(str, Enum):
    idle = "idle"
    running = "running"
    paused = "paused"


@dataclass
class PomodoroState:
    status: PomodoroStatus = PomodoroStatus.idle
    duration_minutes: int = 25
    started_at: str | None = None
    paused_at: str | None = None
    elapsed_seconds: int = 0
    log_id: str | None = None
    task_id: str | None = None


state = PomodoroState()


def _award(source: str, source_id: str | None = None) -> None:
    try:
        db = get_settings().db_path
        GamificationService(GamificationRepository(db)).award(source, source_id)
    except Exception:
        pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _elapsed_seconds() -> int:
    if state.status != PomodoroStatus.running or not state.started_at:
        return state.elapsed_seconds
    started_at = datetime.fromisoformat(state.started_at)
    return max(state.elapsed_seconds, int((_now() - started_at).total_seconds()))


def start(minutes: int, task_id: str | None = None) -> dict[str, Any]:
    """Start a Pomodoro session."""

    db_path = get_settings().db_path
    reconcile_stale(db_path)
    session_id = repository.create_session(db_path, task_id, minutes)
    started_at = _now().isoformat()
    repository.write_active_session(db_path, session_id=session_id, task_id=task_id, started_at=started_at, paused_duration_ms=0)
    state.status = PomodoroStatus.running
    state.duration_minutes = minutes
    state.started_at = started_at
    state.paused_at = None
    state.elapsed_seconds = 0
    state.log_id = session_id
    state.task_id = task_id
    return get_status()


def pause() -> dict[str, Any]:
    """Pause the active Pomodoro."""

    if state.status != PomodoroStatus.running:
        return get_status()
    state.status = PomodoroStatus.paused
    state.paused_at = _now().isoformat()
    return get_status()


def resume() -> dict[str, Any]:
    """Resume the active Pomodoro."""

    if state.status != PomodoroStatus.paused:
        return get_status()
    paused_at = datetime.fromisoformat(state.paused_at) if state.paused_at else _now()
    state.elapsed_seconds += int((_now() - paused_at).total_seconds())
    state.status = PomodoroStatus.running
    state.paused_at = None
    return get_status()


def stop() -> dict[str, Any]:
    """Stop the active Pomodoro without marking it complete."""

    if state.log_id:
        repository.end_session(get_settings().db_path, state.log_id, completed=False)
        repository.clear_active_session(get_settings().db_path)
    state.status = PomodoroStatus.idle
    state.paused_at = None
    return get_status()


def complete() -> dict[str, Any]:
    """Complete the active Pomodoro."""

    if state.log_id:
        db_path = get_settings().db_path
        repository.end_session(db_path, state.log_id, completed=True)
        repository.clear_active_session(db_path)
        _award("focus_session", state.log_id)
    state.status = PomodoroStatus.idle
    state.paused_at = None
    return get_status()


def get_status() -> dict[str, Any]:
    """Return the current in-memory Pomodoro state."""

    return {
        "status": state.status.value,
        "duration_minutes": state.duration_minutes,
        "started_at": state.started_at,
        "paused_at": state.paused_at,
        "elapsed_seconds": _elapsed_seconds(),
        "log_id": state.log_id,
        "task_id": state.task_id,
    }


def reconcile_stale(db_path: str) -> None:
    """Close stale active sessions older than four hours."""

    active = repository.get_active_session(db_path)
    if not active:
        return
    started_at = datetime.fromisoformat(active["started_at"])
    if _now() - started_at > timedelta(hours=4):
        session_id = active.get("session_id")
        if session_id:
            repository.end_session(db_path, session_id, completed=False)
        repository.clear_active_session(db_path)
