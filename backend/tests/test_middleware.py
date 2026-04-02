from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware


def build_app(db_path: str) -> FastAPI:
    app = FastAPI()

    class Settings:
        dev_auth = False
        enforce_auth = True
        api_key = "dev-local-key"

    app.add_middleware(RateLimitMiddleware, db_path=db_path, default_limit_per_minute=60, command_limit_per_minute=5)
    app.add_middleware(AuthMiddleware, settings=Settings())

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/secure")
    async def secure() -> dict[str, str]:
        return {"status": "secure"}

    @app.post("/api/v2/tasks/quick-add")
    async def quick_add() -> dict[str, str]:
        return {"status": "ok"}

    return app


async def request(app: FastAPI, method: str, path: str, *, headers: dict[str, str] | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, client=("203.0.113.10", 12345))
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
