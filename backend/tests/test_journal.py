from __future__ import annotations

from pathlib import Path


def create_entry(client, **overrides):
    payload = {
        "date": "2026-03-25",
        "markdown_body": "Daily note",
        "emoji": "🙂",
        "tags": ["daily"],
    }
    payload.update(overrides)
    response = client.post("/api/v2/journal/entries", json=payload)
    assert response.status_code == 201
    return response.json()


def test_create_entry_returns_id(client) -> None:
    entry = create_entry(client)

    assert entry["id"].startswith("jrn_")
    assert entry["date"] == "2026-03-25"


def test_list_entries_returns_saved_entries(client) -> None:
    entry = create_entry(client)

    response = client.get("/api/v2/journal/entries")

    assert response.status_code == 200
    assert response.json()[0]["id"] == entry["id"]


def test_get_entry_by_id(client) -> None:
    entry = create_entry(client)

    response = client.get(f"/api/v2/journal/entries/{entry['id']}")

    assert response.status_code == 200
    assert response.json()["markdown_body"] == "Daily note"


def test_saving_same_date_updates_entry_and_increments_version(client) -> None:
    first = create_entry(client)

    response = client.post(
        "/api/v2/journal/entries",
        json={"date": "2026-03-25", "markdown_body": "Updated body", "emoji": None, "tags": ["daily", "updated"]},
    )

    assert response.status_code == 201
    assert response.json()["id"] == first["id"]
    assert response.json()["version"] == 2
    assert response.json()["markdown_body"] == "Updated body"


def test_delete_entry_removes_it_from_reads(client) -> None:
    entry = create_entry(client)

    delete_response = client.delete(f"/api/v2/journal/entries/{entry['id']}")
    get_response = client.get(f"/api/v2/journal/entries/{entry['id']}")

    assert delete_response.status_code == 200
    assert delete_response.json()["deleted"] is True
    assert get_response.status_code == 404


def test_graph_and_backlinks_return_wikilink_structure(client) -> None:
    target = create_entry(client, date="2026-03-24", markdown_body="Target day")
    source = create_entry(client, date="2026-03-25", markdown_body="Links to [[2026-03-24]]")

    graph_response = client.get("/api/v2/journal/graph")
    backlinks_response = client.get("/api/v2/journal/2026-03-24/backlinks")

    assert graph_response.status_code == 200
    assert any(node["id"] == "2026-03-24" for node in graph_response.json()["nodes"])
    assert any(edge["source"] == source["id"] for edge in graph_response.json()["edges"])
    assert backlinks_response.json() == [source["id"]]
    assert target["id"].startswith("jrn_")


def test_backup_status_and_trigger_create_markdown_backup(client, tmp_path) -> None:
    create_entry(client)

    status_response = client.get("/api/v2/journal/backup-status")
    trigger_response = client.post("/api/v2/journal/backup/trigger", params={"date": "2026-03-25"})

    assert status_response.status_code == 200
    assert trigger_response.status_code == 200
    backup_file = tmp_path / ".local" / "share" / "ZoesTM" / "journal-backup" / "2026-03-25.md"
    assert backup_file.exists()
    assert "Daily note" in backup_file.read_text(encoding="utf-8")
