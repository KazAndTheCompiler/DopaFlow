"""FastAPI router for the projects domain."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings_dependency
from app.domains.projects import repository
from app.domains.projects.schemas import (
    DeleteResponse,
    Project,
    ProjectCreate,
    ProjectPatch,
    ProjectTaskCounts,
)
from app.middleware.auth_scopes import require_scope

router = APIRouter(tags=["projects"])


async def _db_path(settings: Settings = Depends(get_settings_dependency)) -> str:
    return settings.db_path


@router.get(
    "/",
    response_model=list[Project],
    dependencies=[Depends(require_scope("read:projects"))],
)
async def list_projects(
    include_archived: bool = Query(default=False),
    db_path: str = Depends(_db_path),
) -> list[dict[str, Any]]:
    return repository.list_projects(db_path, include_archived=include_archived)


@router.post(
    "/", response_model=Project, dependencies=[Depends(require_scope("write:projects"))]
)
async def create_project(
    payload: ProjectCreate, db_path: str = Depends(_db_path)
) -> dict[str, Any]:
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="name is required")
    return repository.create_project(db_path, payload.model_dump(mode="json"))


@router.patch(
    "/{project_id}",
    response_model=Project,
    dependencies=[Depends(require_scope("write:projects"))],
)
async def update_project(
    project_id: str, patch: ProjectPatch, db_path: str = Depends(_db_path)
) -> dict[str, Any]:
    result = repository.update_project(
        db_path, project_id, patch.model_dump(mode="json", exclude_unset=True)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.delete(
    "/{project_id}",
    response_model=DeleteResponse,
    dependencies=[Depends(require_scope("write:projects"))],
)
async def delete_project(
    project_id: str, db_path: str = Depends(_db_path)
) -> dict[str, bool]:
    deleted = repository.delete_project(db_path, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True}


@router.get(
    "/task-counts",
    response_model=ProjectTaskCounts,
    dependencies=[Depends(require_scope("read:projects"))],
)
async def task_counts(db_path: str = Depends(_db_path)) -> dict[str, int]:
    return repository.get_project_task_counts(db_path)
