"""Persistence helpers for the calendar_sharing domain."""

from __future__ import annotations

import hashlib
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.database import get_db, tx
from app.domains.calendar_sharing.schemas import PeerFeed, PeerFeedCreate, PeerFeedUpdate, ShareToken, ShareTokenCreated

logger = logging.getLogger(__name__)


def _row_to_share_token(row: object) -> ShareToken:
    """Convert a SQLite Row to ShareToken."""
    return ShareToken(
        id=row["id"],  # type: ignore[index]
        label=row["label"],  # type: ignore[index]
        scopes=row["scopes"],  # type: ignore[index]
        allow_write=bool(row["allow_write"]),  # type: ignore[index]
        created_at=row["created_at"],  # type: ignore[index]
        expires_at=row["expires_at"],  # type: ignore[index]
        last_used_at=row["last_used_at"],  # type: ignore[index]
        revoked_at=row["revoked_at"],  # type: ignore[index]
    )


def _row_to_peer_feed(row: object) -> PeerFeed:
    """Convert a SQLite Row to PeerFeed."""
    return PeerFeed(
        id=row["id"],  # type: ignore[index]
        label=row["label"],  # type: ignore[index]
        base_url=row["base_url"],  # type: ignore[index]
        color=row["color"],  # type: ignore[index]
        sync_status=row["sync_status"],  # type: ignore[index]
        allow_write=bool(row["allow_write"]),  # type: ignore[index]
        last_synced_at=row["last_synced_at"],  # type: ignore[index]
        last_error=row["last_error"],  # type: ignore[index]
        created_at=row["created_at"],  # type: ignore[index]
    )


class CalendarSharingRepository:
    """Manage calendar sharing tokens and peer feed subscriptions."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def list_tokens(self) -> list[ShareToken]:
        """Return non-revoked share tokens."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM calendar_share_tokens
                WHERE revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                ORDER BY created_at DESC
                """
            ).fetchall()
            return [_row_to_share_token(row) for row in rows]

    def create_token(self, label: str, expires_in_days: int | None = None) -> ShareTokenCreated:
        """Create a new share token."""

        raw = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        token_id = "shr_" + uuid4().hex[:16]
        now = datetime.now(timezone.utc).isoformat()
        expires_at = None
        if expires_in_days is not None:
            expires_at = (datetime.now(timezone.utc) + timedelta(days=expires_in_days)).isoformat()

        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO calendar_share_tokens (id, label, token_hash, scopes, allow_write, created_at, expires_at)
                VALUES (?, ?, ?, 'read:calendar', 0, ?, ?)
                """,
                (token_id, label, token_hash, now, expires_at),
            )

        return ShareTokenCreated(
            id=token_id,
            label=label,
            scopes="read:calendar",
            allow_write=False,
            created_at=datetime.fromisoformat(now),
            expires_at=datetime.fromisoformat(expires_at) if expires_at else None,
            last_used_at=None,
            revoked_at=None,
            raw_token=raw,
        )

    def revoke_token(self, token_id: str) -> bool:
        """Revoke a share token."""

        now = datetime.now(timezone.utc).isoformat()
        with tx(self.db_path) as conn:
            result = conn.execute(
                "UPDATE calendar_share_tokens SET revoked_at = ? WHERE id = ?",
                (now, token_id),
            )
            return result.rowcount > 0

    def validate_token(self, raw: str) -> ShareToken | None:
        """Validate a raw token and update last_used_at."""

        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        now = datetime.now(timezone.utc).isoformat()

        with tx(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT *
                FROM calendar_share_tokens
                WHERE token_hash = ?
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > ?)
                """,
                (token_hash, now),
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE calendar_share_tokens SET last_used_at = ? WHERE id = ?",
                    (now, row["id"]),  # type: ignore[index]
                )
                return _row_to_share_token(row)
        return None

    def list_feeds(self) -> list[PeerFeed]:
        """Return all active peer feeds."""

        with get_db(self.db_path) as conn:
            rows = conn.execute("SELECT * FROM calendar_peer_feeds ORDER BY created_at DESC").fetchall()
            return [_row_to_peer_feed(row) for row in rows]

    def get_feed_credentials(self, feed_id: str) -> tuple[PeerFeed, str] | None:
        """Return a peer feed plus its stored bearer token for sync work."""

        with get_db(self.db_path) as conn:
            row = conn.execute("SELECT * FROM calendar_peer_feeds WHERE id = ?", (feed_id,)).fetchone()
            if row is None:
                return None
            return (_row_to_peer_feed(row), row["token"])  # type: ignore[index]

    def add_feed(self, payload: PeerFeedCreate) -> PeerFeed:
        """Add a new peer feed subscription."""

        feed_id = "pf_" + uuid4().hex[:16]
        now = datetime.now(timezone.utc).isoformat()

        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO calendar_peer_feeds (id, label, base_url, token, color, sync_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'idle', ?, ?)
                """,
                (feed_id, payload.label, payload.base_url, payload.token, payload.color, now, now),
            )

        return PeerFeed(
            id=feed_id,
            label=payload.label,
            base_url=payload.base_url,
            color=payload.color,
            sync_status="idle",
            allow_write=False,
            last_synced_at=None,
            last_error=None,
            created_at=datetime.fromisoformat(now),
        )

    def update_feed(self, feed_id: str, patch: PeerFeedUpdate) -> PeerFeed | None:
        """Update mutable peer feed fields."""

        with get_db(self.db_path) as conn:
            row = conn.execute("SELECT * FROM calendar_peer_feeds WHERE id = ?", (feed_id,)).fetchone()
            if not row:
                return None

        now = datetime.now(timezone.utc).isoformat()
        with tx(self.db_path) as conn:
            updates = []
            params = []
            if patch.label is not None:
                updates.append("label = ?")
                params.append(patch.label)
            if patch.color is not None:
                updates.append("color = ?")
                params.append(patch.color)
            if updates:
                updates.append("updated_at = ?")
                params.append(now)
                params.append(feed_id)
                query = f"UPDATE calendar_peer_feeds SET {', '.join(updates)} WHERE id = ?"
                conn.execute(query, params)

        with get_db(self.db_path) as conn:
            row = conn.execute("SELECT * FROM calendar_peer_feeds WHERE id = ?", (feed_id,)).fetchone()
            return _row_to_peer_feed(row) if row else None

    def remove_feed(self, feed_id: str) -> bool:
        """Delete a peer feed subscription."""

        with tx(self.db_path) as conn:
            source_type = f"peer:{feed_id}"
            conn.execute("DELETE FROM sync_conflicts WHERE owner = ?", (source_type,))
            conn.execute("DELETE FROM calendar_events WHERE source_type = ?", (source_type,))
            result = conn.execute("DELETE FROM calendar_peer_feeds WHERE id = ?", (feed_id,))
            return result.rowcount > 0

    def update_feed_status(self, feed_id: str, status: str, error: str | None = None) -> None:
        """Update peer feed sync status and error message."""

        now = datetime.now(timezone.utc).isoformat()
        with tx(self.db_path) as conn:
            if status == "ok":
                conn.execute(
                    """
                    UPDATE calendar_peer_feeds
                    SET sync_status = ?, last_error = NULL, last_synced_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (status, now, now, feed_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE calendar_peer_feeds
                    SET sync_status = ?, last_error = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (status, error, now, feed_id),
                )

    def upsert_peer_event(self, feed_id: str, entry: dict) -> str:
        """Upsert a calendar event from a peer feed."""

        external_id = entry.get("id") or entry.get("source_id") or entry.get("source_external_id")
        if not external_id:
            return "skipped"

        start_at = entry.get("start_at") or entry.get("at")
        end_at = entry.get("end_at") or start_at
        if not start_at or not end_at:
            return "skipped"

        source_type = f"peer:{feed_id}"
        now = datetime.now(timezone.utc).isoformat()

        with get_db(self.db_path) as conn:
            existing = conn.execute(
                "SELECT * FROM calendar_events WHERE source_external_id = ? AND source_type = ?",
                (external_id, source_type),
            ).fetchone()

        if existing:
            existing_status = existing["sync_status"]  # type: ignore[index]
            remote_updated = entry.get("updated_at", entry.get("created_at", now))
            local_updated = existing["updated_at"]  # type: ignore[index]

            if existing_status != "local_only" and remote_updated > local_updated:
                # Update from remote
                with tx(self.db_path) as conn:
                    conn.execute(
                        """
                        UPDATE calendar_events
                        SET title = ?, description = ?, start_at = ?, end_at = ?,
                            all_day = ?, category = ?, sync_status = 'synced', updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            entry.get("title"),
                            entry.get("description"),
                            start_at,
                            end_at,
                            int(entry.get("all_day", False)),
                            entry.get("category"),
                            now,
                            existing["id"],  # type: ignore[index]
                        ),
                    )
                return "updated"
            elif existing_status == "local_only":
                # Conflict: local-only, incoming shared change
                with tx(self.db_path) as conn:
                    conn.execute(
                        """
                        INSERT INTO sync_conflicts
                            (object_id, object_type, conflict_reason, local_snapshot, incoming_snapshot, owner)
                        VALUES (?, 'event', 'concurrent_shared_field', ?, ?, ?)
                        """,
                        (
                            existing["id"],  # type: ignore[index]
                            json.dumps(dict(existing)),
                            json.dumps(entry),
                            source_type,
                        ),
                    )
                return "conflict"
            else:
                # No update needed
                return "updated"
        else:
            # Insert new event from peer
            from app.core.id_gen import event_id

            new_id = event_id()
            with tx(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO calendar_events
                        (id, title, description, start_at, end_at, all_day,
                         category, source_type, source_external_id, source_origin_app,
                         sync_status, provider_readonly, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 1, ?, ?)
                    """,
                    (
                        new_id,
                        entry.get("title"),
                        entry.get("description"),
                        start_at,
                        end_at,
                        int(entry.get("all_day", False)),
                        entry.get("category"),
                        source_type,
                        external_id,
                        entry.get("source") or "dopaflow",
                        now,
                        now,
                    ),
                )
            return "inserted"
