"""Persistence helpers for the review domain."""

from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import UTC, date, datetime, timedelta

from app.core.database import get_db, tx
from app.core.id_gen import review_card_id
from app.domains.review.schemas import (
    DeckCreate,
    DeckRead,
    ReviewActiveSession,
    ReviewCardCreate,
    ReviewCardRead,
    ReviewDeckBasic,
    ReviewDeckStats,
    ReviewExportCard,
    ReviewExportPreviewCard,
    ReviewExportPreviewResponse,
    ReviewHistoryItem,
    ReviewImportPreview,
    ReviewImportResult,
    ReviewRating,
    ReviewSearchCard,
    ReviewSessionLog,
)

_DEFAULT_DECK_ID = "deck_default"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _row_to_card(row: object) -> ReviewCardRead:
    """Convert a sqlite3.Row to ReviewCardRead."""

    r = dict(row)  # type: ignore[call-overload]
    return ReviewCardRead(
        id=r["id"],
        deck_id=r["deck_id"],
        front=r["front"],
        back=r["back"],
        interval=r["last_interval_days"],
        ease_factor=r["ease_factor"],
        next_review_at=r["next_review_at"],
        last_rating=r["last_rating"],
        lapse_count=r["lapse_count"],
        reviews_done=r["reviews_done"],
    )


class ReviewRepository:
    """Read and write decks, cards, and session logs via SQLite."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._ensure_default_deck()

    def _ensure_default_deck(self) -> None:
        """Create the default deck if it does not exist."""

        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO review_decks (id, name)
                VALUES (?, 'Default')
                """,
                (_DEFAULT_DECK_ID,),
            )

    # ── cards ─────────────────────────────────────────────────────────────────

    def list_cards(self) -> list[ReviewCardRead]:
        """Return all cards due today or new, ordered by next_review_at."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM review_cards
                WHERE state != 'suspended'
                  AND (next_review_at IS NULL OR DATE(next_review_at) <= DATE('now'))
                ORDER BY next_review_at IS NOT NULL, next_review_at ASC
                """
            ).fetchall()
        return [_row_to_card(row) for row in rows]

    def get_due_cards(
        self, deck_id: str, limit: int = 20, offset: int = 0
    ) -> list[ReviewCardRead]:
        """Return cards due today or earlier for a specific deck."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM review_cards
                WHERE deck_id = ?
                  AND state != 'suspended'
                  AND (next_review_at IS NULL OR DATE(next_review_at) <= DATE('now'))
                ORDER BY next_review_at IS NOT NULL, next_review_at ASC
                LIMIT ?
                OFFSET ?
                """,
                (deck_id, limit, offset),
            ).fetchall()
        return [_row_to_card(row) for row in rows]

    def get_card(self, card_id: str) -> ReviewCardRead:
        """Fetch a single card by ID."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM review_cards WHERE id = ?", (card_id,)
            ).fetchone()
        if row is None:
            raise ValueError(f"Card not found: {card_id}")
        return _row_to_card(row)

    def update_card(self, card_id: str, front: str, back: str) -> ReviewCardRead:
        """Update the front and back text of an existing card."""

        with tx(self.db_path) as conn:
            result = conn.execute(
                "UPDATE review_cards SET front = ?, back = ? WHERE id = ?",
                (front.strip(), back.strip(), card_id),
            )
            if result.rowcount == 0:
                raise ValueError(f"Card not found: {card_id}")
        return self.get_card(card_id)

    def card_exists_by_front(self, deck_id: str, front: str) -> bool:
        """Return True if a card with this front text already exists in the deck."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT id FROM review_cards WHERE deck_id = ? AND lower(front) = lower(?) LIMIT 1",
                (deck_id, front.strip()),
            ).fetchone()
        return row is not None

    def create_card(self, payload: ReviewCardCreate) -> ReviewCardRead:
        """Insert a new review card and return it."""

        card_id = review_card_id()
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO review_cards (id, deck_id, front, back)
                VALUES (?, ?, ?, ?)
                """,
                (card_id, payload.deck_id, payload.front, payload.back),
            )
        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM review_cards WHERE id = ?", (card_id,)
            ).fetchone()
        return _row_to_card(row)

    def create_card_full(
        self,
        deck_id: str,
        front: str,
        back: str,
        tags: list[str],
        source: str = "manual",
    ) -> ReviewCardRead:
        """Insert a review card with tags and source, return it."""

        card_id = review_card_id()
        tags_json = json.dumps(tags)
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO review_cards (id, deck_id, front, back, tags_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (card_id, deck_id, front, back, tags_json),
            )
        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM review_cards WHERE id = ?", (card_id,)
            ).fetchone()
        return _row_to_card(row)

    def save_card_after_rating(
        self,
        card_id: str,
        *,
        ease_factor: float,
        interval: int,
        lapse_count: int,
        next_review_at: str,
        last_rating: int,
        reviews_done: int,
    ) -> ReviewCardRead:
        """Persist SM-2 results back to the card row."""

        with tx(self.db_path) as conn:
            conn.execute(
                """
                UPDATE review_cards
                SET ease_factor = ?,
                    last_interval_days = ?,
                    lapse_count = ?,
                    next_review_at = ?,
                    last_rating = ?,
                    reviews_done = ?,
                    state = CASE WHEN ? >= 3 THEN 'review' ELSE 'learning' END
                WHERE id = ?
                """,
                (
                    ease_factor,
                    interval,
                    lapse_count,
                    next_review_at,
                    last_rating,
                    reviews_done,
                    last_rating,
                    card_id,
                ),
            )
        return self.get_card(card_id)

    def rate_card(self, payload: ReviewRating) -> ReviewCardRead:
        """Return the current card state before scheduling updates are applied."""

        return self.get_card(payload.card_id)

    def reset_card(self, card_id: str) -> ReviewCardRead:
        """Reset SM-2 state for a card back to new."""

        with tx(self.db_path) as conn:
            conn.execute(
                """
                UPDATE review_cards
                SET state = 'new',
                    ease_factor = 2.5,
                    last_interval_days = 0,
                    lapse_count = 0,
                    last_rating = NULL,
                    reviews_done = 0,
                    next_review_at = NULL
                WHERE id = ?
                """,
                (card_id,),
            )
        return self.get_card(card_id)

    def suspend_card(self, card_id: str) -> None:
        """Suspend a card so it does not appear in the review queue."""

        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE review_cards SET state = 'suspended' WHERE id = ?", (card_id,)
            )

    def unsuspend_card(self, card_id: str) -> None:
        """Restore a suspended card to the queue."""

        with tx(self.db_path) as conn:
            conn.execute(
                """
                UPDATE review_cards
                SET state = CASE WHEN reviews_done > 0 THEN 'review' ELSE 'new' END
                WHERE id = ?
                """,
                (card_id,),
            )

    def bury_card_today(self, card_id: str) -> None:
        """Hide a card until tomorrow by moving its next review date."""

        buried_until = (date.today() + timedelta(days=1)).isoformat()
        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE review_cards SET next_review_at = ? WHERE id = ?",
                (buried_until, card_id),
            )

    def search_cards(
        self, deck_id: str, q: str = "", state: str | None = None, limit: int = 50
    ) -> list[ReviewSearchCard]:
        """Search cards in a deck by front/back content and optional state."""

        parts = [
            "SELECT id, front, back, deck_id, state FROM review_cards WHERE deck_id = ?"
        ]
        params: list[object] = [deck_id]
        if q:
            like = f"%{q}%"
            parts.append("AND (front LIKE ? OR back LIKE ?)")
            params.extend([like, like])
        if state == "suspended":
            parts.append("AND state = 'suspended'")
        elif state:
            parts.append("AND state = ?")
            params.append(state)
        parts.append("ORDER BY created_at DESC, id DESC LIMIT ?")
        params.append(max(1, min(limit, 50)))
        with get_db(self.db_path) as conn:
            rows = conn.execute(" ".join(parts), tuple(params)).fetchall()
        return [
            ReviewSearchCard(
                card_id=str(row["id"]),
                front=str(row["front"]),
                back=str(row["back"]),
                deck_id=str(row["deck_id"]),
                state=str(row["state"]),
            )
            for row in rows
        ]

    def bulk_cards(self, deck_id: str, ids: list[str], action: str) -> int:
        """Apply a bulk action to a set of cards. Returns affected row count."""

        if not ids:
            return 0
        placeholders = ",".join("?" * len(ids))
        with tx(self.db_path) as conn:
            if action == "suspend":
                cur = conn.execute(
                    f"UPDATE review_cards SET state = 'suspended' WHERE deck_id = ? AND id IN ({placeholders})",
                    (deck_id, *ids),
                )
            elif action == "unsuspend":
                cur = conn.execute(
                    f"UPDATE review_cards SET state = CASE WHEN reviews_done > 0 THEN 'review' ELSE 'new' END WHERE deck_id = ? AND id IN ({placeholders})",
                    (deck_id, *ids),
                )
            elif action == "bury":
                buried_until = (date.today() + timedelta(days=1)).isoformat()
                cur = conn.execute(
                    f"UPDATE review_cards SET next_review_at = ? WHERE deck_id = ? AND id IN ({placeholders})",
                    (buried_until, deck_id, *ids),
                )
            elif action == "delete":
                cur = conn.execute(
                    f"DELETE FROM review_cards WHERE deck_id = ? AND id IN ({placeholders})",
                    (deck_id, *ids),
                )
            elif action == "reset":
                cur = conn.execute(
                    f"""
                    UPDATE review_cards
                    SET state = 'new',
                        ease_factor = 2.5,
                        last_interval_days = 0,
                        lapse_count = 0,
                        last_rating = NULL,
                        reviews_done = 0,
                        next_review_at = NULL
                    WHERE deck_id = ? AND id IN ({placeholders})
                    """,
                    (deck_id, *ids),
                )
            else:
                raise ValueError(f"Invalid bulk action: {action}")
        return cur.rowcount

    # ── decks ─────────────────────────────────────────────────────────────────

    def list_decks(self) -> list[ReviewDeckBasic]:
        """Return all review decks with a lightweight card count."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT d.id, d.name, COUNT(c.id) AS card_count
                FROM review_decks d
                LEFT JOIN review_cards c ON c.deck_id = d.id
                GROUP BY d.id, d.name
                ORDER BY d.name ASC
                """
            ).fetchall()
        return [
            ReviewDeckBasic(
                id=str(row["id"]),
                name=str(row["name"]),
                source_type=None,
                card_count=int(row["card_count"]),
            )
            for row in rows
        ]

    def create_deck(self, payload: DeckCreate) -> DeckRead:
        """Create a review deck and return its record."""

        deck_id = f"deck_{payload.name.lower().replace(' ', '_')}"
        with tx(self.db_path) as conn:
            conn.execute(
                "INSERT OR IGNORE INTO review_decks (id, name) VALUES (?, ?)",
                (deck_id, payload.name),
            )
        return DeckRead(
            id=deck_id,
            name=payload.name,
            source_type=payload.source_type,
            description=None,
            created_at=None,
            card_count=0,
        )

    def get_deck(self, deck_id: str) -> DeckRead | None:
        """Fetch a single deck by ID."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT id, name, description, created_at FROM review_decks WHERE id = ?",
                (deck_id,),
            ).fetchone()
        if row is None:
            return None
        return DeckRead(
            id=str(row["id"]),
            name=str(row["name"]),
            description=row["description"],
            created_at=row["created_at"],
            source_type=None,
            card_count=None,
        )

    def rename_deck(self, deck_id: str, name: str) -> DeckRead | None:
        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE review_decks SET name = ? WHERE id = ?", (name, deck_id)
            )
        return self.get_deck(deck_id)

    def delete_deck(self, deck_id: str) -> bool:
        with tx(self.db_path) as conn:
            conn.execute("DELETE FROM review_cards WHERE deck_id = ?", (deck_id,))
            result = conn.execute("DELETE FROM review_decks WHERE id = ?", (deck_id,))
        return result.rowcount > 0

    def get_deck_stats(self, deck_id: str) -> ReviewDeckStats:
        """Return aggregate stats for a review deck."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT
                    d.id AS deck_id,
                    d.name AS deck_name,
                    COUNT(c.id) AS total_cards,
                    SUM(
                        CASE
                            WHEN c.id IS NOT NULL
                             AND c.state != 'suspended'
                             AND (c.next_review_at IS NULL OR DATE(c.next_review_at) <= DATE('now'))
                            THEN 1
                            ELSE 0
                        END
                    ) AS due_cards,
                    SUM(CASE WHEN c.state = 'suspended' THEN 1 ELSE 0 END) AS suspended_count,
                    AVG(COALESCE(c.last_interval_days, 0)) AS average_interval
                FROM review_decks d
                LEFT JOIN review_cards c ON c.deck_id = d.id
                WHERE d.id = ?
                GROUP BY d.id, d.name
                """,
                (deck_id,),
            ).fetchone()
        if row is None:
            raise ValueError(f"Deck not found: {deck_id}")
        return ReviewDeckStats(
            deck_id=str(row["deck_id"]),
            deck_name=str(row["deck_name"]),
            total_cards=int(row["total_cards"]),
            due_cards=int(row["due_cards"] or 0),
            suspended_count=int(row["suspended_count"] or 0),
            average_interval=float(row["average_interval"] or 0.0),
        )

    def get_next_due(self, deck_id: str) -> str | None:
        """Return the ISO timestamp of the next due card in the deck."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT next_review_at
                FROM review_cards
                WHERE deck_id = ? AND state != 'suspended'
                ORDER BY next_review_at ASC
                LIMIT 1
                """,
                (deck_id,),
            ).fetchone()
        return row["next_review_at"] if row else None

    # ── export ────────────────────────────────────────────────────────────────

    def get_all_cards_for_export(self, deck_id: str) -> list[ReviewExportCard]:
        """Fetch all cards for deck export."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, deck_id, front, back, last_interval_days, ease_factor, lapse_count, reviews_done, next_review_at, tags_json
                FROM review_cards
                WHERE deck_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (deck_id,),
            ).fetchall()
        return [
            ReviewExportCard(
                id=str(row["id"]),
                deck_id=str(row["deck_id"]),
                front=str(row["front"]),
                back=str(row["back"]),
                interval=int(row["last_interval_days"]),
                ease_factor=float(row["ease_factor"]),
                lapse_count=int(row["lapse_count"]),
                reviews_done=int(row["reviews_done"]),
                due=row["next_review_at"],
                tags=json.loads(row["tags_json"] or "[]"),
            )
            for index, row in enumerate(rows, 1)
        ]

    def export_preview(
        self, deck_id: str, limit: int = 50
    ) -> ReviewExportPreviewResponse:
        """Return a preview of cards for export inspection."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, front, back, state, next_review_at, tags_json
                FROM review_cards
                WHERE deck_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (deck_id, max(1, min(limit, 200))),
            ).fetchall()
        cards = [
            ReviewExportPreviewCard(
                id=str(row["id"]),
                front=str(row["front"]),
                back=str(row["back"]),
                state=str(row["state"]),
                next_review_at=row["next_review_at"],
                tags=json.loads(row["tags_json"] or "[]"),
            )
            for row in rows
        ]
        return ReviewExportPreviewResponse(
            deck_id=deck_id, card_count=len(cards), cards=cards
        )

    # ── import ────────────────────────────────────────────────────────────────

    def import_notes(
        self, deck_id: str, source_text: str, fmt: str = "csv"
    ) -> ReviewImportResult:
        """Import CSV or TSV content as cards into a deck."""

        sep = "\t" if fmt == "tsv" else ","
        reader = csv.DictReader(io.StringIO(source_text), delimiter=sep)
        created = 0
        duplicates = 0
        seen: set[str] = set()
        for row in reader:
            front = (row.get("front") or "").strip()
            back = (row.get("back") or "").strip()
            if not front or not back:
                continue
            key = front.lower()
            if key in seen or self.card_exists_by_front(deck_id, front):
                duplicates += 1
                continue
            seen.add(key)
            tags = [t.strip() for t in (row.get("tags") or "").split("|") if t.strip()]
            source = row.get("source") or "import"
            self.create_card_full(deck_id, front, back, tags, source)
            created += 1
        return ReviewImportResult(created_cards=created, duplicate_cards=duplicates)

    def preview_import(
        self, deck_id: str, source_text: str, fmt: str = "csv"
    ) -> ReviewImportPreview:
        """Dry-run a CSV/TSV import and report what would be created."""

        sep = "\t" if fmt == "tsv" else ","
        reader = csv.DictReader(io.StringIO(source_text), delimiter=sep)
        total = new_count = dupe_count = 0
        errors: list[str] = []
        seen: set[str] = set()
        for i, row in enumerate(reader, start=2):
            front = (row.get("front") or "").strip()
            back = (row.get("back") or "").strip()
            if not front or not back:
                errors.append(f"Row {i}: missing front or back")
                continue
            total += 1
            key = front.lower()
            if key in seen or self.card_exists_by_front(deck_id, front):
                dupe_count += 1
            else:
                seen.add(key)
                new_count += 1
        return ReviewImportPreview(
            total_cards=total,
            new_cards=new_count,
            duplicate_cards=dupe_count,
            errors=errors,
        )

    # ── sessions ──────────────────────────────────────────────────────────────

    def start_session(self, deck_id: str) -> str:
        """Start a new review session for a deck, closing any active one first."""

        session_id = str(uuid.uuid4())
        now = _now_iso()
        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE review_session_log SET status = 'closed', ended_at = COALESCE(ended_at, ?) WHERE deck_id = ? AND status = 'active'",
                (now, deck_id),
            )
            conn.execute(
                "INSERT INTO review_session_log (id, deck_id, started_at, status) VALUES (?, ?, ?, 'active')",
                (session_id, deck_id, now),
            )
        return session_id

    def get_active_session(self, deck_id: str) -> ReviewActiveSession | None:
        """Return the active session row for a deck, if any."""

        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT id, cards_seen FROM review_session_log WHERE deck_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1",
                (deck_id,),
            ).fetchone()
        return (
            ReviewActiveSession(id=str(row["id"]), cards_seen=int(row["cards_seen"]))
            if row
            else None
        )

    def bump_session_answer(self, deck_id: str, rating_label: str) -> None:
        """Increment the answer counter for the active session."""

        active = self.get_active_session(deck_id)
        if not active:
            return
        field = {
            "again": "cards_again",
            "hard": "cards_hard",
            "good": "cards_good",
            "easy": "cards_easy",
        }.get(rating_label)
        if not field:
            return
        VALID_CARD_RATING_FIELDS = {
            "cards_again",
            "cards_hard",
            "cards_good",
            "cards_easy",
        }
        if field not in VALID_CARD_RATING_FIELDS:
            raise ValueError(f"Invalid rating field: {field}")
        with tx(self.db_path) as conn:
            conn.execute(
                f"UPDATE review_session_log SET cards_seen = cards_seen + 1, {field} = {field} + 1 WHERE id = ?",
                (active.id,),
            )

    def end_session(self, deck_id: str) -> str | None:
        """Close the active session for a deck. Returns session_id or None."""

        active = self.get_active_session(deck_id)
        if not active:
            return None
        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE review_session_log SET ended_at = ?, status = 'closed' WHERE id = ?",
                (_now_iso(), active.id),
            )
        return str(active.id)

    def log_session(
        self, deck_id: str, ratings_summary: dict[str, int]
    ) -> ReviewSessionLog:
        """Persist a lightweight review session log summary (legacy)."""

        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO review_session_log (id, deck_id, card_id, rating, reviewed_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    f"log_{deck_id}_{date.today().isoformat()}",
                    deck_id,
                    "session-summary",
                    ratings_summary.get("avg_rating", 0),
                ),
            )
        return ReviewSessionLog(deck_id=deck_id, ratings_summary=ratings_summary)

    def get_history(self, limit: int = 20) -> list[ReviewHistoryItem]:
        """Return closed review session summaries joined with deck names."""

        with get_db(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT rsl.id AS session_id, d.name AS deck_name, rsl.started_at, rsl.ended_at,
                       rsl.cards_seen, rsl.cards_good, rsl.cards_easy
                FROM review_session_log rsl
                JOIN review_decks d ON d.id = rsl.deck_id
                WHERE rsl.status = 'closed' OR rsl.started_at IS NOT NULL
                ORDER BY rsl.started_at DESC
                LIMIT ?
                """,
                (max(1, min(limit, 100)),),
            ).fetchall()
        items = []
        for row in rows:
            cards_seen = int(row["cards_seen"] or 0)
            retained = int(row["cards_good"] or 0) + int(row["cards_easy"] or 0)
            items.append(
                ReviewHistoryItem(
                    session_id=row["session_id"],
                    deck_name=row["deck_name"],
                    started_at=row["started_at"],
                    ended_at=row["ended_at"],
                    cards_seen=cards_seen,
                    retention_pct=round((retained / cards_seen) * 100, 1)
                    if cards_seen
                    else 0.0,
                )
            )
        return items
