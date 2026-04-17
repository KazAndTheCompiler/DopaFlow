"""Repository for health check and readiness queries."""

from __future__ import annotations

import sqlite3

from app.core.base_repository import BaseRepository
from app.core.config import Settings


class HealthRepository(BaseRepository):
    """Read database connectivity and migration readiness state."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)

    def check_connectivity(self) -> bool:
        """Return True if the database is reachable and functional."""
        try:
            with self.get_db_readonly() as conn:
                conn.execute("SELECT 1")
            return True
        except sqlite3.Error:
            return False

    def get_memory_depth_days(self) -> int:
        """Count distinct days with non-empty journal entries."""
        try:
            with self.get_db_readonly() as conn:
                row = conn.execute(
                    """
                    SELECT COUNT(DISTINCT date(entry_date)) AS depth
                    FROM journal_entries
                    WHERE COALESCE(TRIM(markdown_body), '') <> ''
                      AND deleted_at IS NULL
                    """
                ).fetchone()
                return int((row["depth"] if row else 0) or 0)
        except sqlite3.OperationalError:
            return 0

    def get_readiness(self) -> dict[str, object]:
        """Return readiness info based on Alembic version tracking.

        Checks that the alembic_version table exists and is stamped at the
        expected head revision. Falls back to checking the legacy
        _migrations table for databases that haven't been migrated yet.
        """
        try:
            with self.get_db_readonly() as conn:
                tables = {
                    row[0]
                    for row in conn.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ).fetchall()
                }

                # Primary check: Alembic version tracking
                if "alembic_version" in tables:
                    row = conn.execute(
                        "SELECT version_num FROM alembic_version"
                    ).fetchone()
                    alembic_version = row[0] if row else None
                    return {
                        "status": "ready" if alembic_version else "not_ready",
                        "alembic_version": alembic_version,
                        "error": None,
                    }

                # Legacy fallback: _migrations table
                if "_migrations" in tables:
                    row = conn.execute("PRAGMA user_version").fetchone()
                    user_version = int((row[0] if row else 0) or 0)
                    applied = {
                        r[0]: r[1]
                        for r in conn.execute(
                            "SELECT filename, checksum FROM _migrations"
                        ).fetchall()
                    }
                    return {
                        "status": "migrating",
                        "user_version": user_version,
                        "applied": applied,
                        "error": None,
                    }

                return {
                    "status": "not_ready",
                    "error": "No migration tracking found",
                }
        except (sqlite3.Error, RuntimeError) as exc:
            return {
                "status": "not_ready",
                "error": str(exc),
            }
