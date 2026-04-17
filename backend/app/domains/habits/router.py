# ENDPOINTS
#   GET    /
#   POST   /
#   GET    /today
#   GET    /weekly
#   GET    /insights
#   GET    /goals/summary
#   POST   /{identifier}/checkin
#   DELETE /{identifier}/checkin/{checkin_date}
#   GET    /{identifier}/logs
#   GET    /{identifier}/export/csv
#   PATCH  /{identifier}
#   DELETE /{identifier}
#   PATCH  /{identifier}/freeze
#   PATCH  /{identifier}/unfreeze
#   GET    /correlations

"""FastAPI router for habits."""

from __future__ import annotations

import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.config import Settings, get_settings_dependency
from app.domains.habits import service
from app.domains.habits.repository import HabitRepository
from app.domains.habits.schemas import (
    DeleteResponse,
    HabitCheckIn,
    HabitCheckinLog,
    HabitCorrelation,
    HabitCreate,
    HabitGoalSummary,
    HabitInsights,
    HabitPatch,
    HabitRead,
    HabitTodaySummary,
    HabitWeeklyOverview,
)
from app.middleware.auth_scopes import require_scope
from app.services.event_stream import publish_invalidation

router = APIRouter(tags=["habits"], redirect_slashes=False)


def _repo(settings: Settings = Depends(get_settings_dependency)) -> HabitRepository:
    return HabitRepository(settings)


@router.get(
    "",
    response_model=list[HabitRead],
    dependencies=[Depends(require_scope("read:habits"))],
)
@router.get(
    "/",
    response_model=list[HabitRead],
    include_in_schema=False,
    dependencies=[Depends(require_scope("read:habits"))],
)
async def list_habits(repo: HabitRepository = Depends(_repo)) -> list[HabitRead]:
    return [HabitRead(**habit) for habit in repo.list_habits()]


@router.post(
    "", response_model=HabitRead, dependencies=[Depends(require_scope("write:habits"))]
)
@router.post(
    "/",
    response_model=HabitRead,
    include_in_schema=False,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def add_habit(
    payload: HabitCreate,
    repo: HabitRepository = Depends(_repo),
) -> HabitRead:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    created = repo.add_habit(
        name,
        int(payload.target_freq),
        payload.target_period,
        payload.color,
    )
    if payload.description is not None or payload.freeze_until is not None:
        patched = repo.update_habit(
            created["id"],
            {"description": payload.description, "freeze_until": payload.freeze_until},
        )
        if patched is not None:
            created = patched
    await publish_invalidation("habits")
    return HabitRead(**created)


@router.get(
    "/today",
    response_model=HabitTodaySummary,
    dependencies=[Depends(require_scope("read:habits"))],
)
async def get_today_summary(
    repo: HabitRepository = Depends(_repo),
) -> HabitTodaySummary:
    return service.today_summary(repo)


@router.get(
    "/weekly",
    response_model=HabitWeeklyOverview,
    dependencies=[Depends(require_scope("read:habits"))],
)
async def weekly(repo: HabitRepository = Depends(_repo)) -> HabitWeeklyOverview:
    habits = repo.list_habits()
    logs = repo.get_logs(limit=500)
    names = {habit["id"]: habit["name"] for habit in habits}
    meta = {habit["id"]: habit for habit in habits}
    return service.weekly_overview(logs, names, meta)


@router.get(
    "/insights",
    response_model=HabitInsights,
    dependencies=[Depends(require_scope("read:habits"))],
)
async def habit_insights(repo: HabitRepository = Depends(_repo)) -> HabitInsights:
    habits = repo.list_habits()
    windows = {}
    for days in (7, 14, 30):
        cutoff = (date.today() - timedelta(days=days - 1)).isoformat()
        logs = [
            log for log in repo.get_logs(limit=5000) if log["checkin_date"] >= cutoff
        ]
        windows[f"{days}d"] = len(logs)
    return HabitInsights(windows=windows, habit_count=len(habits))


@router.get(
    "/goals/summary",
    response_model=list[HabitGoalSummary],
    dependencies=[Depends(require_scope("read:habits"))],
)
async def goals_summary(
    repo: HabitRepository = Depends(_repo),
) -> list[HabitGoalSummary]:
    return [HabitGoalSummary(**goal) for goal in repo.goals_summary()]


@router.post(
    "/{identifier}/checkin",
    response_model=HabitRead,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def checkin(
    identifier: str,
    payload: HabitCheckIn | None = None,
    repo: HabitRepository = Depends(_repo),
) -> HabitRead:
    target_date = (
        None if payload is None else payload.checkin_date or payload.checked_at
    )
    result = HabitRead(**service.checkin(repo, identifier, target_date))
    await publish_invalidation("habits")
    return result


@router.delete(
    "/{identifier}/checkin/{checkin_date}",
    response_model=DeleteResponse,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def delete_checkin(
    identifier: str, checkin_date: str, repo: HabitRepository = Depends(_repo)
) -> DeleteResponse:
    result = DeleteResponse(deleted=repo.delete_checkin(identifier, checkin_date))
    if result.deleted:
        await publish_invalidation("habits")
    return result


@router.get(
    "/{identifier}/logs",
    response_model=list[HabitCheckinLog],
    dependencies=[Depends(require_scope("read:habits"))],
)
async def habit_logs(
    identifier: str, repo: HabitRepository = Depends(_repo)
) -> list[HabitCheckinLog]:
    return [HabitCheckinLog(**log) for log in repo.get_logs_for_habit(identifier)]


@router.get(
    "/{identifier}/export/csv", dependencies=[Depends(require_scope("read:habits"))]
)
async def export_csv(
    identifier: str, repo: HabitRepository = Depends(_repo)
) -> Response:
    logs = repo.get_logs_for_habit(identifier)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["habit_id", "checkin_date"])
    writer.writeheader()
    for row in logs:
        writer.writerow(
            {"habit_id": row["habit_id"], "checkin_date": row["checkin_date"]}
        )
    return Response(output.getvalue(), media_type="text/csv")


@router.patch(
    "/{identifier}",
    response_model=HabitRead,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def update_habit(
    identifier: str, payload: HabitPatch, repo: HabitRepository = Depends(_repo)
) -> HabitRead:
    habit = repo.update_habit(identifier, payload.model_dump(exclude_unset=True))
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    await publish_invalidation("habits")
    return HabitRead(**habit)


@router.delete(
    "/{identifier}",
    response_model=DeleteResponse,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def delete_habit(
    identifier: str, repo: HabitRepository = Depends(_repo)
) -> DeleteResponse:
    deleted = repo.delete_habit(identifier)
    if not deleted:
        raise HTTPException(status_code=404, detail="Habit not found")
    await publish_invalidation("habits")
    return DeleteResponse(deleted=True)


@router.patch(
    "/{identifier}/freeze",
    response_model=HabitRead,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def freeze(
    identifier: str, payload: HabitPatch, repo: HabitRepository = Depends(_repo)
) -> HabitRead:
    habit = repo.update_habit(identifier, {"freeze_until": payload.freeze_until})
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    await publish_invalidation("habits")
    return HabitRead(**habit)


@router.patch(
    "/{identifier}/unfreeze",
    response_model=HabitRead,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def unfreeze(
    identifier: str, repo: HabitRepository = Depends(_repo)
) -> HabitRead:
    habit = repo.update_habit(identifier, {"freeze_until": None})
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    await publish_invalidation("habits")
    return HabitRead(**habit)


@router.get(
    "/correlations",
    response_model=list[HabitCorrelation],
    dependencies=[Depends(require_scope("read:habits"))],
)
async def correlations(
    repo: HabitRepository = Depends(_repo),
) -> list[HabitCorrelation]:
    habits = repo.list_habits()
    logs = repo.get_logs(limit=500)
    names = {habit["id"]: habit["name"] for habit in habits}
    return service.pearson_correlation(logs, names)
