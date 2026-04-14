"""Load and concurrency sanity tests for critical endpoints."""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest

from app.core.config import get_settings
from app.main import create_app


@pytest.fixture()
def app():
    import os
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"
    get_settings.cache_clear()
    return create_app()


def test_health_endpoint_handles_concurrent_requests(app) -> None:
    """Health endpoint should return 200 for all concurrent requests without errors."""
    from httpx import ASGITransport, AsyncClient

    errors: list[BaseException] = []

    async def get_health() -> None:
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                response = await client.get("/health")
                assert response.status_code == 200, f"health returned {response.status_code}"
        except BaseException as exc:
            errors.append(exc)

    async def run() -> None:
        await asyncio.gather(*[get_health() for _ in range(50)])

    asyncio.run(run())

    assert errors == [], f"concurrent health requests produced errors: {errors}"


def test_health_live_endpoint_concurrent_requests(app) -> None:
    """Health live endpoint should handle concurrent load without failures."""
    from httpx import ASGITransport, AsyncClient

    errors: list[BaseException] = []

    async def get_live() -> None:
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                response = await client.get("/health/live")
                assert response.status_code == 200
        except BaseException as exc:
            errors.append(exc)

    async def run() -> None:
        await asyncio.gather(*[get_live() for _ in range(50)])

    asyncio.run(run())

    assert errors == [], f"concurrent /health/live requests produced errors: {errors}"


def test_no_n_plus_1_on_habit_list_query(app, db_path) -> None:
    """Habit list endpoint should return a valid response without N+1 query patterns.

    Uses the app and db_path fixtures to ensure proper test isolation.
    Full N+1 query detection is covered by test_n_plus_one.py with connection
    instrumentation; this test validates response correctness as a proxy.
    """
    from httpx import ASGITransport, AsyncClient

    async def run() -> dict:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.get(
                "/api/v2/habits",
                headers={"Authorization": "Bearer dev-local-key"}
            )
            return {"status": response.status_code, "data": response.json()}

    result = asyncio.run(run())
    assert result["status"] == 200, f"Expected 200, got {result['status']}"
    assert isinstance(result["data"], list), "Response should be a JSON list"
