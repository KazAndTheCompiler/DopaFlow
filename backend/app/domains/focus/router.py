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
from app.domains.focus import service
from app.domains.focus.repository import FocusRepository
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


def _repo(settings: Settings = Depends(get_settings_dependency)) -> FocusRepository:
    return FocusRepository(settings)


# ── REST surface (used by frontend hooks) ──────────────────────────────────


@router.get(
    "/sessions",
    response_model=list[FocusSessionRead],
    dependencies=[Depends(require_scope("read:focus"))],
)
async def list_sessions(
    limit: int = Query(default=30),
    repo: FocusRepository = Depends(_repo),
) -> list[FocusSessionRead]:
    """List recent focus sessions."""

    return repo.list_sessions(limit=limit)


@router.post(
    "/sessions",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def start_session(
    payload: FocusSessionCreate,
    repo: FocusRepository = Depends(_repo),
) -> FocusStatus:
    """Start a new Pomodoro or deep-focus session."""

    return service.start(repo.db_path, payload.duration_minutes, payload.task_id)


@router.post(
    "/sessions/control",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def control_session(
    payload: FocusControlRequest,
    repo: FocusRepository = Depends(_repo),
) -> FocusStatus:
    """Pause, resume, or complete the active session."""

    action = payload.action
    if action == "paused":
        return service.pause(repo.db_path)
    if action == "running":
        return service.resume(repo.db_path)
    if action in {"completed", "stopped"}:
        return (
            service.complete(repo.db_path)
            if action == "completed"
            else service.stop(repo.db_path)
        )
    return service.get_status()


# ── Convenience single-action verbs (keep for backward compatibility) ──────


@router.post(
    "/start",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def start_focus(
    payload: dict | None = None, repo: FocusRepository = Depends(_repo)
) -> FocusStatus:
    payload = payload or {}
    return service.start(
        repo.db_path, int(payload.get("duration_minutes", 25)), payload.get("task_id")
    )


@router.post(
    "/pause",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def pause_focus(repo: FocusRepository = Depends(_repo)) -> FocusStatus:
    return service.pause(repo.db_path)


@router.post(
    "/resume",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def resume_focus(repo: FocusRepository = Depends(_repo)) -> FocusStatus:
    return service.resume(repo.db_path)


@router.post(
    "/stop",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def stop_focus(repo: FocusRepository = Depends(_repo)) -> FocusStatus:
    return service.stop(repo.db_path)


@router.post(
    "/complete",
    response_model=FocusStatus,
    dependencies=[Depends(require_scope("write:focus"))],
)
async def complete_focus(repo: FocusRepository = Depends(_repo)) -> FocusStatus:
    return service.complete(repo.db_path)


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
    repo: FocusRepository = Depends(_repo),
) -> list[FocusSessionRead]:
    return repo.list_sessions(limit=limit)


@router.get(
    "/stats",
    response_model=FocusStats,
    dependencies=[Depends(require_scope("read:focus"))],
)
async def focus_stats(repo: FocusRepository = Depends(_repo)) -> FocusStats:
    return repo.session_stats()


@router.get(
    "/recommendation",
    response_model=FocusRecommendation,
    dependencies=[Depends(require_scope("read:focus"))],
)
async def focus_recommendation(repo: FocusRepository = Depends(_repo)) -> FocusRecommendation:
    return repo.session_recommendation()