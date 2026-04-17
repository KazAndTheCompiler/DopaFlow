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
from app.domains.integrations.repository import IntegrationsRepository

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

    repo = IntegrationsRepository(db_path=settings.db_path, settings=settings)
    repo.emit_event(event_type, json.dumps(payload))


def dispatch_once(settings: Settings, limit: int = 20) -> dict[str, int]:
    """Deliver pending outbox events to all enabled webhooks."""

    repo = IntegrationsRepository(db_path=settings.db_path, settings=settings)
    processed = 0
    delivered = 0
    failed = 0
    events, webhooks = repo.fetch_pending_events(limit)
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
        if success:
            delivered += 1
            repo.mark_event_sent(event["id"], attempts + 1)
        else:
            failed += 1
            next_status = "failed" if attempts >= 2 else "retry_wait"
            repo.mark_event_failed(event["id"], attempts + 1, next_status)
    return {"processed": processed, "delivered": delivered, "failed": failed}


def snapshot_metrics(settings: Settings) -> dict[str, int]:
    """Return coarse outbox queue counts."""

    repo = IntegrationsRepository(db_path=settings.db_path, settings=settings)
    return repo.snapshot_metrics()
