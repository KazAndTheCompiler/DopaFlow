from __future__ import annotations

from pathlib import Path

import pytest
import sqlite3

from app.core.database import get_db, run_migrations, tx


def test_run_migrations_works_without_turso(tmp_path: Path) -> None:
    db_path = tmp_path / "local.sqlite3"

    run_migrations(str(db_path), turso_url=None, turso_token=None)

    assert db_path.exists()


def test_get_db_yields_connection_without_turso(tmp_path: Path) -> None:
    db_path = tmp_path / "local.sqlite3"
    run_migrations(str(db_path))

    with get_db(str(db_path), turso_url=None, turso_token=None) as conn:
        row = conn.execute("SELECT COUNT(*) FROM _migrations").fetchone()

    assert row[0] >= 1


def test_tx_commits_without_turso(tmp_path: Path) -> None:
    db_path = tmp_path / "local.sqlite3"
    run_migrations(str(db_path))

    with tx(str(db_path), turso_url=None, turso_token=None) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS scratch (value TEXT)")
        conn.execute("INSERT INTO scratch(value) VALUES ('ok')")

    with get_db(str(db_path)) as conn:
        row = conn.execute("SELECT value FROM scratch").fetchone()

    assert row[0] == "ok"


def test_run_migrations_supports_trigger_bodies_with_semicolons(tmp_path: Path) -> None:
    db_path = tmp_path / "trigger.sqlite3"
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    (migrations_dir / "001_trigger.sql").write_text(
        """
        CREATE TABLE example (
            id INTEGER PRIMARY KEY,
            value TEXT NOT NULL,
            touched INTEGER NOT NULL DEFAULT 0
        );

        CREATE TRIGGER example_touch
        AFTER UPDATE ON example
        BEGIN
            UPDATE example SET touched = 1 WHERE id = NEW.id;
        END;
        """,
        encoding="utf-8",
    )

    from app.core import database as database_module

    original = database_module._migrations_dir
    database_module._migrations_dir = lambda: migrations_dir
    try:
        run_migrations(str(db_path))
    finally:
        database_module._migrations_dir = original

    with get_db(str(db_path)) as conn:
        conn.execute("INSERT INTO example (id, value) VALUES (1, 'before')")
        conn.execute("UPDATE example SET value = 'after' WHERE id = 1")
        row = conn.execute("SELECT touched FROM example WHERE id = 1").fetchone()

    assert row[0] == 1


def test_get_db_fails_fast_when_sqlite_setup_breaks(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import database as database_module

    class BrokenConnection:
        def execute(self, _sql: str):
            raise sqlite3.OperationalError("boom")

        def close(self) -> None:
            return None

    monkeypatch.setattr(database_module, "_connect", lambda *args, **kwargs: BrokenConnection())

    with pytest.raises(RuntimeError, match="Database connection setup failed"):
        with get_db("/tmp/unused.sqlite3"):
            pass
