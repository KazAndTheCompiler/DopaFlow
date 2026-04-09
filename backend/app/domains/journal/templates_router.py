# ENDPOINTS
#   GET    /journal/templates
#   POST   /journal/templates
#   GET    /journal/templates/{identifier}
#   DELETE /journal/templates/{identifier}
#   POST   /journal/templates/{identifier}/apply

"""Direct SQLite CRUD for journal templates."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.config import Settings, get_settings_dependency
from app.core.db_utils import get_conn
from app.domains.journal.schemas import JournalTemplateApplyResponse
from app.domains.journal.template_schemas import JournalTemplateCreate, JournalTemplateRead

router = APIRouter(tags=["journal"])


@router.get("/journal/templates", response_model=list[JournalTemplateRead])
async def list_templates(settings: Settings = Depends(get_settings_dependency)) -> list[JournalTemplateRead]:
    conn = get_conn(settings.db_path)
    rows = conn.execute("SELECT * FROM journal_templates ORDER BY created_at ASC").fetchall()
    conn.close()
    return [JournalTemplateRead(id=row["id"], name=row["name"], body=row["body"], tags=json.loads(row["tags"] or "[]"), created_at=row["created_at"]) for row in rows]


@router.post("/journal/templates", response_model=JournalTemplateRead)
async def create_template(payload: JournalTemplateCreate, settings: Settings = Depends(get_settings_dependency)) -> JournalTemplateRead:
    identifier = f"tpl_{uuid.uuid4().hex[:16]}"
    created_at = datetime.now(timezone.utc).isoformat()
    conn = get_conn(settings.db_path)
    conn.execute("INSERT INTO journal_templates (id, name, body, tags, created_at) VALUES (?, ?, ?, ?, ?)", (identifier, payload.name, payload.body, json.dumps(payload.tags), created_at))
    conn.commit()
    conn.close()
    return JournalTemplateRead(id=identifier, name=payload.name, body=payload.body, tags=payload.tags, created_at=created_at)


@router.get("/journal/templates/{identifier}", response_model=JournalTemplateRead)
async def get_template(identifier: str, settings: Settings = Depends(get_settings_dependency)) -> JournalTemplateRead:
    conn = get_conn(settings.db_path)
    row = conn.execute("SELECT * FROM journal_templates WHERE id = ?", (identifier,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Journal template not found")
    return JournalTemplateRead(id=row["id"], name=row["name"], body=row["body"], tags=json.loads(row["tags"] or "[]"), created_at=row["created_at"])


@router.delete("/journal/templates/{identifier}", status_code=204)
async def delete_template(identifier: str, settings: Settings = Depends(get_settings_dependency)) -> Response:
    conn = get_conn(settings.db_path)
    result = conn.execute("DELETE FROM journal_templates WHERE id = ?", (identifier,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Journal template not found")
    return Response(status_code=204)


@router.post("/journal/templates/{identifier}/apply", response_model=JournalTemplateApplyResponse)
async def apply_template(identifier: str, settings: Settings = Depends(get_settings_dependency)) -> JournalTemplateApplyResponse:
    conn = get_conn(settings.db_path)
    row = conn.execute("SELECT body, tags FROM journal_templates WHERE id = ?", (identifier,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Journal template not found")
    return JournalTemplateApplyResponse(body=row["body"], tags=json.loads(row["tags"] or "[]"))
