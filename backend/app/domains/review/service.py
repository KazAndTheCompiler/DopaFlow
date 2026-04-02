"""Business logic for the review domain."""

from __future__ import annotations

import logging
import os
import re
import sqlite3
import tempfile
import zipfile
from datetime import UTC, date, datetime, timedelta

from app.core.config import get_settings
from app.domains.gamification.repository import GamificationRepository
from app.domains.gamification.service import GamificationService
from app.domains.review.repository import ReviewRepository
from app.domains.review.schemas import DeckCreate, ReviewCardCreate, ReviewCardRead, ReviewRating
from app.domains.review.schemas_extra import CardBuryResponse, CardSuspendResponse, DeckStatsResponse, ReviewSearchResult

MIN_EASE = 1.3
DEFAULT_EASE = 2.5

_RATING_MAP = {"again": 1, "hard": 2, "good": 3, "easy": 4}

logger = logging.getLogger(__name__)


def _award(source: str, source_id: str | None = None) -> None:
    try:
        db = get_settings().db_path
        GamificationService(GamificationRepository(db)).award(source, source_id)
    except Exception:
        logger.exception("Failed to award gamification points for source=%s source_id=%s", source, source_id)


def sm2_next(
    rating: int,
    ease_factor: float,
    last_interval: int,
    reviews_done: int,
    lapse_count: int,
) -> tuple[float, int, int, date]:
    """
    Return the next SM-2 scheduling tuple.

    Rating scale: 1=Again 2=Hard 3=Good 4=Easy.
    """

    if rating not in {1, 2, 3, 4}:
        raise ValueError("Rating must be between 1 and 4")

    ease = max(ease_factor or DEFAULT_EASE, MIN_EASE)
    new_lapse_count = lapse_count

    if rating == 1:
        interval = 1
        ease = max(MIN_EASE, ease - 0.2)
        new_lapse_count += 1
    elif rating == 2:
        interval = max(1, round(last_interval * 1.2))
        ease = max(MIN_EASE, ease - 0.15)
    elif rating == 3:
        if reviews_done == 0:
            interval = 1
        elif reviews_done == 1:
            interval = 6
        else:
            interval = max(1, round(last_interval * ease))
    else:
        if reviews_done == 0:
            interval = 1
        elif reviews_done == 1:
            interval = 8
        else:
            interval = max(1, round(last_interval * ease * 1.3))
        ease = max(MIN_EASE, ease + 0.15)

    return ease, interval, new_lapse_count, date.today() + timedelta(days=interval)


class ReviewService:
    """Coordinate SM-2 scheduling, deck imports, and review session tracking."""

    def __init__(self, repository: ReviewRepository) -> None:
        self.repository = repository

    # ── cards ─────────────────────────────────────────────────────────────────

    def list_cards(self) -> list[ReviewCardRead]:
        return self.repository.list_cards()

    def create_card(self, payload: ReviewCardCreate) -> ReviewCardRead:
        return self.repository.create_card(payload)

    def create_card_for_deck(self, deck_id: str, front: str, back: str, tags: list[str], source: str = "manual") -> ReviewCardRead:
        return self.repository.create_card_full(deck_id, front, back, tags, source)

    def get_due_cards(self, deck_id: str, limit: int = 20) -> list[ReviewCardRead]:
        return self.repository.get_due_cards(deck_id, limit)

    def rate_card(self, payload: ReviewRating) -> ReviewCardRead:
        """Update scheduling fields after a review rating and persist them."""

        existing = self.repository.rate_card(payload)
        next_ease, next_interval, lapse_count, next_review_date = sm2_next(
            rating=payload.rating,
            ease_factor=existing.ease_factor,
            last_interval=existing.interval,
            reviews_done=existing.reviews_done,
            lapse_count=existing.lapse_count,
        )
        card = self.repository.save_card_after_rating(
            existing.id,
            ease_factor=next_ease,
            interval=next_interval,
            lapse_count=lapse_count,
            next_review_at=next_review_date.isoformat(),
            last_rating=payload.rating,
            reviews_done=existing.reviews_done + 1,
        )
        _award("review_card", existing.id)
        return card

    def answer_card(self, card_id: str, rating_label: str, deck_id: str | None = None) -> dict[str, object]:
        """Apply a string rating to a card. Bumps the active session if deck_id given."""

        int_rating = _RATING_MAP.get(rating_label.lower())
        if int_rating is None:
            raise ValueError(f"rating must be one of: {', '.join(_RATING_MAP)}")
        existing = self.repository.get_card(card_id)
        next_ease, next_interval, lapse_count, next_review_date = sm2_next(
            rating=int_rating,
            ease_factor=existing.ease_factor,
            last_interval=existing.interval,
            reviews_done=existing.reviews_done,
            lapse_count=existing.lapse_count,
        )
        updated = self.repository.save_card_after_rating(
            card_id,
            ease_factor=next_ease,
            interval=next_interval,
            lapse_count=lapse_count,
            next_review_at=next_review_date.isoformat(),
            last_rating=int_rating,
            reviews_done=existing.reviews_done + 1,
        )
        if deck_id:
            self.repository.bump_session_answer(deck_id, rating_label.lower())
        _award("review_card", card_id)
        return {
            "session": {
                "state": updated.id,
                "interval": next_interval,
                "last_rating": rating_label,
            },
            "card": updated.model_dump(),
        }

    def reset_card(self, card_id: str) -> ReviewCardRead:
        self.repository.get_card(card_id)
        return self.repository.reset_card(card_id)

    def suspend_card(self, card_id: str) -> CardSuspendResponse:
        self.repository.get_card(card_id)
        self.repository.suspend_card(card_id)
        return CardSuspendResponse(card_id=card_id, suspended=True)

    def unsuspend_card(self, card_id: str) -> CardSuspendResponse:
        self.repository.get_card(card_id)
        self.repository.unsuspend_card(card_id)
        return CardSuspendResponse(card_id=card_id, suspended=False)

    def bury_card_today(self, card_id: str) -> CardBuryResponse:
        self.repository.get_card(card_id)
        self.repository.bury_card_today(card_id)
        return CardBuryResponse(card_id=card_id, buried_until=(date.today() + timedelta(days=1)).isoformat())

    def search_cards(self, deck_id: str, q: str = "", state: str | None = None, limit: int = 50) -> list[ReviewSearchResult]:
        rows = self.repository.search_cards(deck_id, q=q, state=state, limit=limit)
        return [ReviewSearchResult(**row) for row in rows]

    def bulk_cards(self, deck_id: str, ids: list[str], action: str) -> dict[str, int]:
        affected = self.repository.bulk_cards(deck_id, ids, action)
        return {"affected": affected}

    # ── decks ─────────────────────────────────────────────────────────────────

    def list_decks(self) -> list[dict[str, object]]:
        return self.repository.list_decks()

    def create_deck(self, payload: DeckCreate) -> dict[str, object]:
        return self.repository.create_deck(payload)

    def get_deck(self, deck_id: str) -> dict[str, object] | None:
        return self.repository.get_deck(deck_id)

    def get_deck_stats(self, deck_id: str) -> DeckStatsResponse:
        return DeckStatsResponse(**self.repository.get_deck_stats(deck_id))

    def get_next_due(self, deck_id: str) -> dict[str, object]:
        return {"next_due": self.repository.get_next_due(deck_id)}

    # ── export ────────────────────────────────────────────────────────────────

    def get_all_cards_for_export(self, deck_id: str) -> list[dict[str, object]]:
        return self.repository.get_all_cards_for_export(deck_id)

    def export_preview(self, deck_id: str, limit: int = 50) -> dict[str, object]:
        return self.repository.export_preview(deck_id, limit)

    # ── import ────────────────────────────────────────────────────────────────

    def import_notes(self, deck_id: str, content: str, fmt: str = "csv") -> dict[str, int]:
        return self.repository.import_notes(deck_id, content, fmt)

    def preview_import(self, deck_id: str, content: str, fmt: str = "csv") -> dict[str, object]:
        return self.repository.preview_import(deck_id, content, fmt)

    def import_apkg(self, deck_id: str, data: bytes, filename: str) -> dict[str, object]:
        """Import an Anki .apkg file. Handles cloze deletions and HTML stripping."""

        def strip_html(text: str) -> str:
            text = (
                text.replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replace("&nbsp;", " ")
                .replace("<br>", "\n")
                .replace("<br/>", "\n")
                .replace("<br />", "\n")
            )
            return re.sub(r"<[^>]+>", "", text).strip()

        def convert_cloze(fields: list[str]) -> tuple[str, str]:
            front_raw = fields[0] if fields else ""
            back_raw = fields[1] if len(fields) > 1 else ""
            if "{{c" in front_raw:
                question = re.sub(r"\{\{c\d+::(.*?)(?:::[^}]*)?\}\}", "[...]", front_raw)
                answer = re.sub(r"\{\{c\d+::(.*?)(?:::[^}]*)?\}\}", r"\1", front_raw)
                return strip_html(question), strip_html(answer)
            f = strip_html(front_raw)
            b = strip_html(back_raw) if back_raw.strip() else f
            return f, b

        try:
            with tempfile.TemporaryDirectory() as tmp:
                apkg_path = os.path.join(tmp, "deck.apkg")
                with open(apkg_path, "wb") as fh:
                    fh.write(data)
                with zipfile.ZipFile(apkg_path, "r") as z:
                    names = z.namelist()
                    db_name = "collection.anki21" if "collection.anki21" in names else "collection.anki2"
                    z.extract(db_name, tmp)
                anki_conn = sqlite3.connect(os.path.join(tmp, db_name))
                anki_conn.row_factory = sqlite3.Row
                created = skipped = 0
                try:
                    notes = anki_conn.execute("SELECT flds, tags FROM notes").fetchall()
                    for note in notes:
                        fields = note["flds"].split("\x1f")
                        front, back = convert_cloze(fields)
                        if not front or not back:
                            skipped += 1
                            continue
                        tags = [t.strip() for t in (note["tags"] or "").split() if t.strip()]
                        self.repository.create_card_full(deck_id, front, back, tags, source="apkg")
                        created += 1
                finally:
                    anki_conn.close()
            return {"imported": created, "skipped": skipped, "source": filename}
        except zipfile.BadZipFile:
            raise ValueError("File is not a valid .apkg (bad zip)")

    # ── sessions ──────────────────────────────────────────────────────────────

    def get_session_state(self, limit: int = 20, deck_id: str | None = None) -> dict[str, object]:
        """Return the current session state: next card and queue size."""

        queue = self.repository.get_due_cards(deck_id, limit) if deck_id else self.repository.list_cards()[:limit]
        if queue:
            top = queue[0]
            return {
                "state": "active",
                "interval": top.interval or 1,
                "last_rating": top.last_rating,
                "card": {"id": top.id, "front": top.front, "back": top.back},
                "queue_size": len(queue),
            }
        return {"queue_size": 0}

    def start_session(self, limit: int = 20, deck_id: str | None = None) -> dict[str, object]:
        """Start a review session and return the initial queue."""

        if deck_id and self.repository.get_deck(deck_id):
            self.repository.start_session(deck_id)
        queue = self.repository.get_due_cards(deck_id, limit) if deck_id else self.repository.list_cards()[:limit]
        return {
            "count": len(queue),
            "cards": [
                {
                    "id": c.id,
                    "deck_id": c.deck_id,
                    "front": c.front,
                    "state": "active",
                    "next_review_at": str(c.next_review_at) if c.next_review_at else None,
                }
                for c in queue
            ],
        }

    def start_deck_session(self, deck_id: str, limit: int = 20) -> dict[str, object]:
        """Start a deck-specific session."""

        return self.start_session(limit=limit, deck_id=deck_id)

    def answer_card_for_deck(self, deck_id: str, card_id: str, rating_label: str) -> dict[str, object]:
        """Answer a card within a deck session. Ends session when queue empties."""

        result = self.answer_card(card_id, rating_label, deck_id=deck_id)
        remaining = self.repository.get_due_cards(deck_id, 1)
        if not remaining:
            self.repository.end_session(deck_id)
        return result

    def end_session(self, deck_id: str) -> dict[str, object]:
        """Explicitly close the active session for a deck."""

        session_id = self.repository.end_session(deck_id)
        return {"ok": True, "session_log_id": session_id}

    def log_session(self, deck_id: str, ratings_summary: dict[str, int]) -> dict[str, object]:
        return self.repository.log_session(deck_id, ratings_summary)

    def get_history(self, limit: int = 20) -> dict[str, object]:
        return {"items": self.repository.get_history(limit)}
