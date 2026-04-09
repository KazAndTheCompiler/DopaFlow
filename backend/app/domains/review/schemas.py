"""Pydantic schemas for the review domain."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class DeckCreate(BaseModel):
    """Payload for creating a spaced repetition deck."""

    name: str
    source_type: str = "manual"


class ReviewCardCreate(BaseModel):
    """Payload for creating a review card."""

    deck_id: str
    front: str
    back: str


class ReviewCardRead(ReviewCardCreate):
    """Serialized review card including SM-2 scheduling fields."""

    id: str
    interval: int = 0
    ease_factor: float = 2.5
    next_review_at: date | None = None
    last_rating: int | None = None
    lapse_count: int = 0
    reviews_done: int = 0


class ReviewRating(BaseModel):
    """Payload for grading a review card."""

    card_id: str
    rating: int


class DeckRead(BaseModel):
    """Serialized review deck."""

    id: str
    name: str
    source_type: str | None = None
    description: str | None = None
    created_at: datetime | None = None
    card_count: int | None = None


class DeckRenameRequest(BaseModel):
    """Payload for renaming a deck."""

    name: str


class DeleteResponse(BaseModel):
    """Simple delete acknowledgement."""

    deleted: bool


class NextDueResponse(BaseModel):
    """Next due card timestamp for a deck."""

    next_due: str | None = None


class ReviewImportPreview(BaseModel):
    """Dry-run results for CSV/TSV import."""

    total_cards: int
    new_cards: int
    duplicate_cards: int
    errors: list[str]


class ReviewImportResult(BaseModel):
    """Result of importing CSV/TSV cards."""

    created_cards: int
    duplicate_cards: int


class ReviewApkgImportResult(BaseModel):
    """Result of importing an APKG package."""

    imported: int
    skipped: int
    source: str


class ReviewSessionStateCard(BaseModel):
    """Current card preview inside session state."""

    id: str
    front: str
    back: str


class ReviewSessionState(BaseModel):
    """Current review session status."""

    queue_size: int
    state: str | None = None
    interval: int | None = None
    last_rating: int | None = None
    card: ReviewSessionStateCard | None = None


class ReviewSessionQueueCard(BaseModel):
    """Card summary returned when a session starts."""

    id: str
    deck_id: str
    front: str
    state: str
    next_review_at: str | None = None


class ReviewSessionStart(BaseModel):
    """Initial queue for a started review session."""

    count: int
    cards: list[ReviewSessionQueueCard]


class ReviewAnswerSession(BaseModel):
    """Session metadata returned after answering a card."""

    state: str
    interval: int
    last_rating: str


class ReviewAnswerResponse(BaseModel):
    """Answer result with updated card and session summary."""

    session: ReviewAnswerSession
    card: ReviewCardRead


class ReviewHistoryItem(BaseModel):
    """Historical review session summary."""

    session_id: str
    deck_name: str
    started_at: str | None = None
    ended_at: str | None = None
    cards_seen: int
    retention_pct: float


class ReviewHistoryResponse(BaseModel):
    """List of recent review sessions."""

    items: list[ReviewHistoryItem]


class ReviewSessionEndResponse(BaseModel):
    """Result of explicitly closing a session."""

    ok: bool
    session_log_id: str | None = None


class ReviewBulkCardsResponse(BaseModel):
    """Result of a bulk card mutation."""

    affected: int


class ReviewExportPreviewCard(BaseModel):
    """Card row shown in export preview."""

    id: str
    front: str
    back: str
    state: str
    next_review_at: str | None = None
    tags: list[str]


class ReviewExportPreviewResponse(BaseModel):
    """Preview of cards that would be exported."""

    deck_id: str
    card_count: int
    cards: list[ReviewExportPreviewCard]


class ReviewSearchCard(BaseModel):
    """Card shape returned by search."""

    card_id: str
    front: str
    back: str
    deck_id: str
    state: str = "new"


ReviewSearchResult = ReviewSearchCard


class ReviewDeckBasic(BaseModel):
    """Lightweight deck with card count."""

    id: str
    name: str
    source_type: str | None = None
    card_count: int


class ReviewDeckStats(BaseModel):
    """Aggregate stats for a review deck."""

    deck_id: str
    deck_name: str
    total_cards: int
    due_cards: int
    suspended_count: int
    average_interval: float


class ReviewExportCard(BaseModel):
    """Full card row used during CSV/JSON export."""

    id: str
    deck_id: str
    front: str
    back: str
    interval: int
    ease_factor: float
    lapse_count: int
    reviews_done: int
    due: str | None = None
    tags: list[str] = []


class ReviewActiveSession(BaseModel):
    """Lightweight active session reference."""

    id: str
    cards_seen: int


class ReviewSessionLog(BaseModel):
    """Lightweight session summary persisted after close."""

    deck_id: str
    ratings_summary: dict[str, int]
