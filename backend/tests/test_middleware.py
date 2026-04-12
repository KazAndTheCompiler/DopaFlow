from __future__ import annotations

import os
from pathlib import Path

import httpx
import pytest
import sqlite3
from fastapi import FastAPI

from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_log import RequestLogMiddleware
from app.middleware.security import SecurityHeadersMiddleware


def build_app(db_path: str, *, packaged: bool = False) -> FastAPI:
    app = FastAPI()
    os.environ.pop("DOPAFLOW_DISABLE_RATE_LIMITS", None)
    os.environ.pop("ZOESTM_DISABLE_RATE_LIMITS", None)

    class Settings:
        dev_auth = False
        enforce_auth = True
        api_key = "dev-local-key"

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        db_path=db_path,
        default_limit_per_minute=60,
        command_limit_per_minute=5,
        packaged=packaged,
    )
    app.add_middleware(AuthMiddleware, settings=Settings())
    app.add_middleware(RequestLogMiddleware)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/live")
    async def health_live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    async def health_ready() -> dict[str, str | None]:
        return {"status": "ready", "reason": None}

    @app.get("/secure")
    async def secure() -> dict[str, str]:
        return {"status": "secure"}

    @app.post("/api/v2/tasks/quick-add")
    async def quick_add() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/boom")
    async def boom() -> dict[str, str]:
        raise RuntimeError("boom")

    return app


async def request(app: FastAPI, method: str, path: str, *, headers: dict[str, str] | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, client=("203.0.113.10", 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, path, headers=headers)


async def request_from(
    app: FastAPI,
    method: str,
    path: str,
    *,
    client_host: str,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, client=(client_host, 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, path, headers=headers)


@pytest.mark.anyio
async def test_auth_with_correct_api_key_returns_200(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure", headers={"x-api-key": "dev-local-key"})

    assert response.status_code == 200


@pytest.mark.anyio
async def test_auth_with_wrong_api_key_returns_401(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure", headers={"x-api-key": "wrong-token"})

    assert response.status_code == 401


@pytest.mark.anyio
async def test_auth_with_no_api_key_returns_401(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure")

    assert response.status_code == 401


@pytest.mark.anyio
async def test_auth_with_malformed_authorization_header_returns_401(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure", headers={"Authorization": "Token dev-local-key"})

    assert response.status_code == 401


@pytest.mark.anyio
async def test_auth_with_empty_api_key_returns_401(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure", headers={"x-api-key": ""})

    assert response.status_code == 401


@pytest.mark.anyio
async def test_health_is_exempt_from_auth(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/health")

    assert response.status_code == 200


@pytest.mark.anyio
async def test_health_ready_is_exempt_from_auth(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/health/ready")

    assert response.status_code == 200


@pytest.mark.anyio
async def test_health_live_is_exempt_from_auth(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/health/live")

    assert response.status_code == 200


@pytest.mark.anyio
async def test_single_authorized_request_is_not_rate_limited(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure", headers={"x-api-key": "dev-local-key"})

    assert response.status_code == 200


@pytest.mark.anyio
async def test_repeated_requests_eventually_return_429(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))
    headers = {"x-api-key": "dev-local-key"}
    statuses = []

    for _ in range(65):
        response = await request(app, "GET", "/secure", headers=headers)
        statuses.append(response.status_code)

    assert 429 in statuses


@pytest.mark.anyio
async def test_command_path_uses_separate_rate_limit_bucket(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))
    headers = {"x-api-key": "dev-local-key"}

    for _ in range(65):
        await request(app, "GET", "/secure", headers=headers)

    response = await request(app, "POST", "/api/v2/tasks/quick-add", headers=headers)

    assert response.status_code == 200


@pytest.mark.anyio
async def test_rate_limit_returns_503_when_storage_backend_is_unavailable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    def explode_connect(self) -> sqlite3.Connection:
        raise sqlite3.OperationalError("disk I/O error")

    monkeypatch.setattr(RateLimitMiddleware, "_connect", explode_connect)

    response = await request(app, "GET", "/secure", headers={"x-api-key": "dev-local-key"})

    assert response.status_code == 503
    assert response.json()["code"] == "rate_limit_unavailable"


@pytest.mark.anyio
async def test_packaged_build_ignores_disable_rate_limits_flag(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"), packaged=True)
    monkeypatch.setenv("DOPAFLOW_DISABLE_RATE_LIMITS", "1")
    with caplog.at_level("WARNING", logger="app.middleware.rate_limit"):
        headers = {"x-api-key": "dev-local-key"}
        statuses = []

        for _ in range(65):
            response = await request(app, "GET", "/secure", headers=headers)
            statuses.append(response.status_code)

        assert 429 in statuses
        assert any("DOPAFLOW_DISABLE_RATE_LIMITS is set but ignored in packaged build" in r.message for r in caplog.records)


@pytest.mark.anyio
async def test_rate_limit_ignores_spoofed_forwarded_ip_from_untrusted_client(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))
    headers = {"x-api-key": "dev-local-key", "x-forwarded-for": "198.51.100.77"}
    statuses = []

    for _ in range(65):
        response = await request_from(app, "GET", "/secure", client_host="203.0.113.10", headers=headers)
        statuses.append(response.status_code)

    assert 429 in statuses


@pytest.mark.anyio
async def test_security_headers_are_applied_to_api_responses(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure", headers={"x-api-key": "dev-local-key"})

    assert response.status_code == 200
    assert response.headers["Content-Security-Policy"] == (
        "default-src 'self'; "
        "connect-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "object-src 'none'"
    )
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Permissions-Policy"] == "camera=(), microphone=(self), geolocation=()"
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert response.headers["X-Permitted-Cross-Domain-Policies"] == "none"
    assert response.headers["X-Request-ID"]


@pytest.mark.anyio
async def test_remote_request_cannot_bypass_auth_with_spoofed_app_origin(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request_from(
        app,
        "GET",
        "/secure",
        client_host="203.0.113.10",
        headers={"origin": "app://dopaflow"},
    )

    assert response.status_code == 401


@pytest.mark.anyio
async def test_loopback_request_requires_api_key_without_trust_flag(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", raising=False)
    monkeypatch.delenv("ZOESTM_TRUST_LOCAL_CLIENTS", raising=False)
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request_from(app, "GET", "/secure", client_host="127.0.0.1")

    assert response.status_code == 401


@pytest.mark.anyio
async def test_loopback_request_can_bypass_api_key_when_trust_flag_enabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", "true")
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request_from(app, "GET", "/secure", client_host="127.0.0.1")

    assert response.status_code == 200


@pytest.mark.anyio
async def test_loopback_request_accepts_legacy_trust_flag_as_fallback(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", raising=False)
    monkeypatch.setenv("ZOESTM_TRUST_LOCAL_CLIENTS", "true")
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request_from(app, "GET", "/secure", client_host="127.0.0.1")

    assert response.status_code == 200


@pytest.mark.anyio
async def test_request_log_preserves_incoming_request_id(tmp_path: Path) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))

    response = await request(app, "GET", "/secure", headers={"x-api-key": "dev-local-key", "x-request-id": "req-123"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-123"


@pytest.mark.anyio
async def test_request_log_logs_exception_context(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    app = build_app(str(tmp_path / "rate-limit.db"))
    caplog.set_level("ERROR", logger="dopaflow.slow_requests")

    with pytest.raises(RuntimeError, match="boom"):
        await request(app, "GET", "/boom", headers={"x-api-key": "dev-local-key", "x-request-id": "req-error"})

    assert any("request_error" in record.message and "req-error" in record.message and "/boom" in record.message for record in caplog.records)
