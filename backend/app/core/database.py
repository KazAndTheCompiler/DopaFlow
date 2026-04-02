"""SQLite database connection and migration runner."""

from __future__ import annotations

import logging
import pathlib
import sqlite3
from contextlib import contextmanager
from typing import Generator

try:
    import libsql_experimental as libsql
except ModuleNotFoundError:  # pragma: no cover - optional dependency in local dev
    libsql = None

logger = logging.getLogger("dopaflow.db")


def _migrations_dir() -> pathlib.Path:
    """Return the backend migration directory."""

    return pathlib.Path(__file__).parent.parent.parent / "migrations"


def _connect(db_path: str, turso_url: str | None = None, turso_token: str | None = None):
    if turso_url:
        if libsql is None:
            raise RuntimeError("libsql-experimental is required when turso_url is configured")
        return libsql.connect(turso_url, auth_token=turso_token)
    pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(db_path)


def _prepare_connection(conn) -> None:
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    except Exception:
        logger.exception("Failed to set PRAGMA journal_mode=WAL")
    try:
        conn.execute("PRAGMA foreign_keys=ON")
    except Exception:
        logger.exception("Failed to set PRAGMA foreign_keys=ON")
    try:
        conn.row_factory = sqlite3.Row
    except Exception:
        logger.exception("Failed to set row_factory")


def run_migrations(db_path: str, turso_url: str | None = None, turso_token: str | None = None) -> None:
    """Apply all pending SQL migrations in order."""

    conn = _connect(db_path, turso_url=turso_url, turso_token=turso_token)
    _prepare_connection(conn)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS _migrations (
            filename TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    applied = {row[0] for row in conn.execute("SELECT filename FROM _migrations").fetchall()}
    migration_files = sorted(_migrations_dir().glob("*.sql"))
    for migration_file in migration_files:
        if migration_file.name not in applied:
            logger.info("Applying migration: %s", migration_file.name)
            sql = migration_file.read_text()
            try:
                conn.execute("BEGIN")
                for statement in sql.split(";"):
                    statement = statement.strip()
                    if statement:
                        conn.execute(statement)
                conn.execute("INSERT INTO _migrations (filename) VALUES (?)", (migration_file.name,))
                conn.execute("COMMIT")
                logger.info("Migration applied: %s", migration_file.name)
            except Exception:
                conn.execute("ROLLBACK")
                logger.exception("Migration failed, rolled back: %s", migration_file.name)
                raise
    conn.close()


@contextmanager
def get_db(db_path: str, turso_url: str | None = None, turso_token: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    """Yield a SQLite connection with WAL and foreign keys enabled."""

    conn = _connect(db_path, turso_url=turso_url, turso_token=turso_token)
    _prepare_connection(conn)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def tx(db_path: str, turso_url: str | None = None, turso_token: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    """Yield a connection inside an explicit transaction."""

    conn = _connect(db_path, turso_url=turso_url, turso_token=turso_token)
    _prepare_connection(conn)
    try:
        yield conn
        conn.commit()
    except Exception:
        logger.exception("Transaction failed, rolling back")
        conn.rollback()
        raise
    finally:
        conn.close()
