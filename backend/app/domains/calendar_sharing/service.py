"""Business logic for the calendar_sharing domain."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urljoin

from app.domains.calendar_sharing.repository import CalendarSharingRepository
from app.domains.calendar_sharing.schemas import (
    PeerFeed,
    PeerFeedCreate,
    PeerFeedSyncResult,
    PeerFeedUpdate,
    ShareToken,
    ShareTokenCreate,
    ShareTokenCreated,
)

logger = logging.getLogger(__name__)
MAX_FEED_ENTRIES_PER_SYNC = 5000
MAX_FEED_BACKOFF_SECONDS = 2 * 60 * 60


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Block redirects so a validated peer feed cannot hop to a new target."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        raise urllib.error.HTTPError(newurl, code, "redirects_not_allowed", headers, fp)


class CalendarSharingService:
    """Manage calendar sharing tokens and peer feed synchronization."""

    def __init__(self, repository: CalendarSharingRepository) -> None:
        self.repository = repository
        self._feed_backoff: dict[str, tuple[datetime, int]] = {}

    def list_tokens(self) -> list[ShareToken]:
        """Return non-revoked share tokens."""

        return self.repository.list_tokens()

    def create_token(self, payload: ShareTokenCreate) -> ShareTokenCreated:
        """Create a new share token."""

        token = self.repository.create_token(payload.label, payload.expires_in_days)
        logger.info("Created calendar share token %s (%s)", token.id, token.label)
        return token

    def revoke_token(self, token_id: str) -> bool:
        """Revoke a share token."""

        revoked = self.repository.revoke_token(token_id)
        if revoked:
            logger.info("Revoked calendar share token %s", token_id)
        else:
            logger.warning(
                "Attempted to revoke missing calendar share token %s", token_id
            )
        return revoked

    def validate_token(self, raw: str) -> ShareToken | None:
        """Validate a raw token."""

        return self.repository.validate_token(raw)

    def list_feeds(self) -> list[PeerFeed]:
        """Return all peer feeds."""

        return self.repository.list_feeds()

    def add_feed(self, payload: PeerFeedCreate) -> PeerFeed:
        """Add a peer feed subscription."""

        feed = self.repository.add_feed(payload)
        logger.info(
            "Added peer calendar feed %s (%s) for %s",
            feed.id,
            feed.label,
            feed.base_url,
        )
        return feed

    def update_feed(self, feed_id: str, patch: PeerFeedUpdate) -> PeerFeed | None:
        """Update a peer feed."""

        feed = self.repository.update_feed(feed_id, patch)
        if feed is not None:
            logger.info("Updated peer calendar feed %s", feed_id)
        else:
            logger.warning("Attempted to update missing peer calendar feed %s", feed_id)
        return feed

    def remove_feed(self, feed_id: str) -> bool:
        """Remove a peer feed subscription."""

        removed = self.repository.remove_feed(feed_id)
        if removed:
            logger.info(
                "Removed peer calendar feed %s and its mirrored events", feed_id
            )
        else:
            logger.warning("Attempted to remove missing peer calendar feed %s", feed_id)
        return removed

    def _feed_sync_window(self, feed: PeerFeed) -> tuple[str, str]:
        """Return the date window used for peer calendar imports."""

        now = datetime.now(timezone.utc)
        start = now - timedelta(days=30)
        end = now + timedelta(days=120)

        if feed.last_synced_at is not None:
            last_synced = feed.last_synced_at.astimezone(timezone.utc)
            start = min(start, last_synced - timedelta(days=7))

        return (
            start.isoformat().replace("+00:00", "Z"),
            end.isoformat().replace("+00:00", "Z"),
        )

    @staticmethod
    def _normalize_entry(entry: dict[str, object]) -> dict[str, object]:
        """Normalize the peer feed payload into the local import contract."""

        normalized = dict(entry)
        if not normalized.get("id"):
            normalized["id"] = normalized.get("source_id")
        if not normalized.get("start_at"):
            normalized["start_at"] = normalized.get("at")
        if not normalized.get("end_at"):
            normalized["end_at"] = normalized.get("start_at")
        return normalized

    def _fetch_feed_payload(
        self, feed: PeerFeed, raw_token: str, from_dt: str, to_dt: str
    ) -> dict[str, object]:
        """Fetch a peer feed payload without following redirects."""

        feed_url = urljoin(feed.base_url.rstrip("/") + "/", "calendar/feed")
        request = urllib.request.Request(
            f"{feed_url}?{urlencode({'from': from_dt, 'to': to_dt})}",
            headers={
                "Authorization": f"Bearer {raw_token}",
                "Accept": "application/json",
            },
        )
        opener = urllib.request.build_opener(_NoRedirectHandler())
        with opener.open(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    def _current_backoff(self, feed_id: str) -> tuple[datetime, int] | None:
        record = self._feed_backoff.get(feed_id)
        if record is None:
            return None
        retry_after, cooldown_seconds = record
        if retry_after <= datetime.now(timezone.utc):
            self._feed_backoff.pop(feed_id, None)
            return None
        return record

    def _record_feed_failure(self, feed_id: str) -> None:
        now = datetime.now(timezone.utc)
        current = self._feed_backoff.get(feed_id)
        next_cooldown = (
            15 * 60
            if current is None
            else min(
                current[1] * 2,
                MAX_FEED_BACKOFF_SECONDS,
            )
        )
        self._feed_backoff[feed_id] = (
            now + timedelta(seconds=next_cooldown),
            next_cooldown,
        )

    def _clear_feed_failure(self, feed_id: str) -> None:
        self._feed_backoff.pop(feed_id, None)

    @staticmethod
    def _extract_entries(payload: object) -> list[dict[str, object]]:
        """Validate the remote payload shape before importing any peer events."""

        if not isinstance(payload, dict):
            raise ValueError("invalid_feed_payload")
        entries = payload.get("entries")
        if not isinstance(entries, list):
            raise ValueError("invalid_feed_payload")
        if len(entries) > MAX_FEED_ENTRIES_PER_SYNC:
            raise ValueError("feed_entry_limit_exceeded")
        normalized_entries: list[dict[str, object]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError("invalid_feed_payload")
            normalized_entries.append(entry)
        return normalized_entries

    def sync_feed(self, feed_id: str) -> PeerFeedSyncResult:
        """Sync a single peer feed."""

        feed_record = self.repository.get_feed_credentials(feed_id)
        if feed_record is None:
            return PeerFeedSyncResult(
                feed_id=feed_id,
                events_imported=0,
                conflicts=0,
                status="error",
                detail="feed_not_found",
            )
        feed_row, raw_token = feed_record

        try:
            self.repository.update_feed_status(feed_id, "syncing")
            from_dt, to_dt = self._feed_sync_window(feed_row)
            data = self._fetch_feed_payload(feed_row, raw_token, from_dt, to_dt)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                self.repository.update_feed_status(
                    feed_id, "error", "token_invalid_or_revoked"
                )
                logger.warning(
                    "Peer feed %s sync failed: token invalid or revoked", feed_id
                )
                return PeerFeedSyncResult(
                    feed_id=feed_id,
                    events_imported=0,
                    conflicts=0,
                    status="error",
                    detail="token_invalid_or_revoked",
                )
            if 300 <= e.code < 400:
                self.repository.update_feed_status(
                    feed_id, "error", "redirect_not_allowed"
                )
                logger.warning(
                    "Peer feed %s sync rejected redirect (HTTP %s)", feed_id, e.code
                )
                return PeerFeedSyncResult(
                    feed_id=feed_id,
                    events_imported=0,
                    conflicts=0,
                    status="error",
                    detail="redirect_not_allowed",
                )
            else:
                self.repository.update_feed_status(feed_id, "error", f"HTTP {e.code}")
                logger.warning("Peer feed %s sync failed with HTTP %s", feed_id, e.code)
                return PeerFeedSyncResult(
                    feed_id=feed_id,
                    events_imported=0,
                    conflicts=0,
                    status="error",
                    detail=f"HTTP {e.code}",
                )
        except Exception as e:
            error_message = str(e)
            self.repository.update_feed_status(feed_id, "error", error_message)
            logger.exception("Failed to sync peer feed %s", feed_id)
            return PeerFeedSyncResult(
                feed_id=feed_id,
                events_imported=0,
                conflicts=0,
                status="error",
                detail=error_message,
            )

        try:
            entries = self._extract_entries(data)
        except ValueError as exc:
            self.repository.update_feed_status(feed_id, "error", str(exc))
            logger.warning("Peer feed %s returned invalid payload: %s", feed_id, exc)
            return PeerFeedSyncResult(
                feed_id=feed_id,
                events_imported=0,
                conflicts=0,
                status="error",
                detail=f"Invalid payload: {type(exc).__name__}",
            )
        imported = 0
        conflicts = 0

        for entry in entries:
            try:
                result = self.repository.upsert_peer_event(
                    feed_id, self._normalize_entry(entry)
                )
                if result == "inserted" or result == "updated":
                    imported += 1
                elif result == "conflict":
                    conflicts += 1
            except Exception:
                logger.exception("Failed to upsert peer event from feed %s", feed_id)

        self.repository.update_feed_status(feed_id, "ok")
        logger.info(
            "Peer feed %s sync completed: imported=%s conflicts=%s",
            feed_id,
            imported,
            conflicts,
        )
        return PeerFeedSyncResult(
            feed_id=feed_id, events_imported=imported, conflicts=conflicts, status="ok"
        )

    def sync_all_feeds(self) -> dict[str, object]:
        """Sync all peer feeds."""

        feeds = self.repository.list_feeds()
        synced = 0
        errors = 0
        total_imported = 0

        for feed in feeds:
            if backoff := self._current_backoff(feed.id):
                logger.warning(
                    "Skipping peer feed %s due to backoff until %s",
                    feed.id,
                    backoff[0].isoformat(),
                )
                errors += 1
                continue
            try:
                result = self.sync_feed(feed.id)
                if result.status == "ok":
                    self._clear_feed_failure(feed.id)
                    synced += 1
                    total_imported += result.events_imported
                else:
                    self._record_feed_failure(feed.id)
                    errors += 1
            except Exception:
                self._record_feed_failure(feed.id)
                logger.exception("Failed to sync feed %s", feed.id)
                errors += 1

        return {"synced": synced, "errors": errors, "events_imported": total_imported}
