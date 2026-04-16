"""DopaFlow Alembic environment configuration.

Resolves the database URL from DopaFlow Settings (supports both local
SQLite and Turso/libsql). Uses render_as_batch=True for SQLite
ALTER TABLE compatibility. No ORM models — target_metadata is None.
"""

from __future__ import annotations

import importlib.util
import logging
from logging.config import fileConfig

import sqlalchemy
from alembic import context

# Detect libsql for Turso support
if importlib.util.find_spec("libsql_experimental") is not None:
    import libsql_experimental as libsql
else:
    libsql = None

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# No ORM models — autogenerate is not used.
target_metadata = None

logger = logging.getLogger(__name__)


def _resolve_db_url() -> str:
    """Resolve the database URL from DopaFlow Settings.

    Returns a SQLAlchemy-compatible URL string.
    For local SQLite: sqlite:///<path>
    For Turso: the URL is handled via a custom connection in
    run_migrations_online (not through SQLAlchemy engine).
    """
    try:
        from app.core.config import get_settings

        settings = get_settings()
    except Exception:
        # Fallback: read from environment or alembic.ini
        return config.get_main_option("sqlalchemy.url", "sqlite:///dopaflow.db")

    if settings.turso_url:
        # Turso: we don't use SQLAlchemy engine; custom connect below.
        # Return a placeholder — the actual connection is created in
        # run_migrations_online via libsql.
        return f"libsql://{settings.turso_url}"

    return f"sqlite:///{settings.db_path}"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (SQL script generation)."""
    url = _resolve_db_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    For Turso: creates a libsql connection directly (bypasses SQLAlchemy
    engine) and passes it to Alembic's context.

    For local SQLite: uses SQLAlchemy engine with NullPool.
    """
    try:
        from app.core.config import get_settings

        settings = get_settings()
    except Exception:
        settings = None

    if settings and settings.turso_url:
        _run_migrations_turso(settings)
        return

    url = _resolve_db_url()
    connectable = sqlalchemy.engine_from_config(
        {"sqlalchemy.url": url},
        prefix="sqlalchemy.",
        poolclass=sqlalchemy.pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


def _run_migrations_turso(settings) -> None:
    """Run migrations using a Turso/libsql connection.

    Bypasses SQLAlchemy engine entirely and provides the raw
    connection to Alembic's MigrationContext.
    """
    if libsql is None:
        raise ImportError(
            "Install libsql-experimental to use Turso: pip install libsql-experimental"
        )

    conn = libsql.connect(settings.turso_url, auth_token=settings.turso_token)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = None  # Alembic doesn't need row_factory

    context.configure(
        connection=conn,
        target_metadata=target_metadata,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()

    conn.close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()