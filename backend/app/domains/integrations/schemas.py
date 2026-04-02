"""Pydantic schemas for the integrations domain."""

from __future__ import annotations

from pydantic import BaseModel


class GmailConnectRequest(BaseModel):
    """Payload for initiating or completing Gmail OAuth."""

    code: str | None = None
    redirect_uri: str | None = None


class GmailImportResult(BaseModel):
    """Result of importing Gmail content into tasks."""

    imported_count: int
    status: str


class WebhookDispatch(BaseModel):
    """Webhook event dispatch payload."""

    event_type: str
    payload: dict[str, object]

