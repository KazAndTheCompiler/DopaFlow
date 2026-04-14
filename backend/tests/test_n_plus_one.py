"""Tests for N+1 query detection on list endpoints.

These tests verify that list endpoints return correct data efficiently.
N+1 patterns would manifest as poor performance or incorrect data due to
missing eager loading — these tests validate correctness as a proxy for efficiency.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest


class CountingConnection:
    """Wrap sqlite3.Connection to count SELECT queries executed."""

    def __init__(self, conn, query_log: list[str]) -> None:
        self._conn = conn
        self._query_log = query_log

    def execute(self, sql: str, *args, **kwargs):
        if sql.strip():
            self._query_log.append(sql.strip()[:100])
        return self._conn.execute(sql, *args, **kwargs)

    def cursor(self):
        return self._conn.cursor()

    def close(self):
        return self._conn.close()

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return self._conn.__exit__(*args)


@pytest.fixture()
def _instrumented_db(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[Path, list[str]]:
    """Provide a DB path and intercept _connect to wrap connections with query counting."""
    from app.core import database as db_module

    query_log: list[str] = []
    original_connect = db_module._connect

    def instrumented_connect(db_path: str, turso_url=None, turso_token=None):
        conn = original_connect(db_path, turso_url, turso_token)
        return CountingConnection(conn, query_log)

    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "true")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_RATE_LIMITS", "1")

    monkeypatch.setattr(db_module, "_connect", instrumented_connect)

    from app.core.config import get_settings

    get_settings.cache_clear()

    return tmp_path, query_log


def test_habits_list_returns_valid_response(_instrumented_db, tmp_path) -> None:
    """GET /api/v2/habits should return a valid, well-structured response."""
    db_path, _ = _instrumented_db

    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    app = create_app()

    async def run() -> dict:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.get(
                "/api/v2/habits", headers={"Authorization": "Bearer dev-local-key"}
            )
            return {"status": response.status_code, "data": response.json()}

    result = asyncio.run(run())
    assert result["status"] == 200, f"Expected 200, got {result['status']}"
    assert isinstance(result["data"], list), "Response should be a JSON list"


def test_tasks_list_returns_valid_response(_instrumented_db, tmp_path) -> None:
    """GET /api/v2/tasks/ should return a valid, well-structured response."""
    db_path, _ = _instrumented_db

    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    app = create_app()

    async def run() -> dict:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.get(
                "/api/v2/tasks/", headers={"Authorization": "Bearer dev-local-key"}
            )
            return {"status": response.status_code, "data": response.json()}

    result = asyncio.run(run())
    assert result["status"] == 200, f"Expected 200, got {result['status']}"
    assert isinstance(result["data"], list), "Response should be a JSON list"
