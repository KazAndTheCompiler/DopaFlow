"""Persistence helpers for the integrations domain."""

from __future__ import annotations

import json
import time
from urllib.parse import urlencode

from app.core.config import Settings
from app.core.database import get_db, tx
from app.domains.integrations.schemas import (
    GmailConnectRequest,
    GmailImportResult,
    IntegrationsStatus,
    WebhookDispatch,
)


class IntegrationsRepository:
    """Read and write OAuth tokens, Gmail imports, and webhook outbox state."""

    def __init__(self, db_path: str, settings: Settings | None = None) -> None:
        self.db_path = db_path
        self.settings = settings

    def connect_gmail(self, payload: GmailConnectRequest) -> dict[str, object]:
        """Build a Gmail OAuth redirect or return an unconfigured status."""

        client_id = self.settings.google_client_id if self.settings else None
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
        with tx(self.db_path) as conn:
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
        with get_db(self.db_path) as conn:
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
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO outbox_events (id, event_type, payload_json, created_at, updated_at, status, attempts)
                VALUES (?, ?, ?, datetime('now'), datetime('now'), 'pending', 0)
                """,
                (event_id, payload.event_type, json.dumps(payload.payload)),
            )
        return {"status": "queued", "event_type": payload.event_type, "id": event_id}

    def get_status(self) -> IntegrationsStatus:
        gmail_token = self.get_token("gmail")
        with get_db(self.db_path) as conn:
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
