"""SQL migration loader for the DopaFlow backend."""

from __future__ import annotations

import sqlite3
from pathlib import Path


class MigrationRunner:
    """Apply SQL files from the migrations directory in lexical order."""

    def __init__(self, db_path: str, migrations_dir: str | None = None) -> None:
        self.db_path = db_path
        self.migrations_dir = Path(
            migrations_dir or Path(__file__).resolve().parents[2] / "migrations"
        )

    def run(self) -> None:
        """Execute any SQL migration that has not yet been recorded."""

        self.migrations_dir.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            applied = {
                row[0]
                for row in connection.execute(
                    "SELECT version FROM schema_migrations"
                ).fetchall()
            }
            for migration_path in sorted(self.migrations_dir.glob("*.sql")):
                if migration_path.name in applied:
                    continue
                connection.executescript(migration_path.read_text(encoding="utf-8"))
                connection.execute(
                    "INSERT INTO schema_migrations (version) VALUES (?)",
                    (migration_path.name,),
                )
            connection.commit()
