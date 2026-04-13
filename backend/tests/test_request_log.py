"""Tests for RequestLogMiddleware."""
from __future__ import annotations

import pytest


def test_request_id_header_echoed_on_every_response(_app, client) -> None:
    """Every API response includes X-Request-ID, whether provided by client or generated."""
    response = client.get("/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) == 32  # uuid.uuid4().hex length

    response = client.get("/health", headers={"x-request-id": "custom-id-123"})
    assert response.headers["X-Request-ID"] == "custom-id-123"


def test_request_id_carried_through_error_responses(_app, client) -> None:
    """Error responses also include the X-Request-ID header."""
    response = client.get("/api/v2/tasks", headers={"x-request-id": "error-test-id"})
    # Auth error — still should carry the request ID
    assert "X-Request-ID" in response.headers
    assert response.headers["X-Request-ID"] == "error-test-id"


def test_health_endpoint_returns_x_request_id(client) -> None:
    """Health endpoint must always return X-Request-ID for traceability."""
    response = client.get("/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers


def test_health_live_returns_x_request_id(client) -> None:
    """Health live must always return X-Request-ID for traceability."""
    response = client.get("/health/live")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
