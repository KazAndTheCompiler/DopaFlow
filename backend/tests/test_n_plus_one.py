"""Tests for N+1 query detection on list endpoints.

These tests instrument the SQLite connection to count SELECT queries per request.
A well-behaved list endpoint should make O(1) queries, not O(n).
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

import pytest


def test_habits_list_issues_bounded_select_queries(db_path) -> None:
    """GET /api/v2/habits should not issue more than a bounded number of SELECT queries.

    This test instruments the raw SQLite connection to count queries.
    A typical N+1 pattern issues one query per related entity (e.g. per habit log).
    A correct implementation uses JOINs or a single query with subqueries.
    """
    query_log: list[str] = []

    conn = sqlite3.connect(db_path, isolation_level=None)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    original_execute = conn.execute

    def log_execute(sql: str, *args, **kwargs):
        if sql.strip():
            query_log.append(sql.strip()[:100])
        return original_execute(sql, *args, **kwargs)

    conn.execute = log_execute

    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"

    from app.core.config import get_settings
    get_settings.cache_clear()

    from app.main import create_app
    import asyncio

    app = create_app()

    async def run() -> None:
        from httpx import ASGITransport, AsyncClient
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            await client.get("/api/v2/habits", headers={"Authorization": "Bearer dev-local-key"})

    asyncio.run(run())
    conn.close()

    select_queries = [q for q in query_log if q.lower().startswith("select")]
    assert len(select_queries) <= 3, (
        f"habits list made {len(select_queries)} SELECT queries — possible N+1.\n"
        f"Queries:\n  " + "\n  ".join(select_queries)
    )


def test_tasks_list_issues_bounded_select_queries(db_path) -> None:
    """GET /api/v2/tasks/ should not issue unbounded repeated SELECT queries."""
    query_log: list[str] = []

    conn = sqlite3.connect(db_path, isolation_level=None)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    original_execute = conn.execute

    def log_execute(sql: str, *args, **kwargs):
        if sql.strip():
            query_log.append(sql.strip()[:100])
        return original_execute(sql, *args, **kwargs)

    conn.execute = log_execute

    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"

    from app.core.config import get_settings
    get_settings.cache_clear()

    from app.main import create_app
    import asyncio

    app = create_app()

    async def run() -> None:
        from httpx import ASGITransport, AsyncClient
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            await client.get("/api/v2/tasks/", headers={"Authorization": "Bearer dev-local-key"})

    asyncio.run(run())
    conn.close()

    select_queries = [q for q in query_log if q.lower().startswith("select")]
    assert len(select_queries) <= 5, (
        f"tasks list made {len(select_queries)} SELECT queries — possible N+1.\n"
        f"Queries:\n  " + "\n  ".join(select_queries)
    )
