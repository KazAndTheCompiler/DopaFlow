"""Cross-domain SQL search helpers."""

from __future__ import annotations

from app.domains.search.repository import SearchRepository


def search(
    query: str,
    db_path: str,
    types: list[str] | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    """
    Search tasks, habits, journal entries, and review cards for query.
    Returns list of result dicts with: id, type, title, snippet, date.
    """
    repo = SearchRepository(db_path)
    return repo.search(query, types=types, from_date=from_date, to_date=to_date)
