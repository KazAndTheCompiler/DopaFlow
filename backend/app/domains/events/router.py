"""SSE endpoint for frontend invalidation events."""

from __future__ import annotations

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.services.event_stream import stream_events

router = APIRouter(tags=["events"])


@router.get("/events")
async def events(request: Request) -> EventSourceResponse:
    return EventSourceResponse(stream_events(request), ping=10)
