"""SQLite repository for nutrition logging."""

from __future__ import annotations

import csv
import io
import logging
from datetime import date as date_mod
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.database import get_db, tx
from app.domains.nutrition.schemas import (
    DailyTotals,
    FoodItemCreate,
    FoodItemRead,
    FoodLibraryItem,
    LogEntryCreate,
    NutritionGoals,
)

logger = logging.getLogger(__name__)

_VALID_MEALS = {"breakfast", "lunch", "dinner", "snack"}
_GOAL_DEFAULTS = {"daily_kj": 9000, "protein_g": 120, "carbs_g": 250, "fat_g": 70}
_PRESET_FOODS = [
    {
        "id": "preset_water_glass",
        "name": "Water",
        "kj": 0,
        "unit": "glass",
        "protein_g": 0,
        "carbs_g": 0,
        "fat_g": 0,
        "meal_label": "snack",
    },
    {
        "id": "preset_coffee_cup",
        "name": "Coffee",
        "kj": 8,
        "unit": "cup",
        "protein_g": 0.3,
        "carbs_g": 0,
        "fat_g": 0,
        "meal_label": "breakfast",
    },
    {
        "id": "preset_tea_cup",
        "name": "Tea",
        "kj": 4,
        "unit": "cup",
        "protein_g": 0,
        "carbs_g": 0,
        "fat_g": 0,
        "meal_label": "breakfast",
    },
    {
        "id": "preset_milk_100ml",
        "name": "Milk",
        "kj": 250,
        "unit": "100 ml",
        "protein_g": 3.4,
        "carbs_g": 4.8,
        "fat_g": 3.5,
        "meal_label": "breakfast",
    },
    {
        "id": "preset_sugar_tsp",
        "name": "Sugar",
        "kj": 80,
        "unit": "tsp",
        "protein_g": 0,
        "carbs_g": 5,
        "fat_g": 0,
        "meal_label": "breakfast",
    },
    {
        "id": "preset_bread_slice",
        "name": "Bread slice",
        "kj": 330,
        "unit": "slice",
        "protein_g": 3.2,
        "carbs_g": 14.2,
        "fat_g": 1.1,
        "meal_label": "lunch",
    },
    {
        "id": "preset_butter_pat",
        "name": "Butter",
        "kj": 150,
        "unit": "pat",
        "protein_g": 0.1,
        "carbs_g": 0,
        "fat_g": 4.1,
        "meal_label": "lunch",
    },
    {
        "id": "preset_cheese_slice",
        "name": "Cheese slice",
        "kj": 290,
        "unit": "slice",
        "protein_g": 5.2,
        "carbs_g": 0.2,
        "fat_g": 5.6,
        "meal_label": "lunch",
    },
    {
        "id": "preset_ham_slice",
        "name": "Ham slice",
        "kj": 120,
        "unit": "slice",
        "protein_g": 3.7,
        "carbs_g": 0.3,
        "fat_g": 1.8,
        "meal_label": "lunch",
    },
    {
        "id": "preset_basic_sandwich",
        "name": "Basic sandwich",
        "kj": 1150,
        "unit": "sandwich",
        "protein_g": 15.5,
        "carbs_g": 28,
        "fat_g": 12.6,
        "meal_label": "lunch",
    },
]


def _normalize_meal(label: str | None) -> str:
    v = (label or "snack").strip().lower()
    return v if v in _VALID_MEALS else "snack"


def _row_to_food(row: object) -> FoodItemRead:
    data = dict(row)  # type: ignore[call-overload]
    return FoodItemRead(
        id=str(data["id"]),
        name=str(data["food_name"]),
        kj=float(data.get("calories") or data.get("kj") or 0.0),
        unit=str(data.get("unit") or "serving"),
        protein_g=float(data.get("protein_g") or 0.0),
        carbs_g=float(data.get("carbs_g") or 0.0),
        fat_g=float(data.get("fat_g") or 0.0),
        meal_label=_normalize_meal(data.get("meal_label")),
        logged_at=str(data.get("created_at") or data.get("entry_date") or ""),
    )


class NutritionRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def _ensure_presets(self) -> None:
        with tx(self.db_path) as conn:
            for preset in _PRESET_FOODS:
                conn.execute(
                    """
                    INSERT INTO nutrition_foods (
                        id, name, kj, unit, protein_g, carbs_g, fat_g, meal_label, is_preset
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        kj = excluded.kj,
                        unit = excluded.unit,
                        protein_g = excluded.protein_g,
                        carbs_g = excluded.carbs_g,
                        fat_g = excluded.fat_g,
                        meal_label = excluded.meal_label,
                        is_preset = 1
                    """,
                    (
                        preset["id"],
                        preset["name"],
                        preset["kj"],
                        preset["unit"],
                        preset["protein_g"],
                        preset["carbs_g"],
                        preset["fat_g"],
                        _normalize_meal(str(preset["meal_label"])),
                    ),
                )

    # ── inline log entries ────────────────────────────────────────────────────

    def log_food(self, payload: FoodItemCreate) -> FoodItemRead:
        """Log a food entry with inline macros."""
        identifier = f"nut_{uuid4().hex[:24]}"
        today = datetime.now(timezone.utc).date().isoformat()
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO nutrition_entries (
                    id, entry_date, food_name, calories, protein_g, carbs_g, fat_g, meal_label, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    identifier,
                    today,
                    payload.name,
                    payload.kj,
                    payload.protein_g,
                    payload.carbs_g,
                    payload.fat_g,
                    _normalize_meal(payload.meal_label),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM nutrition_entries WHERE id = ?", (identifier,)
            ).fetchone()
        return _row_to_food(row)

    def log_from_food(self, payload: LogEntryCreate) -> FoodItemRead:
        """Log consumption of a food from the library, expanding macros by qty."""
        food = self.get_food(payload.food_id)
        if not food:
            raise ValueError(f"Food not found: {payload.food_id}")
        identifier = f"nut_{uuid4().hex[:24]}"
        target_date = payload.date or datetime.now(timezone.utc).date().isoformat()
        qty = payload.qty
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO nutrition_entries (
                    id, entry_date, food_name, calories, protein_g, carbs_g, fat_g,
                    meal_label, qty, food_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    identifier,
                    target_date,
                    food.name,
                    round(food.kj * qty, 2),
                    round(food.protein_g * qty, 2),
                    round(food.carbs_g * qty, 2),
                    round(food.fat_g * qty, 2),
                    _normalize_meal(payload.meal_label),
                    qty,
                    payload.food_id,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM nutrition_entries WHERE id = ?", (identifier,)
            ).fetchone()
        return _row_to_food(row)

    def get_log(self, date: str | None = None) -> dict:
        """Return all log entries for a date grouped by meal."""
        target = date or datetime.now(timezone.utc).date().isoformat()
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM nutrition_entries WHERE entry_date = ? ORDER BY created_at ASC",
                (target,),
            ).fetchall()
        entries = [_row_to_food(row) for row in rows]
        total_kj = sum(e.kj for e in entries)
        by_meal: dict = {}
        for meal in ("breakfast", "lunch", "dinner", "snack"):
            meal_entries = [e for e in entries if e.meal_label == meal]
            by_meal[meal] = {
                "entries": [e.model_dump() for e in meal_entries],
                "kj_total": round(sum(e.kj for e in meal_entries), 1),
                "protein_g": round(sum(e.protein_g for e in meal_entries), 1),
                "carbs_g": round(sum(e.carbs_g for e in meal_entries), 1),
                "fat_g": round(sum(e.fat_g for e in meal_entries), 1),
            }
        return {
            "date": target,
            "entries": [e.model_dump() for e in entries],
            "total_kj": round(total_kj, 1),
            "protein_g": round(sum(e.protein_g for e in entries), 1),
            "carbs_g": round(sum(e.carbs_g for e in entries), 1),
            "fat_g": round(sum(e.fat_g for e in entries), 1),
            "by_meal": by_meal,
        }

    def daily_totals(self, date: str) -> DailyTotals:
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM nutrition_entries WHERE entry_date = ? ORDER BY created_at DESC",
                (date,),
            ).fetchall()
        entries = [_row_to_food(row) for row in rows]
        return DailyTotals(
            date=date,
            total_kj=round(sum(item.kj for item in entries), 1),
            total_protein_g=round(sum(item.protein_g for item in entries), 1),
            total_carbs_g=round(sum(item.carbs_g for item in entries), 1),
            total_fat_g=round(sum(item.fat_g for item in entries), 1),
            entries=entries,
        )

    def get_monthly(self, month: str | None = None) -> dict:
        """Return daily kj totals for a month."""
        target = month or datetime.now(timezone.utc).strftime("%Y-%m")
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT entry_date, SUM(calories) AS total_kj
                FROM nutrition_entries
                WHERE entry_date LIKE ?
                GROUP BY entry_date
                ORDER BY entry_date ASC
                """,
                (f"{target}%",),
            ).fetchall()
        days = [
            {
                "date": row["entry_date"],
                "total_kj": round(float(row["total_kj"] or 0), 1),
            }
            for row in rows
        ]
        return {
            "month": target,
            "days": days,
            "total_kj": round(sum(d["total_kj"] for d in days), 1),
        }

    def get_summary(self, date: str) -> dict:
        """Return daily totals with goal progress percentages."""
        log = self.get_log(date)
        goals = self.get_goals()
        return {
            "date": log["date"],
            "total_kj": log["total_kj"],
            "protein_g": log["protein_g"],
            "carbs_g": log["carbs_g"],
            "fat_g": log["fat_g"],
            "goal_progress": {
                "daily_kj": round((log["total_kj"] / goals["daily_kj"]) * 100, 1)
                if goals["daily_kj"]
                else 0.0,
                "protein_g": round((log["protein_g"] / goals["protein_g"]) * 100, 1)
                if goals["protein_g"]
                else 0.0,
                "carbs_g": round((log["carbs_g"] / goals["carbs_g"]) * 100, 1)
                if goals["carbs_g"]
                else 0.0,
                "fat_g": round((log["fat_g"] / goals["fat_g"]) * 100, 1)
                if goals["fat_g"]
                else 0.0,
            },
        }

    def delete_log_entry(self, identifier: str) -> bool:
        with tx(self.db_path) as conn:
            result = conn.execute(
                "DELETE FROM nutrition_entries WHERE id = ?", (identifier,)
            )
        return result.rowcount > 0

    def delete_entry(self, identifier: str) -> bool:
        return self.delete_log_entry(identifier)

    def list_recent(self, limit: int = 50) -> list[FoodItemRead]:
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM nutrition_entries ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [_row_to_food(row) for row in rows]

    # ── food library ──────────────────────────────────────────────────────────

    def list_foods(self) -> list[FoodLibraryItem]:
        self._ensure_presets()
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM nutrition_foods ORDER BY is_preset DESC, name ASC"
            ).fetchall()
        return [
            FoodLibraryItem(
                id=str(r["id"]),
                name=str(r["name"]),
                kj=float(r["kj"]),
                unit=str(r["unit"]),
                protein_g=float(r["protein_g"] or 0),
                carbs_g=float(r["carbs_g"] or 0),
                fat_g=float(r["fat_g"] or 0),
                meal_label=_normalize_meal(r["meal_label"]),
                is_preset=bool(r["is_preset"]),
            )
            for r in rows
        ]

    def get_food(self, food_id: str) -> FoodLibraryItem | None:
        self._ensure_presets()
        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM nutrition_foods WHERE id = ?", (food_id,)
            ).fetchone()
        if not row:
            return None
        r = dict(row)
        return FoodLibraryItem(
            id=str(r["id"]),
            name=str(r["name"]),
            kj=float(r["kj"]),
            unit=str(r["unit"]),
            protein_g=float(r["protein_g"] or 0),
            carbs_g=float(r["carbs_g"] or 0),
            fat_g=float(r["fat_g"] or 0),
            meal_label=_normalize_meal(r["meal_label"]),
            is_preset=bool(r["is_preset"]),
        )

    def create_food(self, payload: FoodItemCreate) -> FoodLibraryItem:
        food_id = f"food_{uuid4().hex[:20]}"
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO nutrition_foods (id, name, kj, unit, protein_g, carbs_g, fat_g, meal_label)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    food_id,
                    payload.name.strip(),
                    payload.kj,
                    payload.unit or "serving",
                    payload.protein_g,
                    payload.carbs_g,
                    payload.fat_g,
                    _normalize_meal(payload.meal_label),
                ),
            )
        return self.get_food(food_id)  # type: ignore[return-value]

    def delete_food(self, food_id: str) -> bool | None:
        """Returns None if not found, False if preset (protected), True if deleted."""
        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT is_preset FROM nutrition_foods WHERE id = ?", (food_id,)
            ).fetchone()
        if not row:
            return None
        if row["is_preset"]:
            return False
        with tx(self.db_path) as conn:
            conn.execute("DELETE FROM nutrition_foods WHERE id = ?", (food_id,))
        return True

    # ── goals ─────────────────────────────────────────────────────────────────

    def get_goals(self) -> dict:
        goals = dict(_GOAL_DEFAULTS)
        with get_db(self.db_path) as conn:
            rows = conn.execute("SELECT key, value FROM nutrition_goals").fetchall()
        for row in rows:
            try:
                goals[row["key"]] = int(float(row["value"]))
            except Exception:
                logger.exception(
                    "Failed to parse nutrition goal value for key=%s, value=%s",
                    row["key"],
                    row["value"],
                )
        return goals

    def set_goals(self, payload: NutritionGoals) -> dict:
        data = payload.model_dump()
        with tx(self.db_path) as conn:
            for key, value in data.items():
                conn.execute(
                    "INSERT INTO nutrition_goals(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, str(value)),
                )
        return self.get_goals()

    # ── export ────────────────────────────────────────────────────────────────

    def export_csv(self, from_date: str, to_date: str) -> str:
        """Return CSV string of daily nutrition summaries in a date range."""
        start = date_mod.fromisoformat(from_date)
        end = date_mod.fromisoformat(to_date)
        if (end - start).days > 365:
            raise ValueError("Date range too large (max 365 days)")
        goals = self.get_goals()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "date",
                "total_kj",
                "protein_g",
                "carbs_g",
                "fat_g",
                "goal_kj",
                "adherence_pct",
            ]
        )
        current = start
        while current <= end:
            summary = self.get_summary(current.isoformat())
            goal_kj = goals.get("daily_kj")
            adherence = (
                round((summary["total_kj"] / goal_kj) * 100, 1) if goal_kj else None
            )
            writer.writerow(
                [
                    current.isoformat(),
                    summary["total_kj"],
                    summary["protein_g"],
                    summary["carbs_g"],
                    summary["fat_g"],
                    goal_kj,
                    adherence,
                ]
            )
            current += timedelta(days=1)
        return output.getvalue()
