"""FastAPI router for the projects domain."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings_dependency
from app.domains.projects import repository
from app.middleware.auth_scopes import require_scope

router = APIRouter(tags=["projects"])


async def _db_path(settings: Settings = Depends(get_settings_dependency)) -> str:
    return settings.db_path


@router.get("/", response_model=list[dict], dependencies=[Depends(require_scope("read:projects"))])
async def list_projects(
    include_archived: bool = Query(default=False),
    db_path: str = Depends(_db_path),
) -> list[dict[str, Any]]:
    return repository.list_projects(db_path, include_archived=include_archived)


@router.post("/", response_model=dict, dependencies=[Depends(require_scope("write:projects"))])
async def create_project(payload: dict[str, Any], db_path: str = Depends(_db_path)) -> dict[str, Any]:
    if not payload.get("name", "").strip():
        raise HTTPException(status_code=422, detail="name is required")
    return repository.create_project(db_path, payload)


@router.patch("/{project_id}", response_model=dict, dependencies=[Depends(require_scope("write:projects"))])
async def update_project(project_id: str, patch: dict[str, Any], db_path: str = Depends(_db_path)) -> dict[str, Any]:
    result = repository.update_project(db_path, project_id, patch)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.delete("/{project_id}", dependencies=[Depends(require_scope("write:projects"))])
async def delete_project(project_id: str, db_path: str = Depends(_db_path)) -> dict[str, bool]:
    deleted = repository.delete_project(db_path, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True}


@router.get("/task-counts", response_model=dict, dependencies=[Depends(require_scope("read:projects"))])
async def task_counts(db_path: str = Depends(_db_path)) -> dict[str, int]:
    return repository.get_project_task_counts(db_path)
