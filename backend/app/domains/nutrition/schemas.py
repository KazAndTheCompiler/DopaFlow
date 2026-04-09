"""Pydantic schemas for nutrition logging."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FoodItemCreate(BaseModel):
    name: str
    kj: float = Field(gt=0)
    unit: str = "serving"
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    meal_label: str = "snack"


class FoodItemRead(FoodItemCreate):
    id: str
    logged_at: str | None = None


class FoodLibraryItem(BaseModel):
    id: str
    name: str
    kj: float
    unit: str
    protein_g: float
    carbs_g: float
    fat_g: float
    meal_label: str
    is_preset: bool = False


class LogEntryCreate(BaseModel):
    food_id: str
    qty: float = Field(default=1.0, gt=0)
    date: str | None = None
    meal_label: str = "snack"


class NutritionGoals(BaseModel):
    daily_kj: int = 9000
    protein_g: int = 120
    carbs_g: int = 250
    fat_g: int = 70


class DailyTotals(BaseModel):
    date: str
    total_kj: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    entries: list[FoodItemRead]


class NutritionMealSummary(BaseModel):
    entries: list[FoodItemRead]
    kj_total: float
    protein_g: float
    carbs_g: float
    fat_g: float


class NutritionLogResponse(BaseModel):
    date: str
    entries: list[FoodItemRead]
    total_kj: float
    protein_g: float
    carbs_g: float
    fat_g: float
    by_meal: dict[str, NutritionMealSummary]


class NutritionMonthDay(BaseModel):
    date: str
    total_kj: float


class NutritionMonthlyResponse(BaseModel):
    month: str
    days: list[NutritionMonthDay]
    total_kj: float


class NutritionGoalProgress(BaseModel):
    daily_kj: float
    protein_g: float
    carbs_g: float
    fat_g: float


class NutritionSummaryResponse(BaseModel):
    date: str
    total_kj: float
    protein_g: float
    carbs_g: float
    fat_g: float
    goal_progress: NutritionGoalProgress


class NutritionDeleteResponse(BaseModel):
    deleted: bool
