from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.core.config import Settings
from app.core.database import get_db, run_migrations, tx


def test_run_migrations_works_without_turso(tmp_path: Path) -> None:
    db_path = tmp_path / "local.sqlite3"

    run_migrations(str(db_path), turso_url=None, turso_token=None)

    assert db_path.exists()
    with get_db(str(db_path)) as conn:
        columns = {
            row[1] for row in conn.execute("PRAGMA table_info(_migrations)").fetchall()
        }
        assert "checksum" in columns


def test_get_db_yields_connection_without_turso(tmp_path: Path) -> None:
    db_path = tmp_path / "local.sqlite3"
    run_migrations(str(db_path))

    with get_db(str(db_path), turso_url=None, turso_token=None) as conn:
        row = conn.execute("SELECT COUNT(*) FROM _migrations").fetchone()

    assert row[0] >= 1


def test_get_db_accepts_settings_object(tmp_path: Path) -> None:
    db_path = tmp_path / "settings.sqlite3"
    settings = Settings(db_path=str(db_path), turso_url=None, turso_token=None)
    run_migrations(settings)

    with get_db(settings) as conn:
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


def test_tx_accepts_settings_object(tmp_path: Path) -> None:
    db_path = tmp_path / "settings-tx.sqlite3"
    settings = Settings(db_path=str(db_path), turso_url=None, turso_token=None)
    run_migrations(settings)

    with tx(settings) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS scratch (value TEXT)")
        conn.execute("INSERT INTO scratch(value) VALUES ('ok')")

    with get_db(settings) as conn:
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


def test_apply_migration_sql_preserves_trigger_bodies_for_non_sqlite_connections() -> (
    None
):
    from app.core import database as database_module

    sql = """
    CREATE TABLE example (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TRIGGER example_touch
    AFTER UPDATE ON example
    BEGIN
        UPDATE example SET value = 'semi;colon' WHERE id = NEW.id;
    END;
    """

    class FakeConnection:
        def __init__(self) -> None:
            self.statements: list[str] = []
            self.row_factory = None

        def execute(self, statement: str, *_args, **_kwargs):
            self.statements.append(statement)
            return []

    conn = FakeConnection()

    database_module._apply_migration_sql(conn, sql)

    assert conn.statements == [
        """
    CREATE TABLE example (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL
    );
    """.strip(),
        """
    CREATE TRIGGER example_touch
    AFTER UPDATE ON example
    BEGIN
        UPDATE example SET value = 'semi;colon' WHERE id = NEW.id;
    END;
    """.strip(),
    ]


def test_run_migrations_rejects_modified_applied_migration(tmp_path: Path) -> None:
    db_path = tmp_path / "checksums.sqlite3"
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    migration = migrations_dir / "001_example.sql"
    migration.write_text(
        "CREATE TABLE sample (id INTEGER PRIMARY KEY);\n", encoding="utf-8"
    )

    from app.core import database as database_module

    original = database_module._migrations_dir
    database_module._migrations_dir = lambda: migrations_dir
    try:
        run_migrations(str(db_path))
        migration.write_text(
            "CREATE TABLE sample (id INTEGER PRIMARY KEY, label TEXT);\n",
            encoding="utf-8",
        )
        with pytest.raises(RuntimeError, match="Migration drift detected"):
            run_migrations(str(db_path))
    finally:
        database_module._migrations_dir = original


def test_run_migrations_is_idempotent_across_full_suite(tmp_path: Path) -> None:
    db_path = tmp_path / "idempotent.sqlite3"

    run_migrations(str(db_path))
    with get_db(str(db_path)) as conn:
        first_migration_count = conn.execute(
            "SELECT COUNT(*) FROM _migrations"
        ).fetchone()[0]
        first_tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        }

    run_migrations(str(db_path))
    with get_db(str(db_path)) as conn:
        second_migration_count = conn.execute(
            "SELECT COUNT(*) FROM _migrations"
        ).fetchone()[0]
        second_tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        }

    assert second_migration_count == first_migration_count
    assert second_tables == first_tables


def test_run_migrations_is_idempotent_on_in_memory_database() -> None:
    # Test that running migrations twice on an in-memory database doesn't cause errors
    # Note: :memory: databases don't persist across connections, so we can't test
    # for duplicate rows in _migrations table across separate calls
    db_path = ":memory:"

    # First run - should complete without error
    run_migrations(db_path)

    # Second run - should also complete without error
    run_migrations(db_path)


def test_get_db_fails_fast_when_sqlite_setup_breaks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import database as database_module

    class BrokenConnection:
        def execute(self, _sql: str):
            raise sqlite3.OperationalError("boom")

        def close(self) -> None:
            return None

    monkeypatch.setattr(
        database_module, "_connect", lambda *args, **kwargs: BrokenConnection()
    )

    with pytest.raises(RuntimeError, match="Database connection setup failed"):
        with get_db("/tmp/unused.sqlite3"):
            pass


def test_get_db_raises_clear_import_error_when_turso_dependency_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import database as database_module

    monkeypatch.setattr(database_module, "libsql", None)

    with pytest.raises(
        ImportError,
        match="Install libsql-experimental to use Turso: pip install libsql-experimental",
    ):
        with get_db("/tmp/unused.sqlite3", turso_url="libsql://example.turso.io"):
            pass


def test_run_migrations_fails_fast_when_health_check_breaks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import database as database_module

    class BrokenHealthConnection:
        row_factory = None

        def execute(self, sql: str, *_args, **_kwargs):
            if sql == "PRAGMA foreign_keys=ON":
                return self
            if sql == "PRAGMA user_version":
                raise sqlite3.OperationalError("disk I/O error")
            return self

        def fetchone(self):
            return (0,)

        def close(self) -> None:
            return None

    monkeypatch.setattr(
        database_module, "_connect", lambda *args, **kwargs: BrokenHealthConnection()
    )

    with pytest.raises(RuntimeError, match="Database health check failed"):
        run_migrations("/tmp/unused.sqlite3")


def test_tx_does_not_log_expected_value_errors(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    db_path = tmp_path / "expected.sqlite3"
    run_migrations(str(db_path))
    caplog.set_level("DEBUG", logger="dopaflow.db")

    with pytest.raises(ValueError, match="expected"), tx(str(db_path)):
        raise ValueError("expected")

    assert not any(record.levelname == "ERROR" for record in caplog.records)
    assert any(
        record.levelname == "DEBUG"
        and "Transaction rolled back for expected error" in record.message
        for record in caplog.records
    )


def test_tx_logs_unexpected_errors(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    db_path = tmp_path / "unexpected.sqlite3"
    run_migrations(str(db_path))
    caplog.set_level("ERROR", logger="dopaflow.db")

    with pytest.raises(RuntimeError, match="unexpected"), tx(str(db_path)):
        raise RuntimeError("unexpected")

    assert any(
        record.levelname == "ERROR"
        and "Transaction failed, rolling back" in record.message
        for record in caplog.records
    )


def test_connect_raises_import_error_when_libsql_is_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import database as database_module

    monkeypatch.setattr(database_module, "libsql", None)

    with pytest.raises(ImportError, match="libsql-experimental"):
        database_module._connect(":memory:", turso_url="libsql://fake")
