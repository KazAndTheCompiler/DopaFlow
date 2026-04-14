"""API router for the calendar_sharing domain."""

from __future__ import annotations

import ipaddress
import logging
import socket
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.core.config import Settings, get_settings_dependency
from app.domains.calendar_sharing.repository import CalendarSharingRepository
from app.domains.calendar_sharing.schemas import (
    PeerFeed,
    PeerFeedCreate,
    PeerFeedRemoval,
    PeerFeedSyncResult,
    PeerFeedUpdate,
    ShareToken,
    ShareTokenCreate,
    ShareTokenCreated,
    ShareTokenInvite,
    ShareTokenRevocation,
)
from app.domains.calendar_sharing.service import CalendarSharingService
from app.middleware.auth_scopes import require_scope
from app.services.event_stream import publish_invalidation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sharing", tags=["calendar_sharing"])


async def _svc(
    settings: Settings = Depends(get_settings_dependency),
) -> CalendarSharingService:
    """Build a CalendarSharingService wired to the real database."""

    return CalendarSharingService(CalendarSharingRepository(settings.db_path))


def _validate_remote_base_url(base_url: str) -> str:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(
            status_code=422, detail="Only http:// and https:// URLs are allowed"
        )
    if not parsed.netloc:
        raise HTTPException(status_code=422, detail="Base URL must include a host")
    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=422, detail="Embedded credentials are not allowed"
        )
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=422, detail="Base URL host is invalid")
    lowered = hostname.lower()
    if lowered in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(status_code=422, detail="Localhost URLs are not allowed")
    try:
        addresses = {
            info[4][0]
            for info in socket.getaddrinfo(
                hostname, parsed.port or None, type=socket.SOCK_STREAM
            )
        }
    except OSError as exc:
        raise HTTPException(
            status_code=422, detail=f"Could not resolve host: {exc}"
        ) from exc
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(
                status_code=422,
                detail="Private or local network targets are not allowed",
            )
    return base_url.rstrip("/")


async def require_share_token(
    authorization: str | None = Header(default=None),
    svc: CalendarSharingService = Depends(_svc),
) -> ShareToken:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Expected Bearer token")
    share_token = svc.validate_token(token.strip())
    if share_token is None:
        raise HTTPException(status_code=403, detail="Invalid or revoked share token")
    return share_token


@router.get(
    "/tokens",
    response_model=list[ShareToken],
    dependencies=[Depends(require_scope("share:calendar"))],
)
async def list_tokens(
    svc: CalendarSharingService = Depends(_svc),
) -> list[ShareToken]:
    """List non-revoked share tokens."""

    return svc.list_tokens()


@router.post(
    "/tokens",
    response_model=ShareTokenCreated,
    status_code=201,
    dependencies=[Depends(require_scope("share:calendar"))],
)
async def create_token(
    payload: ShareTokenCreate,
    svc: CalendarSharingService = Depends(_svc),
) -> ShareTokenCreated:
    """Create a new share token."""

    token = svc.create_token(payload)
    await publish_invalidation("calendar")
    return token


@router.delete(
    "/tokens/{token_id}",
    response_model=ShareTokenRevocation,
    dependencies=[Depends(require_scope("share:calendar"))],
)
async def revoke_token(
    token_id: str,
    svc: CalendarSharingService = Depends(_svc),
) -> ShareTokenRevocation:
    """Revoke a share token."""

    if not svc.revoke_token(token_id):
        raise HTTPException(status_code=404, detail="Token not found")
    await publish_invalidation("calendar")
    return ShareTokenRevocation(revoked=True)


@router.get(
    "/tokens/{token_id}/invite",
    response_model=ShareTokenInvite,
    dependencies=[Depends(require_scope("share:calendar"))],
)
async def get_invite_string(
    token_id: str,
    request: Request,
    svc: CalendarSharingService = Depends(_svc),
) -> ShareTokenInvite:
    """Get connection string for token invitation."""

    tokens = svc.list_tokens()
    token = None
    for t in tokens:
        if t.id == token_id:
            token = t
            break

    if token is None:
        raise HTTPException(status_code=404, detail="Token not found")

    base_url = f"{request.url.scheme}://{request.url.netloc}"
    connection_string = f"{base_url}|{token_id}"
    return ShareTokenInvite(connection_string=connection_string, label=token.label)


@router.get(
    "/feeds",
    response_model=list[PeerFeed],
    dependencies=[Depends(require_scope("read:calendar"))],
)
async def list_feeds(
    svc: CalendarSharingService = Depends(_svc),
) -> list[PeerFeed]:
    """List peer feed subscriptions."""

    return svc.list_feeds()


@router.post(
    "/feeds",
    response_model=PeerFeed,
    status_code=201,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def add_feed(
    payload: PeerFeedCreate,
    svc: CalendarSharingService = Depends(_svc),
) -> PeerFeed:
    """Add a peer feed subscription."""

    payload = payload.model_copy(
        update={"base_url": _validate_remote_base_url(payload.base_url)}
    )

    # Test pull to validate token
    feed = svc.add_feed(payload)
    result = svc.sync_feed(feed.id)
    if result.status == "error":
        # Rollback: remove the feed
        svc.remove_feed(feed.id)
        raise HTTPException(
            status_code=422,
            detail=f"Initial sync failed: {result.detail or result.status}",
        )

    await publish_invalidation("calendar")
    return feed


@router.patch(
    "/feeds/{feed_id}",
    response_model=PeerFeed,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def update_feed(
    feed_id: str,
    patch: PeerFeedUpdate,
    svc: CalendarSharingService = Depends(_svc),
) -> PeerFeed:
    """Update a peer feed subscription."""

    feed = svc.update_feed(feed_id, patch)
    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")
    await publish_invalidation("calendar")
    return feed


@router.delete(
    "/feeds/{feed_id}",
    response_model=PeerFeedRemoval,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def remove_feed(
    feed_id: str,
    svc: CalendarSharingService = Depends(_svc),
) -> PeerFeedRemoval:
    """Remove a peer feed subscription."""

    if not svc.remove_feed(feed_id):
        raise HTTPException(status_code=404, detail="Feed not found")
    await publish_invalidation("calendar")
    return PeerFeedRemoval(removed=True)


@router.post(
    "/feeds/{feed_id}/sync",
    response_model=PeerFeedSyncResult,
    dependencies=[Depends(require_scope("write:calendar"))],
)
async def sync_feed(
    feed_id: str,
    svc: CalendarSharingService = Depends(_svc),
) -> PeerFeedSyncResult:
    """Sync a peer feed."""

    result = svc.sync_feed(feed_id)
    await publish_invalidation("calendar")
    return result
