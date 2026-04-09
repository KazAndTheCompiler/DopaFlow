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


class GmailConnectResult(BaseModel):
    """Stable result for Gmail auth flows."""

    status: str
    message: str | None = None
    url: str | None = None


class GitHubImportIssuesRequest(BaseModel):
    """Payload for importing GitHub issues into tasks."""

    token: str
    repo: str
    state: str = "open"


class GitHubImportIssuesResult(BaseModel):
    """Result of a GitHub issues import attempt."""

    created: int
    skipped: int
    repo: str


class WebhookEnqueueResult(BaseModel):
    """Result of enqueuing an outbound webhook."""

    id: str
    event_type: str
    status: str


class OutboxMetrics(BaseModel):
    """Current outbox counters used by settings and ops views."""

    pending: int
    retry_wait: int
    sent: int


class OutboxDispatchResult(BaseModel):
    """Single dispatch-pass summary."""

    processed: int
    delivered: int
    failed: int
