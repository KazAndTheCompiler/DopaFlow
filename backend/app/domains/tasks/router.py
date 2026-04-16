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

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)

from app.core.config import Settings, get_settings_dependency
from app.domains.integrations.service import emit_event
from app.domains.tasks.repository import TaskRepository
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
from app.domains.tasks.service import complete_task as complete_task_service
from app.domains.tasks.service import import_tasks_csv
from app.middleware.auth_scopes import require_scope
from app.services.event_stream import publish_invalidation
from app.services.quick_add import parse
from app.services.upload_security import validate_upload

router = APIRouter(tags=["tasks"])


def _repo(settings: Settings = Depends(get_settings_dependency)) -> TaskRepository:
    return TaskRepository(settings)


async def _settings(settings: Settings = Depends(get_settings_dependency)) -> Settings:
    """Resolve the full settings object."""

    return settings


def _emit(settings: Settings, event_type: str, payload: dict[str, Any]) -> None:
    """Emit a task-domain outbox event."""

    emit_event(settings, event_type, payload)


@router.post(
    "/", response_model=Task, dependencies=[Depends(require_scope("write:tasks"))]
)
async def create_task(
    payload: TaskCreate,
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> Task:
    task = repo.create_task(payload.model_dump(mode="json"))
    _emit(settings, "task.created", {"id": task.id})
    await publish_invalidation("tasks")
    return task


@router.get(
    "/", response_model=list[Task], dependencies=[Depends(require_scope("read:tasks"))]
)
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
    sort_by: str = Query(
        default="default", pattern="^(default|due|priority|created|updated|title)$"
    ),
    repo: TaskRepository = Depends(_repo),
) -> list[Task]:
    tasks = repo.list_tasks(
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
    etag = hashlib.md5(
        json.dumps([t.model_dump() for t in tasks], sort_keys=True).encode(),
        usedforsecurity=False,
    ).hexdigest()
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "max-age=5"
    return tasks


@router.get(
    "/search",
    response_model=list[Task],
    dependencies=[Depends(require_scope("read:tasks"))]
)
async def search_tasks(
    q: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    priority: int | None = Query(default=None),
    done: bool | None = Query(default=None),
    due_before: str | None = Query(default=None),
    repo: TaskRepository = Depends(_repo),
) -> list[Task]:
    tasks = repo.list_tasks(done=done, search=q)
    if tag:
        tasks = [task for task in tasks if tag in task.tags]
    if priority is not None:
        tasks = [task for task in tasks if task.priority == priority]
    if due_before:
        tasks = [task for task in tasks if task.due_at and task.due_at <= due_before]
    return tasks


@router.get(
    "/tomorrow",
    response_model=list[Task],
    dependencies=[Depends(require_scope("read:tasks"))]
)
async def tomorrow_tasks(repo: TaskRepository = Depends(_repo)) -> list[Task]:
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date()
    tasks = repo.list_tasks()
    return [
        task
        for task in tasks
        if (
            task.due_at
            and datetime.fromisoformat(task.due_at).date() <= tomorrow
            and not task.done
        )
    ]


@router.get(
    "/templates",
    response_model=list[TaskTemplate],
    dependencies=[Depends(require_scope("read:tasks"))]
)
async def list_templates(repo: TaskRepository = Depends(_repo)) -> list[TaskTemplate]:
    return repo.list_templates()


@router.post(
    "/templates",
    response_model=TaskTemplate,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def create_template(
    payload: TaskTemplateCreate, repo: TaskRepository = Depends(_repo)
) -> TaskTemplate:
    return repo.create_template(payload.model_dump(mode="json"))


@router.delete(
    "/templates/{identifier}",
    response_model=DeleteResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def delete_template(
    identifier: str, repo: TaskRepository = Depends(_repo)
) -> dict[str, bool]:
    return {"deleted": repo.delete_template(identifier)}


@router.post(
    "/from-template/{identifier}",
    response_model=Task,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def create_from_template(
    identifier: str,
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> Task | None:
    task = repo.create_from_template(identifier)
    if task is None:
        raise HTTPException(status_code=404, detail="Template not found")
    _emit(
        settings,
        "task.created_from_template",
        {"id": task.id, "template_id": identifier},
    )
    await publish_invalidation("tasks")
    return task


@router.post(
    "/quick-add",
    response_model=Task | TaskQuickAddPreview,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def quick_add(
    request: Request,
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> dict[str, Any]:
    commit = False
    text = ""
    user_tz = "UTC"
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
        text = str(payload.get("text", ""))
        commit = bool(payload.get("commit", False))
        user_tz = str(payload.get("user_tz", "UTC"))
    else:
        form = await request.form()
        text = str(form.get("text", ""))
        commit = str(form.get("commit", "")).lower() in {"1", "true", "yes"}
        user_tz = str(form.get("user_tz", "UTC"))
    parsed = parse(text, user_tz=user_tz) if text else {}
    if "rrule" in parsed and "recurrence_rule" not in parsed:
        parsed["recurrence_rule"] = parsed.pop("rrule")
    if commit:
        task = repo.create_task(parsed)
        _emit(settings, "task.created", {"id": task.id})
        await publish_invalidation("tasks")
        return task
    return TaskQuickAddPreview(**parsed)


@router.post(
    "/materialize-recurring",
    response_model=CreatedCountResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def materialize_recurring(
    request: Request,
    window_hours: int = Query(default=36),
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> CreatedCountResponse:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.body()
        payload = {}
        if body.strip():
            try:
                payload = await request.json()
            except Exception:
                payload = {}
        raw_window_hours = payload.get("window_hours")
        if raw_window_hours is not None:
            try:
                window_hours = int(raw_window_hours)
            except (TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=422, detail="window_hours must be an integer"
                ) from exc
    result = repo.materialize_recurring(window_hours=window_hours)
    if result.created:
        _emit(settings, "task.recurring_materialized", {"count": result.created})
        await publish_invalidation("tasks")
    return result


@router.post(
    "/bulk/complete",
    response_model=UpdatedCountResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def bulk_complete(
    payload: dict[str, list[str]],
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> dict[str, int]:
    count = repo.bulk_complete(payload.get("ids", []))
    _emit(settings, "task.bulk_completed", {"count": count})
    if count:
        await publish_invalidation("tasks")
    return {"updated": count}


@router.post(
    "/bulk/delete",
    response_model=UpdatedCountResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def bulk_delete(
    payload: dict[str, list[str]],
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> dict[str, int]:
    count = repo.bulk_delete(payload.get("ids", []))
    _emit(settings, "task.bulk_deleted", {"count": count})
    if count:
        await publish_invalidation("tasks")
    return {"updated": count}


@router.get("/export/csv", dependencies=[Depends(require_scope("read:tasks"))])
async def export_csv(repo: TaskRepository = Depends(_repo)) -> Response:
    tasks = repo.list_tasks()
    output = csv.StringIO()
    fields = [
        "id",
        "title",
        "status",
        "priority",
        "due_at",
        "tags",
        "description",
        "estimated_minutes",
        "recurrence_rule",
        "created_at",
        "updated_at",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for task in tasks:
        d = task.model_dump()
        row = {k: d.get(k, "") for k in fields}
        row["tags"] = ",".join(d.get("tags") or [])
        writer.writerow(row)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=tasks-{today}.csv"},
    )


@router.post(
    "/import/csv",
    response_model=CreatedCountResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def import_csv(
    file: UploadFile = File(...),
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> dict[str, int]:
    data, _ = validate_upload(
        file,
        allowed_suffixes={".csv"},
        allowed_content_types={
            "text/csv",
            "application/csv",
            "application/vnd.ms-excel",
            "text/plain",
        },
        default_max_bytes=5 * 1024 * 1024,
    )
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="CSV must be UTF-8 encoded"
        ) from exc
    created = 0
    for payload in import_tasks_csv(content):
        repo.create_task(payload)
        created += 1
    _emit(settings, "task.csv_imported", {"count": created})
    if created:
        await publish_invalidation("tasks")
    return {"created": created}


@router.get(
    "/{identifier}",
    response_model=Task,
    dependencies=[Depends(require_scope("read:tasks"))]
)
async def get_task(identifier: str, repo: TaskRepository = Depends(_repo)) -> Task:
    task = repo.get_task(identifier)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch(
    "/{identifier}",
    response_model=Task,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def update_task(
    identifier: str,
    payload: TaskUpdate,
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> Task:
    previous = repo.get_task(identifier)
    if previous is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task = repo.update_task(identifier, payload.model_dump(mode="json", exclude_unset=True))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if not previous.done and task.done:
        from app.core.gamification_helpers import award

        award("task_complete", identifier)
    _emit(settings, "task.updated", {"id": identifier})
    await publish_invalidation("tasks")
    return task


@router.delete(
    "/{identifier}",
    response_model=DeleteResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def delete_task(
    identifier: str,
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> dict[str, bool]:
    deleted = repo.delete_task(identifier)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    _emit(settings, "task.deleted", {"id": identifier})
    await publish_invalidation("tasks")
    return {"deleted": True}


@router.patch(
    "/{identifier}/complete",
    response_model=Task,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def complete_task(
    identifier: str,
    repo: TaskRepository = Depends(_repo),
    settings: Settings = Depends(_settings),
) -> Task:
    task = complete_task_service(repo, identifier)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    _emit(settings, "task.completed", {"id": identifier})
    await publish_invalidation("tasks")
    return task


@router.get(
    "/{identifier}/context",
    response_model=TaskContext,
    dependencies=[Depends(require_scope("read:tasks"))]
)
async def get_task_context(
    identifier: str, repo: TaskRepository = Depends(_repo)
) -> TaskContext:
    return repo.get_task_context(identifier)


@router.post(
    "/{identifier}/deps/{dep_id}",
    response_model=OkResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def add_dependency(
    identifier: str,
    dep_id: str,
    repo: TaskRepository = Depends(_repo),
) -> dict[str, Any]:
    ok, detail = repo.add_dependency(identifier, dep_id)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)
    await publish_invalidation("tasks")
    return {"ok": True}


@router.delete(
    "/{identifier}/deps/{dep_id}",
    response_model=OkResponse,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def remove_dependency(
    identifier: str,
    dep_id: str,
    repo: TaskRepository = Depends(_repo),
) -> dict[str, bool]:
    repo.remove_dependency(identifier, dep_id)
    await publish_invalidation("tasks")
    return {"ok": True}


@router.post(
    "/{identifier}/subtasks",
    response_model=Task,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def add_subtask(
    identifier: str, payload: dict[str, str], repo: TaskRepository = Depends(_repo)
) -> Task:
    task = repo.add_subtask(identifier, payload["title"])
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    await publish_invalidation("tasks")
    return task


@router.patch(
    "/{identifier}/subtasks/{sub_id}",
    response_model=Task,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def patch_subtask(
    identifier: str,
    sub_id: str,
    payload: dict[str, bool],
    repo: TaskRepository = Depends(_repo),
) -> Task:
    task = repo.patch_subtask(identifier, sub_id, payload.get("done", False))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    await publish_invalidation("tasks")
    return task


@router.delete(
    "/{identifier}/subtasks/{sub_id}",
    response_model=Task,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def delete_subtask(
    identifier: str, sub_id: str, repo: TaskRepository = Depends(_repo)
) -> Task:
    task = repo.delete_subtask(identifier, sub_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    await publish_invalidation("tasks")
    return task


@router.post(
    "/{identifier}/time/start",
    response_model=TaskTimeLog,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def start_time(identifier: str, repo: TaskRepository = Depends(_repo)) -> TaskTimeLog:
    log = repo.start_time_log(identifier)
    await publish_invalidation("tasks")
    return log


@router.post(
    "/{identifier}/time/stop",
    response_model=TaskTimeLog,
    dependencies=[Depends(require_scope("write:tasks"))]
)
async def stop_time(identifier: str, repo: TaskRepository = Depends(_repo)) -> TaskTimeLog:
    log = repo.stop_time_log(identifier)
    if log is None:
        raise HTTPException(status_code=404, detail="No active time log")
    await publish_invalidation("tasks")
    return log


@router.get(
    "/{identifier}/time",
    response_model=list[TaskTimeLog],
    dependencies=[Depends(require_scope("read:tasks"))]
)
async def get_time_logs(
    identifier: str, repo: TaskRepository = Depends(_repo)
) -> list[TaskTimeLog]:
    return repo.list_time_logs(identifier)