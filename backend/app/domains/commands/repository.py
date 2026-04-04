"""SQL-only command execution log helpers."""

from __future__ import annotations

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
              executed_at TEXT
            )
            """
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(command_logs)").fetchall()}
        if "source" not in columns:
            conn.execute("ALTER TABLE command_logs ADD COLUMN source TEXT DEFAULT 'text'")

    @staticmethod
    def add_log(
        db_path: str,
        text: str,
        intent: str,
        status: str,
        error: str | None = None,
        *,
        source: str = "text",
    ) -> dict[str, str]:
        """Log a command execution."""
        cmd_id = str(uuid.uuid4())
        with tx(db_path) as conn:
            CommandRepository._ensure_table(conn)
            conn.execute(
                "INSERT INTO command_logs(id, text, intent, status, source, error_json, executed_at) VALUES(?,?,?,?,?,?,?)",
                (cmd_id, text, intent, status, source, error, datetime.now(timezone.utc).isoformat()),
            )
        return {"id": cmd_id, "text": text, "intent": intent, "status": status, "source": source}

    @staticmethod
    def history(db_path: str, limit: int = 100) -> list[dict[str, object]]:
        """Fetch recent command logs."""
        with get_db(db_path) as conn:
            CommandRepository._ensure_table(conn)
            rows = conn.execute(
                "SELECT id, text, intent, status, source, executed_at FROM command_logs ORDER BY executed_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def clear_history(db_path: str) -> dict[str, object]:
        """Delete all command logs."""
        with tx(db_path) as conn:
            conn.execute("DELETE FROM command_logs")
        return {"cleared": True}
