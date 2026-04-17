from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings_dependency
from app.domains.goals.repository import GoalRepository
from app.domains.goals.schemas import Goal, GoalCreate, GoalMilestoneCreate, OkResponse
from app.middleware.auth_scopes import require_scope

router = APIRouter(prefix="/goals", tags=["goals"])


def _repo(settings: Settings = Depends(get_settings_dependency)) -> GoalRepository:
    return GoalRepository(settings)


@router.get(
    "/", response_model=list[Goal], dependencies=[Depends(require_scope("read:tasks"))]
)
async def list_goals(repo: GoalRepository = Depends(_repo)) -> list[dict[str, Any]]:
    return repo.list_goals()


@router.post(
    "/", response_model=Goal, dependencies=[Depends(require_scope("write:tasks"))]
)
async def create_goal(
    payload: GoalCreate, repo: GoalRepository = Depends(_repo)
) -> dict[str, Any]:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="title is required")
    return repo.create_goal(payload.model_dump(mode="json"))


@router.delete(
    "/{goal_id}",
    response_model=OkResponse,
    dependencies=[Depends(require_scope("write:tasks"))],
)
async def delete_goal(
    goal_id: str, repo: GoalRepository = Depends(_repo)
) -> dict[str, bool]:
    if not repo.delete_goal(goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"ok": True}


@router.post(
    "/{goal_id}/milestones",
    response_model=Goal,
    dependencies=[Depends(require_scope("write:tasks"))],
)
async def add_milestone(
    goal_id: str, payload: GoalMilestoneCreate, repo: GoalRepository = Depends(_repo)
) -> dict[str, Any]:
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=422, detail="label is required")
    updated = repo.add_milestone(goal_id, label)
    if updated is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return updated


@router.post(
    "/{goal_id}/milestones/{milestone_id}/complete",
    response_model=Goal,
    dependencies=[Depends(require_scope("write:tasks"))],
)
async def complete_milestone(
    goal_id: str, milestone_id: str, repo: GoalRepository = Depends(_repo)
) -> dict[str, Any]:
    updated = repo.complete_milestone(goal_id, milestone_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Goal or milestone not found")
    return updated
