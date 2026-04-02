"""APKG-compliant export and import for review decks."""

# ENDPOINTS
#   GET    /review/decks/{deck_id}/apkg          — download .apkg file
#   POST   /review/decks/{deck_id}/export-apkg   — export as base64 JSON
#   POST   /review/import-apkg                   — import a .apkg file
#   GET    /review/deck-names                     — list deck names

from __future__ import annotations

import base64
import csv
import io
import json
import logging
import uuid
import zipfile
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.core.config import Settings, get_settings_dependency
from app.core.database import get_db, tx
from app.services.upload_security import validate_upload

router = APIRouter(tags=["review"])
logger = logging.getLogger(__name__)


# ── APKG builder ─────────────────────────────────────────────────────────────

def _create_apkg(deck_id: str, db_path: str) -> tuple[str, bytes]:
    with get_db(db_path) as conn:
        deck = conn.execute("SELECT * FROM review_decks WHERE id=?", (deck_id,)).fetchone()
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
        cards = conn.execute("SELECT * FROM review_cards WHERE deck_id=?", (deck_id,)).fetchall()

    if not cards:
        raise HTTPException(status_code=404, detail="No cards in deck")

    deck_name = deck["name"]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # collection.conf
        zf.writestr(
            "collection.anki2/collection.conf",
            json.dumps({
                "creator": "DopaFlow",
                "curDecks": {"1": {"name": deck_name}},
                "mod": int(datetime.now(UTC).timestamp()),
                "nextID": 100000000,
                "sortFieldName": "noteField1",
                "sortOrder": 0,
                "srcRevNumber": 1,
                "usn": 0,
                "yaml": f"deckOrder: 1\ngid: {uuid.uuid4()}",
            }, indent=2),
        )

        # notes1.csv
        notes_buf = io.StringIO()
        notes_writer = csv.writer(notes_buf)
        notes_writer.writerow(["id", "guid", "mid", "nfd", "usn", "mod", "tag", "flds", "sfld", "csum", "flags", "data", "dupe", "model"])
        for i, card in enumerate(cards):
            tags_raw = card["tags_json"] if "tags_json" in card.keys() else "[]"
            try:
                tags = json.loads(tags_raw or "[]")
            except Exception:  # noqa: BLE001
                tags = []
            notes_writer.writerow([
                i + 1,
                str(uuid.uuid4()),
                1, 0, 0,
                int(datetime.now(UTC).timestamp()),
                "|".join(tags),
                f"{card['front']}|||{card['back']}",
                card["front"],
                0, 0, "", 0, 1,
            ])
        zf.writestr("collection.anki2/notes1.csv", notes_buf.getvalue())

        # models1.json
        zf.writestr(
            "collection.anki2/models1.json",
            json.dumps([{
                "id": 1,
                "name": "DopaFlow card",
                "flds": [
                    {"name": "Front", "ord": 0, "sticky": False, "rtl": False, "font": "Arial,11px"},
                    {"name": "Back", "ord": 1, "sticky": False, "rtl": False, "font": "Arial,11px"},
                ],
                "css": "card { font-family: Arial; font-size: 11px; }",
                "tmpls": [{"name": "Card 1", "ord": 0, "qfmt": "{{Front}}", "afmt": "{{FrontSide}}<hr>{{Back}}", "did": 1}],
                "cat": "DopaFlow",
            }]),
        )

        # cards.csv
        cards_buf = io.StringIO()
        cards_writer = csv.writer(cards_buf)
        cards_writer.writerow(["nid", "ord", "did", "mod", "usn", "due", "odue", "type", "queue", "ivl", "left", "odid", "flags", "data"])
        for i, card in enumerate(cards):
            nxt = card["next_review_at"] if "next_review_at" in card.keys() else None
            try:
                due = int(datetime.fromisoformat(str(nxt).replace("Z", "+00:00")).timestamp()) if nxt else int(datetime.now(UTC).timestamp())
            except Exception:  # noqa: BLE001
                due = int(datetime.now(UTC).timestamp())
            ivl = int(card["last_interval_days"]) if "last_interval_days" in card.keys() and card["last_interval_days"] else 1
            cards_writer.writerow([i + 1, 0, 1, int(datetime.now(UTC).timestamp()), 0, due, 0, 1, 0, ivl, 0, 0, 0, ""])
        zf.writestr("collection.anki2/cards.csv", cards_buf.getvalue())

    buf.seek(0)
    return f"{deck_id}.apkg", buf.getvalue()


# ── endpoints ────────────────────────────────────────────────────────────────

@router.get("/review/decks/{deck_id}/apkg")
async def download_apkg(deck_id: str, settings: Settings = Depends(get_settings_dependency)) -> Response:
    """Download a deck as a proper .apkg file (Anki-compatible)."""
    filename, apkg_bytes = _create_apkg(deck_id, settings.db_path)
    return Response(
        content=apkg_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/review/decks/{deck_id}/export-apkg")
async def export_apkg(deck_id: str, settings: Settings = Depends(get_settings_dependency)) -> dict[str, object]:
    """Export a deck as a base64-encoded .apkg (for API consumers)."""
    filename, apkg_bytes = _create_apkg(deck_id, settings.db_path)
    return {
        "filename": filename,
        "content_type": "application/zip",
        "encoding": "base64",
        "size": len(apkg_bytes),
        "data": base64.b64encode(apkg_bytes).decode("utf-8"),
    }


@router.post("/review/import-apkg")
async def import_apkg(
    file: UploadFile = File(...),
    target_deck_name: str | None = None,
    settings: Settings = Depends(get_settings_dependency),
) -> dict[str, object]:
    """Import a .apkg file and create cards."""
    content, _ = validate_upload(
        file,
        kind="zip",
        allowed_suffixes={".apkg"},
        default_max_bytes=25 * 1024 * 1024,
    )
    deck_name = target_deck_name or f"imported_deck_{uuid.uuid4().hex[:8]}"
    zf_buf = io.BytesIO(content)
    try:
        with zipfile.ZipFile(zf_buf, "r") as zf:
            # Try to read deck name from collection.conf
            try:
                conf = json.loads(zf.read("collection.anki2/collection.conf").decode("utf-8"))
                decks = conf.get("curDecks", {})
                if decks:
                    first = next(iter(decks.values()))
                    inferred = first.get("name")
                    if inferred:
                        deck_name = inferred
            except Exception:  # noqa: BLE001
                pass

            # Read notes
            try:
                notes_csv = zf.read("collection.anki2/notes1.csv").decode("utf-8")
            except KeyError:
                raise HTTPException(status_code=400, detail="APKG missing notes1.csv")

            notes = list(csv.DictReader(notes_csv.splitlines()))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to parse APKG file")
        raise HTTPException(status_code=400, detail=f"Failed to parse APKG: {exc}") from exc

    with get_db(settings.db_path) as conn:
        existing = conn.execute("SELECT id FROM review_decks WHERE name=?", (deck_name,)).fetchone()
        deck_id = existing["id"] if existing else None

    if not deck_id:
        deck_id = str(uuid.uuid4())
        with tx(settings.db_path) as conn:
            conn.execute(
                "INSERT INTO review_decks(id, name) VALUES(?,?)",
                (deck_id, deck_name),
            )

    created = 0
    with tx(settings.db_path) as conn:
        for note in notes:
            front = note.get("sfld", "").strip()
            flds = note.get("flds", "")
            back = flds.split("|||")[1].strip() if "|||" in flds else flds.strip()
            if not front or not back:
                continue
            tags_str = note.get("tag", "")
            tags = [t.strip() for t in tags_str.split("|") if t.strip()]
            conn.execute(
                "INSERT INTO review_cards(id, deck_id, front, back, tags_json) VALUES(?,?,?,?,?)",
                (str(uuid.uuid4()), deck_id, front, back, json.dumps(tags)),
            )
            created += 1

    return {"success": True, "deck_id": deck_id, "deck_name": deck_name, "cards_created": created}


@router.get("/review/deck-names")
async def list_deck_names(settings: Settings = Depends(get_settings_dependency)) -> dict[str, list[str]]:
    """Get a simple list of deck names for UI selection."""
    with get_db(settings.db_path) as conn:
        rows = conn.execute("SELECT name FROM review_decks ORDER BY name").fetchall()
    return {"decks": [r["name"] for r in rows]}
