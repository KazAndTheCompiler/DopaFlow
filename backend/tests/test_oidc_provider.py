"""Tests for external OIDC provider service: discovery, JWKS, ID token validation."""

from __future__ import annotations

import time
from unittest.mock import patch

import jwt as pyjwt
import pytest

from app.services.oidc_provider import (
    clear_cache,
    fetch_discovery,
    validate_id_token,
)


def _generate_rsa_key():
    """Generate an RSA key pair for testing."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_key, public_pem


@pytest.fixture(autouse=True)
def _clear_oidc_cache():
    clear_cache()
    yield
    clear_cache()


class TestValidateIdToken:
    def test_valid_token(self):
        private_key, _ = _generate_rsa_key()
        now = int(time.time())
        payload = {
            "iss": "https://keycloak.example.com/realms/test",
            "aud": "dopaflow-client",
            "sub": "user-123",
            "email": "test@example.com",
            "exp": now + 300,
            "iat": now,
        }
        id_token = pyjwt.encode(
            payload, private_key, algorithm="RS256", headers={"kid": "test-key-1"}
        )
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
        claims = validate_id_token(
            id_token=id_token,
            issuer="https://keycloak.example.com/realms/test",
            client_id="dopaflow-client",
            jwks=jwks,
        )
        assert claims["sub"] == "user-123"
        assert claims["email"] == "test@example.com"

    def test_expired_token(self):
        private_key, _ = _generate_rsa_key()
        now = int(time.time())
        payload = {
            "iss": "https://keycloak.example.com/realms/test",
            "aud": "dopaflow-client",
            "sub": "user-123",
            "exp": now - 100,
            "iat": now - 200,
        }
        id_token = pyjwt.encode(
            payload, private_key, algorithm="RS256", headers={"kid": "test-key-1"}
        )
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
        with pytest.raises(ValueError, match="ID token validation failed"):
            validate_id_token(
                id_token,
                "https://keycloak.example.com/realms/test",
                "dopaflow-client",
                jwks,
            )

    def test_wrong_audience(self):
        private_key, _ = _generate_rsa_key()
        now = int(time.time())
        payload = {
            "iss": "https://keycloak.example.com/realms/test",
            "aud": "wrong-client",
            "sub": "user-123",
            "exp": now + 300,
            "iat": now,
        }
        id_token = pyjwt.encode(
            payload, private_key, algorithm="RS256", headers={"kid": "test-key-1"}
        )
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
        with pytest.raises(ValueError, match="ID token validation failed"):
            validate_id_token(
                id_token,
                "https://keycloak.example.com/realms/test",
                "dopaflow-client",
                jwks,
            )

    def test_nonce_check(self):
        private_key, _ = _generate_rsa_key()
        now = int(time.time())
        payload = {
            "iss": "https://keycloak.example.com/realms/test",
            "aud": "dopaflow-client",
            "sub": "user-123",
            "exp": now + 300,
            "iat": now,
            "nonce": "expected-nonce",
        }
        id_token = pyjwt.encode(
            payload, private_key, algorithm="RS256", headers={"kid": "test-key-1"}
        )
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
        # Correct nonce passes
        claims = validate_id_token(
            id_token,
            "https://keycloak.example.com/realms/test",
            "dopaflow-client",
            jwks,
            nonce="expected-nonce",
        )
        assert claims["sub"] == "user-123"
        # Wrong nonce fails
        with pytest.raises(ValueError, match="Nonce mismatch"):
            validate_id_token(
                id_token,
                "https://keycloak.example.com/realms/test",
                "dopaflow-client",
                jwks,
                nonce="wrong-nonce",
            )

    def test_wrong_issuer(self):
        private_key, _ = _generate_rsa_key()
        now = int(time.time())
        payload = {
            "iss": "https://evil.example.com/realms/test",
            "aud": "dopaflow-client",
            "sub": "user-123",
            "exp": now + 300,
            "iat": now,
        }
        id_token = pyjwt.encode(
            payload, private_key, algorithm="RS256", headers={"kid": "test-key-1"}
        )
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
        with pytest.raises(ValueError, match="ID token validation failed"):
            validate_id_token(
                id_token,
                "https://keycloak.example.com/realms/test",
                "dopaflow-client",
                jwks,
            )


class TestCaching:
    @pytest.mark.asyncio
    async def test_discovery_cache(self):
        doc = {
            "issuer": "https://test.example.com",
            "authorization_endpoint": "https://test.example.com/auth",
            "token_endpoint": "https://test.example.com/token",
            "jwks_uri": "https://test.example.com/jwks",
        }
        call_count = 0

        async def mock_get(self, url):
            nonlocal call_count
            call_count += 1

            class Resp:
                def raise_for_status(self):
                    pass

                def json(self):
                    return doc

            return Resp()

        with patch("httpx.AsyncClient.get", mock_get):
            r1 = await fetch_discovery("https://test.example.com")
            r2 = await fetch_discovery("https://test.example.com")
        assert call_count == 1
        assert r1 == doc

    @pytest.mark.asyncio
    async def test_discovery_issuer_mismatch(self):
        doc = {"issuer": "https://wrong.example.com"}

        async def mock_get(self, url):
            class Resp:
                def raise_for_status(self):
                    pass

                def json(self):
                    return doc

            return Resp()

        with patch("httpx.AsyncClient.get", mock_get):
            with pytest.raises(ValueError, match="Issuer mismatch"):
                await fetch_discovery("https://test.example.com")


def _get_rsa_n(private_key):
    """Extract base64url-encoded RSA modulus."""
    numbers = private_key.private_numbers().public_numbers
    import base64

    n_bytes = numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, byteorder="big")
    return base64.urlsafe_b64encode(n_bytes).rstrip(b"=").decode("ascii")


def _get_rsa_e(private_key):
    """Extract base64url-encoded RSA exponent."""
    numbers = private_key.private_numbers().public_numbers
    import base64

    e_bytes = numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, byteorder="big")
    return base64.urlsafe_b64encode(e_bytes).rstrip(b"=").decode("ascii")
