from __future__ import annotations

from pathlib import Path

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
