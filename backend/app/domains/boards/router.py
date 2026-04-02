# ENDPOINTS
#   GET    /boards/kanban
#   GET    /boards/eisenhower
#   GET    /boards/matrix-data

"""Board-oriented task routes."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings_dependency
from app.core.database import get_db
from app.domains.boards.eisenhower import sort_into_quadrants
from app.middleware.auth_scopes import require_scope

router = APIRouter(prefix="/boards", tags=["boards"])


def _load_tasks(db_path: str) -> list[dict[str, object]]:
    with get_db(db_path) as conn:
        rows = conn.execute("SELECT * FROM tasks WHERE deleted_at IS NULL AND done = 0 ORDER BY updated_at DESC").fetchall()
    tasks: list[dict[str, object]] = []
    for row in rows:
        task = dict(row)
        task["done"] = bool(task.get("done"))
        task["tags"] = json.loads(task.get("tags_json") or "[]")
        task["subtasks"] = json.loads(task.get("subtasks_json") or "[]")
        tasks.append(task)
    return tasks


@router.get("/kanban", response_model=dict[str, list[str]], dependencies=[Depends(require_scope("read:tasks"))])
async def kanban_columns() -> dict[str, list[str]]:
    return {"columns": ["inbox", "next", "doing", "waiting", "done"]}


@router.get("/eisenhower", response_model=dict[str, list[dict]], dependencies=[Depends(require_scope("read:tasks"))])
async def eisenhower_view(settings: Settings = Depends(get_settings_dependency)) -> dict[str, list[dict]]:
    quadrants = sort_into_quadrants(_load_tasks(settings.db_path))
    return {"q1": quadrants["do"], "q2": quadrants["schedule"], "q3": quadrants["delegate"], "q4": quadrants["eliminate"]}


@router.get("/matrix-data", response_model=dict[str, list[dict]], dependencies=[Depends(require_scope("read:tasks"))])
async def matrix_data(settings: Settings = Depends(get_settings_dependency)) -> dict[str, list[dict]]:
    return sort_into_quadrants(_load_tasks(settings.db_path))
