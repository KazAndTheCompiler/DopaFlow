"""Persistence helpers for the integrations domain."""

from __future__ import annotations

import json
import time
from urllib.parse import urlencode

from app.core.base_repository import BaseRepository
from app.core.config import Settings
from app.domains.integrations.schemas import (
    GmailConnectRequest,
    GmailImportResult,
    IntegrationsStatus,
    WebhookDispatch,
)


class IntegrationsRepository(BaseRepository):
    """Read and write OAuth tokens, Gmail imports, and webhook outbox state."""

    def __init__(self, db_path: str, settings: Settings | None = None) -> None:
        super().__init__(settings or db_path)

    def connect_gmail(self, payload: GmailConnectRequest) -> dict[str, object]:
        """Build a Gmail OAuth redirect or return an unconfigured status."""

        client_id = self.settings.google_client_id
        if not client_id:
            return {
                "status": "unconfigured",
                "message": "Set GOOGLE_CLIENT_ID in environment",
            }
        params = {
            "client_id": client_id,
            "redirect_uri": payload.redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/gmail.readonly",
            "access_type": "offline",
            "prompt": "consent",
        }
        if payload.state:
            params["state"] = payload.state
        return {
            "status": "redirect",
            "url": f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}",
        }

    def import_gmail_tasks(self) -> GmailImportResult:
        """Return the current Gmail import status."""

        return GmailImportResult(imported_count=0, status="queued")

    def store_token(
        self,
        provider: str,
        access_token: str,
        refresh_token: str | None,
        expires_at: str,
        scope: str,
    ) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, stored_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(provider) DO UPDATE SET
                    access_token = excluded.access_token,
                    refresh_token = excluded.refresh_token,
                    expires_at = excluded.expires_at,
                    scope = excluded.scope,
                    stored_at = datetime('now')
                """,
                (provider, access_token, refresh_token, expires_at, scope),
            )

    def get_token(self, provider: str) -> dict[str, object] | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM oauth_tokens WHERE provider = ?", (provider,)
            ).fetchone()
        return dict(row) if row else None

    def import_gmail_tasks_real(self) -> GmailImportResult:
        """Return real Gmail import readiness based on stored OAuth state."""
        token = self.get_token("gmail")
        if token is None:
            return GmailImportResult(imported_count=0, status="not_connected")
        return GmailImportResult(imported_count=0, status="connected_ready")

    def enqueue_webhook(self, payload: WebhookDispatch) -> dict[str, object]:
        """Insert a webhook dispatch event into the outbox."""

        event_id = f"evt_{int(time.time() * 1000)}"
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO outbox_events (id, event_type, payload_json, created_at, updated_at, status, attempts)
                VALUES (?, ?, ?, datetime('now'), datetime('now'), 'pending', 0)
                """,
                (event_id, payload.event_type, json.dumps(payload.payload)),
            )
        return {"status": "queued", "event_type": payload.event_type, "id": event_id}

    def emit_event(self, event_type: str, payload_json: str) -> None:
        """Insert an outbox event for later delivery."""
        from app.core.id_gen import notification_id

        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO outbox_events (id, event_type, payload_json, status, attempts, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (notification_id(), event_type, payload_json),
            )

    def fetch_pending_events(self, limit: int = 20) -> list[dict[str, object]]:
        """Return pending outbox events and enabled webhooks."""
        with self.get_db_readonly() as conn:
            events = conn.execute(
                """
                SELECT * FROM outbox_events
                WHERE status IN ('pending', 'retry_wait')
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            webhooks = conn.execute("SELECT * FROM webhooks WHERE enabled = 1").fetchall()
        return [dict(e) for e in events], [dict(w) for w in webhooks]

    def mark_event_sent(self, event_id: str, attempts: int) -> None:
        """Mark an outbox event as successfully sent."""
        with self.tx() as conn:
            conn.execute(
                "UPDATE outbox_events SET status = 'sent', attempts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (attempts, event_id),
            )

    def mark_event_failed(self, event_id: str, attempts: int, next_status: str) -> None:
        """Mark an outbox event as failed or retry_wait."""
        with self.tx() as conn:
            conn.execute(
                """
                UPDATE outbox_events
                SET status = ?, attempts = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (next_status, attempts, "delivery_failed", event_id),
            )

    def snapshot_metrics(self) -> dict[str, int]:
        """Return coarse outbox queue counts."""
        with self.get_db_readonly() as conn:
            rows = conn.execute(
                """
                SELECT status, COUNT(*) AS count
                FROM outbox_events
                GROUP BY status
                """
            ).fetchall()
        metrics = {"pending": 0, "retry_wait": 0, "sent": 0}
        for row in rows:
            metrics[row["status"]] = int(row["count"])
        return metrics

    def get_status(self) -> IntegrationsStatus:
        gmail_token = self.get_token("gmail")
        with self.get_db_readonly() as conn:
            webhook_count = conn.execute(
                "SELECT COUNT(*) FROM webhooks WHERE enabled = 1"
            ).fetchone()[0]
            metrics_rows = conn.execute(
                """
                SELECT status, COUNT(*) AS count
                FROM outbox_events
                GROUP BY status
                """
            ).fetchall()

        metrics = {"pending": 0, "retry_wait": 0, "sent": 0}
        for row in metrics_rows:
            metrics[str(row["status"])] = int(row["count"])

        return IntegrationsStatus(
            gmail_status="connected" if gmail_token else "not_connected",
            gmail_connected=gmail_token is not None,
            webhooks_enabled=bool(webhook_count),
            webhook_pending=metrics.get("pending", 0),
            webhook_retry_wait=metrics.get("retry_wait", 0),
            webhook_sent=metrics.get("sent", 0),
        )
