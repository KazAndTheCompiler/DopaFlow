from __future__ import annotations

import asyncio
import os
import sqlite3
import tempfile
from pathlib import Path

import httpx
import pytest


class HTTPResponse:
    def __init__(self, response) -> None:
        self._response = response
        self.status_code = response.status_code
        self.text = response.text

    @property
    def headers(self):
        return self._response.headers

    def json(self):
        return self._response.json()


class LiveServerClient:
    """Wrap FastAPI TestClient with the legacy request helper interface."""

    REQUEST_TIMEOUT_SECONDS = 10

    def __init__(self, app) -> None:
        self._app = app

    async def _request_async(
        self, method: str, path: str, *, params=None, json=None, data=None, headers=None
    ) -> httpx.Response:
        transport = httpx.ASGITransport(app=self._app, client=("127.0.0.1", 12345))
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            return await asyncio.wait_for(
                client.request(
                    method,
                    path,
                    params=params,
                    json=json,
                    data=data,
                    headers=headers or {},
                ),
                timeout=self.REQUEST_TIMEOUT_SECONDS,
            )

    def request(
        self, method: str, path: str, *, params=None, json=None, data=None, headers=None
    ) -> HTTPResponse:
        from app.core.config import get_settings

        get_settings.cache_clear()
        response = asyncio.run(
            self._request_async(
                method, path, params=params, json=json, data=data, headers=headers
            ),
        )
        return HTTPResponse(response)

    def get(self, path: str, **kwargs) -> HTTPResponse:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> HTTPResponse:
        return self.request("POST", path, **kwargs)

    def patch(self, path: str, **kwargs) -> HTTPResponse:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs) -> HTTPResponse:
        return self.request("DELETE", path, **kwargs)


def _reset_database(path: Path) -> None:
    conn = sqlite3.connect(path)
    try:
        conn.execute("PRAGMA foreign_keys=OFF")
        table_rows = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
              AND name != '_migrations'
            """
        ).fetchall()
        tables = [row[0] for row in table_rows]
        preserved = {"badges", "player_level"}
        for table in tables:
            if table in preserved:
                continue
            conn.execute(f'DELETE FROM "{table}"')
        if "player_level" in tables:
            conn.execute(
                "UPDATE player_level SET total_xp = 0, level = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
            )
        if "badges" in tables:
            conn.execute("UPDATE badges SET earned_at = NULL, progress = 0.0")
        conn.commit()
    finally:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.close()


@pytest.fixture(scope="session")
def _shared_db_path(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("dopaflow-test") / "dopaflow-test.sqlite"
    os.environ["DOPAFLOW_DB_PATH"] = str(path)
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"
    from app.core.database import run_migrations

    run_migrations(str(path))
    return path


@pytest.fixture(scope="session", autouse=True)
def _assert_test_db_is_sandboxed(_shared_db_path: Path) -> None:
    from app.core.config import default_db_path, get_settings, user_data_dir

    get_settings.cache_clear()
    configured = get_settings().db_path
    resolved = Path(configured).resolve() if configured != ":memory:" else configured
    default_resolved = Path(default_db_path()).resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()
    real_data_dir = user_data_dir().resolve()

    assert configured == ":memory:" or str(resolved).startswith(str(temp_root))
    assert configured == ":memory:" or resolved == _shared_db_path.resolve()
    assert configured == ":memory:" or resolved != default_resolved
    assert configured == ":memory:" or not str(resolved).startswith(str(real_data_dir))


@pytest.fixture(scope="session")
def _app(_shared_db_path: Path):
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.main import create_app

    return create_app()


@pytest.fixture()
def db_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, _shared_db_path: Path
) -> Path:
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("DOPAFLOW_DB_PATH", str(_shared_db_path))
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "true")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_RATE_LIMITS", "1")
    _reset_database(_shared_db_path)
    from app.core.config import get_settings
    from app.domains.gamification.service import pop_award_counters

    pop_award_counters()
    get_settings.cache_clear()
    return _shared_db_path


@pytest.fixture()
def sqlite_db_path(tmp_path: Path) -> Path:
    """Provide a fresh temporary SQLite database path for migration tests."""
    path = tmp_path / "migration-test.sqlite"
    os.environ["DOPAFLOW_DB_PATH"] = str(path)
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"
    from app.core.config import get_settings

    get_settings.cache_clear()
    return path


@pytest.fixture()
def client(db_path: Path, _app) -> LiveServerClient:
    os.environ["DOPAFLOW_DB_PATH"] = str(db_path)
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"

    from app.core.config import get_settings

    get_settings.cache_clear()
    return LiveServerClient(_app)
