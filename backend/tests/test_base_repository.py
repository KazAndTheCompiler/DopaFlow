"""Tests for BaseRepository and UnitOfWork."""

from __future__ import annotations

import pytest

from app.core.base_repository import BaseRepository
from app.core.config import Settings
from app.core.database import run_migrations
from app.core.unit_of_work import UnitOfWork


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test_uow.db")


@pytest.fixture
def settings(db_path):
    return Settings(
        db_path=db_path,
        auth_token_secret="test-secret-for-base-repo-tests-minimum-length",
        base_url="http://127.0.0.1:8000",
    )


@pytest.fixture
def _init_db(settings):
    run_migrations(settings.db_path)


class TestBaseRepositoryStandalone:
    def test_get_db_yields_connection(self, settings, _init_db):
        repo = BaseRepository(settings)
        with repo.get_db() as conn:
            row = conn.execute("SELECT 1 AS v").fetchone()
            assert row["v"] == 1

    def test_tx_commits_on_success(self, settings, _init_db):
        repo = BaseRepository(settings)
        with repo.tx() as conn:
            conn.execute(
                "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                ("usr_test1", "test@example.com", "hash", "viewer"),
            )
        # Data persisted after tx exit
        with repo.get_db() as conn:
            row = conn.execute(
                "SELECT email FROM auth_users WHERE id = ?", ("usr_test1",)
            ).fetchone()
            assert row is not None
            assert row["email"] == "test@example.com"

    def test_tx_rollbacks_on_exception(self, settings, _init_db):
        repo = BaseRepository(settings)
        with pytest.raises(ValueError):
            with repo.tx() as conn:
                conn.execute(
                    "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                    ("usr_test2", "rollback@example.com", "hash", "viewer"),
                )
                raise ValueError("force rollback")
        with repo.get_db() as conn:
            row = conn.execute(
                "SELECT id FROM auth_users WHERE id = ?", ("usr_test2",)
            ).fetchone()
            assert row is None

    def test_get_db_readonly_yields_connection(self, settings, _init_db):
        repo = BaseRepository(settings)
        with repo.get_db_readonly() as conn:
            row = conn.execute("SELECT 1 AS v").fetchone()
            assert row["v"] == 1

    def test_settings_property(self, settings, _init_db):
        repo = BaseRepository(settings)
        assert repo.settings is settings
        assert repo.db_path == settings.db_path

    def test_db_path_string_compat(self, settings, _init_db):
        """Backward-compat: accept db_path string."""
        repo = BaseRepository(settings.db_path)
        with repo.get_db() as conn:
            row = conn.execute("SELECT 1 AS v").fetchone()
            assert row["v"] == 1


class TestUnitOfWork:
    def test_commit_on_exit(self, settings, _init_db):
        with UnitOfWork(settings) as uow:
            conn = uow.connection
            conn.execute(
                "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                ("usr_uow1", "uow@example.com", "hash", "viewer"),
            )
        # Data persisted after UoW exit
        with BaseRepository(settings).get_db() as conn:
            row = conn.execute(
                "SELECT email FROM auth_users WHERE id = ?", ("usr_uow1",)
            ).fetchone()
            assert row is not None

    def test_rollback_on_exception(self, settings, _init_db):
        with pytest.raises(RuntimeError):
            with UnitOfWork(settings) as uow:
                conn = uow.connection
                conn.execute(
                    "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                    ("usr_uow2", "rollback@example.com", "hash", "viewer"),
                )
                raise RuntimeError("force rollback")
        with BaseRepository(settings).get_db() as conn:
            row = conn.execute(
                "SELECT id FROM auth_users WHERE id = ?", ("usr_uow2",)
            ).fetchone()
            assert row is None

    def test_explicit_commit(self, settings, _init_db):
        with UnitOfWork(settings) as uow:
            conn = uow.connection
            conn.execute(
                "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                ("usr_uow3", "explicit@example.com", "hash", "viewer"),
            )
            uow.commit()
        # Data persisted
        with BaseRepository(settings).get_db() as conn:
            row = conn.execute(
                "SELECT email FROM auth_users WHERE id = ?", ("usr_uow3",)
            ).fetchone()
            assert row is not None

    def test_connection_property_raises_outside_context(self, settings):
        uow = UnitOfWork(settings)
        with pytest.raises(RuntimeError, match="no active connection"):
            _ = uow.connection


class TestUnitOfWorkWithRepos:
    def test_shared_transaction_across_repos(self, settings, _init_db):
        """Two repos sharing a UoW: both writes commit or both roll back."""
        with UnitOfWork(settings) as uow:
            repo1 = BaseRepository(uow)
            repo2 = BaseRepository(uow)
            conn1 = uow.connection
            conn2 = uow.connection
            assert conn1 is conn2  # same connection

            conn1.execute(
                "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                ("usr_shared1", "shared1@example.com", "hash", "viewer"),
            )
            conn2.execute(
                "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                ("usr_shared2", "shared2@example.com", "hash", "viewer"),
            )

        # Both rows persisted
        with BaseRepository(settings).get_db() as conn:
            rows = conn.execute(
                "SELECT id FROM auth_users WHERE id IN (?, ?)",
                ("usr_shared1", "usr_shared2"),
            ).fetchall()
            assert len(rows) == 2

    def test_shared_transaction_rollback(self, settings, _init_db):
        """Exception rolls back both repos' writes."""
        with pytest.raises(ValueError):
            with UnitOfWork(settings) as uow:
                repo = BaseRepository(uow)
                conn = uow.connection
                conn.execute(
                    "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                    ("usr_rollback1", "rb1@example.com", "hash", "viewer"),
                )
                conn.execute(
                    "INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
                    ("usr_rollback2", "rb2@example.com", "hash", "viewer"),
                )
                raise ValueError("rollback everything")

        with BaseRepository(settings).get_db() as conn:
            rows = conn.execute(
                "SELECT id FROM auth_users WHERE id IN (?, ?)",
                ("usr_rollback1", "usr_rollback2"),
            ).fetchall()
            assert len(rows) == 0
