"""Tests for external OIDC state management: create_oidc_state, consume_oidc_state."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from app.core.config import Settings
from app.core.database import run_migrations
from app.domains.auth.oidc_external import (
    OIDC_STATE_TTL,
    consume_oidc_state,
    create_oidc_state,
)


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test_oidc_ext.db")


@pytest.fixture
def settings(db_path):
    return Settings(
        db_path=db_path,
        auth_token_secret="test-secret-for-oidc-ext-tests-minimum-length",
        base_url="http://127.0.0.1:8000",
    )


@pytest.fixture
def _init_db(settings):
    run_migrations(settings.db_path)


class TestCreateOidcState:
    def test_creates_state_and_returns_verifier(self, settings, _init_db):
        state, code_verifier = create_oidc_state(
            provider_name="keycloak",
            redirect_uri="http://localhost:3000/callback",
            scope="openid profile email",
            client_id="dopaflow",
            original_state="orig-state-123",
            code_challenge="challenge-abc",
            settings=settings,
        )
        assert state  # non-empty
        assert code_verifier  # non-empty
        # State should be retrievable
        consumed = consume_oidc_state(state, settings.db_path)
        assert consumed is not None
        assert consumed["provider_name"] == "keycloak"
        assert consumed["redirect_uri"] == "http://localhost:3000/callback"
        assert consumed["client_id"] == "dopaflow"
        assert consumed["original_state"] == "orig-state-123"
        assert consumed["code_challenge"] == "challenge-abc"


class TestConsumeOidcState:
    def test_one_time_use(self, settings, _init_db):
        state, _ = create_oidc_state(
            provider_name="keycloak",
            redirect_uri="http://localhost:3000/callback",
            scope="openid",
            client_id="dopaflow",
            original_state="orig",
            code_challenge="challenge",
            settings=settings,
        )
        # First consume succeeds
        result = consume_oidc_state(state, settings.db_path)
        assert result is not None
        # Second consume returns None (one-time use)
        result2 = consume_oidc_state(state, settings.db_path)
        assert result2 is None

    def test_unknown_state_returns_none(self, settings, _init_db):
        result = consume_oidc_state("nonexistent-state", settings.db_path)
        assert result is None

    def test_expired_state_returns_none(self, settings, _init_db):
        state, _ = create_oidc_state(
            provider_name="keycloak",
            redirect_uri="http://localhost:3000/callback",
            scope="openid",
            client_id="dopaflow",
            original_state="orig",
            code_challenge="challenge",
            settings=settings,
        )
        # Expire the state by mocking time
        with patch("app.domains.auth.oidc_external.datetime") as mock_dt:
            from datetime import UTC, datetime

            future = datetime.fromtimestamp(time.time() + OIDC_STATE_TTL + 100, tz=UTC)
            # Make the consume check think we're far in the future
            mock_dt.now.return_value = future
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = consume_oidc_state(state, settings.db_path)
        assert result is None
