# ENDPOINTS
#   GET    /boards/kanban
#   GET    /boards/eisenhower
#   GET    /boards/matrix-data

"""Board-oriented task routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings_dependency
from app.domains.boards.eisenhower import sort_into_quadrants
from app.domains.boards.schemas import BoardColumns, EisenhowerView, MatrixData
from app.domains.tasks.repository import TaskRepository
from app.middleware.auth_scopes import require_scope

router = APIRouter(prefix="/boards", tags=["boards"])


def _load_tasks(settings: Settings) -> list[dict[str, object]]:
    repo = TaskRepository(settings)
    return repo.list_active_undone()


@router.get(
    "/kanban",
    response_model=BoardColumns,
    dependencies=[Depends(require_scope("read:tasks"))],
)
async def kanban_columns() -> dict[str, list[str]]:
    return {"columns": ["inbox", "next", "doing", "waiting", "done"]}


@router.get(
    "/eisenhower",
    response_model=EisenhowerView,
    dependencies=[Depends(require_scope("read:tasks"))],
)
async def eisenhower_view(
    settings: Settings = Depends(get_settings_dependency),
) -> dict[str, list[dict]]:
    quadrants = sort_into_quadrants(_load_tasks(settings))
    return {
        "q1": quadrants["do"],
        "q2": quadrants["schedule"],
        "q3": quadrants["delegate"],
        "q4": quadrants["eliminate"],
    }


@router.get(
    "/matrix-data",
    response_model=MatrixData,
    dependencies=[Depends(require_scope("read:tasks"))],
)
async def matrix_data(
    settings: Settings = Depends(get_settings_dependency),
) -> dict[str, list[dict]]:
    return sort_into_quadrants(_load_tasks(settings))
