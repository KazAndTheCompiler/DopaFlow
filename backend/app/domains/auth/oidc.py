"""OIDC utilities: PKCE, discovery document, and ID token generation."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

from app.core.config import Settings
from app.domains.auth.schemas import OIDCDiscovery


def generate_code_verifier(length: int = 64) -> str:
    raw = secrets.token_bytes(length)
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def generate_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def verify_code_challenge(code_verifier: str, code_challenge: str) -> bool:
    expected = generate_code_challenge(code_verifier)
    return secrets.compare_digest(expected, code_challenge)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def build_discovery(settings: Settings) -> OIDCDiscovery:
    issuer = settings.base_url.rstrip("/")
    return OIDCDiscovery(
        issuer=issuer,
        authorization_endpoint=f"{issuer}/authorize",
        token_endpoint=f"{issuer}/api/v2/auth/token",
        userinfo_endpoint=f"{issuer}/api/v2/auth/userinfo",
        revocation_endpoint=f"{issuer}/api/v2/auth/revoke",
        jwks_uri=f"{issuer}/api/v2/auth/jwks",
        response_types_supported=["code"],
        grant_types_supported=["authorization_code", "refresh_token"],
        subject_types_supported=["public"],
        id_token_signing_alg_values_supported=["HS256"],
        scopes_supported=[
            "openid",
            "profile",
            "email",
            "read:tasks",
            "write:tasks",
            "read:habits",
            "write:habits",
            "read:journal",
            "write:journal",
            "read:focus",
            "write:focus",
            "read:calendar",
            "write:calendar",
            "admin:ops",
        ],
        token_endpoint_auth_methods_supported=["none"],
        code_challenge_methods_supported=["S256"],
        claims_supported=[
            "sub",
            "email",
            "email_verified",
            "name",
            "preferred_username",
            "role",
            "aud",
            "iss",
            "exp",
            "iat",
        ],
    )


def build_id_token(
    settings: Settings,
    sub: str,
    email: str,
    nonce: str | None = None,
    at_hash: str | None = None,
    roles: list[str] | None = None,
    expiry: int = 3600,
) -> str:
    now = int(time.time())
    payload = {
        "iss": settings.base_url.rstrip("/"),
        "sub": sub,
        "aud": settings.auth_token_issuer,
        "exp": now + expiry,
        "iat": now,
        "email": email,
        "email_verified": True,
    }
    if nonce:
        payload["nonce"] = nonce
    if roles:
        payload["role"] = roles[0] if len(roles) == 1 else roles
    if at_hash:
        payload["at_hash"] = at_hash
    payload_segment = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    secret = (
        settings.auth_token_secret
        or settings.api_key
        or "insecure-dev-secret-replace-in-production"
    )
    signature = hmac.new(
        secret.encode("utf-8"), payload_segment.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{payload_segment}.{_b64url_encode(signature)}"


def at_hash_from_access_token(access_token: str) -> str:
    digest = hashlib.sha256(access_token.encode("ascii")).digest()
    return _b64url_encode(digest)[:22]
