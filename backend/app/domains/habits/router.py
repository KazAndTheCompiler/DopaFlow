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

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.config import Settings, get_settings_dependency
from app.domains.habits import repository, service
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


async def _db_path(settings: Settings = Depends(get_settings_dependency)) -> str:
    return settings.db_path


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
async def list_habits(db_path: str = Depends(_db_path)) -> list[HabitRead]:
    return [HabitRead(**habit) for habit in repository.list_habits(db_path)]


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
    db_path: str = Depends(_db_path),
) -> HabitRead:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    created = repository.add_habit(
        db_path,
        name,
        int(payload.target_freq),
        payload.target_period,
        payload.color,
    )
    if payload.description is not None or payload.freeze_until is not None:
        patched = repository.update_habit(
            db_path,
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
async def get_today_summary(db_path: str = Depends(_db_path)) -> HabitTodaySummary:
    return service.today_summary(db_path)


@router.get(
    "/weekly",
    response_model=HabitWeeklyOverview,
    dependencies=[Depends(require_scope("read:habits"))],
)
async def weekly(db_path: str = Depends(_db_path)) -> HabitWeeklyOverview:
    habits = repository.list_habits(db_path)
    logs = repository.get_logs(db_path, limit=500)
    names = {habit["id"]: habit["name"] for habit in habits}
    meta = {habit["id"]: habit for habit in habits}
    return service.weekly_overview(logs, names, meta)


@router.get(
    "/insights",
    response_model=HabitInsights,
    dependencies=[Depends(require_scope("read:habits"))],
)
async def habit_insights(db_path: str = Depends(_db_path)) -> HabitInsights:
    habits = repository.list_habits(db_path)
    windows = {}
    for days in (7, 14, 30):
        cutoff = (date.today() - timedelta(days=days - 1)).isoformat()
        logs = [
            log
            for log in repository.get_logs(db_path, limit=5000)
            if log["checkin_date"] >= cutoff
        ]
        windows[f"{days}d"] = len(logs)
    return HabitInsights(windows=windows, habit_count=len(habits))


@router.get(
    "/goals/summary",
    response_model=list[HabitGoalSummary],
    dependencies=[Depends(require_scope("read:habits"))],
)
async def goals_summary(db_path: str = Depends(_db_path)) -> list[HabitGoalSummary]:
    return [HabitGoalSummary(**goal) for goal in repository.goals_summary(db_path)]


@router.post(
    "/{identifier}/checkin",
    response_model=HabitRead,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def checkin(
    identifier: str,
    payload: HabitCheckIn | None = None,
    db_path: str = Depends(_db_path),
) -> HabitRead:
    target_date = (
        None if payload is None else payload.checkin_date or payload.checked_at
    )
    result = HabitRead(**service.checkin(db_path, identifier, target_date))
    await publish_invalidation("habits")
    return result


@router.delete(
    "/{identifier}/checkin/{checkin_date}",
    response_model=DeleteResponse,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def delete_checkin(
    identifier: str, checkin_date: str, db_path: str = Depends(_db_path)
) -> DeleteResponse:
    result = DeleteResponse(
        deleted=repository.delete_checkin(db_path, identifier, checkin_date)
    )
    if result.deleted:
        await publish_invalidation("habits")
    return result


@router.get(
    "/{identifier}/logs",
    response_model=list[HabitCheckinLog],
    dependencies=[Depends(require_scope("read:habits"))],
)
async def habit_logs(
    identifier: str, db_path: str = Depends(_db_path)
) -> list[HabitCheckinLog]:
    return [
        HabitCheckinLog(**log)
        for log in repository.get_logs_for_habit(db_path, identifier)
    ]


@router.get(
    "/{identifier}/export/csv", dependencies=[Depends(require_scope("read:habits"))]
)
async def export_csv(identifier: str, db_path: str = Depends(_db_path)) -> Response:
    logs = repository.get_logs_for_habit(db_path, identifier)
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
    identifier: str, payload: HabitPatch, db_path: str = Depends(_db_path)
) -> HabitRead:
    habit = repository.update_habit(
        db_path, identifier, payload.model_dump(exclude_unset=True)
    )
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
    identifier: str, db_path: str = Depends(_db_path)
) -> DeleteResponse:
    deleted = repository.delete_habit(db_path, identifier)
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
    identifier: str, payload: HabitPatch, db_path: str = Depends(_db_path)
) -> HabitRead:
    habit = repository.update_habit(
        db_path, identifier, {"freeze_until": payload.freeze_until}
    )
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    await publish_invalidation("habits")
    return HabitRead(**habit)


@router.patch(
    "/{identifier}/unfreeze",
    response_model=HabitRead,
    dependencies=[Depends(require_scope("write:habits"))],
)
async def unfreeze(identifier: str, db_path: str = Depends(_db_path)) -> HabitRead:
    habit = repository.update_habit(db_path, identifier, {"freeze_until": None})
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    await publish_invalidation("habits")
    return HabitRead(**habit)


@router.get(
    "/correlations",
    response_model=list[HabitCorrelation],
    dependencies=[Depends(require_scope("read:habits"))],
)
async def correlations(db_path: str = Depends(_db_path)) -> list[HabitCorrelation]:
    habits = repository.list_habits(db_path)
    logs = repository.get_logs(db_path, limit=500)
    names = {habit["id"]: habit["name"] for habit in habits}
    return service.pearson_correlation(logs, names)
