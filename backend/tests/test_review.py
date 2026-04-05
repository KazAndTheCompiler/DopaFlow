from __future__ import annotations

import sqlite3
import tempfile
import zipfile
from datetime import date, timedelta
from pathlib import Path

from app.domains.review.repository import ReviewRepository
from app.domains.review.schemas import DeckCreate
from app.domains.review.service import ReviewService


def _build_test_apkg(notes: list[tuple[list[str], str]]) -> bytes:
    """Create a tiny Anki-style package with just the notes table the importer needs."""

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        db_path = tmp / "collection.anki21"
        conn = sqlite3.connect(db_path)
        try:
            conn.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT NOT NULL, tags TEXT)")
            for idx, (fields, tags) in enumerate(notes, start=1):
                conn.execute(
                    "INSERT INTO notes (id, flds, tags) VALUES (?, ?, ?)",
                    (idx, "\x1f".join(fields), tags),
                )
            conn.commit()
        finally:
            conn.close()

        apkg_path = tmp / "fixture.apkg"
        with zipfile.ZipFile(apkg_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(db_path, arcname="collection.anki21")

        return apkg_path.read_bytes()


def test_import_apkg_creates_cards_from_generated_package(db_path) -> None:
    repo = ReviewRepository(str(db_path))
    svc = ReviewService(repo)
    deck = repo.create_deck(DeckCreate(name="Imported SM2"))
    apkg_bytes = _build_test_apkg(
        [
            (["What is dopamine?", "A neurotransmitter tied to motivation"], "brain chem"),
            (["{{c1::Pomodoro}} helps protect focus blocks", ""], "focus habits"),
            (["", "missing front should skip"], "broken"),
        ],
    )

    result = svc.import_apkg(deck["id"], apkg_bytes, "fixture.apkg")
    cards = repo.search_cards(deck["id"], limit=10)

    assert result == {"imported": 2, "skipped": 1, "source": "fixture.apkg"}
    assert sorted(card["front"] for card in cards) == [
        "What is dopamine?",
        "[...] helps protect focus blocks",
    ]


def test_imported_apkg_cards_enter_sm2_schedule(db_path) -> None:
    repo = ReviewRepository(str(db_path))
    svc = ReviewService(repo)
    deck = repo.create_deck(DeckCreate(name="Import Scheduling"))
    apkg_bytes = _build_test_apkg(
        [
            (["Coffee after lunch hurts sleep", "Avoid caffeine late"], "health energy"),
        ],
    )

    svc.import_apkg(deck["id"], apkg_bytes, "sm2-fixture.apkg")
    due_cards = repo.get_due_cards(deck["id"], limit=5)

    assert len(due_cards) == 1
    assert due_cards[0].front == "Coffee after lunch hurts sleep"
    assert due_cards[0].reviews_done == 0

    svc.answer_card(due_cards[0].id, "good", deck_id=deck["id"])
    updated = repo.get_card(due_cards[0].id)

    assert updated.reviews_done == 1
    assert updated.interval == 1
    assert updated.last_rating == 3
    assert updated.next_review_at == date.today() + timedelta(days=1)
