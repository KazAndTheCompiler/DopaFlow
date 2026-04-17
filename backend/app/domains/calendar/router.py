# ENDPOINTS
#   GET    /calendar/events
#   POST   /calendar/events
#   GET    /calendar/events/{identifier}
#   PATCH  /calendar/events/{identifier}
#   DELETE /calendar/events/{identifier}
#   POST   /calendar/events/{identifier}/move
#   GET    /calendar/feed
#   GET    /calendar/today
#   POST   /calendar/google/sync
#   GET    /calendar/oauth/url
#   GET    /calendar/oauth/callback
#   GET    /calendar/sync/conflicts
#   POST   /calendar/sync/conflicts/{identifier}/resolve
#   GET    /calendar/sync/status

"""API router for the calendar domain."""

from __future__ import annotations

import datetime
import logging
import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings_dependency
from app.domains.calendar.repository import CalendarRepository
from app.domains.calendar.schemas import (
    CalendarDeleteResponse,
    CalendarEvent,
    CalendarEventCreate,
    CalendarFeedEntry,
    CalendarFeedResponse,
    CalendarMoveResponse,
    CalendarOAuthResponse,
    CalendarSyncStatusResponse,
    CalendarTodayEntry,
    CalendarTodayResponse,
    GoogleSyncRequest,
    MoveEventRequest,
    SyncConflict,
)
from app.domains.calendar.service import CalendarService
from app.domains.calendar_sharing.router import require_share_token
from app.middleware.auth_scopes import require_scope
from app.services.event_stream import publish_invalidation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calendar", tags=["calendar"])


def _google_oauth_client() -> httpx.AsyncClient:
    return httpx.AsyncClient()


def _zoescal_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=3.0)


async def _svc(
    settings: Settings = Depends(get_settings_dependency),
) -> CalendarService:
    """Build a CalendarService wired to the real database."""

    return CalendarService(CalendarRepository(settings.db_path))


async def _repo(
    settings: Settings = Depends(get_settings_dependency),
) -> CalendarRepository:
    return CalendarRepository(settings.db_path)


@router.get(
    "/events",
    response_model=list[CalendarEvent],
    dependencies=[Depends(require_scope("read:calendar"))],
)
async def list_events(
    from_dt: str | None = Query(default=None, alias="from"),
    until_dt: str | None = Query(default=None, alias="until"),
    category: str | None = Query(default=None),
    svc: CalendarService = Depends(_svc),
) -> list[CalendarEvent]:
    """List calendar events with optional date-range and category filters."""

    return svc.list_events(from_dt=from_dt, until_dt=until_dt, category=category)


@router.post(
    "/events",
    response_model=CalendarEvent,
    status_code=201,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def create_event(
    payload: CalendarEventCreate,
    settings: Settings = Depends(get_settings_dependency),
    svc: CalendarService = Depends(_svc),
) -> CalendarEvent:
    """Create a new calendar event."""

    event = svc.create_event(payload, db_path=settings.db_path)
    await publish_invalidation("calendar")
    return event


@router.get(
    "/events/{identifier}",
    response_model=CalendarEvent,
    dependencies=[Depends(require_scope("read:calendar"))],
)
async def get_event(
    identifier: str,
    svc: CalendarService = Depends(_svc),
) -> CalendarEvent:
    """Fetch a single calendar event by ID."""

    event = svc.get_event(identifier)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch(
    "/events/{identifier}",
    response_model=CalendarEvent,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def update_event(
    identifier: str,
    patch: dict,
    svc: CalendarService = Depends(_svc),
) -> CalendarEvent:
    """Update a calendar event."""

    event = svc.update_event(identifier, patch)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    await publish_invalidation("calendar")
    return event


@router.delete(
    "/events/{identifier}",
    response_model=CalendarDeleteResponse,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def delete_event(
    identifier: str,
    settings: Settings = Depends(get_settings_dependency),
    svc: CalendarService = Depends(_svc),
) -> CalendarDeleteResponse:
    """Delete a calendar event."""

    if not svc.delete_event(identifier, db_path=settings.db_path):
        raise HTTPException(status_code=404, detail="Event not found")
    await publish_invalidation("calendar")
    return CalendarDeleteResponse(deleted=True)


@router.post(
    "/events/{identifier}/move",
    response_model=CalendarMoveResponse,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def move_event(
    identifier: str,
    payload: MoveEventRequest,
    svc: CalendarService = Depends(_svc),
) -> CalendarMoveResponse:
    """Move a calendar event by delta_minutes; auto_adjust bumps conflicting events forward."""
    result = svc.move_event(identifier, payload)
    if not result.get("moved"):
        raise HTTPException(
            status_code=404, detail=result.get("error", "Event not found")
        )
    await publish_invalidation("calendar")
    return CalendarMoveResponse(**result)


@router.get("/feed", response_model=CalendarFeedResponse)
async def calendar_feed(
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    source: str | None = Query(default=None),
    include_tombstones: bool = Query(default=False),
    _: object = Depends(require_share_token),
    svc: CalendarService = Depends(_svc),
) -> CalendarFeedResponse:
    """Shared contract feed: local events shaped for ZoesCal.

    Share token auth is validated by ShareTokenMiddleware — see calendar_sharing router
    """
    from datetime import datetime, timezone

    def _parse(val: str) -> datetime | None:
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00")).astimezone(
                timezone.utc
            )
        except Exception:
            logger.exception("Failed to parse datetime from query parameter: %s", val)
            return None

    start = _parse(from_)
    end = _parse(to)
    if not start or not end:
        return CalendarFeedResponse(from_=from_, to=to, entries=[], owner="dopaflow")

    all_events = svc.list_events(from_dt=start.isoformat(), until_dt=end.isoformat())
    entries = []
    for ev in all_events:
        if source and ev.source_type != source:
            continue
        entries.append(
            CalendarFeedEntry(
                id=ev.id,
                source="dopaflow",
                source_type=ev.source_type or "event",
                source_id=ev.id,
                source_version="v2",
                dedupe_key=f"evt:{ev.id}",
                conflict_score=0.0,
                title=ev.title,
                description=ev.description,
                start_at=ev.start_at.isoformat(),
                at=ev.start_at.isoformat(),
                end_at=ev.end_at.isoformat(),
                all_day=ev.all_day,
                category=ev.category,
                created_at=ev.created_at.isoformat(),
                updated_at=ev.updated_at.isoformat(),
                read_only=ev.provider_readonly,
                editability_class="readonly_mirror"
                if ev.provider_readonly
                else "editable",
            )
        )
    return CalendarFeedResponse(from_=from_, to=to, entries=entries, owner="dopaflow")


@router.get(
    "/today",
    response_model=CalendarTodayResponse,
    dependencies=[Depends(require_scope("read:calendar"))],
)
async def today_schedule(svc: CalendarService = Depends(_svc)) -> CalendarTodayResponse:
    """Return today's events; falls back to querying ZoesCal if available."""
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).date().isoformat()
    zoescal_base = os.getenv("ZOESCAL_BASE_URL", "http://localhost:8001").rstrip("/")
    try:
        async with _zoescal_client() as client:
            resp = await client.get(
                f"{zoescal_base}/calendar/range",
                params={"start": f"{today}T00:00:00Z", "end": f"{today}T23:59:59Z"},
            )
            resp.raise_for_status()
            payload = resp.json()
            entries = payload.get("entries", []) if isinstance(payload, dict) else []
            return CalendarTodayResponse(
                entries=entries, available=True, source="zoescal"
            )
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "ZoesCal schedule request returned %s from %s",
            exc.response.status_code,
            zoescal_base,
        )
    except httpx.RequestError as exc:
        logger.info("ZoesCal schedule unavailable at %s: %s", zoescal_base, exc)
    except ValueError as exc:
        logger.warning(
            "ZoesCal schedule returned invalid JSON from %s: %s", zoescal_base, exc
        )
    local_events = svc.list_events(
        from_dt=f"{today}T00:00:00Z", until_dt=f"{today}T23:59:59Z"
    )
    entries = [
        CalendarTodayEntry(
            id=ev.id,
            title=ev.title,
            start_at=ev.start_at.isoformat(),
            end_at=ev.end_at.isoformat(),
            all_day=ev.all_day,
            category=ev.category,
        )
        for ev in local_events
    ]
    return CalendarTodayResponse(entries=entries, available=True, source="local")


@router.post(
    "/google/sync",
    response_model=CalendarSyncStatusResponse,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def sync_google(
    payload: GoogleSyncRequest,
    svc: CalendarService = Depends(_svc),
) -> CalendarSyncStatusResponse:
    """Queue a Google Calendar sync run."""

    result = CalendarSyncStatusResponse(**svc.sync_google(payload))
    await publish_invalidation("calendar")
    return result


@router.get(
    "/oauth/url",
    response_model=CalendarOAuthResponse,
    dependencies=[Depends(require_scope("read:calendar"))],
)
async def google_calendar_oauth_url(
    redirect_uri: str,
    settings: Settings = Depends(get_settings_dependency),
) -> CalendarOAuthResponse:
    if not settings.google_client_id:
        return CalendarOAuthResponse(status="unconfigured")
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar.readonly",
        "access_type": "offline",
        "prompt": "consent",
    }
    return CalendarOAuthResponse(
        status="redirect",
        url="https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params),
    )


@router.get(
    "/oauth/callback",
    response_model=CalendarOAuthResponse,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def google_calendar_oauth_callback(
    code: str,
    settings: Settings = Depends(get_settings_dependency),
    repo: CalendarRepository = Depends(_repo),
) -> CalendarOAuthResponse:
    if not settings.google_client_id or not settings.google_client_secret:
        return CalendarOAuthResponse(
            status="error", message="Google credentials not configured"
        )
    async with _google_oauth_client() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code != 200:
        return CalendarOAuthResponse(status="error", message="Token exchange failed")
    data = response.json()
    expires_at = (
        datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(seconds=int(data.get("expires_in", 3600)))
    ).isoformat()
    repo.store_google_token(data["access_token"], data.get("refresh_token"), expires_at)
    await publish_invalidation("calendar")
    return CalendarOAuthResponse(status="connected")


@router.get(
    "/sync/conflicts",
    response_model=list[SyncConflict],
    dependencies=[Depends(require_scope("read:calendar"))],
)
async def list_conflicts(svc: CalendarService = Depends(_svc)) -> list[SyncConflict]:
    """List unresolved sync conflicts (ADR-0003)."""

    return svc.list_conflicts()


@router.post(
    "/sync/conflicts/{identifier}/resolve",
    response_model=SyncConflict,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def resolve_conflict(
    identifier: int,
    payload: dict,
    svc: CalendarService = Depends(_svc),
) -> SyncConflict:
    """Resolve a sync conflict."""

    conflict = svc.resolve_conflict(identifier, payload.get("repair_hint", "manual"))
    if conflict is None:
        raise HTTPException(status_code=404, detail="Conflict not found")
    await publish_invalidation("calendar")
    return conflict


@router.get(
    "/sync/status",
    response_model=CalendarSyncStatusResponse,
    dependencies=[Depends(require_scope("read:calendar"))],
)
async def sync_status(
    svc: CalendarService = Depends(_svc),
) -> CalendarSyncStatusResponse:
    """Return sync health summary."""

    return CalendarSyncStatusResponse(**svc.sync_status())
