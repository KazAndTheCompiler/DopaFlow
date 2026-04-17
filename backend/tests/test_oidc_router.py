"""E2E tests for the OIDC router: login redirect, callback flow with mocked external IdP."""

from __future__ import annotations

import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import jwt as pyjwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings_dependency
from app.core.database import run_migrations, tx
from app.domains.auth.oidc_router import router as oidc_router
from app.domains.auth.repository import AuthRepository
from app.domains.auth.service import AuthService, get_auth_service


def _generate_rsa_key():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_key, public_pem


def _get_rsa_n(private_key):
    import base64

    numbers = private_key.private_numbers().public_numbers
    n_bytes = numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, byteorder="big")
    return base64.urlsafe_b64encode(n_bytes).rstrip(b"=").decode("ascii")


def _get_rsa_e(private_key):
    import base64

    numbers = private_key.private_numbers().public_numbers
    e_bytes = numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, byteorder="big")
    return base64.urlsafe_b64encode(e_bytes).rstrip(b"=").decode("ascii")


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test_oidc_e2e.db")


@pytest.fixture
def settings(db_path):
    return Settings(
        db_path=db_path,
        auth_token_secret="test-secret-for-oidc-e2e-minimum-length",
        base_url="http://127.0.0.1:8000",
    )


@pytest.fixture
def _seed_provider(settings):
    run_migrations(settings.db_path)
    now = datetime.now(UTC).isoformat()
    with tx(settings) as conn:
        conn.execute(
            """INSERT INTO auth_oidc_providers
               (id, name, issuer_url, client_id, client_secret, scopes, enabled, default_role, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
            (
                "op_e2e",
                "keycloak",
                "https://kc.example.com/realms/test",
                "dopaflow-test",
                "secret123",
                "openid profile email",
                "viewer",
                now,
                now,
            ),
        )
        # Register a client for auth code exchange
        conn.execute(
            """INSERT INTO auth_clients
               (id, client_id, client_name, redirect_uri, scope, pkce_required, active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)""",
            (
                "cl_dopaflow",
                "dopaflow",
                "DopaFlow Test Client",
                "http://localhost:3000/callback",
                "openid profile email",
                now,
                now,
            ),
        )


@pytest.fixture
def app(settings, _seed_provider):
    _app = FastAPI()
    _app.include_router(oidc_router, prefix="/api/v2")

    def _get_settings():
        return settings

    def _get_svc():
        return AuthService(AuthRepository(settings), settings)

    _app.dependency_overrides[get_settings_dependency] = _get_settings
    _app.dependency_overrides[get_auth_service] = _get_svc
    return _app


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


DISCOVERY_DOC = {
    "issuer": "https://kc.example.com/realms/test",
    "authorization_endpoint": "https://kc.example.com/realms/test/protocol/openid-connect/auth",
    "token_endpoint": "https://kc.example.com/realms/test/protocol/openid-connect/token",
    "jwks_uri": "https://kc.example.com/realms/test/protocol/openid-connect/certs",
}


class TestListProviders:
    @pytest.mark.asyncio
    async def test_returns_enabled_providers(self, client):
        resp = await client.get("/api/v2/auth/oidc/providers")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["providers"]) >= 1
        assert any(p["name"] == "keycloak" for p in data["providers"])


class TestOidcLogin:
    @pytest.mark.asyncio
    async def test_login_redirects_to_idp(self, client):
        with patch(
            "app.domains.auth.oidc_router.fetch_discovery", new_callable=AsyncMock
        ) as mock_disc:
            mock_disc.return_value = DISCOVERY_DOC
            resp = await client.get(
                "/api/v2/auth/oidc/login/keycloak",
                params={
                    "client_id": "dopaflow",
                    "redirect_uri": "http://localhost:3000/callback",
                    "scope": "openid profile email",
                    "state": "a" * 16,
                    "code_challenge": "a" * 43,
                    "code_challenge_method": "S256",
                },
                follow_redirects=False,
            )
        assert resp.status_code == 302
        location = resp.headers["location"]
        assert "kc.example.com" in location
        assert "code_challenge" in location
        assert "S256" in location

    @pytest.mark.asyncio
    async def test_login_rejects_non_s256(self, client):
        resp = await client.get(
            "/api/v2/auth/oidc/login/keycloak",
            params={
                "client_id": "dopaflow",
                "redirect_uri": "http://localhost:3000/callback",
                "state": "a" * 16,
                "code_challenge": "a" * 43,
                "code_challenge_method": "plain",
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_login_404_for_unknown_provider(self, client):
        resp = await client.get(
            "/api/v2/auth/oidc/login/nonexistent",
            params={
                "client_id": "dopaflow",
                "redirect_uri": "http://localhost:3000/callback",
                "state": "a" * 16,
                "code_challenge": "a" * 43,
            },
        )
        assert resp.status_code == 404


class TestOidcCallback:
    @pytest.mark.asyncio
    async def test_callback_full_flow(self, client, settings):
        """Full E2E: login creates state → callback consumes it, exchanges code, issues auth code."""
        private_key, _ = _generate_rsa_key()
        jwks = {
            "keys": [
                {
                    "kty": "RSA",
                    "kid": "test-key-1",
                    "n": _get_rsa_n(private_key),
                    "e": _get_rsa_e(private_key),
                    "alg": "RS256",
                    "use": "sig",
                }
            ]
        }

        # Step 1: Initiate login to get the state stored
        with patch(
            "app.domains.auth.oidc_router.fetch_discovery", new_callable=AsyncMock
        ) as mock_disc:
            mock_disc.return_value = DISCOVERY_DOC
            login_resp = await client.get(
                "/api/v2/auth/oidc/login/keycloak",
                params={
                    "client_id": "dopaflow",
                    "redirect_uri": "http://localhost:3000/callback",
                    "scope": "openid profile email",
                    "state": "original-state-12345",
                    "code_challenge": "a" * 43,
                    "code_challenge_method": "S256",
                },
                follow_redirects=False,
            )
        assert login_resp.status_code == 302
        location = login_resp.headers["location"]
        # Extract state from the redirect URL
        from urllib.parse import parse_qs, urlparse

        parsed = urlparse(location)
        external_state = parse_qs(parsed.query)["state"][0]

        # Step 2: Build a mock ID token
        now = int(time.time())
        payload = {
            "iss": "https://kc.example.com/realms/test",
            "aud": "dopaflow-test",
            "sub": "ext-user-e2e",
            "email": "e2e@example.com",
            "exp": now + 300,
            "iat": now,
        }
        id_token = pyjwt.encode(
            payload, private_key, algorithm="RS256", headers={"kid": "test-key-1"}
        )

        # Step 3: Mock the token exchange and JWKS fetch
        mock_token_resp = type(
            "Resp",
            (),
            {
                "status_code": 200,
                "json": lambda self: {
                    "access_token": "at",
                    "id_token": id_token,
                    "token_type": "Bearer",
                },
            },
        )()

        async def mock_post(self, url, **kwargs):
            return mock_token_resp

        with (
            patch(
                "app.domains.auth.oidc_router.fetch_discovery", new_callable=AsyncMock
            ) as mock_disc,
            patch(
                "app.domains.auth.oidc_router.fetch_jwks", new_callable=AsyncMock
            ) as mock_jwks,
            patch("httpx.AsyncClient.post", mock_post),
        ):
            mock_disc.return_value = DISCOVERY_DOC
            mock_jwks.return_value = jwks

            callback_resp = await client.get(
                "/api/v2/auth/oidc/callback/keycloak",
                params={"code": "auth-code-from-idp", "state": external_state},
                follow_redirects=False,
            )

        assert callback_resp.status_code == 302
        redirect_url = callback_resp.headers["location"]
        assert "code=" in redirect_url
        assert "state=original-state-12345" in redirect_url

    @pytest.mark.asyncio
    async def test_callback_rejects_invalid_state(self, client):
        resp = await client.get(
            "/api/v2/auth/oidc/callback/keycloak",
            params={"code": "some-code", "state": "invalid-state"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_callback_rejects_reused_state(self, client, settings):
        """State is one-time-use: second callback with same state should fail."""
        private_key, _ = _generate_rsa_key()
        jwks = {
            "keys": [
                {
                    "kty": "RSA",
                    "kid": "test-key-1",
                    "n": _get_rsa_n(private_key),
                    "e": _get_rsa_e(private_key),
                    "alg": "RS256",
                    "use": "sig",
                }
            ]
        }

        # Initiate login
        with patch(
            "app.domains.auth.oidc_router.fetch_discovery", new_callable=AsyncMock
        ) as mock_disc:
            mock_disc.return_value = DISCOVERY_DOC
            login_resp = await client.get(
                "/api/v2/auth/oidc/login/keycloak",
                params={
                    "client_id": "dopaflow",
                    "redirect_uri": "http://localhost:3000/callback",
                    "scope": "openid",
                    "state": "original-state-reuse",
                    "code_challenge": "a" * 43,
                    "code_challenge_method": "S256",
                },
                follow_redirects=False,
            )
        from urllib.parse import parse_qs, urlparse

        external_state = parse_qs(urlparse(login_resp.headers["location"]).query)[
            "state"
        ][0]

        now = int(time.time())
        payload = {
            "iss": "https://kc.example.com/realms/test",
            "aud": "dopaflow-test",
            "sub": "ext-user-reuse",
            "email": "reuse@example.com",
            "exp": now + 300,
            "iat": now,
        }
        id_token = pyjwt.encode(
            payload, private_key, algorithm="RS256", headers={"kid": "test-key-1"}
        )

        mock_token_resp = type(
            "Resp",
            (),
            {
                "status_code": 200,
                "json": lambda self: {
                    "access_token": "at",
                    "id_token": id_token,
                    "token_type": "Bearer",
                },
            },
        )()

        async def mock_post(self, url, **kwargs):
            return mock_token_resp

        # First callback succeeds
        with (
            patch(
                "app.domains.auth.oidc_router.fetch_discovery", new_callable=AsyncMock
            ) as mock_disc,
            patch(
                "app.domains.auth.oidc_router.fetch_jwks", new_callable=AsyncMock
            ) as mock_jwks,
            patch("httpx.AsyncClient.post", mock_post),
        ):
            mock_disc.return_value = DISCOVERY_DOC
            mock_jwks.return_value = jwks
            resp1 = await client.get(
                "/api/v2/auth/oidc/callback/keycloak",
                params={"code": "code-1", "state": external_state},
                follow_redirects=False,
            )
        assert resp1.status_code == 302

        # Second callback with same state should fail
        resp2 = await client.get(
            "/api/v2/auth/oidc/callback/keycloak",
            params={"code": "code-2", "state": external_state},
        )
        assert resp2.status_code == 400
