from __future__ import annotations

import importlib
import os

from app.core.config import get_settings


def _create_app():
    os.environ["DOPAFLOW_DEV_AUTH"] = "true"
    get_settings.cache_clear()
    app_main = importlib.import_module("app.main")
    app_main = importlib.reload(app_main)
    return app_main.create_app()


def test_app_creates_without_error(db_path) -> None:
    app = _create_app()

    assert app.title == "DopaFlow API"
    assert app.version == "2.0.7"


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
    ]
    for prefix in required:
        assert any(path.startswith(prefix) for path in routes), prefix
    assert routes.count("/api/v2/alarms/resolve-url") == 1


def test_health_returns_ok(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["version"] == "2.0.7"


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


def test_no_route_returns_500_on_get(db_path, client) -> None:
    app = _create_app()
    schema = app.openapi()
    failures: list[str] = []

    for path, methods in schema["paths"].items():
        get_spec = methods.get("get")
        if not get_spec or "{" in path:
            continue
        response = client.get(path, headers={"Authorization": "Bearer dev-local-key"})
        if response.status_code == 500:
            failures.append(path)

    assert failures == []
