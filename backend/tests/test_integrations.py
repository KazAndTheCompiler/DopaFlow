from __future__ import annotations


def test_integrations_status_reports_gmail_and_webhook_state(client) -> None:
    response = client.get("/api/v2/integrations/status")

    assert response.status_code == 200
    body = response.json()
    assert body["gmail_status"] == "not_connected"
    assert body["gmail_connected"] is False
    assert set(body).issuperset({"webhooks_enabled", "webhook_pending", "webhook_retry_wait", "webhook_sent"})


def test_outbox_metrics_endpoint_returns_counts(client) -> None:
    response = client.get("/api/v2/integrations/outbox/metrics")

    assert response.status_code == 200
    body = response.json()
    assert set(body).issuperset({"pending", "retry_wait", "sent"})


def test_outbox_dispatch_endpoint_returns_result(client) -> None:
    response = client.post("/api/v2/integrations/outbox/dispatch")

    assert response.status_code == 200
    body = response.json()
    assert set(body).issuperset({"processed", "delivered", "failed"})
