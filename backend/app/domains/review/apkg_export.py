"""Build minimal APKG-compatible archives for review decks."""

from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import UTC, datetime


def create_apkg(deck: dict, cards: list[dict]) -> tuple[str, bytes]:
    """Create an APKG-like zip payload for deck export."""

    deck_name = deck.get("name", "deck")
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "collection.anki2/collection.conf",
            json.dumps(
                {"creator": "zoesTM", "version": 11, "nextID": len(cards) + 1000}
            ),
        )

        csv_buffer = io.StringIO()
        writer = csv.DictWriter(
            csv_buffer,
            fieldnames=[
                "id",
                "deckID",
                "modelID",
                "did",
                "ord",
                "mod",
                "usn",
                "type",
                "queue",
                "due",
                "ivl",
                "factor",
                "reps",
                "lapses",
                "left",
                "odue",
                "odid",
                "flags",
                "data",
                "front",
                "back",
            ],
        )
        writer.writeheader()

        for index, card in enumerate(cards, 1):
            writer.writerow(
                {
                    "id": card.get("id", str(index)),
                    "deckID": deck["id"],
                    "modelID": "1",
                    "did": "1",
                    "ord": str(index),
                    "mod": str(int(datetime.now(UTC).timestamp())),
                    "usn": "-1",
                    "type": "0",
                    "queue": "0",
                    "due": str(card.get("due", index)),
                    "ivl": str(card.get("interval", 0)),
                    "factor": str(int(float(card.get("ease_factor", 2.5)) * 1000)),
                    "reps": str(card.get("reviews_done", 0)),
                    "lapses": str(card.get("lapse_count", 0)),
                    "left": "0",
                    "odue": "",
                    "odid": "",
                    "flags": "0",
                    "data": "",
                    "front": card.get("front", ""),
                    "back": card.get("back", ""),
                }
            )

        zf.writestr("cards.csv", csv_buffer.getvalue())
        zf.writestr(
            "manifest.json",
            json.dumps(
                {
                    "exportDate": datetime.now(UTC).isoformat(),
                    "deckName": deck_name,
                    "cardCount": len(cards),
                    "schemaVersion": "1",
                }
            ),
        )

    zip_buffer.seek(0)
    return f"{deck_name.replace(' ', '_')}.apkg", zip_buffer.getvalue()
