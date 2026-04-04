"""API router for the journal domain — full feature parity with v1.2.7."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse, Response

from app.core.config import Settings, get_settings_dependency
from app.domains.journal.repository import JournalRepository
from app.domains.journal.schemas import (
    JournalBackupStatus,
    JournalBackupTriggerResponse,
    JournalDeleteResponse,
    JournalEntryCreate,
    JournalEntryPatch,
    JournalEntryRead,
    JournalPromptResponse,
    JournalSearchResult,
    JournalTemplate,
    JournalTemplateCreate,
    JournalTemplatePatch,
    JournalToCardIn,
    JournalVersionDetail,
    JournalVersionSummary,
)
from app.domains.journal.service import JournalService
from app.middleware.auth_scopes import require_scope
from app.services.speech_to_text import transcribe_upload

router = APIRouter(prefix="/journal", tags=["journal"])


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> JournalService:
    return JournalService(JournalRepository(settings.db_path))


async def _db_path(settings: Settings = Depends(get_settings_dependency)) -> str:
    return settings.db_path


# ── entries ───────────────────────────────────────────────────────────────────

@router.get("/entries", response_model=list[JournalEntryRead], dependencies=[Depends(require_scope("read:journal"))])
async def list_entries(
    tag: str | None = Query(default=None),
    search: str | None = Query(default=None),
    svc: JournalService = Depends(_svc),
) -> list[JournalEntryRead]:
    return svc.list_entries(tag=tag, search=search)


@router.post("/entries", response_model=JournalEntryRead, status_code=201, dependencies=[Depends(require_scope("write:journal"))])
async def save_entry(payload: JournalEntryCreate, svc: JournalService = Depends(_svc)) -> JournalEntryRead:
    return svc.save_entry(payload)


@router.patch("/entries/{entry_id}", response_model=JournalEntryRead, dependencies=[Depends(require_scope("write:journal"))])
async def patch_entry(entry_id: str, payload: JournalEntryPatch, svc: JournalService = Depends(_svc)) -> JournalEntryRead:
    try:
        entry = svc.patch_entry(entry_id, payload)
    except ValueError as exc:
        if str(exc) == "locked":
            raise HTTPException(status_code=423, detail="Journal entry is locked")
        raise
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.get("/entries/{identifier}", response_model=JournalEntryRead, dependencies=[Depends(require_scope("read:journal"))])
async def get_entry(identifier: str, svc: JournalService = Depends(_svc)) -> JournalEntryRead:
    entry = svc.get_entry(identifier)
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.delete("/entries/{identifier}", response_model=JournalDeleteResponse, dependencies=[Depends(require_scope("write:journal"))])
async def delete_entry(identifier: str, svc: JournalService = Depends(_svc)) -> JournalDeleteResponse:
    return svc.delete_entry(identifier)


@router.patch("/entries/{entry_id}/lock", response_model=JournalEntryRead, dependencies=[Depends(require_scope("write:journal"))])
async def lock_entry(entry_id: str, svc: JournalService = Depends(_svc)) -> JournalEntryRead:
    entry = svc.lock_entry(entry_id, locked=True)
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.patch("/entries/{entry_id}/unlock", response_model=JournalEntryRead, dependencies=[Depends(require_scope("write:journal"))])
async def unlock_entry(entry_id: str, svc: JournalService = Depends(_svc)) -> JournalEntryRead:
    entry = svc.lock_entry(entry_id, locked=False)
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


# ── versions ──────────────────────────────────────────────────────────────────

@router.get("/entries/{identifier}/versions", response_model=list[JournalVersionSummary], dependencies=[Depends(require_scope("read:journal"))])
async def list_versions(identifier: str, svc: JournalService = Depends(_svc)) -> list[JournalVersionSummary]:
    return svc.list_versions(identifier)


@router.get("/entries/{identifier}/versions/{version_number}", response_model=JournalVersionDetail, dependencies=[Depends(require_scope("read:journal"))])
async def get_version(identifier: str, version_number: int, svc: JournalService = Depends(_svc)) -> JournalVersionDetail:
    version = svc.get_version(identifier, version_number)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


# ── analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/summary", dependencies=[Depends(require_scope("read:journal"))])
async def analytics_summary(days: int = Query(default=90, ge=7, le=3650), svc: JournalService = Depends(_svc)) -> dict:
    return svc.get_analytics_summary(days)


@router.get("/analytics/heatmap", dependencies=[Depends(require_scope("read:journal"))])
async def analytics_heatmap(year: int = Query(default=0), svc: JournalService = Depends(_svc)) -> dict:
    from datetime import date as _date
    y = year if year > 0 else _date.today().year
    return svc.get_heatmap(y)


@router.get("/auto-tags/stats", dependencies=[Depends(require_scope("read:journal"))])
async def auto_tag_stats(svc: JournalService = Depends(_svc)) -> dict:
    return svc.get_auto_tag_stats()


# ── search ────────────────────────────────────────────────────────────────────

@router.get("/search", response_model=list[JournalSearchResult], dependencies=[Depends(require_scope("read:journal"))])
async def search_journal(
    q: str = Query(default=""),
    mood: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    svc: JournalService = Depends(_svc),
) -> list[JournalSearchResult]:
    return svc.search_rich(q=q, mood=mood, limit=limit)


# ── prompts ───────────────────────────────────────────────────────────────────

@router.get("/prompt/{for_date}", response_model=JournalPromptResponse, dependencies=[Depends(require_scope("read:journal"))])
async def get_prompt(for_date: str, svc: JournalService = Depends(_svc)) -> JournalPromptResponse:
    return svc.get_prompt(for_date)


# ── export ────────────────────────────────────────────────────────────────────

@router.get("/export/range", dependencies=[Depends(require_scope("read:journal"))])
async def export_range(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    fmt: str = Query(default="markdown", pattern="^(markdown|json|zip)$"),
    svc: JournalService = Depends(_svc),
):
    result = svc.export_range(from_date, to_date, fmt)
    if fmt == "zip":
        return Response(content=result, media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="journal-export.zip"'})
    if fmt == "json":
        return result
    return PlainTextResponse(str(result), media_type="text/markdown; charset=utf-8")


@router.get("/export/zip", dependencies=[Depends(require_scope("read:journal"))])
async def export_zip(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    svc: JournalService = Depends(_svc),
):
    content = svc.export_zip(from_date, to_date)
    return Response(content=content, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="journal-{from_date}-to-{to_date}.zip"'})


# ── to-card ───────────────────────────────────────────────────────────────────

@router.post("/to-card", dependencies=[Depends(require_scope("write:journal"))])
async def journal_to_card(payload: JournalToCardIn, db_path: str = Depends(_db_path)) -> dict:
    if not payload.front.strip() or not payload.back.strip():
        raise HTTPException(status_code=422, detail="Front and back are required")
    from app.domains.review.repository import ReviewRepository
    repo = ReviewRepository(db_path)
    card = repo.create_card(deck_id=payload.deck_id, front=payload.front, back=payload.back, tags=[], source="journal")
    return card.model_dump() if hasattr(card, "model_dump") else dict(card)


# ── transcribe ────────────────────────────────────────────────────────────────

@router.post("/transcribe", dependencies=[Depends(require_scope("write:journal"))])
async def transcribe_audio(file: UploadFile = File(...), lang: str = Query(default="en-US")) -> dict:
    result = transcribe_upload(file, lang=lang)
    return {"transcript": result.transcript}


# ── graph / backlinks ─────────────────────────────────────────────────────────

@router.get("/graph", response_model=dict[str, list[dict[str, object]]], dependencies=[Depends(require_scope("read:journal"))])
async def graph_data(svc: JournalService = Depends(_svc)) -> dict[str, list[dict[str, object]]]:
    return svc.get_graph_data()


@router.get("/{identifier}/backlinks", response_model=list[str], dependencies=[Depends(require_scope("read:journal"))])
async def backlinks(identifier: str, svc: JournalService = Depends(_svc)) -> list[str]:
    return svc.get_backlinks(identifier)


# ── backup ────────────────────────────────────────────────────────────────────

@router.get("/backup-status", response_model=JournalBackupStatus, dependencies=[Depends(require_scope("read:journal"))])
async def backup_status(svc: JournalService = Depends(_svc)) -> JournalBackupStatus:
    return svc.get_backup_status()


@router.post("/backup/trigger", response_model=JournalBackupTriggerResponse, dependencies=[Depends(require_scope("write:journal"))])
async def trigger_backup(date: str | None = Query(default=None), svc: JournalService = Depends(_svc)) -> JournalBackupTriggerResponse:
    return svc.trigger_backup(date=date)


@router.post("/export-today", dependencies=[Depends(require_scope("write:journal"))])
async def export_today(svc: JournalService = Depends(_svc)) -> dict:
    return svc.export_today()


# ── templates ─────────────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[JournalTemplate], dependencies=[Depends(require_scope("read:journal"))])
async def list_templates(svc: JournalService = Depends(_svc)) -> list[JournalTemplate]:
    return svc.list_templates()


@router.post("/templates", response_model=JournalTemplate, status_code=201, dependencies=[Depends(require_scope("write:journal"))])
async def create_template(payload: JournalTemplateCreate, svc: JournalService = Depends(_svc)) -> JournalTemplate:
    return svc.create_template(payload)


@router.get("/templates/{template_id}", response_model=JournalTemplate, dependencies=[Depends(require_scope("read:journal"))])
async def get_template(template_id: str, svc: JournalService = Depends(_svc)) -> JournalTemplate:
    tpl = svc.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.patch("/templates/{template_id}", response_model=JournalTemplate, dependencies=[Depends(require_scope("write:journal"))])
async def update_template(template_id: str, payload: JournalTemplatePatch, svc: JournalService = Depends(_svc)) -> JournalTemplate:
    tpl = svc.update_template(template_id, payload)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.delete("/templates/{template_id}", dependencies=[Depends(require_scope("write:journal"))])
async def delete_template(template_id: str, svc: JournalService = Depends(_svc)) -> dict:
    deleted = svc.delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True, "id": template_id}


@router.post("/templates/{template_id}/apply", response_model=dict[str, object], dependencies=[Depends(require_scope("write:journal"))])
async def apply_template(template_id: str, svc: JournalService = Depends(_svc)) -> dict[str, object]:
    tpl = svc.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"body": tpl.body, "tags": tpl.tags}
