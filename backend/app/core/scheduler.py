"""Background scheduler for recurring backend jobs."""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.domains.journal.service import JournalService

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None
_spoken_tasks: set[str] = set()


def _expire_focus_sessions() -> None:
    from app.domains.focus import service as focus_service

    state = focus_service.state
    if state is None or state.status != focus_service.PomodoroStatus.running:
        return
    elapsed = focus_service.get_status().get("elapsed_seconds", 0)
    limit = state.duration_minutes * 60
    if elapsed >= limit:
        try:
            focus_service.complete()
        except Exception:
            logger.exception("Failed to complete focus session")


def _speak_due_tasks() -> None:
    """Speak tasks due within the next 2 minutes via TTS."""
    try:
        from datetime import datetime, timedelta

        from app.core.config import get_settings
        from app.core.database import get_db
        from app.services.tts import speak

        settings = get_settings()
        now = datetime.utcnow()
        window = (now + timedelta(minutes=2)).isoformat()
        with get_db(settings.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, title FROM tasks
                WHERE done = 0
                  AND due_at IS NOT NULL
                  AND due_at <= ?
                ORDER BY due_at ASC
                LIMIT 5
                """,
                (window,),
            ).fetchall()
        for row in rows:
            task_id, title = row["id"], row["title"]
            if task_id not in _spoken_tasks:
                _spoken_tasks.add(task_id)
                speak(f"Task due: {title}")
    except Exception:
        logger.exception("Failed to speak due tasks")


def _materialize_recurring_tasks() -> None:
    """Materialize recurring task instances for the next 36 hours."""
    try:
        from app.core.config import get_settings
        from app.domains.tasks import repository as tasks_repo

        settings = get_settings()
        tasks_repo.materialize_recurring(settings.db_path, window_hours=36)
    except Exception:
        logger.exception("Failed to materialize recurring tasks")


def _sync_peer_feeds() -> None:
    try:
        from app.core.config import get_settings
        from app.domains.calendar_sharing.service import CalendarSharingService
        from app.domains.calendar_sharing.repository import CalendarSharingRepository
        settings = get_settings()
        svc = CalendarSharingService(CalendarSharingRepository(settings.db_path))
        svc.sync_all_feeds()
    except Exception:
        logger.exception("Peer feed sync failed")


def start_scheduler(journal_service: JournalService) -> None:
    global _scheduler

    if _scheduler is None:
        _scheduler = BackgroundScheduler()

    if _scheduler.running:
        return

    _scheduler.add_job(journal_service.trigger_backup, "cron", hour=0, minute=0, id="nightly-journal-backup", replace_existing=True)
    _scheduler.add_job(_expire_focus_sessions, "interval", seconds=30, id="expire_focus", replace_existing=True)
    _scheduler.add_job(_speak_due_tasks, "interval", seconds=60, id="speak_due_tasks", replace_existing=True)
    _scheduler.add_job(_materialize_recurring_tasks, "cron", hour="*/6", id="materialize_recurring", replace_existing=True)
    _scheduler.add_job(_sync_peer_feeds, "interval", minutes=15, id="sync_peer_feeds", replace_existing=True)
    _scheduler.start()
