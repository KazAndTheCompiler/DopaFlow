"""SQLite repository for the goals domain."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.core.base_repository import BaseRepository


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _serialize_goal(conn, row) -> dict:
    milestones = conn.execute(
        """
        SELECT id, label, done, completed_at
        FROM goal_milestones
        WHERE goal_id = ?
        ORDER BY position ASC, created_at ASC
        """,
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "horizon": row["horizon"],
        "milestones": [
            {
                "id": milestone["id"],
                "label": milestone["label"],
                "done": bool(milestone["done"]),
                "completed_at": milestone["completed_at"],
            }
            for milestone in milestones
        ],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "done": bool(row["done"]),
    }


class GoalRepository(BaseRepository):
    """Repository for goal and milestone CRUD."""

    def list_goals(self) -> list[dict]:
        with self.get_db_readonly() as conn:
            rows = conn.execute(
                """
                SELECT id, title, description, horizon, done, created_at, updated_at
                FROM goals
                ORDER BY done ASC, created_at DESC
                """
            ).fetchall()
            return [_serialize_goal(conn, row) for row in rows]

    def create_goal(self, payload: dict) -> dict:
        goal_id = str(uuid4())
        now = _now()
        milestone_labels = [
            label.strip() for label in payload.get("milestone_labels", []) if label.strip()
        ]
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO goals(id, title, description, horizon, done, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    goal_id,
                    payload["title"].strip(),
                    payload.get("description"),
                    payload.get("horizon", "quarter"),
                    now,
                    now,
                ),
            )
            for index, label in enumerate(milestone_labels):
                conn.execute(
                    """
                    INSERT INTO goal_milestones(id, goal_id, label, done, position, created_at)
                    VALUES (?, ?, ?, 0, ?, ?)
                    """,
                    (str(uuid4()), goal_id, label, index, now),
                )
            row = conn.execute(
                "SELECT id, title, description, horizon, done, created_at, updated_at FROM goals WHERE id = ?",
                (goal_id,),
            ).fetchone()
            return _serialize_goal(conn, row)

    def delete_goal(self, goal_id: str) -> bool:
        with self.tx() as conn:
            result = conn.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
            return result.rowcount > 0

    def add_milestone(self, goal_id: str, label: str) -> dict | None:
        now = _now()
        with self.tx() as conn:
            goal = conn.execute(
                "SELECT id, title, description, horizon, done, created_at, updated_at FROM goals WHERE id = ?",
                (goal_id,),
            ).fetchone()
            if goal is None:
                return None
            position_row = conn.execute(
                "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM goal_milestones WHERE goal_id = ?",
                (goal_id,),
            ).fetchone()
            conn.execute(
                """
                INSERT INTO goal_milestones(id, goal_id, label, done, position, created_at)
                VALUES (?, ?, ?, 0, ?, ?)
                """,
                (str(uuid4()), goal_id, label.strip(), position_row["next_position"], now),
            )
            conn.execute(
                "UPDATE goals SET done = 0, updated_at = ? WHERE id = ?", (now, goal_id)
            )
            updated = conn.execute(
                "SELECT id, title, description, horizon, done, created_at, updated_at FROM goals WHERE id = ?",
                (goal_id,),
            ).fetchone()
            return _serialize_goal(conn, updated)

    def complete_milestone(self, goal_id: str, milestone_id: str) -> dict | None:
        now = _now()
        with self.tx() as conn:
            goal = conn.execute(
                "SELECT id, title, description, horizon, done, created_at, updated_at FROM goals WHERE id = ?",
                (goal_id,),
            ).fetchone()
            if goal is None:
                return None
            updated = conn.execute(
                """
                UPDATE goal_milestones
                SET done = 1, completed_at = ?
                WHERE id = ? AND goal_id = ?
                """,
                (now, milestone_id, goal_id),
            )
            if updated.rowcount == 0:
                return None
            counts = conn.execute(
                """
                SELECT
                    COUNT(*) AS total_count,
                    SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done_count
                FROM goal_milestones
                WHERE goal_id = ?
                """,
                (goal_id,),
            ).fetchone()
            goal_done = (
                bool(counts["total_count"])
                and counts["done_count"] == counts["total_count"]
            )
            conn.execute(
                "UPDATE goals SET done = ?, updated_at = ? WHERE id = ?",
                (1 if goal_done else 0, now, goal_id),
            )
            fresh = conn.execute(
                "SELECT id, title, description, horizon, done, created_at, updated_at FROM goals WHERE id = ?",
                (goal_id,),
            ).fetchone()
            return _serialize_goal(conn, fresh)
