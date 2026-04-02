# ENDPOINTS
#   GET    /review/cards
#   GET    /review/decks
#   GET    /review/due
#   POST   /review/decks
#   POST   /review/decks/{deck_id}/cards
#   POST   /review/cards
#   POST   /review/rate
#   GET    /review/session
#   POST   /review/session/start
#   POST   /review/session/{deck_id}/start
#   POST   /review/answer
#   POST   /review/session/{deck_id}/answer
#   POST   /review/session/{deck_id}/end
#   GET    /review/history
#   GET    /review/export/apkg/{deck_id}
#   GET    /review/export-preview
#   POST   /review/import
#   POST   /review/import-apkg
#   GET    /review/decks/{deck_id}/cards/search
#   POST   /review/decks/{deck_id}/cards/bulk
#   GET    /review/decks/{deck_id}/next-due
#   GET    /review/decks/{deck_id}/stats
#   POST   /review/cards/{card_id}/suspend
#   POST   /review/cards/{card_id}/unsuspend
#   POST   /review/cards/{card_id}/bury-today
#   POST   /review/cards/{card_id}/reset
#   POST   /review/decks/{deck_id}/import/preview

"""API router for the review domain."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Response, UploadFile

from app.core.config import Settings, get_settings_dependency
from app.domains.review.apkg_export import create_apkg
from app.domains.review.repository import ReviewRepository
from app.domains.review.schemas import DeckCreate, ReviewCardCreate, ReviewCardRead, ReviewRating
from app.domains.review.schemas_extra import (
    BulkCardsBody,
    CardBuryResponse,
    CardSuspendResponse,
    DeckCardCreate,
    DeckStatsResponse,
    ImportBody,
)
from app.domains.review.service import ReviewService
from app.middleware.auth_scopes import require_scope
from app.services.upload_security import validate_upload

router = APIRouter(prefix="/review", tags=["review"])
logger = logging.getLogger(__name__)


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> ReviewService:
    return ReviewService(ReviewRepository(settings.db_path))


# ── cards ─────────────────────────────────────────────────────────────────────

@router.get("/cards", response_model=list[ReviewCardRead], dependencies=[Depends(require_scope("read:review"))])
async def list_cards(svc: ReviewService = Depends(_svc)) -> list[ReviewCardRead]:
    return svc.list_cards()


@router.post("/cards", response_model=ReviewCardRead, dependencies=[Depends(require_scope("write:review"))])
async def create_card(payload: ReviewCardCreate, svc: ReviewService = Depends(_svc)) -> ReviewCardRead:
    return svc.create_card(payload)


@router.post("/cards/{card_id}/suspend", response_model=CardSuspendResponse, dependencies=[Depends(require_scope("write:review"))])
async def suspend_card(card_id: str, svc: ReviewService = Depends(_svc)) -> CardSuspendResponse:
    try:
        return svc.suspend_card(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post("/cards/{card_id}/unsuspend", response_model=CardSuspendResponse, dependencies=[Depends(require_scope("write:review"))])
async def unsuspend_card(card_id: str, svc: ReviewService = Depends(_svc)) -> CardSuspendResponse:
    try:
        return svc.unsuspend_card(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post("/cards/{card_id}/bury-today", response_model=CardBuryResponse, dependencies=[Depends(require_scope("write:review"))])
async def bury_card_today(card_id: str, svc: ReviewService = Depends(_svc)) -> CardBuryResponse:
    try:
        return svc.bury_card_today(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post("/cards/{card_id}/reset", response_model=ReviewCardRead, dependencies=[Depends(require_scope("write:review"))])
async def reset_card(card_id: str, svc: ReviewService = Depends(_svc)) -> ReviewCardRead:
    try:
        return svc.reset_card(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


# ── decks ─────────────────────────────────────────────────────────────────────

@router.get("/decks", response_model=list[dict[str, object]], dependencies=[Depends(require_scope("read:review"))])
async def list_decks(svc: ReviewService = Depends(_svc)) -> list[dict[str, object]]:
    return svc.list_decks()


@router.post("/decks", response_model=dict[str, object], dependencies=[Depends(require_scope("write:review"))])
async def create_deck(payload: DeckCreate, svc: ReviewService = Depends(_svc)) -> dict[str, object]:
    return svc.create_deck(payload)


@router.patch("/decks/{deck_id}", response_model=dict[str, object], dependencies=[Depends(require_scope("write:review"))])
async def rename_deck(deck_id: str, payload: dict[str, str], svc: ReviewService = Depends(_svc)) -> dict[str, object]:
    deck = svc.rename_deck(deck_id, payload.get("name", "").strip())
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.delete("/decks/{deck_id}", response_model=dict[str, object], dependencies=[Depends(require_scope("write:review"))])
async def delete_deck(deck_id: str, svc: ReviewService = Depends(_svc)) -> dict[str, bool]:
    deleted = svc.delete_deck(deck_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Deck not found")
    return {"deleted": True}


@router.post("/decks/{deck_id}/cards", response_model=ReviewCardRead, dependencies=[Depends(require_scope("write:review"))])
async def create_card_for_deck(deck_id: str, payload: DeckCardCreate, svc: ReviewService = Depends(_svc)) -> ReviewCardRead:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.create_card_for_deck(deck_id, payload.front, payload.back, payload.tags, payload.source)


@router.get("/decks/{deck_id}/cards/search", dependencies=[Depends(require_scope("read:review"))])
async def search_cards(
    deck_id: str,
    q: str = Query(default=""),
    state: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=50),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    valid_states = {None, "", "new", "review", "learning", "relearn", "suspended", "buried"}
    if state not in valid_states:
        raise HTTPException(status_code=422, detail="state must be one of: new, review, learning, relearn, suspended, buried")
    items = svc.search_cards(deck_id, q=q, state=state or None, limit=limit)
    return {"items": [i.model_dump() for i in items], "limit": limit}


@router.post("/decks/{deck_id}/cards/bulk", dependencies=[Depends(require_scope("write:review"))])
async def bulk_cards(deck_id: str, body: BulkCardsBody, svc: ReviewService = Depends(_svc)) -> dict[str, int]:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    try:
        return svc.bulk_cards(deck_id, body.ids, body.action)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/decks/{deck_id}/next-due", dependencies=[Depends(require_scope("read:review"))])
async def next_due(deck_id: str, svc: ReviewService = Depends(_svc)) -> dict[str, object]:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.get_next_due(deck_id)


@router.get("/decks/{deck_id}/stats", response_model=DeckStatsResponse, dependencies=[Depends(require_scope("read:review"))])
async def deck_stats(deck_id: str, svc: ReviewService = Depends(_svc)) -> DeckStatsResponse:
    try:
        return svc.get_deck_stats(deck_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Deck not found")


@router.post("/decks/{deck_id}/import/preview", dependencies=[Depends(require_scope("write:review"))])
async def import_preview(
    deck_id: str,
    body: ImportBody,
    fmt: str = Query(default="csv"),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    if fmt not in ("csv", "tsv"):
        raise HTTPException(status_code=422, detail="fmt must be csv or tsv")
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.preview_import(deck_id, body.content, fmt)


# ── due ───────────────────────────────────────────────────────────────────────

@router.get("/due", response_model=list[ReviewCardRead], dependencies=[Depends(require_scope("read:review"))])
async def due_cards(
    deck_id: str = Query(...),
    limit: int = Query(default=20, ge=1, le=200),
    svc: ReviewService = Depends(_svc),
) -> list[ReviewCardRead]:
    return svc.get_due_cards(deck_id, limit)


# ── rate ──────────────────────────────────────────────────────────────────────

@router.post("/rate", response_model=ReviewCardRead, dependencies=[Depends(require_scope("write:review"))])
async def rate_card(payload: ReviewRating, svc: ReviewService = Depends(_svc)) -> ReviewCardRead:
    try:
        return svc.rate_card(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ── session ───────────────────────────────────────────────────────────────────

@router.get("/session", dependencies=[Depends(require_scope("read:review"))])
async def session_state(
    limit: int = Query(default=20, ge=1, le=200),
    deck_id: str | None = Query(default=None),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    return svc.get_session_state(limit=limit, deck_id=deck_id)


@router.post("/session/start", dependencies=[Depends(require_scope("write:review"))])
async def start_session(
    limit: int = Query(default=20, ge=1, le=200),
    deck_id: str | None = Query(default=None),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    return svc.start_session(limit=limit, deck_id=deck_id)


@router.post("/session/{deck_id}/start", dependencies=[Depends(require_scope("write:review"))])
async def start_deck_session(
    deck_id: str,
    limit: int = Query(default=20, ge=1, le=200),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    if not svc.get_deck(deck_id):
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.start_deck_session(deck_id, limit=limit)


@router.post("/answer", dependencies=[Depends(require_scope("write:review"))])
async def answer(
    rating: str = Query(...),
    card_id: str = Query(...),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    try:
        return svc.answer_card(card_id, rating)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/session/{deck_id}/answer", dependencies=[Depends(require_scope("write:review"))])
async def answer_for_deck(
    deck_id: str,
    rating: str = Query(...),
    card_id: str = Query(...),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    try:
        return svc.answer_card_for_deck(deck_id, card_id, rating)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/session/{deck_id}/end", dependencies=[Depends(require_scope("write:review"))])
async def end_session(deck_id: str, svc: ReviewService = Depends(_svc)) -> dict[str, object]:
    return svc.end_session(deck_id)


# ── history ───────────────────────────────────────────────────────────────────

@router.get("/history", dependencies=[Depends(require_scope("read:review"))])
async def review_history(
    limit: int = Query(default=20, ge=1, le=100),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    return svc.get_history(limit)


# ── export ────────────────────────────────────────────────────────────────────

@router.get("/export-preview", dependencies=[Depends(require_scope("read:review"))])
async def export_preview(
    deck_id: str = Query(...),
    limit: int = Query(default=50, ge=1, le=200),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.export_preview(deck_id, limit)


@router.get("/export/apkg/{deck_id}", dependencies=[Depends(require_scope("read:review"))])
async def export_apkg(deck_id: str, svc: ReviewService = Depends(_svc)) -> Response:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    filename, apkg_bytes = create_apkg(deck, svc.get_all_cards_for_export(deck_id))
    return Response(
        content=apkg_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── import ────────────────────────────────────────────────────────────────────

@router.post("/import", dependencies=[Depends(require_scope("write:review"))])
async def import_notes(
    deck_id: str = Query(...),
    fmt: str = Query(default="csv"),
    body: ImportBody | None = Body(default=None),
    content: str | None = Query(default=None),
    svc: ReviewService = Depends(_svc),
) -> dict[str, int]:
    if fmt not in ("csv", "tsv"):
        raise HTTPException(status_code=422, detail="fmt must be csv or tsv")
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    source_text = body.content if body is not None else (content or "")
    return svc.import_notes(deck_id, source_text, fmt)


@router.post("/import-apkg", dependencies=[Depends(require_scope("write:review"))])
async def import_apkg(
    deck_id: str = Query(...),
    file: UploadFile = File(...),
    svc: ReviewService = Depends(_svc),
) -> dict[str, object]:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    data, _ = validate_upload(file, kind="apkg", allowed_suffixes={".apkg"}, default_max_bytes=25 * 1024 * 1024)
    try:
        return svc.import_apkg(deck_id, data, file.filename or "deck.apkg")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("APKG import failed")
        raise HTTPException(status_code=422, detail=f"Import failed: {exc}")
