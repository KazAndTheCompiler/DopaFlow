from __future__ import annotations

import importlib
import os
from pathlib import Path

import httpx
import pytest
from fastapi import Depends, FastAPI

from app.core.config import get_settings
from app.core.database import run_migrations
from app.middleware.auth_scopes import create_scope_token, require_scope


def _create_remote_app(db_path: Path):
    os.environ["DOPAFLOW_DB_PATH"] = str(db_path)
    os.environ["DOPAFLOW_DEV_AUTH"] = "false"
    os.environ["DOPAFLOW_AUTH_TOKEN_SECRET"] = "test-scope-secret"
    os.environ["DOPAFLOW_OPS_SECRET"] = "test-ops-secret"
    os.environ["DOPAFLOW_DISABLE_LOCAL_AUDIO"] = "1"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "1"
    get_settings.cache_clear()
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    return app_main.create_app()


async def _request(app, method: str, path: str, *, headers: dict[str, str] | None = None, json: object | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, client=("203.0.113.10", 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, path, headers=headers, json=json)


def _bearer(*scopes: str) -> dict[str, str]:
    token = create_scope_token(list(scopes))
    return {"Authorization": f"Bearer {token}"}


def _ops_headers(*scopes: str) -> dict[str, str]:
    return {**_bearer(*scopes), "X-Ops-Secret": "test-ops-secret"}


@pytest.mark.anyio
async def test_remote_tasks_list_requires_read_scope(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    response = await _request(app, "GET", "/api/v2/tasks/")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "missing_token"


@pytest.mark.anyio
async def test_remote_tasks_list_accepts_read_scope(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    response = await _request(app, "GET", "/api/v2/tasks/", headers=_bearer("read:tasks"))

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_remote_task_create_requires_write_scope(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    response = await _request(
        app,
        "POST",
        "/api/v2/tasks/",
        headers=_bearer("read:tasks"),
        json={"title": "Locked down"},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["required"] == "write:tasks"


@pytest.mark.anyio
async def test_remote_calendar_and_journal_read_routes_accept_matching_scopes(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    calendar_response = await _request(app, "GET", "/api/v2/calendar/events", headers=_bearer("read:calendar"))
    journal_response = await _request(app, "GET", "/api/v2/journal/templates", headers=_bearer("read:journal"))

    assert calendar_response.status_code == 200
    assert journal_response.status_code == 200


@pytest.mark.anyio
async def test_remote_focus_and_projects_require_matching_scopes(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    focus_response = await _request(app, "GET", "/api/v2/focus/status")
    projects_response = await _request(app, "GET", "/api/v2/projects/")

    assert focus_response.status_code == 401
    assert focus_response.json()["detail"]["code"] == "missing_token"
    assert projects_response.status_code == 401
    assert projects_response.json()["detail"]["code"] == "missing_token"


@pytest.mark.anyio
async def test_remote_focus_and_projects_accept_matching_scopes(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    focus_response = await _request(app, "GET", "/api/v2/focus/status", headers=_bearer("read:focus"))
    projects_response = await _request(app, "GET", "/api/v2/projects/", headers=_bearer("read:projects"))

    assert focus_response.status_code == 200
    assert projects_response.status_code == 200


@pytest.mark.anyio
async def test_remote_review_and_insights_require_matching_scopes(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    review_response = await _request(app, "GET", "/api/v2/review/decks")
    insights_response = await _request(app, "GET", "/api/v2/insights/momentum")

    assert review_response.status_code == 401
    assert review_response.json()["detail"]["code"] == "missing_token"
    assert insights_response.status_code == 401
    assert insights_response.json()["detail"]["code"] == "missing_token"


@pytest.mark.anyio
async def test_remote_board_view_uses_task_read_scope(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    denied = await _request(app, "GET", "/api/v2/boards/eisenhower")
    allowed = await _request(app, "GET", "/api/v2/boards/eisenhower", headers=_bearer("read:tasks"))

    assert denied.status_code == 401
    assert denied.json()["detail"]["code"] == "missing_token"
    assert allowed.status_code == 200


@pytest.mark.anyio
async def test_remote_gamification_routes_require_matching_scopes(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    status_denied = await _request(app, "GET", "/api/v2/gamification/status")
    award_denied = await _request(
        app,
        "POST",
        "/api/v2/gamification/award",
        headers=_bearer("read:gamification"),
        json={"source": "task_complete", "source_id": "tsk_remote"},
    )
    status_allowed = await _request(app, "GET", "/api/v2/gamification/status", headers=_bearer("read:gamification"))
    award_allowed = await _request(
        app,
        "POST",
        "/api/v2/gamification/award",
        headers=_bearer("write:gamification"),
        json={"source": "task_complete", "source_id": "tsk_remote"},
    )

    assert status_denied.status_code == 401
    assert status_denied.json()["detail"]["code"] == "missing_token"
    assert award_denied.status_code == 403
    assert award_denied.json()["detail"]["required"] == "write:gamification"
    assert status_allowed.status_code == 200
    assert award_allowed.status_code == 200


@pytest.mark.anyio
async def test_remote_nutrition_routes_require_matching_scopes(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    read_denied = await _request(app, "GET", "/api/v2/nutrition/foods")
    write_denied = await _request(
        app,
        "POST",
        "/api/v2/nutrition/log",
        headers=_bearer("read:nutrition"),
        json={"name": "Protein shake", "kj": 300, "protein_g": 25, "carbs_g": 10, "fat_g": 5},
    )
    read_allowed = await _request(app, "GET", "/api/v2/nutrition/foods", headers=_bearer("read:nutrition"))
    write_allowed = await _request(
        app,
        "POST",
        "/api/v2/nutrition/log",
        headers=_bearer("write:nutrition"),
        json={"name": "Protein shake", "kj": 300, "protein_g": 25, "carbs_g": 10, "fat_g": 5},
    )

    assert read_denied.status_code == 401
    assert read_denied.json()["detail"]["code"] == "missing_token"
    assert write_denied.status_code == 403
    assert write_denied.json()["detail"]["required"] == "write:nutrition"
    assert read_allowed.status_code == 200
    assert write_allowed.status_code == 200


@pytest.mark.anyio
async def test_remote_route_rejects_tampered_bearer_token(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)
    token = create_scope_token(["read:tasks"])
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")

    response = await _request(app, "GET", "/api/v2/tasks/", headers={"Authorization": f"Bearer {tampered}"})

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "invalid_token"


@pytest.mark.anyio
async def test_admin_ops_can_issue_scope_token_for_remote_use(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    issue = await _request(
        app,
        "POST",
        "/api/v2/ops/auth-tokens",
        headers=_ops_headers("admin:ops"),
        json={"scopes": ["read:tasks"], "subject": "qa-remote", "ttl_seconds": 600},
    )

    assert issue.status_code == 200
    token = issue.json()["token"]
    follow_up = await _request(app, "GET", "/api/v2/tasks/", headers={"Authorization": f"Bearer {token}"})
    assert follow_up.status_code == 200


@pytest.mark.anyio
async def test_admin_ops_can_list_and_revoke_scope_tokens(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    issue = await _request(
        app,
        "POST",
        "/api/v2/ops/auth-tokens",
        headers=_ops_headers("admin:ops"),
        json={"scopes": ["read:tasks"], "subject": "qa-revoke", "ttl_seconds": 600},
    )
    assert issue.status_code == 200
    token_id = issue.json()["id"]
    token = issue.json()["token"]

    listed = await _request(app, "GET", "/api/v2/ops/auth-tokens", headers=_ops_headers("admin:ops"))
    assert listed.status_code == 200
    assert any(item["id"] == token_id and item["subject"] == "qa-revoke" for item in listed.json())

    revoked = await _request(app, "DELETE", f"/api/v2/ops/auth-tokens/{token_id}", headers=_ops_headers("admin:ops"))
    assert revoked.status_code == 200
    assert revoked.json() == {"revoked": True}

    rejected = await _request(app, "GET", "/api/v2/tasks/", headers={"Authorization": f"Bearer {token}"})
    assert rejected.status_code == 401
    assert rejected.json()["detail"]["code"] == "invalid_token"


@pytest.mark.anyio
async def test_remote_commands_and_search_require_bearer_tokens(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    commands_response = await _request(app, "GET", "/api/v2/commands/list")
    search_response = await _request(app, "GET", "/api/v2/search", json=None)

    assert commands_response.status_code == 401
    assert search_response.status_code == 401


@pytest.mark.anyio
async def test_remote_commands_and_search_accept_matching_tokens(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    commands_response = await _request(app, "GET", "/api/v2/commands/list", headers=_bearer("read:commands"))
    search_response = await _request(app, "GET", "/api/v2/search?q=test", headers=_bearer("read:search"))

    assert commands_response.status_code == 200
    assert search_response.status_code == 200


@pytest.mark.anyio
async def test_remote_alarm_and_player_routes_accept_matching_tokens(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    alarm_response = await _request(app, "GET", "/api/v2/alarms", headers=_bearer("read:alarms"))
    player_response = await _request(app, "GET", "/api/v2/player/queue", headers=_bearer("read:player"))

    assert alarm_response.status_code == 200
    assert player_response.status_code == 200


@pytest.mark.anyio
async def test_remote_ops_backup_and_seed_require_admin_scope(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    backup_denied = await _request(app, "GET", "/api/v2/ops/backup/db", headers=_ops_headers("write:ops"))
    seed_denied = await _request(app, "POST", "/api/v2/ops/seed", headers=_ops_headers("write:ops"))
    backup_allowed = await _request(app, "GET", "/api/v2/ops/backup/db", headers=_ops_headers("admin:ops"))

    assert backup_denied.status_code == 403
    assert backup_denied.json()["detail"]["required"] == "admin:ops"
    assert seed_denied.status_code == 403
    assert seed_denied.json()["detail"]["required"] == "admin:ops"
    assert backup_allowed.status_code == 200


@pytest.mark.anyio
async def test_packaged_ops_routes_require_matching_ops_secret(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "scopes.sqlite"
    monkeypatch.setenv("DOPAFLOW_DB_PATH", str(db_path))
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_AUTH_TOKEN_SECRET", "test-scope-secret")
    monkeypatch.setenv("DOPAFLOW_OPS_SECRET", "test-ops-secret")
    monkeypatch.setenv("DOPAFLOW_PACKAGED", "true")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
    get_settings.cache_clear()
    run_migrations(str(db_path))
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    app = app_main.create_app()

    missing = await _request(app, "GET", "/api/v2/ops/backup/db", headers=_bearer("admin:ops"))
    wrong = await _request(
        app,
        "GET",
        "/api/v2/ops/backup/db",
        headers={**_bearer("admin:ops"), "X-Ops-Secret": "wrong-secret"},
    )
    allowed = await _request(app, "GET", "/api/v2/ops/backup/db", headers=_ops_headers("admin:ops"))

    assert missing.status_code == 403
    assert wrong.status_code == 403
    assert missing.json() == {"detail": "Invalid ops secret"}
    assert wrong.json() == {"detail": "Invalid ops secret"}
    assert "traceback" not in missing.text.lower()
    assert "traceback" not in wrong.text.lower()
    assert str(db_path) not in missing.text
    assert str(db_path) not in wrong.text
    assert allowed.status_code == 200


@pytest.mark.anyio
async def test_remote_docs_and_openapi_are_disabled_when_dev_auth_is_off(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    docs_response = await _request(app, "GET", "/api/v2/docs")
    openapi_response = await _request(app, "GET", "/api/v2/openapi.json")

    assert docs_response.status_code == 404
    assert openapi_response.status_code == 404


@pytest.mark.anyio
async def test_remote_request_cannot_bypass_scope_check_with_localhost_host_header(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    response = await _request(app, "GET", "/api/v2/tasks/", headers={"Host": "localhost:8000"})

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "missing_token"


@pytest.mark.anyio
async def test_scope_tokens_cannot_access_endpoints_outside_declared_scope(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)
    headers = _bearer("read:tasks")

    create_task = await _request(
        app,
        "POST",
        "/api/v2/tasks/",
        headers=headers,
        json={"title": "Not allowed"},
    )
    read_journal = await _request(app, "GET", "/api/v2/journal/templates", headers=headers)
    delete_habit = await _request(app, "DELETE", "/api/v2/habits/hab_missing", headers=headers)

    assert create_task.status_code == 403
    assert create_task.json()["detail"]["required"] == "write:tasks"
    assert read_journal.status_code == 403
    assert read_journal.json()["detail"]["required"] == "read:journal"
    assert delete_habit.status_code == 403
    assert delete_habit.json()["detail"]["required"] == "write:habits"


@pytest.mark.anyio
async def test_scope_token_enforces_tasks_read_alias_contract(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)
    token = create_scope_token(["tasks:read"])
    headers = {"Authorization": f"Bearer {token}"}

    create_task = await _request(
        app,
        "POST",
        "/api/v2/tasks/",
        headers=headers,
        json={"title": "Not allowed"},
    )
    read_journal = await _request(app, "GET", "/api/v2/journal/templates", headers=headers)
    delete_habit = await _request(app, "DELETE", "/api/v2/habits/hab_missing", headers=headers)
    list_tasks = await _request(app, "GET", "/api/v2/tasks/", headers=headers)

    assert create_task.status_code == 403
    assert create_task.json()["detail"]["required"] == "write:tasks"
    assert read_journal.status_code == 403
    assert read_journal.json()["detail"]["required"] == "read:journal"
    assert delete_habit.status_code == 403
    assert delete_habit.json()["detail"]["required"] == "write:habits"
    assert list_tasks.status_code == 200


@pytest.mark.anyio
async def test_loopback_browser_origin_can_be_trusted_when_flag_enabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "scopes.sqlite"
    monkeypatch.setenv("DOPAFLOW_DB_PATH", str(db_path))
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_AUTH_TOKEN_SECRET", "test-scope-secret")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
    monkeypatch.setenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", "true")
    get_settings.cache_clear()
    run_migrations(str(db_path))
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    app = app_main.create_app()

    transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v2/tasks/", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 200


@pytest.mark.anyio
async def test_remote_request_cannot_bypass_scope_check_with_spoofed_app_origin(tmp_path: Path) -> None:
    db_path = tmp_path / "scopes.sqlite"
    run_migrations(str(db_path))
    app = _create_remote_app(db_path)

    response = await _request(app, "GET", "/api/v2/tasks/", headers={"Origin": "app://dopaflow"})

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "missing_token"


@pytest.mark.anyio
async def test_loopback_client_still_requires_scope_without_trust_flag(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "scopes.sqlite"
    monkeypatch.setenv("DOPAFLOW_DB_PATH", str(db_path))
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_AUTH_TOKEN_SECRET", "test-scope-secret")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
    monkeypatch.delenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", raising=False)
    get_settings.cache_clear()
    run_migrations(str(db_path))
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    app = app_main.create_app()

    transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v2/tasks/")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "missing_token"


@pytest.mark.anyio
async def test_ops_secret_required_even_when_enforce_auth_is_false(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "scopes.sqlite"
    monkeypatch.setenv("DOPAFLOW_DB_PATH", str(db_path))
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_AUTH_TOKEN_SECRET", "test-scope-secret")
    monkeypatch.setenv("DOPAFLOW_OPS_SECRET", "test-ops-secret")
    monkeypatch.setenv("DOPAFLOW_ENFORCE_AUTH", "false")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
    get_settings.cache_clear()
    run_migrations(str(db_path))
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    app = app_main.create_app()

    export_resp = await _request(
        app, "GET", "/api/v2/ops/export", headers=_bearer("admin:ops")
    )
    backup_resp = await _request(
        app, "GET", "/api/v2/ops/backup/db", headers=_bearer("admin:ops")
    )

    assert export_resp.status_code == 403
    assert export_resp.json() == {"detail": "Invalid ops secret"}
    assert backup_resp.status_code == 403
    assert backup_resp.json() == {"detail": "Invalid ops secret"}


@pytest.mark.anyio
async def test_legacy_scope_env_flags_still_work_as_fallback(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DOPAFLOW_DEV_AUTH", raising=False)
    monkeypatch.setenv("ZOESTM_DEV_AUTH", "true")
    app = FastAPI()

    @app.get("/protected", dependencies=[Depends(require_scope("read:tasks"))])
    async def protected() -> dict[str, bool]:
        return {"ok": True}

    transport = httpx.ASGITransport(app=app, client=("203.0.113.10", 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/protected")

    assert response.status_code == 200
