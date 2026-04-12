from __future__ import annotations

import importlib
import os
from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.database import run_migrations
from app.domains.ops.schemas import MAX_OPS_IMPORT_BYTES, OpsImportIn, ScopeTokenCreateIn, TursoTestIn


def test_turso_test_input_rejects_non_turso_scheme() -> None:
    with pytest.raises(ValidationError):
        TursoTestIn(url="http://example.com", token="secret")


def test_scope_token_create_input_enforces_bounds() -> None:
    with pytest.raises(ValidationError):
        ScopeTokenCreateIn(scopes=[], subject="", ttl_seconds=30)


def test_ops_import_input_enforces_payload_limit() -> None:
    with pytest.raises(ValidationError):
        OpsImportIn(package="x" * (MAX_OPS_IMPORT_BYTES + 1), checksum="a" * 64)


def _create_remote_app(db_path: Path, *, ops_secret: str = "test-ops-secret"):
    os.environ["DOPAFLOW_DB_PATH"] = str(db_path)
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_AUTH_TOKEN_SECRET"] = "test-scope-secret"
    os.environ["DOPAFLOW_OPS_SECRET"] = ops_secret
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    os.environ["DOPAFLOW_DISABLE_RATE_LIMITS"] = "1"
    get_settings.cache_clear()
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    return app_main.create_app()


async def _request(app, method: str, path: str, *, headers: dict[str, str] | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, path, headers=headers)


@pytest.mark.anyio
async def test_missing_ops_secret_returns_403(tmp_path: Path) -> None:
    db_path = tmp_path / "ops-security.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    response = await _request(app, "GET", "/api/v2/ops/stats")

    assert response.status_code == 403
    body = response.json()
    assert body.keys() == {"detail"}
    assert "traceback" not in response.text.lower()


@pytest.mark.anyio
async def test_wrong_ops_secret_returns_403(tmp_path: Path) -> None:
    db_path = tmp_path / "ops-security.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    response = await _request(app, "GET", "/api/v2/ops/stats", headers={"X-Ops-Secret": "wrong-secret"})

    assert response.status_code == 403
    body = response.json()
    assert body.keys() == {"detail"}
    assert "traceback" not in response.text.lower()
    assert str(db_path) not in response.text


@pytest.mark.anyio
async def test_ops_routes_return_403_not_401(tmp_path: Path) -> None:
    """Ensure all ops routes return 403 (not 401) with correct JSON body."""
    db_path = tmp_path / "ops-security.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    for path in ("/api/v2/ops/stats", "/api/v2/ops/config", "/api/v2/ops/sync-status"):
        missing = await _request(app, "GET", path)
        wrong = await _request(app, "GET", path, headers={"X-Ops-Secret": "wrong-secret"})

        assert missing.status_code == 403, f"{path} missing secret should be 403"
        assert wrong.status_code == 403, f"{path} wrong secret should be 403"
        assert missing.json().keys() == {"detail"}, f"{path} missing secret body keys mismatch"
        assert wrong.json().keys() == {"detail"}, f"{path} wrong secret body keys mismatch"
        assert "traceback" not in missing.text.lower()
        assert "traceback" not in wrong.text.lower()
        assert str(db_path) not in missing.text
        assert str(db_path) not in wrong.text
