"""SQLite repository for the tasks domain."""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.base_repository import BaseRepository
from app.core.id_gen import task_id
from app.domains.tasks.schemas import (
    CreatedCountResponse,
    SubTask,
    Task,
    TaskContext,
    TaskDependency,
    TaskTemplate,
    TaskTimeLog,
)

logger = logging.getLogger(__name__)


def _iso_now() -> str:
    """Return the current UTC timestamp in ISO format."""

    return datetime.now(timezone.utc).isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    """Parse an ISO datetime when present."""

    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _add_months(base: datetime, months: int) -> datetime:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    month_lengths = [
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ]
    day = min(base.day, month_lengths[month - 1])
    return base.replace(year=year, month=month, day=day)


def _parse_rrule(rule: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for part in rule.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        parsed[key.strip().upper()] = value.strip().upper()
    return parsed


def _weekday_index(code: str) -> int | None:
    mapping = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
    return mapping.get(code)


def _row_to_task(row) -> Task:
    """Convert a SQLite row into the v2 task payload shape."""

    return Task(
        id=row["id"],
        title=row["title"],
        description=row["description"],
        due_at=row["due_at"],
        priority=row["priority"],
        status=row["status"],
        done=bool(row["done"]),
        estimated_minutes=row["estimated_minutes"],
        actual_minutes=row["actual_minutes"],
        recurrence_rule=row["recurrence_rule"],
        recurrence_parent_id=row["recurrence_parent_id"],
        sort_order=row["sort_order"],
        subtasks=json.loads(row["subtasks_json"] or "[]"),
        tags=json.loads(row["tags_json"] or "[]"),
        source_type=row["source_type"],
        source_external_id=row["source_external_id"],
        source_instance_id=row["source_instance_id"],
        project_id=row["project_id"] if "project_id" in row else None,  # noqa: SIM401
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


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
        grouped[row["task_id"]].append(
            {"id": row["depends_on_id"], "title": row["title"]}
        )
    return grouped


def _next_due_from_rule(rule: str, current_due_at: str | None) -> str | None:
    """Materialize the next due date for the supported RRULE subset."""

    base = _parse_dt(current_due_at) or datetime.now(timezone.utc)
    parts = _parse_rrule(rule)
    freq = parts.get("FREQ")
    if freq == "HOURLY":
        return (base + timedelta(hours=1)).isoformat()
    if freq == "DAILY":
        return (base + timedelta(days=1)).isoformat()
    if freq == "WEEKLY":
        byday = [token for token in parts.get("BYDAY", "").split(",") if token]
        if byday:
            weekdays = sorted(
                index for token in byday if (index := _weekday_index(token)) is not None
            )
            if weekdays:
                for weekday in weekdays:
                    delta = (weekday - base.weekday()) % 7
                    if delta == 0:
                        continue
                    return (base + timedelta(days=delta)).isoformat()
                return (
                    base + timedelta(days=((weekdays[0] - base.weekday()) % 7 or 7))
                ).isoformat()
        return (base + timedelta(days=7)).isoformat()
    if freq == "MONTHLY":
        return _add_months(base, 1).isoformat()
    if freq == "YEARLY":
        return _add_months(base, 12).isoformat()
    return None


def _recurring_instance_exists(conn, parent_id: str, due_at: str) -> bool:
    row = conn.execute(
        """
        SELECT 1
        FROM tasks
        WHERE recurrence_parent_id = ?
          AND due_at = ?
          AND deleted_at IS NULL
        LIMIT 1
        """,
        (parent_id, due_at),
    ).fetchone()
    return row is not None


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


class TaskRepository(BaseRepository):
    """Repository for task CRUD and queries."""

    def create_task(self, payload: dict[str, Any]) -> Task:
        """Insert a task row and return the created task."""

        identifier = payload.get("id") or task_id()
        now = _iso_now()
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO tasks (
                    id, title, description, due_at, priority, status, done,
                    estimated_minutes, actual_minutes, recurrence_rule, recurrence_parent_id,
                    sort_order, subtasks_json, tags_json, source_type, source_external_id,
                    source_instance_id, created_at, updated_at
                    , project_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    project_id=excluded.project_id,
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
                    payload.get("project_id"),
                ),
            )
        created = self.get_task(identifier)
        if created is None:
            raise RuntimeError("Task creation failed")
        return created

    def get_task(self, task_identifier: str) -> Task | None:
        """Return a task by internal ID."""

        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL",
                (task_identifier,),
            ).fetchone()
            if row is None:
                return None
            task = _row_to_task(row)
            deps = _fetch_deps(conn, [task_identifier]).get(task_identifier, [])
            if deps:
                task.dependencies = [Task.model_validate(d) for d in deps]
            return task

    def get_task_by_source_id(self, source_external_id: str) -> Task | None:
        """Return a task by external provider ID."""

        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM tasks WHERE source_external_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1",
                (source_external_id,),
            ).fetchone()
            return _row_to_task(row) if row is not None else None

    def list_tasks(
        self,
        done: bool | None = None,
        status: str | None = None,
        no_date: bool = False,
        due_today: bool = False,
        search: str | None = None,
        project_id: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        sort_by: str = "default",
    ) -> list[Task]:
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
        with self.get_db_readonly() as conn:
            rows = conn.execute(sql, params).fetchall()
            task_ids = [row["id"] for row in rows]
            deps = _fetch_deps(conn, task_ids)
            tasks = []
            for row in rows:
                task = _row_to_task(row)
                task_deps = deps.get(row["id"], [])
                if task_deps:
                    task.dependencies = [
                        TaskDependency.model_validate(d) for d in task_deps
                    ]
                tasks.append(task)
            return tasks

    def update_task(
        self, task_identifier: str, payload: dict[str, Any]
    ) -> Task | None:
        """Patch task columns using the keys provided."""

        current = self.get_task(task_identifier)
        if current is None:
            return None
        merged = {
            **current.model_dump(),
            **{key: value for key, value in payload.items() if value is not None},
        }
        merged["updated_at"] = _iso_now()
        subtasks_val = merged.get("subtasks", [])
        tags_val = merged.get("tags", [])
        with self.tx() as conn:
            conn.execute(
                """
                UPDATE tasks
                SET title = ?, description = ?, due_at = ?, priority = ?, status = ?, done = ?,
                    estimated_minutes = ?, actual_minutes = ?, recurrence_rule = ?, recurrence_parent_id = ?,
                    sort_order = ?, subtasks_json = ?, tags_json = ?, source_type = ?, source_external_id = ?,
                    source_instance_id = ?, project_id = ?, updated_at = ?
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
                    json.dumps(
                        [
                            s.model_dump() if hasattr(s, "model_dump") else s
                            for s in subtasks_val
                        ]
                    ),
                    json.dumps(tags_val),
                    merged.get("source_type"),
                    merged.get("source_external_id"),
                    merged.get("source_instance_id"),
                    merged.get("project_id"),
                    merged["updated_at"],
                    task_identifier,
                ),
            )
        return self.get_task(task_identifier)

    def delete_task(self, task_identifier: str) -> bool:
        """Soft-delete a task."""

        with self.tx() as conn:
            result = conn.execute(
                "UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
                (_iso_now(), _iso_now(), task_identifier),
            )
            return result.rowcount > 0

    def uncomplete_task(self, task_identifier: str) -> Task | None:
        """Re-open a completed task."""

        return self.update_task(task_identifier, {"done": False, "status": "todo"})

    def complete_task(self, task_identifier: str) -> Task | None:
        """Mark a task complete and spawn the next recurring instance when applicable."""
        current = self.get_task(task_identifier)
        if current is None:
            return None

        task = self.update_task(
            task_identifier,
            {
                "done": True,
                "status": "done",
                "actual_minutes": current.actual_minutes,
            },
        )
        if task is None or not task.recurrence_rule:
            return task

        next_due = _next_due_from_rule(task.recurrence_rule, task.due_at)
        if not next_due:
            return task

        with self.get_db_readonly() as conn:
            if _recurring_instance_exists(conn, task.id, next_due):
                return task

        self.create_task(
            {
                "title": task.title,
                "description": task.description,
                "due_at": next_due,
                "priority": task.priority,
                "estimated_minutes": task.estimated_minutes,
                "tags": task.tags,
                "subtasks": [],
                "recurrence_rule": task.recurrence_rule,
                "recurrence_parent_id": task.id,
            },
        )
        return task

    def add_subtask(self, task_identifier: str, title: str) -> Task | None:
        """Append a subtask into the subtasks JSON array."""

        task = self.get_task(task_identifier)
        if task is None:
            return None
        subtasks = list(task.subtasks)
        subtasks.append(SubTask(id=task_id(), title=title, done=False))
        return self.update_task(task_identifier, {"subtasks": subtasks})

    def patch_subtask(
        self, task_identifier: str, subtask_id: str, done: bool
    ) -> Task | None:
        """Patch the done state for a subtask."""

        task = self.get_task(task_identifier)
        if task is None:
            return None
        subtasks = []
        for subtask in task.subtasks:
            if subtask.id == subtask_id:
                subtasks.append(SubTask(id=subtask.id, title=subtask.title, done=done))
            else:
                subtasks.append(subtask)
        return self.update_task(task_identifier, {"subtasks": subtasks})

    def delete_subtask(self, task_identifier: str, subtask_id: str) -> Task | None:
        """Remove a subtask from the JSON array."""

        task = self.get_task(task_identifier)
        if task is None:
            return None
        subtasks = [subtask for subtask in task.subtasks if subtask.id != subtask_id]
        return self.update_task(task_identifier, {"subtasks": subtasks})

    def add_dependency(self, task_identifier: str, dep_id: str) -> tuple[bool, str]:
        """Add a dependency unless it introduces a cycle."""

        with self.tx() as conn:
            if _has_path(conn, dep_id, task_identifier):
                return False, "Dependency would create a cycle"
            conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)",
                (task_identifier, dep_id),
            )
        return True, "ok"

    def remove_dependency(self, task_identifier: str, dep_id: str) -> None:
        """Remove a dependency edge."""

        with self.tx() as conn:
            conn.execute(
                "DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?",
                (task_identifier, dep_id),
            )

    def bulk_complete(self, ids: list[str]) -> int:
        """Complete multiple tasks and return the count updated."""

        count = 0
        for identifier in ids:
            if self.complete_task(identifier):
                count += 1
        return count

    def bulk_delete(self, ids: list[str]) -> int:
        """Soft-delete multiple tasks and return the count updated."""

        count = 0
        for identifier in ids:
            if self.delete_task(identifier):
                count += 1
        return count

    def start_time_log(self, task_identifier: str) -> TaskTimeLog:
        """Start a task time log entry."""

        log_identifier = task_id()
        started_at = _iso_now()
        with self.tx() as conn:
            conn.execute(
                "INSERT INTO task_time_log (id, task_id, started_at) VALUES (?, ?, ?)",
                (log_identifier, task_identifier, started_at),
            )
        return TaskTimeLog(
            id=log_identifier, task_id=task_identifier, started_at=started_at
        )

    def stop_time_log(self, task_identifier: str) -> TaskTimeLog | None:
        """Close the most recent open time log."""

        with self.tx() as conn:
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
            return TaskTimeLog(
                id=row["id"],
                task_id=task_identifier,
                ended_at=ended_at.isoformat(),
                duration_m=duration_m,
            )

    def list_time_logs(self, task_identifier: str) -> list[TaskTimeLog]:
        """Return time logs for a task."""

        with self.get_db_readonly() as conn:
            rows = conn.execute(
                "SELECT * FROM task_time_log WHERE task_id = ? ORDER BY started_at DESC",
                (task_identifier,),
            ).fetchall()
            return [
                TaskTimeLog(
                    id=row["id"],
                    task_id=row["task_id"],
                    started_at=row["started_at"],
                    ended_at=row["ended_at"],
                    duration_m=row["duration_m"],
                )
                for row in rows
            ]

    def materialize_recurring(self, window_hours: int = 36) -> CreatedCountResponse:
        """Create upcoming recurring instances inside the requested window."""

        created = 0
        created_by_rule: dict[str, int] = defaultdict(int)
        warned_rules: set[str] = set()
        window_end = datetime.now(timezone.utc) + timedelta(hours=window_hours)
        for task in self.list_tasks(done=True):
            rule = task.recurrence_rule
            if not rule:
                continue
            next_due = _next_due_from_rule(rule, task.due_at)
            if next_due and (_parse_dt(next_due) or window_end) <= window_end:
                if created_by_rule[rule] >= 500:
                    if rule not in warned_rules:
                        logger.warning(
                            "Recurring materialization hit 500-instance cap for rule %s; stopping further expansion this run",
                            rule,
                        )
                        warned_rules.add(rule)
                    continue
                with self.get_db_readonly() as conn:
                    if _recurring_instance_exists(conn, task.id, next_due):
                        continue
                    self.create_task(
                        {
                            "title": task.title,
                            "description": task.description,
                            "due_at": next_due,
                            "priority": task.priority,
                            "estimated_minutes": task.estimated_minutes,
                            "tags": task.tags,
                            "subtasks": [],
                            "recurrence_rule": rule,
                            "recurrence_parent_id": task.id,
                        },
                    )
                    created_by_rule[rule] += 1
                    created += 1
        return CreatedCountResponse(created=created)

    def list_templates(self) -> list[TaskTemplate]:
        """Return task templates."""

        with self.get_db_readonly() as conn:
            rows = conn.execute("SELECT * FROM task_templates ORDER BY name ASC").fetchall()
            return [
                TaskTemplate(
                    id=row["id"],
                    name=row["name"],
                    title=row["title"],
                    priority=row["priority"],
                    tags=json.loads(row["tags_json"] or "[]"),
                    estimated_minutes=row["estimated_minutes"],
                    recurrence_rule=row["recurrence_rule"],
                )
                for row in rows
            ]

    def create_template(self, payload: dict[str, Any]) -> TaskTemplate:
        """Create a task template row."""

        identifier = payload.get("id") or task_id()
        with self.tx() as conn:
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
        return TaskTemplate(
            id=identifier,
            name=payload["name"],
            title=payload["title"],
            priority=payload.get("priority", 3),
            tags=payload.get("tags", []),
            estimated_minutes=payload.get("estimated_minutes"),
            recurrence_rule=payload.get("recurrence_rule"),
        )

    def delete_template(self, template_id: str) -> bool:
        """Delete a task template."""

        with self.tx() as conn:
            result = conn.execute("DELETE FROM task_templates WHERE id = ?", (template_id,))
            return result.rowcount > 0

    def create_from_template(self, template_id: str) -> Task | None:
        """Instantiate a task from a saved template."""

        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM task_templates WHERE id = ?", (template_id,)
            ).fetchone()
            if row is None:
                return None
            return self.create_task(
                {
                    "title": row["title"],
                    "priority": row["priority"],
                    "tags": json.loads(row["tags_json"] or "[]"),
                    "estimated_minutes": row["estimated_minutes"],
                    "recurrence_rule": row["recurrence_rule"],
                },
            )

    def list_active_undone(self) -> list[dict[str, object]]:
        """Return active, not-done tasks as raw dicts for board views."""
        with self.get_db_readonly() as conn:
            rows = conn.execute(
                "SELECT * FROM tasks WHERE deleted_at IS NULL AND done = 0 ORDER BY updated_at DESC"
            ).fetchall()
        tasks: list[dict[str, object]] = []
        for row in rows:
            task = dict(row)
            task["done"] = bool(task.get("done"))
            task["dependencies"] = []
            task["tags"] = json.loads(task.get("tags_json") or "[]")
            task["subtasks"] = json.loads(task.get("subtasks_json") or "[]")
            tasks.append(task)
        return tasks

    def get_task_context(self, task_identifier: str) -> TaskContext:
        """Return lightweight cross-domain context for a task."""

        with self.get_db_readonly() as conn:
            task = conn.execute(
                "SELECT updated_at FROM tasks WHERE id = ?", (task_identifier,)
            ).fetchone()
            if task is None:
                return TaskContext(
                    last_touched_days_ago=None,
                    focus_sessions=0,
                    focus_minutes_total=0,
                    journal_connections=0,
                )
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
            return TaskContext(
                last_touched_days_ago=(datetime.now(timezone.utc) - updated_at).days,
                focus_sessions=int(focus["sessions"]),
                focus_minutes_total=int(focus["minutes"]),
                journal_connections=int(journal[0]),
            )
