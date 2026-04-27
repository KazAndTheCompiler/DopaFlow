"""Database connection pooling for SQLite and Turso."""

from __future__ import annotations

import logging
import sqlite3
import threading
import time
from collections.abc import Generator
from contextlib import contextmanager
from queue import Empty, Queue

from app.core.config import Settings

logger = logging.getLogger("dopaflow.db_pool")


class ConnectionPool:
    """Thread-safe SQLite connection pool.

    Features:
    - Min/max connection limits
    - Connection timeout
    - Health checking
    - Automatic reconnection
    """

    def __init__(
        self,
        db_path: str,
        *,
        min_connections: int = 2,
        max_connections: int = 10,
        connection_timeout: float = 30.0,
        max_idle_time: float = 300.0,
    ):
        self.db_path = db_path
        self.min_connections = min_connections
        self.max_connections = max_connections
        self.connection_timeout = connection_timeout
        self.max_idle_time = max_idle_time

        self._pool: Queue[sqlite3.Connection] = Queue(maxsize=max_connections)
        self._lock = threading.Lock()
        self._initialized = False
        self._connection_count = 0
        self._connection_timestamps: dict[int, float] = {}

    def initialize(self) -> None:
        """Initialize the pool with minimum connections."""
        if self._initialized:
            return

        with self._lock:
            for _ in range(self.min_connections):
                conn = self._create_connection()
                if conn:
                    self._pool.put(conn)
            self._initialized = True
            logger.info(
                f"Connection pool initialized: {self.min_connections} connections"
            )

    def _create_connection(self) -> sqlite3.Connection | None:
        """Create a new database connection."""
        try:
            conn = sqlite3.connect(
                self.db_path,
                timeout=self.connection_timeout,
                check_same_thread=False,  # Allow cross-thread usage
            )
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.row_factory = sqlite3.Row

            self._connection_count += 1
            self._connection_timestamps[id(conn)] = time.time()

            return conn
        except sqlite3.Error as exc:
            logger.error(f"Failed to create connection: {exc}")
            return None

    def _is_connection_healthy(self, conn: sqlite3.Connection) -> bool:
        """Check if a connection is still valid."""
        try:
            conn.execute("SELECT 1")
            return True
        except sqlite3.Error:
            return False

    def _should_replace_connection(self, conn: sqlite3.Connection) -> bool:
        """Check if connection should be replaced due to age."""
        conn_id = id(conn)
        if conn_id not in self._connection_timestamps:
            return True

        age = time.time() - self._connection_timestamps[conn_id]
        return age > self.max_idle_time

    def get_connection(
        self, timeout: float | None = None
    ) -> sqlite3.Connection | None:
        """Get a connection from the pool."""
        if not self._initialized:
            self.initialize()

        timeout = timeout or self.connection_timeout

        try:
            # Try to get from pool
            conn = self._pool.get(timeout=timeout)

            # Check if connection is still healthy
            if not self._is_connection_healthy(conn) or self._should_replace_connection(
                conn
            ):
                # Close old connection and create new one
                try:
                    conn.close()
                except sqlite3.Error:
                    pass
                self._connection_count -= 1
                conn = self._create_connection()

            return conn
        except Empty:
            # Pool exhausted, create new connection if under limit
            with self._lock:
                if self._connection_count < self.max_connections:
                    return self._create_connection()

            logger.warning("Connection pool exhausted")
            return None

    def return_connection(self, conn: sqlite3.Connection) -> None:
        """Return a connection to the pool."""
        if conn is None:
            return

        # Check if connection is still healthy
        if not self._is_connection_healthy(conn):
            try:
                conn.close()
            except sqlite3.Error:
                pass
            self._connection_count -= 1
            return

        # Update timestamp
        self._connection_timestamps[id(conn)] = time.time()

        # Return to pool
        try:
            self._pool.put_nowait(conn)
        except Exception:
            # Pool full, close connection
            try:
                conn.close()
            except sqlite3.Error:
                pass
            self._connection_count -= 1

    def close_all(self) -> None:
        """Close all connections in the pool."""
        with self._lock:
            while not self._pool.empty():
                try:
                    conn = self._pool.get_nowait()
                    conn.close()
                except (Empty, sqlite3.Error):
                    pass
            self._connection_count = 0
            self._initialized = False
            logger.info("Connection pool closed")


# Global connection pool instance
_pool_instance: ConnectionPool | None = None
_pool_lock = threading.Lock()


def get_connection_pool(
    db_path: str,
    *,
    min_connections: int = 2,
    max_connections: int = 10,
) -> ConnectionPool:
    """Get or create the global connection pool."""
    global _pool_instance

    if _pool_instance is None:
        with _pool_lock:
            if _pool_instance is None:
                _pool_instance = ConnectionPool(
                    db_path,
                    min_connections=min_connections,
                    max_connections=max_connections,
                )
                _pool_instance.initialize()

    return _pool_instance


@contextmanager
def pooled_connection(
    settings: Settings,
    timeout: float | None = None,
) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for getting a pooled connection."""

    pool = get_connection_pool(
        settings.db_path,
        min_connections=int(getattr(settings, "db_pool_min", 2)),
        max_connections=int(getattr(settings, "db_pool_max", 10)),
    )

    conn = pool.get_connection(timeout=timeout)
    if conn is None:
        raise RuntimeError("Could not get database connection from pool")

    try:
        yield conn
    finally:
        pool.return_connection(conn)


def configure_connection_pool(settings: Settings) -> None:
    """Configure connection pool from settings."""
    global _pool_instance

    with _pool_lock:
        # Close existing pool if reconfiguring
        if _pool_instance is not None:
            _pool_instance.close_all()
            _pool_instance = None

        # Create new pool
        _pool_instance = ConnectionPool(
            settings.db_path,
            min_connections=getattr(settings, "db_pool_min", 2),
            max_connections=getattr(settings, "db_pool_max", 10),
            connection_timeout=getattr(settings, "db_timeout", 30.0),
        )
        _pool_instance.initialize()

        logger.info(
            f"Connection pool configured: "
            f"min={_pool_instance.min_connections}, "
            f"max={_pool_instance.max_connections}"
        )


def get_pool_stats() -> dict:
    """Get connection pool statistics."""
    global _pool_instance

    if _pool_instance is None:
        return {"status": "not_initialized"}

    return {
        "status": "initialized" if _pool_instance._initialized else "initializing",
        "pool_size": _pool_instance._pool.qsize(),
        "total_connections": _pool_instance._connection_count,
        "max_connections": _pool_instance.max_connections,
        "min_connections": _pool_instance.min_connections,
    }
