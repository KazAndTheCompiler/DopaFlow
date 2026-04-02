"""SQLite repository for the tasks domain."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.database import get_db, tx
from app.core.id_gen import task_id


def _iso_now() -> str:
    """Return the current UTC timestamp in ISO format."""

    return datetime.now(timezone.utc).isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    """Parse an ISO datetime when present."""

    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _row_to_task(row) -> dict[str, Any]:
    """Convert a SQLite row into the v2 task payload shape."""

    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "due_at": row["due_at"],
        "priority": row["priority"],
        "status": row["status"],
        "done": bool(row["done"]),
        "estimated_minutes": row["estimated_minutes"],
        "actual_minutes": row["actual_minutes"],
        "recurrence_rule": row["recurrence_rule"],
        "recurrence_parent_id": row["recurrence_parent_id"],
        "sort_order": row["sort_order"],
        "subtasks": json.loads(row["subtasks_json"] or "[]"),
        "tags": json.loads(row["tags_json"] or "[]"),
        "source_type": row["source_type"],
        "source_external_id": row["source_external_id"],
        "source_instance_id": row["source_instance_id"],
        "project_id": row["project_id"] if "project_id" in row.keys() else None,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _fetch_deps(c, task_ids: list[str]) -> dict[str, list[dict[str, str]]]:
    """Batch-load dependencies for the given task IDs."""

    if not task_ids:
        return {}
    placeholders = ",".join("?" for _ in task_ids)
    rows = c.execute(
        f"""
        SELECT td.task_id, td.depends_on_id, t.title
        FROM task_dependencies td
        JOIN tasks t ON t.id = td.depends_on_id
        WHERE td.task_id IN ({placeholders})
        """,
        task_ids,
    ).fetchall()
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["task_id"]].append({"id": row["depends_on_id"], "title": row["title"]})
    return grouped


def create_task(db_path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Insert a task row and return the created task."""

    identifier = payload.get("id") or task_id()
    now = _iso_now()
    with tx(db_path) as conn:
        conn.execute(
            """
            INSERT INTO tasks (
                id, title, description, due_at, priority, status, done,
                estimated_minutes, actual_minutes, recurrence_rule, recurrence_parent_id,
                sort_order, subtasks_json, tags_json, source_type, source_external_id,
                source_instance_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                description=excluded.description,
                due_at=excluded.due_at,
                priority=excluded.priority,
                status=excluded.status,
                done=excluded.done,
                estimated_minutes=excluded.estimated_minutes,
                recurrence_rule=excluded.recurrence_rule,
                subtasks_json=excluded.subtasks_json,
                tags_json=excluded.tags_json,
                updated_at=excluded.updated_at
            """,
            (
                identifier,
                payload["title"],
                payload.get("description"),
                payload.get("due_at"),
                payload.get("priority", 3),
                payload.get("status", "todo"),
                int(payload.get("done", False)),
                payload.get("estimated_minutes"),
                payload.get("actual_minutes"),
                payload.get("recurrence_rule"),
                payload.get("recurrence_parent_id"),
                payload.get("sort_order", 0),
                json.dumps(payload.get("subtasks", [])),
                json.dumps(payload.get("tags", [])),
                payload.get("source_type"),
                payload.get("source_external_id"),
                payload.get("source_instance_id"),
                now,
                now,
            ),
        )
    created = get_task(db_path, identifier)
    if created is None:
        raise RuntimeError("Task creation failed")
    return created


def get_task(db_path: str, task_identifier: str) -> dict[str, Any] | None:
    """Return a task by internal ID."""

    with get_db(db_path) as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL", (task_identifier,)).fetchone()
        if row is None:
            return None
        task = _row_to_task(row)
        task["dependencies"] = _fetch_deps(conn, [task_identifier]).get(task_identifier, [])
        return task


def get_task_by_source_id(db_path: str, source_external_id: str) -> dict[str, Any] | None:
    """Return a task by external provider ID."""

    with get_db(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM tasks WHERE source_external_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1",
            (source_external_id,),
        ).fetchone()
        return _row_to_task(row) if row is not None else None


def list_tasks(
    db_path: str,
    done: bool | None = None,
    status: str | None = None,
    no_date: bool = False,
    due_today: bool = False,
    search: str | None = None,
    project_id: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
    sort_by: str = "default",
) -> list[dict[str, Any]]:
    """List tasks with common filters used by Today and Tasks views."""

    sql = "SELECT * FROM tasks WHERE deleted_at IS NULL"
    params: list[Any] = []
    if done is not None:
        sql += " AND done = ?"
        params.append(int(done))
    if status is not None:
        sql += " AND status = ?"
        params.append(status)
    if no_date:
        sql += " AND due_at IS NULL"
    if due_today:
        sql += " AND DATE(due_at) = DATE('now')"
    if search:
        sql += " AND (LOWER(title) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?)"
        needle = f"%{search.lower()}%"
        params.extend([needle, needle])
    if project_id is not None:
        sql += " AND project_id = ?"
        params.append(project_id)

    ORDER_MAP = {
        "due": "COALESCE(due_at, '9999-12-31') ASC, sort_order ASC",
        "priority": "priority ASC, COALESCE(due_at, '9999-12-31') ASC",
        "created": "created_at DESC",
        "updated": "updated_at DESC",
        "title": "LOWER(title) ASC",
        "default": "sort_order ASC, COALESCE(due_at, '9999-12-31') ASC, updated_at DESC",
    }
    order_clause = ORDER_MAP.get(sort_by, ORDER_MAP["default"])
    sql += f" ORDER BY {order_clause}"

    if limit is not None:
        sql += " LIMIT ?"
        params.append(limit)
    if offset is not None:
        sql += " OFFSET ?"
        params.append(offset)
    with get_db(db_path) as conn:
        rows = conn.execute(sql, params).fetchall()
        task_ids = [row["id"] for row in rows]
        deps = _fetch_deps(conn, task_ids)
        tasks = []
        for row in rows:
            task = _row_to_task(row)
            task["dependencies"] = deps.get(row["id"], [])
            tasks.append(task)
        return tasks


def update_task(db_path: str, task_identifier: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    """Patch task columns using the keys provided."""

    current = get_task(db_path, task_identifier)
    if current is None:
        return None
    merged = {**current, **{key: value for key, value in payload.items() if value is not None}}
    merged["updated_at"] = _iso_now()
    with tx(db_path) as conn:
        conn.execute(
            """
            UPDATE tasks
            SET title = ?, description = ?, due_at = ?, priority = ?, status = ?, done = ?,
                estimated_minutes = ?, actual_minutes = ?, recurrence_rule = ?, recurrence_parent_id = ?,
                sort_order = ?, subtasks_json = ?, tags_json = ?, source_type = ?, source_external_id = ?,
                source_instance_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                merged["title"],
                merged.get("description"),
                merged.get("due_at"),
                merged.get("priority", 3),
                merged.get("status", "todo"),
                int(merged.get("done", False)),
                merged.get("estimated_minutes"),
                merged.get("actual_minutes"),
                merged.get("recurrence_rule"),
                merged.get("recurrence_parent_id"),
                merged.get("sort_order", 0),
                json.dumps(merged.get("subtasks", [])),
                json.dumps(merged.get("tags", [])),
                merged.get("source_type"),
                merged.get("source_external_id"),
                merged.get("source_instance_id"),
                merged["updated_at"],
                task_identifier,
            ),
        )
    return get_task(db_path, task_identifier)


def delete_task(db_path: str, task_identifier: str) -> bool:
    """Soft-delete a task."""

    with tx(db_path) as conn:
        result = conn.execute(
            "UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            (_iso_now(), _iso_now(), task_identifier),
        )
        return result.rowcount > 0


def _next_due_from_rule(rule: str, current_due_at: str | None) -> str | None:
    """Very small recurrence materializer for common rules."""

    base = _parse_dt(current_due_at) or datetime.now(timezone.utc)
    lowered = rule.lower()
    if "day" in lowered:
        return (base + timedelta(days=1)).isoformat()
    if "week" in lowered:
        return (base + timedelta(days=7)).isoformat()
    if "month" in lowered:
        return (base + timedelta(days=30)).isoformat()
    return None


def complete_task(db_path: str, task_identifier: str) -> dict[str, Any] | None:
    """Mark a task complete and spawn the next recurring instance when applicable."""

    task = update_task(
        db_path,
        task_identifier,
        {"done": True, "status": "done", "actual_minutes": get_task(db_path, task_identifier).get("actual_minutes")},
    )
    if task and task.get("recurrence_rule"):
        next_due = _next_due_from_rule(task["recurrence_rule"], task.get("due_at"))
        if next_due:
            create_task(
                db_path,
                {
                    "title": task["title"],
                    "description": task.get("description"),
                    "due_at": next_due,
                    "priority": task.get("priority", 3),
                    "estimated_minutes": task.get("estimated_minutes"),
                    "tags": task.get("tags", []),
                    "subtasks": [],
                    "recurrence_rule": task.get("recurrence_rule"),
                    "recurrence_parent_id": task["id"],
                },
            )
    return task


def add_subtask(db_path: str, task_identifier: str, title: str) -> dict[str, Any] | None:
    """Append a subtask into the subtasks JSON array."""

    task = get_task(db_path, task_identifier)
    if task is None:
        return None
    subtasks = list(task.get("subtasks", []))
    subtasks.append({"id": task_id(), "title": title, "done": False})
    return update_task(db_path, task_identifier, {"subtasks": subtasks})


def patch_subtask(db_path: str, task_identifier: str, subtask_id: str, done: bool) -> dict[str, Any] | None:
    """Patch the done state for a subtask."""

    task = get_task(db_path, task_identifier)
    if task is None:
        return None
    subtasks = []
    for subtask in task.get("subtasks", []):
        if subtask["id"] == subtask_id:
            subtask = {**subtask, "done": done}
        subtasks.append(subtask)
    return update_task(db_path, task_identifier, {"subtasks": subtasks})


def delete_subtask(db_path: str, task_identifier: str, subtask_id: str) -> dict[str, Any] | None:
    """Remove a subtask from the JSON array."""

    task = get_task(db_path, task_identifier)
    if task is None:
        return None
    subtasks = [subtask for subtask in task.get("subtasks", []) if subtask["id"] != subtask_id]
    return update_task(db_path, task_identifier, {"subtasks": subtasks})


def _has_path(conn, start_id: str, target_id: str) -> bool:
    """Detect whether a dependency path already exists."""

    stack = [start_id]
    seen: set[str] = set()
    while stack:
        current = stack.pop()
        if current == target_id:
            return True
        if current in seen:
            continue
        seen.add(current)
        rows = conn.execute(
            "SELECT depends_on_id FROM task_dependencies WHERE task_id = ?",
            (current,),
        ).fetchall()
        stack.extend(row["depends_on_id"] for row in rows)
    return False


def add_dependency(db_path: str, task_identifier: str, dep_id: str) -> tuple[bool, str]:
    """Add a dependency unless it introduces a cycle."""

    with tx(db_path) as conn:
        if _has_path(conn, dep_id, task_identifier):
            return False, "Dependency would create a cycle"
        conn.execute(
            "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)",
            (task_identifier, dep_id),
        )
    return True, "ok"


def remove_dependency(db_path: str, task_identifier: str, dep_id: str) -> None:
    """Remove a dependency edge."""

    with tx(db_path) as conn:
        conn.execute(
            "DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?",
            (task_identifier, dep_id),
        )


def bulk_complete(db_path: str, ids: list[str]) -> int:
    """Complete multiple tasks and return the count updated."""

    count = 0
    for identifier in ids:
        if complete_task(db_path, identifier):
            count += 1
    return count


def bulk_delete(db_path: str, ids: list[str]) -> int:
    """Soft-delete multiple tasks and return the count updated."""

    count = 0
    for identifier in ids:
        if delete_task(db_path, identifier):
            count += 1
    return count


def start_time_log(db_path: str, task_identifier: str) -> dict[str, Any]:
    """Start a task time log entry."""

    log_identifier = task_id()
    started_at = _iso_now()
    with tx(db_path) as conn:
        conn.execute(
            "INSERT INTO task_time_log (id, task_id, started_at) VALUES (?, ?, ?)",
            (log_identifier, task_identifier, started_at),
        )
    return {"id": log_identifier, "task_id": task_identifier, "started_at": started_at}


def stop_time_log(db_path: str, task_identifier: str) -> dict[str, Any] | None:
    """Close the most recent open time log."""

    with tx(db_path) as conn:
        row = conn.execute(
            """
            SELECT id, started_at FROM task_time_log
            WHERE task_id = ? AND ended_at IS NULL
            ORDER BY started_at DESC LIMIT 1
            """,
            (task_identifier,),
        ).fetchone()
        if row is None:
            return None
        started = _parse_dt(row["started_at"]) or datetime.now(timezone.utc)
        ended_at = datetime.now(timezone.utc)
        duration_m = int((ended_at - started).total_seconds() // 60)
        conn.execute(
            "UPDATE task_time_log SET ended_at = ?, duration_m = ? WHERE id = ?",
            (ended_at.isoformat(), duration_m, row["id"]),
        )
        return {"id": row["id"], "task_id": task_identifier, "ended_at": ended_at.isoformat(), "duration_m": duration_m}


def list_time_logs(db_path: str, task_identifier: str) -> list[dict[str, Any]]:
    """Return time logs for a task."""

    with get_db(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM task_time_log WHERE task_id = ? ORDER BY started_at DESC",
            (task_identifier,),
        ).fetchall()
        return [dict(row) for row in rows]


def materialize_recurring(db_path: str, window_hours: int = 36) -> dict[str, int]:
    """Create upcoming recurring instances inside the requested window."""

    created = 0
    window_end = datetime.now(timezone.utc) + timedelta(hours=window_hours)
    for task in list_tasks(db_path, done=True):
        rule = task.get("recurrence_rule")
        if not rule:
            continue
        next_due = _next_due_from_rule(rule, task.get("due_at"))
        if next_due and (_parse_dt(next_due) or window_end) <= window_end:
            existing = list_tasks(db_path, search=task["title"])
            if not any(item.get("recurrence_parent_id") == task["id"] and item.get("due_at") == next_due for item in existing):
                create_task(
                    db_path,
                    {
                        "title": task["title"],
                        "description": task.get("description"),
                        "due_at": next_due,
                        "priority": task.get("priority", 3),
                        "estimated_minutes": task.get("estimated_minutes"),
                        "tags": task.get("tags", []),
                        "subtasks": [],
                        "recurrence_rule": rule,
                        "recurrence_parent_id": task["id"],
                    },
                )
                created += 1
    return {"created": created}


def list_templates(db_path: str) -> list[dict[str, Any]]:
    """Return task templates."""

    with get_db(db_path) as conn:
        rows = conn.execute("SELECT * FROM task_templates ORDER BY name ASC").fetchall()
        return [dict(row) | {"tags": json.loads(row["tags_json"] or "[]")} for row in rows]


def create_template(db_path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create a task template row."""

    identifier = payload.get("id") or task_id()
    with tx(db_path) as conn:
        conn.execute(
            """
            INSERT INTO task_templates (id, name, title, priority, tags_json, estimated_minutes, recurrence_rule)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                identifier,
                payload["name"],
                payload["title"],
                payload.get("priority", 3),
                json.dumps(payload.get("tags", [])),
                payload.get("estimated_minutes"),
                payload.get("recurrence_rule"),
            ),
        )
    return {"id": identifier, **payload}


def delete_template(db_path: str, template_id: str) -> bool:
    """Delete a task template."""

    with tx(db_path) as conn:
        result = conn.execute("DELETE FROM task_templates WHERE id = ?", (template_id,))
        return result.rowcount > 0


def create_from_template(db_path: str, template_id: str) -> dict[str, Any] | None:
    """Instantiate a task from a saved template."""

    with get_db(db_path) as conn:
        row = conn.execute("SELECT * FROM task_templates WHERE id = ?", (template_id,)).fetchone()
        if row is None:
            return None
        return create_task(
            db_path,
            {
                "title": row["title"],
                "priority": row["priority"],
                "tags": json.loads(row["tags_json"] or "[]"),
                "estimated_minutes": row["estimated_minutes"],
                "recurrence_rule": row["recurrence_rule"],
            },
        )


def get_task_context(db_path: str, task_identifier: str) -> dict[str, Any]:
    """Return lightweight cross-domain context for a task."""

    with get_db(db_path) as conn:
        task = conn.execute("SELECT updated_at FROM tasks WHERE id = ?", (task_identifier,)).fetchone()
        if task is None:
            return {"last_touched_days_ago": None, "focus_sessions": 0, "focus_minutes_total": 0, "journal_connections": 0}
        updated_at = _parse_dt(task["updated_at"]) or datetime.now(timezone.utc)
        focus = conn.execute(
            "SELECT COUNT(*) AS sessions, COALESCE(SUM(duration_minutes), 0) AS minutes FROM focus_sessions WHERE task_id = ?",
            (task_identifier,),
        ).fetchone()
        journal = conn.execute(
            """
            SELECT COUNT(*) FROM journal_entries
            WHERE LOWER(markdown_body) LIKE ?
            """,
            (f"%{task_identifier.lower()}%",),
        ).fetchone()
        return {
            "last_touched_days_ago": (datetime.now(timezone.utc) - updated_at).days,
            "focus_sessions": int(focus["sessions"]),
            "focus_minutes_total": int(focus["minutes"]),
            "journal_connections": int(journal[0]),
        }
