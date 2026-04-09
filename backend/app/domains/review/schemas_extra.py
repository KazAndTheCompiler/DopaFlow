"""Additional schemas for review management endpoints."""

from __future__ import annotations

from pydantic import BaseModel

from app.domains.review.schemas import ReviewSearchCard


class CardSuspendResponse(BaseModel):
    card_id: str
    suspended: bool


class CardBuryResponse(BaseModel):
    card_id: str
    buried_until: str


class ReviewSearchResponse(BaseModel):
    items: list[ReviewSearchCard]
    limit: int


class DeckStatsResponse(BaseModel):
    deck_id: str
    deck_name: str
    total_cards: int
    due_cards: int
    suspended_count: int
    average_interval: float


class ImportBody(BaseModel):
    content: str


class BulkCardsBody(BaseModel):
    ids: list[str]
    action: str


class DeckCardCreate(BaseModel):
    front: str
    back: str
    tags: list[str] = []
    source: str = "manual"
