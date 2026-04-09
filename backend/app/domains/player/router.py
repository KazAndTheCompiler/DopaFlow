"""Stub player routes for focus music."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.middleware.auth_scopes import require_scope
from app.domains.player.schemas import (
    PlayerNextTrackResponse,
    PlayerPredownloadJobResponse,
    PlayerPredownloadStatusResponse,
    PlayerPredownloadTickResponse,
    PlayerQueueRequest,
    PlayerQueueResponse,
    PlayerResolveUrlRequest,
    PlayerResolveUrlResponse,
)
from app.domains.player.service import PlayerService

router = APIRouter(prefix="/player", tags=["player"])
_svc = PlayerService()


@router.post("/resolve-url", response_model=PlayerResolveUrlResponse, dependencies=[Depends(require_scope("write:player"))])
async def resolve_url(payload: PlayerResolveUrlRequest) -> PlayerResolveUrlResponse:
    return PlayerResolveUrlResponse(**_svc.resolve_url(payload.url))


@router.post("/queue", response_model=PlayerQueueResponse, dependencies=[Depends(require_scope("write:player"))])
async def save_queue(payload: PlayerQueueRequest | None = None) -> PlayerQueueResponse:
    items = payload.items if payload else []
    return PlayerQueueResponse(**_svc.save_queue(items))


@router.get("/queue", response_model=PlayerQueueResponse, dependencies=[Depends(require_scope("read:player"))])
async def get_queue() -> PlayerQueueResponse:
    return PlayerQueueResponse(**_svc.get_queue())


@router.post("/queue/next", response_model=PlayerNextTrackResponse, dependencies=[Depends(require_scope("write:player"))])
async def next_track() -> PlayerNextTrackResponse:
    return PlayerNextTrackResponse(**_svc.next_track())


@router.post("/predownload/enqueue", response_model=PlayerPredownloadJobResponse, dependencies=[Depends(require_scope("write:player"))])
async def enqueue_predownload(payload: dict[str, object] | None = None) -> PlayerPredownloadJobResponse:
    return PlayerPredownloadJobResponse(**_svc.enqueue_predownload(payload or {}))


@router.get("/predownload/status", response_model=PlayerPredownloadStatusResponse, dependencies=[Depends(require_scope("read:player"))])
async def predownload_status() -> PlayerPredownloadStatusResponse:
    return PlayerPredownloadStatusResponse(**_svc.predownload_status())


@router.post("/predownload/retry/{job_id}", response_model=PlayerPredownloadJobResponse, dependencies=[Depends(require_scope("write:player"))])
async def retry_predownload(job_id: str) -> PlayerPredownloadJobResponse:
    return PlayerPredownloadJobResponse(**_svc.retry_predownload(job_id))


@router.post("/predownload/tick/{job_id}", response_model=PlayerPredownloadTickResponse, dependencies=[Depends(require_scope("write:player"))])
async def tick_predownload(job_id: str) -> PlayerPredownloadTickResponse:
    return PlayerPredownloadTickResponse(**_svc.tick_predownload(job_id))
