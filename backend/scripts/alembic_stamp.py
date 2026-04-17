#!/usr/bin/env python3
"""Stamp an existing DopaFlow database as up-to-date with Alembic.

Run this once after integrating Alembic, on each existing database,
so that Alembic knows all 37 legacy SQL migrations have been applied.

Usage:
    python scripts/alembic_stamp.py               # uses DOPAFLOW_DB_PATH env var
    python scripts/alembic_stamp.py /path/to/db    # explicit path
"""

from __future__ import annotations

import os
import sqlite3
import sys


def main() -> None:
    db_path = (
        sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DOPAFLOW_DB_PATH", "")
    )
    if not db_path:
        print(
            "Error: provide db_path as argument or set DOPAFLOW_DB_PATH",
            file=sys.stderr,
        )
        sys.exit(1)

    # Verify _migrations table exists and has entries
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    tables = {
        row["name"]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }

    if "_migrations" not in tables:
        print(f"Error: _migrations table not found in {db_path}", file=sys.stderr)
        print("Run run_migrations() first to apply legacy migrations.", file=sys.stderr)
        conn.close()
        sys.exit(1)

    count = conn.execute("SELECT COUNT(*) FROM _migrations").fetchone()[0]
    print(f"Found {count} applied migrations in _migrations table.")

    if count == 0:
        print(
            "Error: no migrations applied yet. Run run_migrations() first.",
            file=sys.stderr,
        )
        conn.close()
        sys.exit(1)

    conn.close()

    # Now stamp using Alembic
    os.environ.setdefault("DOPAFLOW_DB_PATH", db_path)

    from alembic.config import Config as AlembicConfig

    from alembic import command

    alembic_cfg = AlembicConfig("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")

    command.stamp(alembic_cfg, "head")
    print(f"Stamped {db_path} at Alembic head.")


if __name__ == "__main__":
    main()
