"""SQL-only command execution log helpers."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone

from app.core.database import get_db, tx


class CommandRepository:
    @staticmethod
    def add_log(db_path: str, text: str, intent: str, status: str, error: str | None = None) -> dict[str, str]:
        """Log a command execution."""
        cmd_id = str(uuid.uuid4())
        with tx(db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS command_logs(
                  id TEXT PRIMARY KEY,
                  text TEXT,
                  intent TEXT,
                  status TEXT,
                  error_json TEXT,
                  executed_at TEXT
                )
                """
            )
            conn.execute(
                "INSERT INTO command_logs(id, text, intent, status, error_json, executed_at) VALUES(?,?,?,?,?,?)",
                (cmd_id, text, intent, status, error, datetime.now(timezone.utc).isoformat()),
            )
        return {"id": cmd_id, "text": text, "intent": intent, "status": status}

    @staticmethod
    def history(db_path: str, limit: int = 100) -> list[dict[str, object]]:
        """Fetch recent command logs."""
        with get_db(db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS command_logs(
                  id TEXT PRIMARY KEY,
                  text TEXT,
                  intent TEXT,
                  status TEXT,
                  error_json TEXT,
                  executed_at TEXT
                )
                """
            )
            rows = conn.execute(
                "SELECT id, text, intent, status, executed_at FROM command_logs ORDER BY executed_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def clear_history(db_path: str) -> dict[str, object]:
        """Delete all command logs."""
        with tx(db_path) as conn:
            conn.execute("DELETE FROM command_logs")
        return {"cleared": True}
