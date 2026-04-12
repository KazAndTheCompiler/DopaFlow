from __future__ import annotations

import importlib
import json
import logging
import os
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.core.config import get_settings
from app.core.version import APP_VERSION


def _create_app():
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    get_settings.cache_clear()
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    return app_main.create_app()


def _restore_root_logger(handlers: list[logging.Handler], level: int) -> None:
    root_logger = logging.getLogger()
    root_logger.handlers = handlers
    root_logger.setLevel(level)


def test_app_creates_without_error(db_path) -> None:
    app = _create_app()

    assert app.title == "DopaFlow API"
    assert app.version == APP_VERSION


def test_configure_logging_uses_json_formatter_for_packaged_builds() -> None:
    from app.logging_config import configure_logging

    root_logger = logging.getLogger()
    original_handlers = root_logger.handlers[:]
    original_level = root_logger.level

    try:
        root_logger.handlers = []
        configure_logging(packaged=True)

        record = logging.makeLogRecord(
            {
                "name": "dopaflow.test",
                "levelno": logging.WARNING,
                "levelname": "WARNING",
                "msg": "hello %s",
                "args": ("world",),
                "request_id": "req-123",
            }
        )
        formatted = root_logger.handlers[0].formatter.format(record)
        payload = json.loads(formatted)

        assert payload["level"] == "WARNING"
        assert payload["logger"] == "dopaflow.test"
        assert payload["message"] == "hello world"
        assert payload["request_id"] == "req-123"
        assert payload["timestamp"]
    finally:
        _restore_root_logger(original_handlers, original_level)


def test_configure_logging_keeps_human_readable_formatter_for_dev_builds() -> None:
    from app.logging_config import configure_logging

    root_logger = logging.getLogger()
    original_handlers = root_logger.handlers[:]
    original_level = root_logger.level

    try:
        root_logger.handlers = []
        configure_logging(packaged=False)

        record = logging.makeLogRecord(
            {
                "name": "dopaflow.test",
                "levelno": logging.WARNING,
                "levelname": "WARNING",
                "msg": "hello %s",
                "args": ("world",),
            }
        )
        formatted = root_logger.handlers[0].formatter.format(record)

        assert formatted.endswith("WARNING [dopaflow.test] hello world")
    finally:
        _restore_root_logger(original_handlers, original_level)


def test_all_routers_mounted(db_path) -> None:
    app = _create_app()
    routes = [route.path for route in app.routes]

    required = [
        "/api/v2/tasks",
        "/api/v2/habits",
        "/api/v2/focus",
        "/api/v2/review",
        "/api/v2/journal",
        "/api/v2/calendar",
        "/api/v2/calendar/sharing",
        "/api/v2/alarms",
        "/api/v2/packy",
        "/api/v2/insights",
        "/api/v2/notifications",
        "/health",
        "/health/live",
        "/health/ready",
    ]
    for prefix in required:
        assert any(path.startswith(prefix) for path in routes), prefix
    assert routes.count("/api/v2/alarms/resolve-url") == 1


def test_register_routers_mounts_expected_paths(db_path) -> None:
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    app = FastAPI()

    app_main.register_routers(app)
    routes = [route.path for route in app.routes]

    assert any(path.startswith("/api/v2/tasks") for path in routes)
    assert any(path.startswith("/api/v2/projects") for path in routes)
    assert any(path.startswith("/api/v2/commands") for path in routes)
    assert any(path.startswith("/api/v2/vault") for path in routes)


def test_task_time_routes_require_task_scopes(db_path) -> None:
    app = _create_app()
    secured_routes = {
        ("/api/v2/tasks/{identifier}/time/start", "POST"): "write",
        ("/api/v2/tasks/{identifier}/time/stop", "POST"): "write",
        ("/api/v2/tasks/{identifier}/time", "GET"): "read",
    }

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in route.methods:
            key = (route.path, method)
            if key not in secured_routes:
                continue
            assert route.dependencies, f"{route.path} {method} is missing auth scope dependencies"


def test_health_returns_ok(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["version"] == APP_VERSION


def test_health_live_returns_ok(client) -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_sets_content_security_policy_header(client) -> None:
    response = client.get("/")

    assert response._response.headers["Content-Security-Policy"] == (
        "default-src 'self'; "
        "connect-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "object-src 'none'"
    )


def test_openapi_schema_valid(db_path) -> None:
    app = _create_app()
    schema = app.openapi()

    assert "paths" in schema
    assert len(schema["paths"]) >= 30
    assert schema["info"]["title"] == "DopaFlow API"
    operation_ids = [
        operation.get("operationId")
        for methods in schema["paths"].values()
        for operation in methods.values()
        if isinstance(operation, dict) and operation.get("operationId")
    ]
    assert len(operation_ids) == len(set(operation_ids))


def test_migrations_do_not_contain_template_placeholders() -> None:
    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    offenders: list[str] = []

    for migration in sorted(migrations_dir.glob("*.sql")):
        content = migration.read_text(encoding="utf-8")
        if "TODO: Add your schema changes here" in content:
            offenders.append(migration.name)

    assert offenders == []


def test_no_route_returns_500_on_get(db_path, client) -> None:
    app = _create_app()
    schema = app.openapi()
    failures: list[dict[str, str | int]] = []

    for path, methods in schema["paths"].items():
        get_spec = methods.get("get")
        if not get_spec or "{" in path:
            continue
        operation_id = get_spec.get("operationId", "unknown")
        try:
            response = client.get(path, headers={"Authorization": "Bearer dev-local-key"})
        except Exception as exc:  # noqa: BLE001
            failures.append(
                {
                    "path": path,
                    "operation_id": operation_id,
                    "failure": "request_exception",
                    "detail": f"{type(exc).__name__}: {exc}",
                }
            )
            continue
        if response.status_code == 500:
            failures.append(
                {
                    "path": path,
                    "operation_id": operation_id,
                    "failure": "status_500",
                    "detail": response.text[:200],
                }
            )

    assert failures == []


def test_lifespan_uses_public_scheduler_stop_api(db_path) -> None:
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    os.environ["DOPAFLOW_DISABLE_BACKGROUND_JOBS"] = "false"
    get_settings.cache_clear()
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)

    async def noop_backup_start() -> None:
        return None

    with (
        patch("app.main.start_scheduler"),
        patch.object(app_main.backup_scheduler, "start", side_effect=noop_backup_start),
        patch.object(app_main.backup_scheduler, "stop"),
        patch("app.main.stop_scheduler") as stop_scheduler_mock,
    ):
        async def drive() -> None:
            async with app_main.lifespan(app_main.create_app()):
                pass

        import asyncio

        asyncio.run(drive())

    stop_scheduler_mock.assert_called_once()
