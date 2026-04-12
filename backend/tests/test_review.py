from __future__ import annotations

import logging
import sqlite3
import tempfile
import zipfile
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

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
            conn.execute(
                "CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT NOT NULL, tags TEXT)"
            )
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


def _build_zip_payload(entries: dict[str, bytes]) -> bytes:
    with tempfile.TemporaryDirectory() as tmpdir:
        apkg_path = Path(tmpdir) / "fixture.apkg"
        with zipfile.ZipFile(apkg_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for name, content in entries.items():
                zf.writestr(name, content)
        return apkg_path.read_bytes()


def test_import_apkg_creates_cards_from_generated_package(db_path) -> None:
    repo = ReviewRepository(str(db_path))
    svc = ReviewService(repo)
    deck = repo.create_deck(DeckCreate(name="Imported SM2"))
    apkg_bytes = _build_test_apkg(
        [
            (
                ["What is dopamine?", "A neurotransmitter tied to motivation"],
                "brain chem",
            ),
            (["{{c1::Pomodoro}} helps protect focus blocks", ""], "focus habits"),
            (["", "missing front should skip"], "broken"),
        ],
    )

    result = svc.import_apkg(deck.id, apkg_bytes, "fixture.apkg")
    cards = repo.search_cards(deck.id, limit=10)

    assert result.imported == 2
    assert result.skipped == 1
    assert result.source == "fixture.apkg"
    assert sorted(card.front for card in cards) == [
        "What is dopamine?",
        "[...] helps protect focus blocks",
    ]


def test_imported_apkg_cards_enter_sm2_schedule(db_path) -> None:
    repo = ReviewRepository(str(db_path))
    svc = ReviewService(repo)
    deck = repo.create_deck(DeckCreate(name="Import Scheduling"))
    apkg_bytes = _build_test_apkg(
        [
            (
                ["Coffee after lunch hurts sleep", "Avoid caffeine late"],
                "health energy",
            ),
        ],
    )

    svc.import_apkg(deck.id, apkg_bytes, "sm2-fixture.apkg")
    due_cards = repo.get_due_cards(deck.id, limit=5)

    assert len(due_cards) == 1
    assert due_cards[0].front == "Coffee after lunch hurts sleep"
    assert due_cards[0].reviews_done == 0

    svc.answer_card(due_cards[0].id, "good", deck_id=deck.id)
    updated = repo.get_card(due_cards[0].id)

    assert updated.reviews_done == 1
    assert updated.interval == 1
    assert updated.last_rating == 3
    assert updated.next_review_at == date.today() + timedelta(days=1)


def test_patch_card_updates_front_and_back(client) -> None:
    response = client.post(
        "/api/v2/review/cards",
        json={
            "deck_id": "deck_default",
            "front": "Original front",
            "back": "Original back",
        },
    )
    assert response.status_code == 200
    card_id = response.json()["id"]

    patch_response = client.patch(
        f"/api/v2/review/cards/{card_id}",
        json={"front": "Updated front", "back": "Updated back"},
    )

    assert patch_response.status_code == 200
    updated = patch_response.json()
    assert updated["front"] == "Updated front"
    assert updated["back"] == "Updated back"
    assert updated["id"] == card_id


def test_patch_card_requires_front(client) -> None:
    response = client.post(
        "/api/v2/review/cards",
        json={"deck_id": "deck_default", "front": "Has front", "back": "Has back"},
    )
    assert response.status_code == 200
    card_id = response.json()["id"]

    patch_response = client.patch(
        f"/api/v2/review/cards/{card_id}",
        json={"front": "", "back": "New back"},
    )

    assert patch_response.status_code == 422


def test_patch_nonexistent_card_returns_404(client) -> None:
    response = client.patch(
        "/api/v2/review/cards/card_does_not_exist",
        json={"front": "x", "back": "y"},
    )

    assert response.status_code == 404


def test_review_search_and_session_routes_return_typed_contracts(client) -> None:
    deck_response = client.post("/api/v2/review/decks", json={"name": "Typed Deck"})
    assert deck_response.status_code == 200
    deck = deck_response.json()
    deck_id = deck["id"]
    assert set(deck) >= {"id", "name", "source_type"}

    card_response = client.post(
        "/api/v2/review/decks/{deck_id}/cards".format(deck_id=deck_id),
        json={
            "front": "Typed front",
            "back": "Typed back",
            "tags": ["ts"],
            "source": "manual",
        },
    )
    assert card_response.status_code == 200
    card_id = card_response.json()["id"]

    search_response = client.get(
        f"/api/v2/review/decks/{deck_id}/cards/search", params={"q": "Typed"}
    )
    assert search_response.status_code == 200
    search_payload = search_response.json()
    assert search_payload["limit"] == 50
    assert search_payload["items"][0]["card_id"] == card_id

    session_response = client.get("/api/v2/review/session", params={"deck_id": deck_id})
    assert session_response.status_code == 200
    session_payload = session_response.json()
    assert session_payload["queue_size"] >= 1
    assert session_payload["card"]["id"] == card_id

    answer_response = client.post(
        "/api/v2/review/session/{deck_id}/answer".format(deck_id=deck_id),
        params={"card_id": card_id, "rating": "good"},
    )
    assert answer_response.status_code == 200
    answer_payload = answer_response.json()
    assert answer_payload["session"]["last_rating"] == "good"
    assert answer_payload["card"]["id"] == card_id


def test_review_bulk_and_export_preview_routes_return_typed_contracts(client) -> None:
    deck_response = client.post("/api/v2/review/decks", json={"name": "Preview Deck"})
    assert deck_response.status_code == 200
    deck_id = deck_response.json()["id"]

    first_card = client.post(
        f"/api/v2/review/decks/{deck_id}/cards",
        json={
            "front": "Front one",
            "back": "Back one",
            "tags": ["alpha"],
            "source": "manual",
        },
    )
    second_card = client.post(
        f"/api/v2/review/decks/{deck_id}/cards",
        json={
            "front": "Front two",
            "back": "Back two",
            "tags": ["beta"],
            "source": "manual",
        },
    )
    assert first_card.status_code == 200
    assert second_card.status_code == 200

    bulk_response = client.post(
        f"/api/v2/review/decks/{deck_id}/cards/bulk",
        json={
            "ids": [first_card.json()["id"], second_card.json()["id"]],
            "action": "suspend",
        },
    )
    assert bulk_response.status_code == 200
    assert bulk_response.json()["affected"] == 2

    preview_response = client.get(
        "/api/v2/review/export-preview", params={"deck_id": deck_id, "limit": 10}
    )
    assert preview_response.status_code == 200
    preview_body = preview_response.json()
    assert preview_body["deck_id"] == deck_id
    assert preview_body["card_count"] == 2
    assert isinstance(preview_body["cards"][0]["tags"], list)


def test_due_cards_route_supports_limit_and_offset(client) -> None:
    deck_response = client.post("/api/v2/review/decks", json={"name": "Due Pagination Deck"})
    assert deck_response.status_code == 200
    deck_id = deck_response.json()["id"]

    for idx in range(1, 26):
        response = client.post(
            f"/api/v2/review/decks/{deck_id}/cards",
            json={
                "front": f"Front {idx:02d}",
                "back": f"Back {idx:02d}",
                "tags": [],
                "source": "manual",
            },
        )
        assert response.status_code == 200

    first_page = client.get(
        "/api/v2/review/due",
        params={"deck_id": deck_id, "limit": 20, "offset": 0},
    )
    second_page = client.get(
        "/api/v2/review/due",
        params={"deck_id": deck_id, "limit": 20, "offset": 20},
    )

    assert first_page.status_code == 200
    assert second_page.status_code == 200
    assert len(first_page.json()) == 20
    assert len(second_page.json()) == 5
    assert first_page.json()[0]["front"] == "Front 01"
    assert first_page.json()[-1]["front"] == "Front 20"
    assert second_page.json()[0]["front"] == "Front 21"
    assert second_page.json()[-1]["front"] == "Front 25"


def test_sm2_rating_sequence_easy_increases_interval(db_path) -> None:
    repo = ReviewRepository(str(db_path))
    svc = ReviewService(repo)
    deck = repo.create_deck(DeckCreate(name="SM2 Test"))
    apkg = _build_test_apkg([(["Capital of Denmark?", "Copenhagen"], "geo")])
    svc.import_apkg(deck.id, apkg, "test.apkg")
    card = repo.get_due_cards(deck.id)[0]

    svc.answer_card(card.id, "good", deck_id=deck.id)
    after_good = repo.get_card(card.id)
    svc.answer_card(card.id, "easy", deck_id=deck.id)
    after_easy = repo.get_card(card.id)

    assert after_easy.interval > after_good.interval


def test_sm2_rating_again_resets_interval(db_path) -> None:
    repo = ReviewRepository(str(db_path))
    svc = ReviewService(repo)
    deck = repo.create_deck(DeckCreate(name="SM2 Lapse"))
    apkg = _build_test_apkg([(["Question", "Answer"], "")])
    svc.import_apkg(deck.id, apkg, "lapse.apkg")
    card = repo.get_due_cards(deck.id)[0]

    svc.answer_card(card.id, "good", deck_id=deck.id)
    svc.answer_card(card.id, "again", deck_id=deck.id)
    lapsed = repo.get_card(card.id)

    assert lapsed.interval == 1
    assert lapsed.lapse_count == 1


@pytest.mark.anyio
async def test_import_apkg_route_rejects_missing_collection_database(
    _app, db_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="app.domains.review.router")
    transport = ASGITransport(app=_app, client=("127.0.0.1", 12345))

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        create_deck = await client.post(
            "/api/v2/review/decks", json={"name": "APKG Import Validation"}
        )
        assert create_deck.status_code == 200
        deck_id = create_deck.json()["id"]

        response = await client.post(
            f"/api/v2/review/import-apkg?deck_id={deck_id}",
            files={
                "file": (
                    "broken.apkg",
                    _build_zip_payload({"notes.txt": b"no db here"}),
                    "application/zip",
                )
            },
        )

    assert response.status_code == 422
    assert response.json()["detail"] == "APKG missing collection database"
    assert any("APKG import rejected" in record.message for record in caplog.records)


@pytest.mark.anyio
async def test_import_apkg_route_rejects_invalid_collection_database(
    _app, db_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="app.domains.review.router")
    transport = ASGITransport(app=_app, client=("127.0.0.1", 12345))

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        create_deck = await client.post(
            "/api/v2/review/decks", json={"name": "APKG Invalid SQLite"}
        )
        assert create_deck.status_code == 200
        deck_id = create_deck.json()["id"]

        response = await client.post(
            f"/api/v2/review/import-apkg?deck_id={deck_id}",
            files={
                "file": (
                    "invalid.apkg",
                    _build_zip_payload({"collection.anki21": b"not-a-sqlite-db"}),
                    "application/zip",
                )
            },
        )

    assert response.status_code == 422
    assert response.json()["detail"] == "APKG collection database is invalid"
    assert any("APKG import rejected" in record.message for record in caplog.records)
