"""Stub player routes for focus music."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.middleware.auth_scopes import require_scope
from app.domains.player.service import PlayerService

router = APIRouter(prefix="/player", tags=["player"])
_svc = PlayerService()


@router.post("/resolve-url", dependencies=[Depends(require_scope("write:player"))])
async def resolve_url(payload: dict[str, object]) -> dict[str, object]:
    return _svc.resolve_url(str(payload.get("url", "")))


@router.post("/queue", dependencies=[Depends(require_scope("write:player"))])
async def save_queue(payload: dict[str, object] | None = None) -> dict[str, object]:
    items = payload.get("items", []) if payload else []
    return _svc.save_queue(items if isinstance(items, list) else [])


@router.get("/queue", dependencies=[Depends(require_scope("read:player"))])
async def get_queue() -> dict[str, object]:
    return _svc.get_queue()


@router.post("/queue/next", dependencies=[Depends(require_scope("write:player"))])
async def next_track() -> dict[str, object]:
    return _svc.next_track()


@router.post("/predownload/enqueue", dependencies=[Depends(require_scope("write:player"))])
async def enqueue_predownload(payload: dict[str, object] | None = None) -> dict[str, object]:
    return _svc.enqueue_predownload(payload or {})


@router.get("/predownload/status", dependencies=[Depends(require_scope("read:player"))])
async def predownload_status() -> dict[str, object]:
    return _svc.predownload_status()


@router.post("/predownload/retry/{job_id}", dependencies=[Depends(require_scope("write:player"))])
async def retry_predownload(job_id: str) -> dict[str, object]:
    return _svc.retry_predownload(job_id)


@router.post("/predownload/tick/{job_id}", dependencies=[Depends(require_scope("write:player"))])
async def tick_predownload(job_id: str) -> dict[str, object]:
    return _svc.tick_predownload(job_id)
