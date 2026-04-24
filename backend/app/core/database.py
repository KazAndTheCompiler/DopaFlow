"""SQLite database connection and migration runner."""

from __future__ import annotations

import importlib.util
import logging
import pathlib
import sqlite3
from collections.abc import Generator
from contextlib import contextmanager
from hashlib import sha256

import sqlparse
from fastapi import HTTPException

from app.core.config import Settings

if importlib.util.find_spec("libsql_experimental") is not None:
    import libsql_experimental as libsql
else:
    libsql = None

logger = logging.getLogger("dopaflow.db")


def _migrations_dir() -> pathlib.Path:
    """Return the backend migration directory."""

    return pathlib.Path(__file__).parent.parent.parent / "migrations"


def _connect(
    db_path: str, turso_url: str | None = None, turso_token: str | None = None
):
    if turso_url:
        if libsql is None:
            raise ImportError(
                "Install libsql-experimental to use Turso: pip install libsql-experimental"
            )
        return libsql.connect(turso_url, auth_token=turso_token)
    pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    # P1 FIX: Add connection timeout to prevent indefinite hangs
    # 30 seconds is reasonable for most operations
    return sqlite3.connect(db_path, timeout=30.0)


def _resolve_db_config(
    settings_or_db_path: Settings | str,
    turso_url: str | None = None,
    turso_token: str | None = None,
) -> tuple[str, str | None, str | None]:
    if isinstance(settings_or_db_path, Settings):
        return (
            settings_or_db_path.db_path,
            settings_or_db_path.turso_url,
            settings_or_db_path.turso_token,
        )
    return settings_or_db_path, turso_url, turso_token


def _replica_url_for_settings(settings: Settings) -> str | None:
    """Return the replica URL if configured, otherwise None."""
    return getattr(settings, "turso_replica_url", None)


def _prepare_sqlite_connection(conn: sqlite3.Connection) -> None:
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
    except sqlite3.Error as exc:
        logger.exception("SQLite connection setup failed")
        raise RuntimeError("SQLite connection setup failed") from exc


def _prepare_connection(conn) -> None:
    if isinstance(conn, sqlite3.Connection):
        _prepare_sqlite_connection(conn)
        return

    try:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
    except (AttributeError, TypeError, sqlite3.Error) as exc:
        logger.exception("Database connection setup failed")
        raise RuntimeError("Database connection setup failed") from exc


def check_db_health(conn) -> None:
    try:
        conn.execute("PRAGMA user_version").fetchone()
    except (AttributeError, TypeError, sqlite3.Error) as exc:
        logger.exception("Database health check failed")
        raise RuntimeError("Database health check failed") from exc


def _split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []

    for char in sql:
        buffer.append(char)
        if char != ";":
            continue
        candidate = "".join(buffer)
        if sqlite3.complete_statement(candidate):
            statement = candidate.strip()
            if statement:
                statements.append(statement)
            buffer.clear()

    trailing = "".join(buffer).strip()
    if trailing:
        statements.append(trailing)

    return statements


def _migration_checksum(sql: str) -> str:
    return sha256(sql.encode("utf-8")).hexdigest()


def _ensure_migrations_table(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS _migrations (
            filename TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT NOT NULL DEFAULT ''
        )
        """
    )

    columns = {
        row[1] for row in conn.execute("PRAGMA table_info(_migrations)").fetchall()
    }
    if "checksum" not in columns:
        conn.execute(
            "ALTER TABLE _migrations ADD COLUMN checksum TEXT NOT NULL DEFAULT ''"
        )


def _apply_migration_sql(conn, sql: str) -> None:
    """Execute a full migration script while preserving SQL bodies intact."""

    if isinstance(conn, sqlite3.Connection):
        conn.executescript(sql)
        return

    for statement in sqlparse.split(sql):
        cleaned = statement.strip()
        if cleaned:
            conn.execute(cleaned)


def run_migrations(
    settings_or_db_path: Settings | str,
    turso_url: str | None = None,
    turso_token: str | None = None,
) -> None:
    """Apply all pending SQL migrations in order."""

    db_path, turso_url, turso_token = _resolve_db_config(
        settings_or_db_path,
        turso_url=turso_url,
        turso_token=turso_token,
    )
    conn = _connect(db_path, turso_url=turso_url, turso_token=turso_token)
    _prepare_connection(conn)
    check_db_health(conn)
    _ensure_migrations_table(conn)
    applied = {
        row[0]: row[1]
        for row in conn.execute("SELECT filename, checksum FROM _migrations").fetchall()
    }
    migration_files = sorted(_migrations_dir().glob("*.sql"))
    for migration_file in migration_files:
        sql = migration_file.read_text(encoding="utf-8")
        checksum = _migration_checksum(sql)
        applied_checksum = applied.get(migration_file.name)
        if applied_checksum is not None:
            if applied_checksum and applied_checksum != checksum:
                raise RuntimeError(
                    f"Migration drift detected: applied migration '{migration_file.name}' "
                    f"has been modified since it was applied. "
                    f"Applied checksum: {applied_checksum}, "
                    f"current file checksum: {checksum}. "
                    f"Previously applied migrations must not be changed."
                )
            if not applied_checksum:
                conn.execute(
                    "UPDATE _migrations SET checksum = ? WHERE filename = ?",
                    (checksum, migration_file.name),
                )
            continue

        logger.info("Applying migration: %s", migration_file.name)
        try:
            conn.execute("BEGIN")
            _apply_migration_sql(conn, sql)
            conn.execute(
                "INSERT INTO _migrations (filename, checksum) VALUES (?, ?)",
                (migration_file.name, checksum),
            )
            conn.execute("COMMIT")
            logger.info("Migration applied: %s", migration_file.name)
        except Exception:
            conn.execute("ROLLBACK")
            logger.exception("Migration failed, rolled back: %s", migration_file.name)
            raise
    conn.close()


@contextmanager
def get_db(
    settings_or_db_path: Settings | str,
    turso_url: str | None = None,
    turso_token: str | None = None,
) -> Generator[sqlite3.Connection, None, None]:
    """Yield a SQLite connection with WAL and foreign keys enabled."""

    db_path, turso_url, turso_token = _resolve_db_config(
        settings_or_db_path,
        turso_url=turso_url,
        turso_token=turso_token,
    )
    conn = _connect(db_path, turso_url=turso_url, turso_token=turso_token)
    _prepare_connection(conn)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def tx(
    settings_or_db_path: Settings | str,
    turso_url: str | None = None,
    turso_token: str | None = None,
) -> Generator[sqlite3.Connection, None, None]:
    """Yield a connection inside an explicit transaction."""

    db_path, turso_url, turso_token = _resolve_db_config(
        settings_or_db_path,
        turso_url=turso_url,
        turso_token=turso_token,
    )
    conn = _connect(db_path, turso_url=turso_url, turso_token=turso_token)
    # P1 FIX: Wrap _prepare_connection in try/finally to ensure cleanup
    try:
        _prepare_connection(conn)
        yield conn
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if isinstance(exc, (HTTPException, ValueError)):
            logger.debug("Transaction rolled back for expected error: %s", exc)
        else:
            logger.exception("Transaction failed, rolling back")
        raise
    finally:
        conn.close()


@contextmanager
def get_db_readonly(
    settings: Settings,
) -> Generator[sqlite3.Connection, None, None]:
    """Yield a read-only database connection.

    Uses turso_replica_url if configured, falling back to the primary
    turso_url or local SQLite. Use this for read-heavy paths that do
    not need write access — it allows horizontal read scaling via
    Turso replicas.
    """

    replica_url = _replica_url_for_settings(settings)
    turso_url = replica_url if replica_url else settings.turso_url
    turso_token = settings.turso_token if settings.turso_url else None

    if turso_url:
        if libsql is None:
            raise ImportError(
                "Install libsql-experimental to use Turso: pip install libsql-experimental"
            )
        conn = libsql.connect(turso_url, auth_token=turso_token)
    else:
        conn = sqlite3.connect(settings.db_path)

    _prepare_connection(conn)
    try:
        yield conn
    finally:
        conn.close()
