"""Base repository class with connection management and read/write separation."""

from __future__ import annotations

import logging
import sqlite3
from collections.abc import Generator
from pathlib import Path
from contextlib import contextmanager
from typing import TYPE_CHECKING

from app.core.config import Settings
from app.core.database import (
    _connect,
    _prepare_connection,
    _resolve_db_config,
    get_db as _get_db,
    get_db_readonly as _get_db_readonly,
    tx as _tx,
)

if TYPE_CHECKING:
    from app.core.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


class BaseRepository:
    """Base class for all domain repositories.

    Provides consistent connection access with automatic read/write
    separation. Subclasses call self.get_db() for reads and self.tx()
    for writes.

    Can be constructed in two modes:
    - With Settings: each call opens/closes its own connection (standalone).
    - With UnitOfWork: all calls share a single transaction (shared-tx).

    When a Turso replica URL is configured, self.get_db() and
    self.get_db_readonly() route reads to the replica.
    """

    def __init__(self, settings_or_uow: Settings | UnitOfWork) -> None:
        if isinstance(settings_or_uow, BaseRepository):
            raise TypeError(
                "BaseRepository expects Settings or UnitOfWork, not a repository"
            )

        # Check for UnitOfWork (import lazily to avoid circular imports)
        from app.core.unit_of_work import UnitOfWork

        if isinstance(settings_or_uow, UnitOfWork):
            self._uow: UnitOfWork | None = settings_or_uow
            self._settings = settings_or_uow.settings
        elif isinstance(settings_or_uow, Settings):
            self._uow = None
            self._settings = settings_or_uow
        elif isinstance(settings_or_uow, (str, Path)):
            # Backward-compat shim: accept db_path string or Path
            db_path_str = str(settings_or_uow)
            self._uow = None
            from app.core.config import get_settings

            self._settings = get_settings()
            # Override db_path if the string differs from the cached settings
            if db_path_str != self._settings.db_path:
                self._settings = self._settings.model_copy(
                    update={"db_path": db_path_str}
                )
        else:
            raise TypeError(
                f"BaseRepository expects Settings, UnitOfWork, str, or Path, "
                f"got {type(settings_or_uow).__name__}"
            )

        self._db_path = self._settings.db_path

    @property
    def settings(self) -> Settings:
        return self._settings

    @property
    def db_path(self) -> str:
        """Convenience accessor — prefer self.settings.db_path."""
        return self._db_path

    @contextmanager
    def get_db(self) -> Generator[sqlite3.Connection, None, None]:
        """Yield a read connection.

        If inside a UnitOfWork, yields the shared connection.
        Otherwise, routes to the replica when turso_replica_url is
        configured, or falls back to the primary.
        """
        if self._uow is not None:
            yield self._uow.connection
            return

        if getattr(self._settings, "turso_replica_url", None):
            with _get_db_readonly(self._settings) as conn:
                yield conn
        else:
            with _get_db(self._db_path) as conn:
                yield conn

    @contextmanager
    def get_db_readonly(self) -> Generator[sqlite3.Connection, None, None]:
        """Explicitly request a read-only connection (replica or primary).

        Use this for methods that are known to be read-only, so the
        read/write split is explicit in the codebase.
        """
        if self._uow is not None:
            yield self._uow.connection
            return

        with _get_db_readonly(self._settings) as conn:
            yield conn

    @contextmanager
    def tx(self) -> Generator[sqlite3.Connection, None, None]:
        """Yield a write connection with auto-commit/rollback.

        If inside a UnitOfWork, yields the shared connection (the
        UnitOfWork handles commit/rollback at its boundary).
        """
        if self._uow is not None:
            yield self._uow.connection
            return

        with _tx(self._db_path) as conn:
            yield conn