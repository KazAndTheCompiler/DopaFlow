"""Tests for migration drift detection."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.core.database import _ensure_migrations_table, _migration_checksum, run_migrations


def test_migration_checksum_is_deterministic(sqlite_db_path: Path) -> None:
    """Same SQL content always produces the same checksum."""
    sql = "CREATE TABLE test (id INTEGER PRIMARY KEY);"
    c1 = _migration_checksum(sql)
    c2 = _migration_checksum(sql)
    assert c1 == c2
    assert len(c1) == 64  # SHA-256 hex digest


def test_migration_checksum_differs_on_content_change(sqlite_db_path: Path) -> None:
    """Different SQL produces different checksums."""
    sql_v1 = "CREATE TABLE test (id INTEGER PRIMARY KEY);"
    sql_v2 = "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT);"
    c1 = _migration_checksum(sql_v1)
    c2 = _migration_checksum(sql_v2)
    assert c1 != c2


def test_drift_warning_logged_when_applied_migration_is_modified(
    sqlite_db_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """If an already-applied migration file changes, a warning is logged."""
    run_migrations(str(sqlite_db_path))

    conn = sqlite3.connect(sqlite_db_path)
    conn.execute("UPDATE _migrations SET checksum = 'old_checksum' WHERE filename = '001_init.sql'")
    conn.commit()
    conn.close()

    with caplog.at_level("WARNING"):
        run_migrations(str(sqlite_db_path))

    assert any(
        "been modified" in record.message and "001_init.sql" in record.message
        for record in caplog.records
    )


def test_checksum_recorded_for_new_migration(sqlite_db_path: Path) -> None:
    """New migrations get their checksum recorded in _migrations."""
    run_migrations(str(sqlite_db_path))

    conn = sqlite3.connect(sqlite_db_path)
    rows = conn.execute("SELECT filename, checksum FROM _migrations").fetchall()
    conn.close()

    assert len(rows) >= 1
    for filename, checksum in rows:
        if filename == "001_init.sql":
            assert len(checksum) == 64


def test_migration_table_has_checksum_column(sqlite_db_path: Path) -> None:
    """_migrations table must have a checksum column."""
    conn = sqlite3.connect(sqlite_db_path)
    _ensure_migrations_table(conn)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(_migrations)").fetchall()}
    conn.close()
    assert "checksum" in columns
