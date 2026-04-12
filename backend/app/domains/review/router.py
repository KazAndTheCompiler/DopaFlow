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

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
)

from app.core.config import Settings, get_settings_dependency
from app.domains.review.apkg_export import create_apkg
from app.domains.review.repository import ReviewRepository
from app.domains.review.schemas import (
    DeckCreate,
    DeckRead,
    DeckRenameRequest,
    DeleteResponse,
    NextDueResponse,
    ReviewApkgImportResult,
    ReviewAnswerResponse,
    ReviewBulkCardsResponse,
    ReviewCardCreate,
    ReviewCardRead,
    ReviewExportPreviewResponse,
    ReviewHistoryResponse,
    ReviewImportPreview,
    ReviewImportResult,
    ReviewRating,
    ReviewSessionEndResponse,
    ReviewSessionStart,
    ReviewSessionState,
)
from app.domains.review.schemas_extra import (
    BulkCardsBody,
    CardBuryResponse,
    CardSuspendResponse,
    DeckCardCreate,
    DeckStatsResponse,
    ImportBody,
    ReviewSearchResponse,
)
from app.domains.review.service import ReviewService
from app.middleware.auth_scopes import require_scope
from app.services.upload_security import validate_upload

router = APIRouter(prefix="/review", tags=["review"])
logger = logging.getLogger(__name__)


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> ReviewService:
    return ReviewService(ReviewRepository(settings.db_path))


# ── cards ─────────────────────────────────────────────────────────────────────


@router.get(
    "/cards",
    response_model=list[ReviewCardRead],
    dependencies=[Depends(require_scope("read:review"))],
)
async def list_cards(svc: ReviewService = Depends(_svc)) -> list[ReviewCardRead]:
    return svc.list_cards()


@router.post(
    "/cards",
    response_model=ReviewCardRead,
    dependencies=[Depends(require_scope("write:review"))],
)
async def create_card(
    payload: ReviewCardCreate, svc: ReviewService = Depends(_svc)
) -> ReviewCardRead:
    return svc.create_card(payload)


@router.patch(
    "/cards/{card_id}",
    response_model=ReviewCardRead,
    dependencies=[Depends(require_scope("write:review"))],
)
async def update_card(
    card_id: str, payload: dict[str, str], svc: ReviewService = Depends(_svc)
) -> ReviewCardRead:
    front = payload.get("front", "").strip()
    back = payload.get("back", "").strip()
    if not front:
        raise HTTPException(status_code=422, detail="front is required")
    try:
        return svc.update_card(card_id, front, back)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post(
    "/cards/{card_id}/suspend",
    response_model=CardSuspendResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def suspend_card(
    card_id: str, svc: ReviewService = Depends(_svc)
) -> CardSuspendResponse:
    try:
        return svc.suspend_card(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post(
    "/cards/{card_id}/unsuspend",
    response_model=CardSuspendResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def unsuspend_card(
    card_id: str, svc: ReviewService = Depends(_svc)
) -> CardSuspendResponse:
    try:
        return svc.unsuspend_card(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post(
    "/cards/{card_id}/bury-today",
    response_model=CardBuryResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def bury_card_today(
    card_id: str, svc: ReviewService = Depends(_svc)
) -> CardBuryResponse:
    try:
        return svc.bury_card_today(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post(
    "/cards/{card_id}/reset",
    response_model=ReviewCardRead,
    dependencies=[Depends(require_scope("write:review"))],
)
async def reset_card(
    card_id: str, svc: ReviewService = Depends(_svc)
) -> ReviewCardRead:
    try:
        return svc.reset_card(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")


# ── decks ─────────────────────────────────────────────────────────────────────


@router.get(
    "/decks",
    response_model=list[DeckRead],
    dependencies=[Depends(require_scope("read:review"))],
)
async def list_decks(svc: ReviewService = Depends(_svc)) -> list[DeckRead]:
    return svc.list_decks()


@router.post(
    "/decks",
    response_model=DeckRead,
    dependencies=[Depends(require_scope("write:review"))],
)
async def create_deck(
    payload: DeckCreate, svc: ReviewService = Depends(_svc)
) -> DeckRead:
    return svc.create_deck(payload)


@router.patch(
    "/decks/{deck_id}",
    response_model=DeckRead,
    dependencies=[Depends(require_scope("write:review"))],
)
async def rename_deck(
    deck_id: str, payload: DeckRenameRequest, svc: ReviewService = Depends(_svc)
) -> DeckRead:
    deck = svc.rename_deck(deck_id, payload.name.strip())
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return DeckRead(**deck)


@router.delete(
    "/decks/{deck_id}",
    response_model=DeleteResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def delete_deck(
    deck_id: str, svc: ReviewService = Depends(_svc)
) -> DeleteResponse:
    deleted = svc.delete_deck(deck_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Deck not found")
    return DeleteResponse(deleted=True)


@router.post(
    "/decks/{deck_id}/cards",
    response_model=ReviewCardRead,
    dependencies=[Depends(require_scope("write:review"))],
)
async def create_card_for_deck(
    deck_id: str, payload: DeckCardCreate, svc: ReviewService = Depends(_svc)
) -> ReviewCardRead:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.create_card_for_deck(
        deck_id, payload.front, payload.back, payload.tags, payload.source
    )


@router.get(
    "/decks/{deck_id}/cards/search",
    response_model=ReviewSearchResponse,
    dependencies=[Depends(require_scope("read:review"))],
)
async def search_cards(
    deck_id: str,
    q: str = Query(default=""),
    state: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=50),
    svc: ReviewService = Depends(_svc),
) -> ReviewSearchResponse:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    valid_states = {
        None,
        "",
        "new",
        "review",
        "learning",
        "relearn",
        "suspended",
        "buried",
    }
    if state not in valid_states:
        raise HTTPException(
            status_code=422,
            detail="state must be one of: new, review, learning, relearn, suspended, buried",
        )
    items = svc.search_cards(deck_id, q=q, state=state or None, limit=limit)
    return ReviewSearchResponse(items=items, limit=limit)


@router.post(
    "/decks/{deck_id}/cards/bulk",
    response_model=ReviewBulkCardsResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def bulk_cards(
    deck_id: str, body: BulkCardsBody, svc: ReviewService = Depends(_svc)
) -> ReviewBulkCardsResponse:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    try:
        return svc.bulk_cards(deck_id, body.ids, body.action)
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"Operation failed: {type(exc).__name__}"
        )


@router.get(
    "/decks/{deck_id}/next-due",
    response_model=NextDueResponse,
    dependencies=[Depends(require_scope("read:review"))],
)
async def next_due(deck_id: str, svc: ReviewService = Depends(_svc)) -> NextDueResponse:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.get_next_due(deck_id)


@router.get(
    "/decks/{deck_id}/stats",
    response_model=DeckStatsResponse,
    dependencies=[Depends(require_scope("read:review"))],
)
async def deck_stats(
    deck_id: str, svc: ReviewService = Depends(_svc)
) -> DeckStatsResponse:
    try:
        return svc.get_deck_stats(deck_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Deck not found")


@router.post(
    "/decks/{deck_id}/import/preview",
    response_model=ReviewImportPreview,
    dependencies=[Depends(require_scope("write:review"))],
)
async def import_preview(
    deck_id: str,
    body: ImportBody,
    fmt: str = Query(default="csv"),
    svc: ReviewService = Depends(_svc),
) -> ReviewImportPreview:
    if fmt not in ("csv", "tsv"):
        raise HTTPException(status_code=422, detail="fmt must be csv or tsv")
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.preview_import(deck_id, body.content, fmt)


# ── due ───────────────────────────────────────────────────────────────────────


@router.get(
    "/due",
    response_model=list[ReviewCardRead],
    dependencies=[Depends(require_scope("read:review"))],
)
async def due_cards(
    deck_id: str = Query(...),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    svc: ReviewService = Depends(_svc),
) -> list[ReviewCardRead]:
    return svc.get_due_cards(deck_id, limit, offset)


# ── rate ──────────────────────────────────────────────────────────────────────


@router.post(
    "/rate",
    response_model=ReviewCardRead,
    dependencies=[Depends(require_scope("write:review"))],
)
async def rate_card(
    payload: ReviewRating, svc: ReviewService = Depends(_svc)
) -> ReviewCardRead:
    try:
        return svc.rate_card(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=f"Not found: {type(exc).__name__}")


# ── session ───────────────────────────────────────────────────────────────────


@router.get(
    "/session",
    response_model=ReviewSessionState,
    dependencies=[Depends(require_scope("read:review"))],
)
async def session_state(
    limit: int = Query(default=20, ge=1, le=200),
    deck_id: str | None = Query(default=None),
    svc: ReviewService = Depends(_svc),
) -> ReviewSessionState:
    return svc.get_session_state(limit=limit, deck_id=deck_id)


@router.post(
    "/session/start",
    response_model=ReviewSessionStart,
    dependencies=[Depends(require_scope("write:review"))],
)
async def start_session(
    limit: int = Query(default=20, ge=1, le=200),
    deck_id: str | None = Query(default=None),
    svc: ReviewService = Depends(_svc),
) -> ReviewSessionStart:
    return svc.start_session(limit=limit, deck_id=deck_id)


@router.post(
    "/session/{deck_id}/start",
    response_model=ReviewSessionStart,
    dependencies=[Depends(require_scope("write:review"))],
)
async def start_deck_session(
    deck_id: str,
    limit: int = Query(default=20, ge=1, le=200),
    svc: ReviewService = Depends(_svc),
) -> ReviewSessionStart:
    if not svc.get_deck(deck_id):
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.start_deck_session(deck_id, limit=limit)


@router.post(
    "/answer",
    response_model=ReviewAnswerResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def answer(
    rating: str = Query(...),
    card_id: str = Query(...),
    svc: ReviewService = Depends(_svc),
) -> ReviewAnswerResponse:
    try:
        return svc.answer_card(card_id, rating)
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"Operation failed: {type(exc).__name__}"
        )


@router.post(
    "/session/{deck_id}/answer",
    response_model=ReviewAnswerResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def answer_for_deck(
    deck_id: str,
    rating: str = Query(...),
    card_id: str = Query(...),
    svc: ReviewService = Depends(_svc),
) -> ReviewAnswerResponse:
    try:
        return svc.answer_card_for_deck(deck_id, card_id, rating)
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"Operation failed: {type(exc).__name__}"
        )


@router.post(
    "/session/{deck_id}/end",
    response_model=ReviewSessionEndResponse,
    dependencies=[Depends(require_scope("write:review"))],
)
async def end_session(
    deck_id: str, svc: ReviewService = Depends(_svc)
) -> ReviewSessionEndResponse:
    return svc.end_session(deck_id)


# ── history ───────────────────────────────────────────────────────────────────


@router.get(
    "/history",
    response_model=ReviewHistoryResponse,
    dependencies=[Depends(require_scope("read:review"))],
)
async def review_history(
    limit: int = Query(default=20, ge=1, le=100),
    svc: ReviewService = Depends(_svc),
) -> ReviewHistoryResponse:
    return svc.get_history(limit)


# ── export ────────────────────────────────────────────────────────────────────


@router.get(
    "/export-preview",
    response_model=ReviewExportPreviewResponse,
    dependencies=[Depends(require_scope("read:review"))],
)
async def export_preview(
    deck_id: str = Query(...),
    limit: int = Query(default=50, ge=1, le=200),
    svc: ReviewService = Depends(_svc),
) -> ReviewExportPreviewResponse:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return svc.export_preview(deck_id, limit)


@router.get(
    "/export/apkg/{deck_id}", dependencies=[Depends(require_scope("read:review"))]
)
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


@router.post(
    "/import",
    response_model=ReviewImportResult,
    dependencies=[Depends(require_scope("write:review"))],
)
async def import_notes(
    deck_id: str = Query(...),
    fmt: str = Query(default="csv"),
    body: ImportBody | None = Body(default=None),
    content: str | None = Query(default=None),
    svc: ReviewService = Depends(_svc),
) -> ReviewImportResult:
    if fmt not in ("csv", "tsv"):
        raise HTTPException(status_code=422, detail="fmt must be csv or tsv")
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    source_text = body.content if body is not None else (content or "")
    return svc.import_notes(deck_id, source_text, fmt)


@router.post(
    "/import-apkg",
    response_model=ReviewApkgImportResult,
    dependencies=[Depends(require_scope("write:review"))],
)
async def import_apkg(
    deck_id: str = Query(...),
    file: UploadFile = File(...),
    svc: ReviewService = Depends(_svc),
) -> ReviewApkgImportResult:
    deck = svc.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    data, _ = validate_upload(
        file,
        kind="apkg",
        allowed_suffixes={".apkg"},
        allowed_content_types={
            "application/octet-stream",
            "application/zip",
            "application/x-zip-compressed",
        },
        default_max_bytes=25 * 1024 * 1024,
    )
    try:
        return svc.import_apkg(deck_id, data, file.filename or "deck.apkg")
    except ValueError as exc:
        logger.warning(
            "APKG import rejected for deck_id=%s filename=%s: %s",
            deck_id,
            file.filename or "deck.apkg",
            exc,
        )
        raise HTTPException(status_code=422, detail=str(exc))
