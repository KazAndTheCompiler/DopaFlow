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


class IntegrationsStatus(BaseModel):
    """Overview-friendly integration status snapshot."""

    gmail_status: str
    gmail_connected: bool = False
    webhooks_enabled: bool = False
    webhook_pending: int = 0
    webhook_retry_wait: int = 0
    webhook_sent: int = 0
