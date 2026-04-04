from __future__ import annotations


def test_packy_lorebook_allows_multiple_updates_in_same_second(client) -> None:
    first = client.post("/api/v2/packy/lorebook", json={"headline": "one", "body": "body"})
    second = client.post("/api/v2/packy/lorebook", json={"headline": "two", "body": "body"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] != second.json()["id"]
