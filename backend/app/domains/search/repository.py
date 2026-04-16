"""Repository for cross-domain SQL search queries."""

from __future__ import annotations

from app.core.base_repository import BaseRepository
from app.core.config import Settings


class SearchRepository(BaseRepository):
    """Search tasks, habits, journal entries, and review cards."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)

    @staticmethod
    def _to_result(row) -> dict:
        data = dict(row)
        body = str(data.get("body") or "")
        data["snippet"] = body[:120] + ("..." if len(body) > 120 else "")
        data.pop("body", None)
        return data

    def search(
        self,
        query: str,
        types: list[str] | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> list[dict]:
        """
        Search tasks, habits, journal entries, and review cards for query.
        Returns list of result dicts with: id, type, title, snippet, date.
        """
        results: list[dict] = []
        like = f"%{query}%"
        with self.get_db_readonly() as conn:
            if not types or "tasks" in types:
                rows = conn.execute(
                    """
                    SELECT id, 'task' AS type, title, COALESCE(description, '') AS body, created_at AS date
                    FROM tasks
                    WHERE (title LIKE ? OR COALESCE(description, '') LIKE ?)
                      AND (? IS NULL OR created_at >= ?)
                      AND (? IS NULL OR created_at <= ?)
                    LIMIT 20
                    """,
                    (like, like, from_date, from_date, to_date, to_date),
                ).fetchall()
                results += [self._to_result(row) for row in rows]
            if not types or "journal" in types:
                rows = conn.execute(
                    """
                    SELECT id, 'journal' AS type, entry_date AS title, markdown_body AS body, entry_date AS date
                    FROM journal_entries
                    WHERE deleted_at IS NULL
                      AND (entry_date LIKE ? OR markdown_body LIKE ?)
                    LIMIT 20
                    """,
                    (like, like),
                ).fetchall()
                results += [self._to_result(row) for row in rows]
            if not types or "habits" in types:
                rows = conn.execute(
                    """
                    SELECT id, 'habit' AS type, name AS title, '' AS body, created_at AS date
                    FROM habits WHERE name LIKE ? LIMIT 10
                    """,
                    (like,),
                ).fetchall()
                results += [self._to_result(row) for row in rows]
            if not types or "review" in types:
                rows = conn.execute(
                    """
                    SELECT id, 'review' AS type, front AS title, back AS body, next_review_at AS date
                    FROM review_cards WHERE (front LIKE ? OR back LIKE ?) LIMIT 10
                    """,
                    (like, like),
                ).fetchall()
                results += [self._to_result(row) for row in rows]
        results.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
        return results[:40]