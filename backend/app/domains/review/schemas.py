"""Pydantic schemas for the review domain."""

from __future__ import annotations

from datetime import date

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
