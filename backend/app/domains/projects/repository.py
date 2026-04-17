"""SQLite repository for the projects domain."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.database import get_db, tx
from app.core.id_gen import project_id


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_project(row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "color": row["color"],
        "icon": row["icon"],
        "archived": bool(row["archived"]),
        "sort_order": row["sort_order"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_projects(db_path: str, include_archived: bool = False) -> list[dict[str, Any]]:
    with get_db(db_path) as conn:
        if include_archived:
            rows = conn.execute(
                "SELECT * FROM projects ORDER BY sort_order ASC, name ASC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM projects WHERE archived = 0 ORDER BY sort_order ASC, name ASC"
            ).fetchall()
    return [_row_to_project(r) for r in rows]


def create_project(db_path: str, payload: dict[str, Any]) -> dict[str, Any]:
    pid = project_id()
    now = _iso_now()
    with tx(db_path) as conn:
        conn.execute(
            """INSERT INTO projects (id, name, color, icon, sort_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                pid,
                payload["name"],
                payload.get("color", "#6366f1"),
                payload.get("icon", "▣"),
                payload.get("sort_order", 0),
                now,
                now,
            ),
        )
    with get_db(db_path) as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    return _row_to_project(row)


def update_project(
    db_path: str, project_identifier: str, patch: dict[str, Any]
) -> dict[str, Any] | None:
    allowed = {"name", "color", "icon", "archived", "sort_order"}
    fields = {k: v for k, v in patch.items() if k in allowed}
    if not fields:
        with get_db(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM projects WHERE id = ?", (project_identifier,)
            ).fetchone()
        return _row_to_project(row) if row else None
    fields["updated_at"] = _iso_now()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    with tx(db_path) as conn:
        conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?",
            (*fields.values(), project_identifier),
        )
    with get_db(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_identifier,)
        ).fetchone()
    return _row_to_project(row) if row else None


def delete_project(db_path: str, project_identifier: str) -> bool:
    """Delete project and unlink tasks (set project_id = NULL)."""
    with tx(db_path) as conn:
        conn.execute(
            "UPDATE tasks SET project_id = NULL WHERE project_id = ?",
            (project_identifier,),
        )
        result = conn.execute(
            "DELETE FROM projects WHERE id = ?", (project_identifier,)
        )
    return result.rowcount > 0


def get_project_task_counts(db_path: str) -> dict[str, int]:
    """Return {project_id: task_count} for active (non-done) tasks."""
    with get_db(db_path) as conn:
        rows = conn.execute(
            "SELECT project_id, COUNT(*) as cnt FROM tasks WHERE project_id IS NOT NULL AND done = 0 AND deleted_at IS NULL GROUP BY project_id"
        ).fetchall()
    return {r["project_id"]: r["cnt"] for r in rows}
