# ENDPOINTS
#   POST   /alarms/resolve-url

"""Audio player helper routes for alarms."""

from __future__ import annotations

from fastapi import APIRouter

from app.services.player import resolve_stream_url

router = APIRouter(tags=["alarms"])


@router.post("/alarms/resolve-url", response_model=dict)
async def resolve_url(youtube_url: str) -> dict[str, str | None]:
    """Extract a direct audio stream URL from a YouTube link via yt-dlp."""
    return resolve_stream_url(youtube_url)
