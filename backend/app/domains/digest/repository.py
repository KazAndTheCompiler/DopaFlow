"""Repository for digest statistics queries."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import date

from app.core.config import get_settings
from app.core.database import get_db

_MOOD_MAP = {"😊": 5, "🙂": 4, "😐": 3, "😟": 2, "😢": 1, "😡": 2, "🤩": 5}


class DigestRepository:
    """Query task, habit, focus, and journal summaries over a date range."""

    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or get_settings().db_path

    def tasks_summary(self, start: date, end: date) -> tuple[dict, dict]:
        daily: dict[str, dict[str, int]] = defaultdict(lambda: {"completed": 0, "created": 0, "overdue": 0})
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT done, due_at, created_at, updated_at, tags_json FROM tasks",
            ).fetchall()
        completed = created = overdue = 0
        tag_counts: Counter[str] = Counter()
        for row in rows:
            due_str = str(row["due_at"] or "")[:10] or None
            created_str = str(row["created_at"] or "")[:10] or None
            updated_str = str(row["updated_at"] or "")[:10] or None
            if created_str and start.isoformat() <= created_str <= end.isoformat():
                created += 1
                daily[created_str]["created"] += 1
            if row["done"] and updated_str and start.isoformat() <= updated_str <= end.isoformat():
                completed += 1
                daily[updated_str]["completed"] += 1
            if due_str and start.isoformat() <= due_str <= end.isoformat() and not row["done"]:
                overdue += 1
                daily[due_str]["overdue"] += 1
            try:
                tags = json.loads(row["tags_json"] or "[]") if row["tags_json"] else []
                for tag in tags:
                    tag_counts[str(tag)] += 1
            except Exception:  # noqa: BLE001
                pass
        completion_rate = round((completed / max(created, 1)) * 100, 1)
        return {
            "completed": completed,
            "created": created,
            "overdue": overdue,
            "completion_rate": completion_rate,
            "top_tags": [{"tag": t, "count": c} for t, c in tag_counts.most_common(5)],
        }, dict(daily)

    def habits_summary(self, start: date, end: date) -> tuple[dict, dict]:
        daily: dict[str, dict[str, int]] = defaultdict(lambda: {"done": 0, "total": 0})
        with get_db(self.db_path) as conn:
            habits = conn.execute("SELECT id, name FROM habits WHERE deleted_at IS NULL").fetchall()
            logs = conn.execute(
                """
                SELECT hc.habit_id, h.name, hc.checkin_date
                FROM habit_checkins hc
                JOIN habits h ON h.id = hc.habit_id
                WHERE DATE(hc.checkin_date) BETWEEN ? AND ?
                """,
                (start.isoformat(), end.isoformat()),
            ).fetchall()
        total_done = total_possible = 0
        best_habit = worst_habit = ""
        best_rate = -1.0
        worst_rate = 101.0
        by_habit = []
        for habit in habits:
            name = habit["name"]
            habit_logs = [lg for lg in logs if lg["name"] == name]
            done_count = len(habit_logs)
            rate = round((done_count / max(done_count, 1)) * 100, 1) if habit_logs else 0.0
            by_habit.append({"name": name, "done": done_count, "rate": rate})
            total_done += done_count
            total_possible += done_count
            if rate > best_rate:
                best_rate = rate
                best_habit = name
            if rate < worst_rate:
                worst_rate = rate
                worst_habit = name
            for lg in habit_logs:
                day = str(lg["checkin_date"])[:10]
                daily[day]["total"] += 1
                daily[day]["done"] += 1
        overall_rate = round((total_done / max(total_possible, 1)) * 100, 1) if total_possible else 0.0
        return {
            "overall_rate": overall_rate,
            "by_habit": by_habit,
            "best_habit": best_habit,
            "worst_habit": worst_habit,
        }, dict(daily)

    def focus_summary(self, start: date, end: date) -> tuple[dict, dict]:
        daily: dict[str, dict[str, int]] = defaultdict(lambda: {"sessions": 0, "minutes": 0})
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT started_at, duration_minutes, status FROM focus_sessions WHERE DATE(started_at) BETWEEN ? AND ?",
                (start.isoformat(), end.isoformat()),
            ).fetchall()
        total_sessions = total_minutes = completed = 0
        best_day = ""
        best_minutes = -1
        for row in rows:
            day = str(row["started_at"] or "")[:10]
            if not day:
                continue
            total_sessions += 1
            mins = int(row["duration_minutes"] or 0)
            total_minutes += mins
            if row["status"] == "completed":
                completed += 1
            daily[day]["sessions"] += 1
            daily[day]["minutes"] += mins
        for day, val in daily.items():
            if val["minutes"] > best_minutes:
                best_minutes = val["minutes"]
                best_day = day
        completion_rate = round((completed / max(total_sessions, 1)) * 100, 1)
        return {
            "total_sessions": total_sessions,
            "total_minutes": total_minutes,
            "completion_rate": completion_rate,
            "best_day": best_day,
        }, dict(daily)

    def journal_summary(self, start: date, end: date) -> tuple[dict, dict]:
        daily: dict[str, dict[str, int]] = defaultdict(lambda: {"words": 0, "has_journal": 0})
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT markdown_body, tags_json, emoji, entry_date
                FROM journal_entries
                WHERE deleted_at IS NULL AND DATE(entry_date) BETWEEN ? AND ?
                """,
                (start.isoformat(), end.isoformat()),
            ).fetchall()
        tag_counts: Counter[str] = Counter()
        mood_counts: Counter[str] = Counter()
        word_counts = []
        for row in rows:
            body = (row["markdown_body"] or "").strip()
            if not body:
                continue
            day = str(row["entry_date"] or "")[:10]
            words = len(body.split())
            word_counts.append(words)
            daily[day]["words"] = words
            daily[day]["has_journal"] = 1
            try:
                tags = json.loads(row["tags_json"] or "[]") if row["tags_json"] else []
                for tag in tags:
                    tag_counts[str(tag)] += 1
            except Exception:  # noqa: BLE001
                pass
            emoji = (row["emoji"] or "").strip()
            if emoji:
                mood_counts[emoji] += 1
        entries_written = len(word_counts)
        avg_words = round(sum(word_counts) / max(len(word_counts), 1), 1) if word_counts else 0.0
        return {
            "entries_written": entries_written,
            "avg_word_count": avg_words,
            "top_tags": [{"tag": t, "count": c} for t, c in tag_counts.most_common(5)],
            "mood_distribution": dict(mood_counts),
        }, dict(daily)

    def nutrition_summary(self, start: date, end: date) -> dict:
        """Return calorie and macro totals for a date range."""
        try:
            with get_db(self.db_path) as conn:
                rows = conn.execute(
                    """
                    SELECT entry_date, SUM(calories) as kcal,
                           SUM(protein_g) as protein, SUM(fat_g) as fat, SUM(carbs_g) as carbs
                    FROM nutrition_entries
                    WHERE entry_date BETWEEN ? AND ?
                    GROUP BY entry_date
                    """,
                    (start.isoformat(), end.isoformat()),
                ).fetchall()
        except Exception:  # noqa: BLE001
            return {"total_kcal": 0, "avg_kcal": 0, "days_logged": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
        total_kcal = sum(float(r["kcal"] or 0) for r in rows)
        days = len(rows)
        return {
            "total_kcal": round(total_kcal, 1),
            "avg_kcal": round(total_kcal / days, 1) if days else 0,
            "days_logged": days,
            "protein_g": round(sum(float(r["protein"] or 0) for r in rows), 1),
            "fat_g": round(sum(float(r["fat"] or 0) for r in rows), 1),
            "carbs_g": round(sum(float(r["carbs"] or 0) for r in rows), 1),
        }

    def review_daily(self, start: date, end: date) -> dict[str, dict[str, float]]:
        daily: dict[str, dict[str, float]] = defaultdict(lambda: {"cards_seen": 0.0, "retained": 0.0})
        try:
            with get_db(self.db_path) as conn:
                rows = conn.execute(
                    "SELECT started_at, cards_seen, cards_good, cards_easy FROM review_session_log WHERE DATE(started_at) BETWEEN ? AND ?",
                    (start.isoformat(), end.isoformat()),
                ).fetchall()
            for row in rows:
                day = str(row["started_at"] or "")[:10]
                if not day:
                    continue
                daily[day]["cards_seen"] += int(row["cards_seen"] or 0)
                daily[day]["retained"] += int(row["cards_good"] or 0) + int(row["cards_easy"] or 0)
        except Exception:  # noqa: BLE001
            pass
        return dict(daily)
