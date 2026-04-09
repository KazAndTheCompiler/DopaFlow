# ENDPOINTS
#   POST   /
#   GET    /
#   GET    /search
#   GET    /tomorrow
#   GET    /templates
#   POST   /templates
#   DELETE /templates/{identifier}
#   POST   /from-template/{identifier}
#   POST   /quick-add
#   POST   /materialize-recurring
#   POST   /bulk/complete
#   POST   /bulk/delete
#   POST   /import/csv
#   GET    /export/csv
#   GET    /{identifier}
#   PATCH  /{identifier}
#   DELETE /{identifier}
#   PATCH  /{identifier}/complete
#   GET    /{identifier}/context
#   POST   /{identifier}/deps/{dep_id}
#   DELETE /{identifier}/deps/{dep_id}
#   POST   /{identifier}/subtasks
#   PATCH  /{identifier}/subtasks/{sub_id}
#   DELETE /{identifier}/subtasks/{sub_id}
#   POST   /{identifier}/time/start
#   POST   /{identifier}/time/stop
#   GET    /{identifier}/time

"""FastAPI router for the tasks domain."""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile

from app.core.config import Settings, get_settings_dependency
from app.domains.integrations.service import emit_event
from app.domains.tasks import repository
from app.domains.tasks.schemas import (
    CreatedCountResponse,
    DeleteResponse,
    OkResponse,
    Task,
    TaskContext,
    TaskCreate,
    TaskQuickAddPreview,
    TaskTemplate,
    TaskTemplateCreate,
    TaskTimeLog,
    TaskUpdate,
    UpdatedCountResponse,
)
from app.middleware.auth_scopes import require_scope
from app.services.upload_security import validate_upload
from app.services.quick_add import parse
from app.domains.tasks.service import complete_task as complete_task_service
from app.domains.tasks.service import import_tasks_csv

router = APIRouter(tags=["tasks"])


async def _db_path(settings: Settings = Depends(get_settings_dependency)) -> str:
    """Resolve the configured database path."""

    return settings.db_path


def _emit(db_path: str, event_type: str, payload: dict[str, Any]) -> None:
    """Emit a task-domain outbox event."""

    emit_event(db_path, event_type, payload)


@router.post("/", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))])
async def create_task(payload: TaskCreate, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    task = repository.create_task(db_path, payload.model_dump(mode="json"))
    _emit(db_path, "task.created", {"id": task["id"]})
    return task


@router.get("/", response_model=list[Task], dependencies=[Depends(require_scope("read:tasks"))])
async def list_tasks(
    response: Response,
    done: bool | None = Query(default=None),
    status: str | None = Query(default=None),
    no_date: bool = Query(default=False),
    due_today: bool = Query(default=False),
    search: str | None = Query(default=None),
    project_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=0, le=500),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="default", pattern="^(default|due|priority|created|updated|title)$"),
    db_path: str = Depends(_db_path),
) -> list[dict[str, Any]]:
    tasks = repository.list_tasks(
        db_path,
        done=done,
        status=status,
        no_date=no_date,
        due_today=due_today,
        search=search,
        project_id=project_id,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
    )
    etag = hashlib.md5(json.dumps(tasks, sort_keys=True).encode(), usedforsecurity=False).hexdigest()
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "max-age=5"
    return tasks


@router.get("/search", response_model=list[Task], dependencies=[Depends(require_scope("read:tasks"))])
async def search_tasks(
    q: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    priority: int | None = Query(default=None),
    done: bool | None = Query(default=None),
    due_before: str | None = Query(default=None),
    db_path: str = Depends(_db_path),
) -> list[dict[str, Any]]:
    tasks = repository.list_tasks(db_path, done=done, search=q)
    if tag:
        tasks = [task for task in tasks if tag in task.get("tags", [])]
    if priority is not None:
        tasks = [task for task in tasks if task.get("priority") == priority]
    if due_before:
        tasks = [task for task in tasks if task.get("due_at") and task["due_at"] <= due_before]
    return tasks


@router.get("/tomorrow", response_model=list[Task], dependencies=[Depends(require_scope("read:tasks"))])
async def tomorrow_tasks(db_path: str = Depends(_db_path)) -> list[dict[str, Any]]:
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date()
    tasks = repository.list_tasks(db_path)
    return [
        task
        for task in tasks
        if (task.get("due_at") and datetime.fromisoformat(task["due_at"]).date() <= tomorrow and not task.get("done"))
    ]


@router.get("/templates", response_model=list[TaskTemplate], dependencies=[Depends(require_scope("read:tasks"))])
async def list_templates(db_path: str = Depends(_db_path)) -> list[dict[str, Any]]:
    return repository.list_templates(db_path)


@router.post("/templates", response_model=TaskTemplate, dependencies=[Depends(require_scope("write:tasks"))])
async def create_template(payload: TaskTemplateCreate, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    return repository.create_template(db_path, payload.model_dump(mode="json"))


@router.delete("/templates/{identifier}", response_model=DeleteResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def delete_template(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, bool]:
    return {"deleted": repository.delete_template(db_path, identifier)}


@router.post("/from-template/{identifier}", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))])
async def create_from_template(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    task = repository.create_from_template(db_path, identifier)
    if task is None:
        raise HTTPException(status_code=404, detail="Template not found")
    _emit(db_path, "task.created_from_template", {"id": task["id"], "template_id": identifier})
    return task


@router.post("/quick-add", response_model=Task | TaskQuickAddPreview, dependencies=[Depends(require_scope("write:tasks"))])
async def quick_add(request: Request, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    commit = False
    text = ""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
        text = str(payload.get("text", ""))
        commit = bool(payload.get("commit", False))
    else:
        form = await request.form()
        text = str(form.get("text", ""))
        commit = str(form.get("commit", "")).lower() in {"1", "true", "yes"}
    parsed = parse(text) if text else {}
    if "rrule" in parsed and "recurrence_rule" not in parsed:
        parsed["recurrence_rule"] = parsed.pop("rrule")
    if commit:
        task = repository.create_task(db_path, parsed)
        _emit(db_path, "task.created", {"id": task["id"]})
        return task
    return parsed


@router.post("/materialize-recurring", response_model=CreatedCountResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def materialize_recurring(
    request: Request,
    window_hours: int = Query(default=36),
    db_path: str = Depends(_db_path),
) -> dict[str, int]:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
        raw_window_hours = payload.get("window_hours")
        if raw_window_hours is not None:
            try:
                window_hours = int(raw_window_hours)
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=422, detail="window_hours must be an integer") from exc
    return repository.materialize_recurring(db_path, window_hours=window_hours)


@router.post("/bulk/complete", response_model=UpdatedCountResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def bulk_complete(payload: dict[str, list[str]], db_path: str = Depends(_db_path)) -> dict[str, int]:
    count = repository.bulk_complete(db_path, payload.get("ids", []))
    _emit(db_path, "task.bulk_completed", {"count": count})
    return {"updated": count}


@router.post("/bulk/delete", response_model=UpdatedCountResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def bulk_delete(payload: dict[str, list[str]], db_path: str = Depends(_db_path)) -> dict[str, int]:
    count = repository.bulk_delete(db_path, payload.get("ids", []))
    _emit(db_path, "task.bulk_deleted", {"count": count})
    return {"updated": count}


@router.get("/export/csv", dependencies=[Depends(require_scope("read:tasks"))])
async def export_csv(db_path: str = Depends(_db_path)) -> Response:
    tasks = repository.list_tasks(db_path)
    output = csv.StringIO()
    fields = ["id", "title", "status", "priority", "due_at", "tags", "description", "estimated_minutes", "recurrence_rule", "created_at", "updated_at"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for task in tasks:
        row = {k: task.get(k, "") for k in fields}
        row["tags"] = ",".join(task.get("tags") or [])
        writer.writerow(row)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=tasks-{today}.csv"},
    )


@router.post("/import/csv", response_model=CreatedCountResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def import_csv(file: UploadFile = File(...), db_path: str = Depends(_db_path)) -> dict[str, int]:
    data, _ = validate_upload(
        file,
        allowed_suffixes={".csv"},
        allowed_content_types={"text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"},
        default_max_bytes=5 * 1024 * 1024,
    )
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc
    created = 0
    for payload in import_tasks_csv(content):
        repository.create_task(db_path, payload)
        created += 1
    _emit(db_path, "task.csv_imported", {"count": created})
    return {"created": created}


@router.get("/{identifier}", response_model=Task, dependencies=[Depends(require_scope("read:tasks"))])
async def get_task(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    task = repository.get_task(db_path, identifier)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{identifier}", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))])
async def update_task(identifier: str, payload: TaskUpdate, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    previous = repository.get_task(db_path, identifier)
    if previous is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task = repository.update_task(db_path, identifier, payload.model_dump(mode="json", exclude_unset=True))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if not previous.get("done") and task.get("done"):
        from app.domains.tasks.service import _award

        _award("task_complete", identifier)
    _emit(db_path, "task.updated", {"id": identifier})
    return task


@router.delete("/{identifier}", response_model=DeleteResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def delete_task(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, bool]:
    deleted = repository.delete_task(db_path, identifier)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    _emit(db_path, "task.deleted", {"id": identifier})
    return {"deleted": True}


@router.patch("/{identifier}/complete", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))])
async def complete_task(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    task = complete_task_service(db_path, identifier)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    _emit(db_path, "task.completed", {"id": identifier})
    return task


@router.get("/{identifier}/context", response_model=TaskContext, dependencies=[Depends(require_scope("read:tasks"))])
async def get_task_context(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    return repository.get_task_context(db_path, identifier)


@router.post("/{identifier}/deps/{dep_id}", response_model=OkResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def add_dependency(identifier: str, dep_id: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    ok, detail = repository.add_dependency(db_path, identifier, dep_id)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)
    return {"ok": True}


@router.delete("/{identifier}/deps/{dep_id}", response_model=OkResponse, dependencies=[Depends(require_scope("write:tasks"))])
async def remove_dependency(identifier: str, dep_id: str, db_path: str = Depends(_db_path)) -> dict[str, bool]:
    repository.remove_dependency(db_path, identifier, dep_id)
    return {"ok": True}


@router.post("/{identifier}/subtasks", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))])
async def add_subtask(identifier: str, payload: dict[str, str], db_path: str = Depends(_db_path)) -> dict[str, Any]:
    task = repository.add_subtask(db_path, identifier, payload["title"])
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{identifier}/subtasks/{sub_id}", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))])
async def patch_subtask(identifier: str, sub_id: str, payload: dict[str, bool], db_path: str = Depends(_db_path)) -> dict[str, Any]:
    task = repository.patch_subtask(db_path, identifier, sub_id, payload.get("done", False))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{identifier}/subtasks/{sub_id}", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))])
async def delete_subtask(identifier: str, sub_id: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    task = repository.delete_subtask(db_path, identifier, sub_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{identifier}/time/start", response_model=TaskTimeLog, dependencies=[Depends(require_scope("write:tasks"))])
async def start_time(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    return repository.start_time_log(db_path, identifier)


@router.post("/{identifier}/time/stop", response_model=TaskTimeLog, dependencies=[Depends(require_scope("write:tasks"))])
async def stop_time(identifier: str, db_path: str = Depends(_db_path)) -> dict[str, Any]:
    log = repository.stop_time_log(db_path, identifier)
    if log is None:
        raise HTTPException(status_code=404, detail="No active time log")
    return log


@router.get("/{identifier}/time", response_model=list[TaskTimeLog], dependencies=[Depends(require_scope("read:tasks"))])
async def get_time_logs(identifier: str, db_path: str = Depends(_db_path)) -> list[dict[str, Any]]:
    return repository.list_time_logs(db_path, identifier)
