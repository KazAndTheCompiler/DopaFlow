"""Repository for ops diagnostics, metadata, export, and seed queries."""

from __future__ import annotations

import sqlite3

from app.core.base_repository import BaseRepository
from app.core.config import Settings


class OpsRepository(BaseRepository):
    """Read and write ops_metadata, table counts, and bulk export queries."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)

    # ── metadata ──────────────────────────────────────────────────────────────

    def set_metadata(self, key: str, value: str) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO ops_metadata(key, value, updated_at)
                VALUES(?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
                """,
                (key, value),
            )

    def get_metadata(self, key: str) -> str | None:
        try:
            with self.get_db_readonly() as conn:
                row = conn.execute(
                    "SELECT value FROM ops_metadata WHERE key=?", (key,)
                ).fetchone()
            return row["value"] if row else None
        except Exception:
            return None

    # ── table counts ─────────────────────────────────────────────────────────

    def get_counts(self) -> dict[str, int]:
        with self.get_db_readonly() as conn:
            tasks = int(conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0])
            habits = int(conn.execute("SELECT COUNT(*) FROM habits").fetchone()[0])
            journal_entries = int(
                conn.execute("SELECT COUNT(*) FROM journal_entries").fetchone()[0]
            )
        return {"tasks": tasks, "habits": habits, "journal_entries": journal_entries}

    def count_journal_entries(self) -> int:
        try:
            with self.get_db_readonly() as conn:
                return int(
                    conn.execute("SELECT COUNT(*) FROM journal_entries").fetchone()[0]
                )
        except sqlite3.OperationalError:
            return 0

    # ── seed checks ──────────────────────────────────────────────────────────

    def count_tasks_and_habits(self) -> tuple[int, int]:
        with self.get_db_readonly() as conn:
            task_count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
            habit_count = conn.execute("SELECT COUNT(*) FROM habits").fetchone()[0]
        return int(task_count), int(habit_count)

    # ── export ───────────────────────────────────────────────────────────────

    @staticmethod
    def _optional_rows(
        conn: sqlite3.Connection, sql: str, *, table_name: str
    ) -> list[dict[str, object]]:
        try:
            return [dict(row) for row in conn.execute(sql).fetchall()]
        except sqlite3.OperationalError as exc:
            if "no such table" not in str(exc).lower():
                raise
            return []

    def export_payload(self) -> dict[str, list[dict[str, object]]]:
        with self.get_db_readonly() as conn:
            tasks = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM tasks ORDER BY created_at"
                ).fetchall()
            ]
            habits = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM habit_checkins ORDER BY checkin_date"
                ).fetchall()
            ]
            journal = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date"
                ).fetchall()
            ]
            decks = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM review_decks ORDER BY created_at"
                ).fetchall()
            ]
            cards = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM review_cards ORDER BY created_at"
                ).fetchall()
            ]
            nutrition = self._optional_rows(
                conn,
                "SELECT * FROM nutrition_log ORDER BY date",
                table_name="nutrition_log",
            )
            cmd_logs = self._optional_rows(
                conn,
                "SELECT * FROM command_logs ORDER BY executed_at DESC LIMIT 500",
                table_name="command_logs",
            )
        return {
            "tasks": tasks,
            "commands": cmd_logs,
            "habits": habits,
            "journal": journal,
            "decks": decks,
            "cards": cards,
            "nutrition_log": nutrition,
        }

    def export_zip_data(self) -> dict[str, list[dict[str, object]]]:
        with self.get_db_readonly() as conn:
            tasks = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM tasks ORDER BY created_at"
                ).fetchall()
            ]
            habits = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM habit_checkins ORDER BY checkin_date"
                ).fetchall()
            ]
            journal = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date"
                ).fetchall()
            ]
            alarms = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM alarms ORDER BY created_at"
                ).fetchall()
            ]
            nutrition = self._optional_rows(
                conn,
                "SELECT * FROM nutrition_log ORDER BY date",
                table_name="nutrition_log",
            )
        return {
            "tasks": tasks,
            "habits": habits,
            "journal": journal,
            "alarms": alarms,
            "nutrition_log": nutrition,
        }
