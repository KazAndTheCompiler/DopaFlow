"""Tests for AuthService OIDC methods: get_or_create_user_by_oidc, get_enabled_providers."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.core.database import run_migrations
from app.domains.auth.repository import AuthRepository
from app.domains.auth.service import AuthService


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test_oidc.db")


@pytest.fixture
def settings(db_path):
    return Settings(
        db_path=db_path,
        auth_token_secret="test-secret-for-oidc-tests-minimum-length",
        base_url="http://127.0.0.1:8000",
    )


@pytest.fixture
def svc(settings):
    run_migrations(settings.db_path)
    return AuthService(AuthRepository(settings), settings)


@pytest.fixture
def _seed_provider(svc, settings):
    """Insert a test OIDC provider into the DB."""
    from datetime import UTC, datetime

    from app.core.database import tx
    now = datetime.now(UTC).isoformat()
    with tx(settings) as conn:
        conn.execute(
            """INSERT INTO auth_oidc_providers
               (id, name, issuer_url, client_id, client_secret, scopes, enabled, default_role, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
            ("op_test1", "keycloak", "https://kc.example.com/realms/test",
             "dopaflow-test", "secret123", "openid profile email", "editor", now, now),
        )


class TestGetOrCreateUserByOidc:
    def test_creates_new_user(self, svc):
        user = svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-user-1",
            email="alice@example.com",
            default_role="viewer",
        )
        assert user["email"] == "alice@example.com"
        assert user["role"] == "viewer"
        assert user["id"].startswith("usr_")

    def test_returns_existing_user_by_oidc_identity(self, svc):
        user1 = svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-user-1",
            email="alice@example.com",
            default_role="viewer",
        )
        user2 = svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-user-1",
            email="alice@example.com",
            default_role="editor",
        )
        assert user1["id"] == user2["id"]
        assert user2["role"] == "viewer"  # original role preserved

    def test_links_existing_user_by_email(self, svc):
        # Create a local user first
        svc.create_user("bob@example.com", "password123", role="editor")
        # Now OIDC login with same email
        user = svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-bob",
            email="bob@example.com",
            default_role="viewer",
        )
        assert user["role"] == "editor"  # kept original role

    def test_auto_provisioned_user_cannot_login_with_password(self, svc):
        svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-carol",
            email="carol@example.com",
            default_role="viewer",
        )
        with pytest.raises(HTTPException):
            svc.authenticate_user("carol@example.com", "anything")

    def test_updates_email_on_change(self, svc):
        user1 = svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-dave",
            email="dave@old.com",
            default_role="viewer",
        )
        user2 = svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-dave",
            email="dave@new.com",
            default_role="viewer",
        )
        assert user1["id"] == user2["id"]
        assert user2["email"] == "dave@new.com"

    def test_different_issuer_same_subject(self, svc):
        user1 = svc.get_or_create_user_by_oidc(
            issuer="https://kc1.example.com/realms/test",
            subject="user-1",
            email="same@example.com",
            default_role="viewer",
        )
        user2 = svc.get_or_create_user_by_oidc(
            issuer="https://kc2.example.com/realms/test",
            subject="user-1",
            email="same@example.com",
            default_role="viewer",
        )
        # Different issuers create different users (linked by email in second call)
        assert user1["id"] == user2["id"]  # linked by email

    def test_invalid_role_falls_back_to_viewer(self, svc):
        user = svc.get_or_create_user_by_oidc(
            issuer="https://kc.example.com/realms/test",
            subject="ext-role-test",
            email="role@example.com",
            default_role="superadmin",  # invalid
        )
        assert user["role"] == "viewer"


class TestGetEnabledProviders:
    def test_returns_db_providers(self, svc, _seed_provider):
        providers = svc.get_enabled_providers()
        assert len(providers) == 1
        assert providers[0]["name"] == "keycloak"
        assert providers[0]["default_role"] == "editor"

    def test_excludes_disabled(self, svc, settings):
        from datetime import UTC, datetime

        from app.core.database import tx
        now = datetime.now(UTC).isoformat()
        with tx(settings) as conn:
            conn.execute(
                """INSERT INTO auth_oidc_providers
                   (id, name, issuer_url, client_id, client_secret, scopes, enabled, default_role, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)""",
                ("op_disabled", "disabled-idp", "https://disabled.example.com",
                 "client", "secret", "openid", "viewer", now, now),
            )
        providers = svc.get_enabled_providers()
        assert not any(p["name"] == "disabled-idp" for p in providers)

    def test_merges_env_provider(self, svc, settings):
        settings._cache = {}  # clear lru_cache if needed
        env_settings = Settings(
            db_path=settings.db_path,
            auth_token_secret="test-secret-for-oidc-tests-minimum-length",
            base_url="http://127.0.0.1:8000",
            oidc_provider_name="zitadel",
            oidc_issuer_url="https://zitadel.example.com",
            oidc_client_id="dopaflow",
            oidc_client_secret="secret",
            oidc_scopes="openid profile email",
            oidc_default_role="admin",
        )
        env_svc = AuthService(AuthRepository(env_settings), env_settings)
        providers = env_svc.get_enabled_providers()
        assert any(p["name"] == "zitadel" for p in providers)

    def test_empty_without_providers(self, svc):
        providers = svc.get_enabled_providers()
        assert providers == []


class TestRegisterEnvProvider:
    def test_seeds_provider(self, svc, settings):
        settings._cache = {}
        env_settings = Settings(
            db_path=settings.db_path,
            auth_token_secret="test-secret-for-oidc-tests-minimum-length",
            base_url="http://127.0.0.1:8000",
            oidc_provider_name="keycloak",
            oidc_issuer_url="https://kc.example.com/realms/test",
            oidc_client_id="dopaflow",
            oidc_client_secret="secret123",
        )
        env_svc = AuthService(AuthRepository(env_settings), env_settings)
        env_svc.register_env_provider()
        providers = env_svc.get_enabled_providers()
        assert len(providers) >= 1
        assert any(p["name"] == "keycloak" for p in providers)

    def test_noop_without_issuer(self, svc):
        svc.register_env_provider()
        # No crash, no provider added
