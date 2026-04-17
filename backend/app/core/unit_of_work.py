"""Unit of Work: coordinates a single transaction across multiple repositories."""

from __future__ import annotations

import logging
import sqlite3
from types import TracebackType

from app.core.config import Settings
from app.core.database import _connect, _prepare_connection, _resolve_db_config

logger = logging.getLogger(__name__)


class UnitOfWork:
    """Coordinates a single database transaction across multiple repositories.

    Usage::

        with UnitOfWork(settings) as uow:
            task_repo = TaskRepository(uow)
            habit_repo = HabitRepository(uow)
            # ... operations share one connection ...
            uow.commit()  # explicit commit
        # On exit: commits if not already committed, rollbacks on exception

    Repositories constructed with a UnitOfWork share the same connection
    and transaction boundary. This eliminates the "each method opens/closes
    its own connection" pattern when cross-repo atomicity is needed.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._conn: sqlite3.Connection | None = None
        self._committed = False

    @property
    def settings(self) -> Settings:
        return self._settings

    @property
    def connection(self) -> sqlite3.Connection:
        """The active database connection. Raises if UoW is not active."""
        if self._conn is None:
            raise RuntimeError("UnitOfWork has no active connection")
        return self._conn

    def __enter__(self) -> UnitOfWork:
        db_path, turso_url, turso_token = _resolve_db_config(self._settings)
        self._conn = _connect(db_path, turso_url=turso_url, turso_token=turso_token)
        _prepare_connection(self._conn)
        self._conn.execute("BEGIN")
        self._committed = False
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if self._conn is None:
            return
        try:
            if exc_type is not None:
                self._conn.rollback()
            elif not self._committed:
                self._conn.commit()
        finally:
            self._conn.close()
            self._conn = None

    def commit(self) -> None:
        """Explicitly commit the transaction.

        Can be called multiple times safely (no-op after the first).
        The context manager exit will not commit again.
        """
        if self._conn is None:
            raise RuntimeError("UnitOfWork has no active connection")
        if not self._committed:
            self._conn.commit()
            self._committed = True
