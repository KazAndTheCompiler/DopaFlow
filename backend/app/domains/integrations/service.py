"""Integrations and outbox delivery helpers."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from typing import Any

import httpx

from app.core.config import Settings
from app.core.database import get_db, tx
from app.core.id_gen import notification_id

logger = logging.getLogger("dopaflow.outbox")


async def _deliver_one(
    url: str, body: dict[str, Any], secret: str | None
) -> dict[str, Any]:
    """POST a webhook payload with optional HMAC signing."""

    headers = {"Content-Type": "application/json"}
    payload_bytes = json.dumps(body, sort_keys=True).encode()
    if secret:
        signature = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
        headers["X-DopaFlow-Signature"] = f"sha256={signature}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, content=payload_bytes, headers=headers)
            return {"ok": response.status_code < 400, "status": response.status_code}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def emit_event(settings: Settings, event_type: str, payload: dict[str, Any]) -> None:
    """Insert an outbox event for later delivery."""

    with tx(settings) as conn:
        conn.execute(
            """
            INSERT INTO outbox_events (id, event_type, payload_json, status, attempts, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (notification_id(), event_type, json.dumps(payload)),
        )


def dispatch_once(settings: Settings, limit: int = 20) -> dict[str, int]:
    """Deliver pending outbox events to all enabled webhooks."""

    processed = 0
    delivered = 0
    failed = 0
    with get_db(settings) as conn:
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
    for event in events:
        processed += 1
        payload = json.loads(event["payload_json"])
        attempts = int(event["attempts"] or 0)
        success = True
        for webhook in webhooks:
            result = asyncio.run(
                _deliver_one(webhook["target_url"], payload, webhook["secret"])
            )
            if not result.get("ok"):
                success = False
                break
        with tx(settings) as conn:
            if success:
                delivered += 1
                conn.execute(
                    "UPDATE outbox_events SET status = 'sent', attempts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (attempts + 1, event["id"]),
                )
            else:
                failed += 1
                next_status = "failed" if attempts >= 2 else "retry_wait"
                conn.execute(
                    """
                    UPDATE outbox_events
                    SET status = ?, attempts = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (next_status, attempts + 1, "delivery_failed", event["id"]),
                )
    return {"processed": processed, "delivered": delivered, "failed": failed}


def snapshot_metrics(settings: Settings) -> dict[str, int]:
    """Return coarse outbox queue counts."""

    with get_db(settings) as conn:
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
