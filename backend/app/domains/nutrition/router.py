# ENDPOINTS
#   GET    /nutrition/foods
#   POST   /nutrition/foods
#   DELETE /nutrition/foods/{food_id}
#   GET    /nutrition/log
#   GET    /nutrition/log/monthly
#   POST   /nutrition/log
#   DELETE /nutrition/log/{entry_id}
#   GET    /nutrition/summary/{date}
#   GET    /nutrition/goals
#   POST   /nutrition/goals
#   GET    /nutrition/export/csv
#   GET    /nutrition/today
#   GET    /nutrition/history
#   GET    /nutrition/recent
#   DELETE /nutrition/{identifier}

"""API router for nutrition logging."""

from __future__ import annotations

from datetime import date as date_mod

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.config import Settings, get_settings_dependency
from app.middleware.auth_scopes import require_scope
from app.domains.nutrition.repository import NutritionRepository
from app.domains.nutrition.schemas import (
    DailyTotals,
    FoodItemCreate,
    FoodItemRead,
    FoodLibraryItem,
    LogEntryCreate,
    NutritionDeleteResponse,
    NutritionGoals,
    NutritionLogResponse,
    NutritionMonthlyResponse,
    NutritionSummaryResponse,
)

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


async def _repo(settings: Settings = Depends(get_settings_dependency)) -> NutritionRepository:
    return NutritionRepository(settings.db_path)


# ── food library ──────────────────────────────────────────────────────────────

@router.get("/foods", response_model=list[FoodLibraryItem], dependencies=[Depends(require_scope("read:nutrition"))])
async def list_foods(repo: NutritionRepository = Depends(_repo)) -> list[FoodLibraryItem]:
    return repo.list_foods()


@router.post("/foods", response_model=FoodLibraryItem, status_code=201, dependencies=[Depends(require_scope("write:nutrition"))])
async def create_food(payload: FoodItemCreate, repo: NutritionRepository = Depends(_repo)) -> FoodLibraryItem:
    return repo.create_food(payload)


@router.delete("/foods/{food_id}", status_code=204, response_class=Response, dependencies=[Depends(require_scope("write:nutrition"))])
async def delete_food(food_id: str, repo: NutritionRepository = Depends(_repo)) -> Response:
    result = repo.delete_food(food_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Food item not found")
    if result is False:
        raise HTTPException(status_code=400, detail="Cannot delete preset food items")
    return Response(status_code=204)


# ── log entries ───────────────────────────────────────────────────────────────

@router.get("/log", response_model=NutritionLogResponse, dependencies=[Depends(require_scope("read:nutrition"))])
async def get_log(date: str | None = Query(default=None), repo: NutritionRepository = Depends(_repo)) -> NutritionLogResponse:
    return NutritionLogResponse(**repo.get_log(date))


@router.get("/log/monthly", response_model=NutritionMonthlyResponse, dependencies=[Depends(require_scope("read:nutrition"))])
async def get_monthly(month: str | None = Query(default=None), repo: NutritionRepository = Depends(_repo)) -> NutritionMonthlyResponse:
    return NutritionMonthlyResponse(**repo.get_monthly(month))


@router.post("/log", response_model=FoodItemRead, dependencies=[Depends(require_scope("write:nutrition"))])
async def log_food(payload: FoodItemCreate, repo: NutritionRepository = Depends(_repo)) -> FoodItemRead:
    return repo.log_food(payload)


@router.post("/log/from-food", response_model=FoodItemRead, status_code=201, dependencies=[Depends(require_scope("write:nutrition"))])
async def log_from_food(payload: LogEntryCreate, repo: NutritionRepository = Depends(_repo)) -> FoodItemRead:
    try:
        return repo.log_from_food(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/log/{entry_id}", status_code=204, response_class=Response, dependencies=[Depends(require_scope("write:nutrition"))])
async def delete_log_entry(entry_id: str, repo: NutritionRepository = Depends(_repo)) -> Response:
    if not repo.delete_log_entry(entry_id):
        raise HTTPException(status_code=404, detail="Log entry not found")
    return Response(status_code=204)


# ── summary / goals ───────────────────────────────────────────────────────────

@router.get("/summary/{date}", response_model=NutritionSummaryResponse, dependencies=[Depends(require_scope("read:nutrition"))])
async def get_summary(date: str, repo: NutritionRepository = Depends(_repo)) -> NutritionSummaryResponse:
    return NutritionSummaryResponse(**repo.get_summary(date))


@router.get("/goals", response_model=NutritionGoals, dependencies=[Depends(require_scope("read:nutrition"))])
async def get_goals(repo: NutritionRepository = Depends(_repo)) -> NutritionGoals:
    return repo.get_goals()


@router.post("/goals", response_model=NutritionGoals, dependencies=[Depends(require_scope("write:nutrition"))])
async def set_goals(payload: NutritionGoals, repo: NutritionRepository = Depends(_repo)) -> NutritionGoals:
    return repo.set_goals(payload)


# ── export ────────────────────────────────────────────────────────────────────

@router.get("/export/csv", dependencies=[Depends(require_scope("read:nutrition"))])
async def export_csv(
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    repo: NutritionRepository = Depends(_repo),
) -> Response:
    try:
        content = repo.export_csv(from_, to)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return Response(content=content, media_type="text/csv; charset=utf-8")


# ── legacy / convenience ──────────────────────────────────────────────────────

@router.get("/today", response_model=DailyTotals, dependencies=[Depends(require_scope("read:nutrition"))])
async def get_today(repo: NutritionRepository = Depends(_repo)) -> DailyTotals:
    return repo.daily_totals(date_mod.today().isoformat())


@router.get("/history", response_model=DailyTotals, dependencies=[Depends(require_scope("read:nutrition"))])
async def get_history(date: str = Query(...), repo: NutritionRepository = Depends(_repo)) -> DailyTotals:
    return repo.daily_totals(date)


@router.get("/recent", response_model=list[FoodItemRead], dependencies=[Depends(require_scope("read:nutrition"))])
async def recent(repo: NutritionRepository = Depends(_repo)) -> list[FoodItemRead]:
    return repo.list_recent()


@router.delete("/{identifier}", response_model=NutritionDeleteResponse, dependencies=[Depends(require_scope("write:nutrition"))])
async def delete_entry(identifier: str, repo: NutritionRepository = Depends(_repo)) -> NutritionDeleteResponse:
    if not repo.delete_entry(identifier):
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    return NutritionDeleteResponse(deleted=True)
