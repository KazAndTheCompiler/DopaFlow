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
from app.domains.notifications import repository
from app.middleware.auth_scopes import require_scope

router = APIRouter(tags=["notifications"])


async def _db_path(settings: Settings = Depends(get_settings_dependency)) -> str:
    return settings.db_path


@router.get("/", response_model=list[dict], dependencies=[Depends(require_scope("read:notifications"))])
async def list_notifications(
    archived: bool = Query(default=False),
    level: str | None = Query(default=None),
    limit: int = Query(default=50),
    db_path: str = Depends(_db_path),
) -> list[dict]:
    return repository.list_notifications(db_path, archived=archived, level=level, limit=limit)


@router.post("/", response_model=dict, dependencies=[Depends(require_scope("write:notifications"))])
async def create_notification(payload: dict, db_path: str = Depends(_db_path)) -> dict:
    return repository.create_notification(
        db_path,
        payload["level"],
        payload["title"],
        payload.get("body"),
        payload.get("action_url"),
    )


@router.post("/{identifier}/read", response_model=dict, dependencies=[Depends(require_scope("write:notifications"))])
async def mark_read(identifier: str, db_path: str = Depends(_db_path)) -> dict:
    if not repository.mark_read(db_path, identifier):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/read-all", response_model=dict, dependencies=[Depends(require_scope("write:notifications"))])
async def mark_all_read(db_path: str = Depends(_db_path)) -> dict:
    return {"updated": repository.mark_all_read(db_path)}


@router.post("/{identifier}/archive", response_model=dict, dependencies=[Depends(require_scope("write:notifications"))])
async def archive_notification(identifier: str, db_path: str = Depends(_db_path)) -> dict:
    if not repository.archive(db_path, identifier):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.delete("/{identifier}", response_model=dict, dependencies=[Depends(require_scope("write:notifications"))])
async def delete_notification(identifier: str, db_path: str = Depends(_db_path)) -> dict:
    if not repository.delete_notification(db_path, identifier):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"deleted": True}


@router.get("/unread-count", response_model=dict, dependencies=[Depends(require_scope("read:notifications"))])
async def unread_count(db_path: str = Depends(_db_path)) -> dict:
    return {"count": repository.unread_count(db_path)}
