"""Pomodoro state machine and focus-domain orchestration."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum

from app.core.gamification_helpers import award as award_gamification
from app.domains.focus.repository import FocusRepository
from app.domains.focus.schemas import FocusStatus

logger = logging.getLogger(__name__)


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


def _restore_from_db(repo: FocusRepository) -> None:
    """Restore in-memory state from DB when the process restarted mid-session."""

    if state.status != PomodoroStatus.idle:
        return
    try:
        active = repo.get_active_session()
        if not active:
            return
        session_id = active.get("session_id")
        if not session_id:
            return
        db_session = repo.get_session(session_id)
        if not db_session or db_session.get("status") in ("completed", "stopped"):
            repo.clear_active_session()
            return
        db_status = db_session.get("status", "running")
        state.status = (
            PomodoroStatus.paused if db_status == "paused" else PomodoroStatus.running
        )
        state.duration_minutes = db_session.get("duration_minutes") or 25
        state.started_at = active.get("started_at")
        state.log_id = session_id
        state.task_id = active.get("task_id")
        # If restoring into paused state, set paused_at to now (exact pause start lost on restart)
        state.paused_at = _now().isoformat() if db_status == "paused" else None
        state.elapsed_seconds = 0
    except Exception:
        logger.exception("Failed to restore focus state from DB")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _elapsed_seconds() -> int:
    if state.status != PomodoroStatus.running or not state.started_at:
        return state.elapsed_seconds
    started_at = datetime.fromisoformat(state.started_at)
    return max(state.elapsed_seconds, int((_now() - started_at).total_seconds()))


def start(db_path: str, minutes: int, task_id: str | None = None) -> FocusStatus:
    """Start a Pomodoro session."""

    repo = FocusRepository(db_path)
    reconcile_stale(db_path)
    session_id = repo.create_session(task_id, minutes)
    started_at = _now().isoformat()
    repo.write_active_session(
        session_id=session_id,
        task_id=task_id,
        started_at=started_at,
        paused_duration_ms=0,
    )
    state.status = PomodoroStatus.running
    state.duration_minutes = minutes
    state.started_at = started_at
    state.paused_at = None
    state.elapsed_seconds = 0
    state.log_id = session_id
    state.task_id = task_id
    return get_status()


def pause(db_path: str) -> FocusStatus:
    """Pause the active Pomodoro."""

    repo = FocusRepository(db_path)
    _restore_from_db(repo)
    if state.status != PomodoroStatus.running:
        return get_status()
    state.status = PomodoroStatus.paused
    state.paused_at = _now().isoformat()
    if state.log_id:
        repo.update_session_status(state.log_id, "paused")
    return get_status()


def resume(db_path: str) -> FocusStatus:
    """Resume the active Pomodoro."""

    repo = FocusRepository(db_path)
    _restore_from_db(repo)
    if state.status != PomodoroStatus.paused:
        return get_status()
    paused_at = datetime.fromisoformat(state.paused_at) if state.paused_at else _now()
    pause_ms = int((_now() - paused_at).total_seconds() * 1000)
    state.elapsed_seconds += int((_now() - paused_at).total_seconds())
    state.status = PomodoroStatus.running
    state.paused_at = None
    if state.log_id:
        repo.add_pause_duration(state.log_id, pause_ms)
        repo.update_session_status(state.log_id, "running")
    return get_status()


def stop(db_path: str) -> FocusStatus:
    """Stop the active Pomodoro without marking it complete."""

    repo = FocusRepository(db_path)
    _restore_from_db(repo)
    if state.log_id:
        repo.end_session(state.log_id, completed=False)
        repo.clear_active_session()
    state.status = PomodoroStatus.idle
    state.paused_at = None
    return get_status()


def complete(db_path: str) -> FocusStatus:
    """Complete the active Pomodoro."""

    repo = FocusRepository(db_path)
    _restore_from_db(repo)
    if state.log_id:
        repo.end_session(state.log_id, completed=True)
        repo.clear_active_session()
        award_gamification("focus_session", state.log_id, logger=logger)
    state.status = PomodoroStatus.idle
    state.paused_at = None
    return get_status()


def get_status() -> FocusStatus:
    """Return the current in-memory Pomodoro state."""

    return FocusStatus(
        status=state.status.value,
        duration_minutes=state.duration_minutes,
        started_at=state.started_at,
        paused_at=state.paused_at,
        elapsed_seconds=_elapsed_seconds(),
        log_id=state.log_id,
        task_id=state.task_id,
    )


def reconcile_stale(db_path: str) -> None:
    """Close stale active sessions older than four hours."""

    repo = FocusRepository(db_path)
    active = repo.get_active_session()
    if not active:
        return
    started_at = datetime.fromisoformat(active["started_at"])
    if _now() - started_at > timedelta(hours=4):
        session_id = active.get("session_id")
        if session_id:
            repo.end_session(session_id, completed=False)
        repo.clear_active_session()
