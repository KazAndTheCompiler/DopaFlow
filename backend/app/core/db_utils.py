"""Small shared SQLite connection helpers."""

from __future__ import annotations

import sqlite3


def get_conn(db_path: str) -> sqlite3.Connection:
    """Return a SQLite connection configured for Row access."""

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn
