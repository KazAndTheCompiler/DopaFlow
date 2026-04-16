# ENDPOINTS
#   GET    /
#   POST   /
#   POST   /{identifier}/read
#   POST   /read-all
#   POST   /{identifier}/archive
#   DELETE /{identifier}
#   GET    /unread-count

"""FastAPI router for notifications."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings_dependency
from app.domains.notifications.repository import NotificationRepository
from app.domains.notifications.schemas import (
    Notification,
    NotificationCreate,
    NotificationDeleteResult,
    NotificationMutationResult,
    UnreadCount,
)
from app.middleware.auth_scopes import require_scope

router = APIRouter(tags=["notifications"])


def _repo(settings: Settings = Depends(get_settings_dependency)) -> NotificationRepository:
    return NotificationRepository(settings)


@router.get(
    "/",
    response_model=list[Notification],
    dependencies=[Depends(require_scope("read:notifications"))],
)
async def list_notifications(
    archived: bool = Query(default=False),
    level: str | None = Query(default=None),
    limit: int = Query(default=50),
    repo: NotificationRepository = Depends(_repo),
) -> list[Notification]:
    return repo.list_notifications(archived=archived, level=level, limit=limit)


@router.post(
    "/",
    response_model=Notification,
    dependencies=[Depends(require_scope("write:notifications"))],
)
async def create_notification(
    payload: NotificationCreate, repo: NotificationRepository = Depends(_repo)
) -> Notification:
    return repo.create_notification(
        payload.level,
        payload.title,
        payload.body,
        payload.action_url,
    )


@router.post(
    "/{identifier}/read",
    response_model=NotificationMutationResult,
    dependencies=[Depends(require_scope("write:notifications"))],
)
async def mark_read(
    identifier: str, repo: NotificationRepository = Depends(_repo)
) -> NotificationMutationResult:
    if not repo.mark_read(identifier):
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationMutationResult()


@router.post(
    "/read-all",
    response_model=UnreadCount,
    dependencies=[Depends(require_scope("write:notifications"))],
)
async def mark_all_read(repo: NotificationRepository = Depends(_repo)) -> UnreadCount:
    return UnreadCount(count=repo.mark_all_read())


@router.post(
    "/{identifier}/archive",
    response_model=NotificationMutationResult,
    dependencies=[Depends(require_scope("write:notifications"))],
)
async def archive_notification(
    identifier: str, repo: NotificationRepository = Depends(_repo)
) -> NotificationMutationResult:
    if not repo.archive(identifier):
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationMutationResult()


@router.delete(
    "/{identifier}",
    response_model=NotificationDeleteResult,
    dependencies=[Depends(require_scope("write:notifications"))],
)
async def delete_notification(
    identifier: str, repo: NotificationRepository = Depends(_repo)
) -> NotificationDeleteResult:
    if not repo.delete_notification(identifier):
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationDeleteResult()


@router.get(
    "/unread-count",
    response_model=UnreadCount,
    dependencies=[Depends(require_scope("read:notifications"))],
)
async def unread_count(repo: NotificationRepository = Depends(_repo)) -> UnreadCount:
    return UnreadCount(count=repo.unread_count())