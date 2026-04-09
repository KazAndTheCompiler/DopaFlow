# ENDPOINTS
#   GET    /sessions
#   POST   /sessions
#   POST   /sessions/control
#   POST   /start
#   POST   /pause
#   POST   /resume
#   POST   /stop
#   POST   /complete
#   GET    /status
#   GET    /history
#   GET    /stats
#   GET    /recommendation

"""FastAPI router for focus and Pomodoro flows."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.config import Settings, get_settings_dependency
from app.domains.focus import repository, service
from app.domains.focus.schemas import (
    FocusControlRequest,
    FocusRecommendation,
    FocusSessionCreate,
    FocusSessionRead,
    FocusStats,
    FocusStatus,
)
from app.middleware.auth_scopes import require_scope

router = APIRouter(tags=["focus"])


async def _db_path(settings: Settings = Depends(get_settings_dependency)) -> str:
    return settings.db_path


# ── REST surface (used by frontend hooks) ──────────────────────────────────


@router.get(
    "/sessions",
    response_model=list[FocusSessionRead],
    dependencies=[Depends(require_scope("read:focus"))],
)
async def list_sessions(
    limit: int = Query(default=30),
    db_path: str = Depends(_db_path),
) -> list[FocusSessionRead]:
    """List recent focus sessions."""

    return repository.list_sessions(db_path, limit=limit)


@router.post(
    "/sessions",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def start_session(
    payload: FocusSessionCreate,
    _db_path: str = Depends(_db_path),
) -> FocusStatus:
    """Start a new Pomodoro or deep-focus session."""

    return service.start(payload.duration_minutes, payload.task_id)


@router.post(
    "/sessions/control",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def control_session(payload: FocusControlRequest) -> FocusStatus:
    """Pause, resume, or complete the active session."""

    action = payload.action
    if action == "paused":
        return service.pause()
    if action == "running":
        return service.resume()
    if action in {"completed", "stopped"}:
        return service.complete() if action == "completed" else service.stop()
    return service.get_status()


# ── Convenience single-action verbs (keep for backward compatibility) ──────


@router.post(
    "/start",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def start_focus(payload: dict | None = None) -> FocusStatus:
    payload = payload or {}
    return service.start(
        int(payload.get("duration_minutes", 25)), payload.get("task_id")
    )


@router.post(
    "/pause",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def pause_focus() -> FocusStatus:
    return service.pause()


@router.post(
    "/resume",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def resume_focus() -> FocusStatus:
    return service.resume()


@router.post(
    "/stop",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def stop_focus() -> FocusStatus:
    return service.stop()


@router.post(
    "/complete",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def complete_focus() -> FocusStatus:
    return service.complete()


@router.get(
    "/status",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("read:focus"))],
)
async def focus_status() -> FocusStatus:
    return service.get_status()


@router.get(
    "/history",
    response_model=list[FocusSessionRead],
    dependencies=[Depends(require_scope("read:focus"))],
)
async def focus_history(
    limit: int = Query(default=30),
    db_path: str = Depends(_db_path),
) -> list[FocusSessionRead]:
    return repository.list_sessions(db_path, limit=limit)


@router.get(
    "/stats",
    response_model=FocusStats,
    dependencies=[Depends(require_scope("read:focus"))],
)
async def focus_stats(db_path: str = Depends(_db_path)) -> FocusStats:
    return repository.session_stats(db_path)


@router.get(
    "/recommendation",
    response_model=FocusRecommendation,
    dependencies=[Depends(require_scope("read:focus"))],
)
async def focus_recommendation(db_path: str = Depends(_db_path)) -> FocusRecommendation:
    return repository.session_recommendation(db_path)
