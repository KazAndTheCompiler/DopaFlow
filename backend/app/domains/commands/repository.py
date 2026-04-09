"""SQL-only command execution log helpers."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone

from app.core.database import get_db, tx


class CommandRepository:
    @staticmethod
    def _ensure_table(conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS command_logs(
              id TEXT PRIMARY KEY,
              text TEXT,
              intent TEXT,
              status TEXT,
              source TEXT DEFAULT 'text',
              error_json TEXT,
              result_json TEXT,
              executed_at TEXT,
              undone_at TEXT
            )
            """
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(command_logs)").fetchall()}
        if "source" not in columns:
            conn.execute("ALTER TABLE command_logs ADD COLUMN source TEXT DEFAULT 'text'")
        if "result_json" not in columns:
            conn.execute("ALTER TABLE command_logs ADD COLUMN result_json TEXT")
        if "undone_at" not in columns:
            conn.execute("ALTER TABLE command_logs ADD COLUMN undone_at TEXT")

    @staticmethod
    def add_log(
        db_path: str,
        text: str,
        intent: str,
        status: str,
        error: str | None = None,
        *,
        source: str = "text",
        result: object = None,
    ) -> dict[str, str]:
        """Log a command execution.

        ``result`` is JSON-serialised and stored in ``result_json`` so that
        undo can retrieve the entity ID needed to reverse the action.
        """
        cmd_id = str(uuid.uuid4())
        result_serialised = json.dumps(result) if result is not None else None
        with tx(db_path) as conn:
            CommandRepository._ensure_table(conn)
            conn.execute(
                "INSERT INTO command_logs(id, text, intent, status, source, error_json, result_json, executed_at) VALUES(?,?,?,?,?,?,?,?)",
                (cmd_id, text, intent, status, source, error, result_serialised, datetime.now(timezone.utc).isoformat()),
            )
        return {"id": cmd_id, "text": text, "intent": intent, "status": status, "source": source}

    @staticmethod
    def history(db_path: str, limit: int = 100) -> list[dict[str, object]]:
        """Fetch recent command logs."""
        with get_db(db_path) as conn:
            CommandRepository._ensure_table(conn)
            rows = conn.execute(
                "SELECT id, text, intent, status, source, error_json, result_json, executed_at, undone_at FROM command_logs ORDER BY executed_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        result: list[dict[str, object]] = []
        for row in rows:
            entry = dict(row)
            raw = entry.pop("result_json", None)
            if raw:
                try:
                    entry["result"] = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    entry["result"] = None
            result.append(entry)
        return result

    @staticmethod
    def mark_undone(db_path: str, command_id: str) -> None:
        with tx(db_path) as conn:
            CommandRepository._ensure_table(conn)
            conn.execute(
                "UPDATE command_logs SET undone_at = ? WHERE id = ?",
                (datetime.now(timezone.utc).isoformat(), command_id),
            )

    @staticmethod
    def clear_history(db_path: str) -> dict[str, object]:
        """Delete all command logs."""
        with tx(db_path) as conn:
            conn.execute("DELETE FROM command_logs")
        return {"cleared": True}
