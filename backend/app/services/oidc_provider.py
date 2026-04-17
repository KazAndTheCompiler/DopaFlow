"""External OIDC provider client: discovery, JWKS, ID token validation."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import jwt

logger = logging.getLogger(__name__)

_discovery_cache: dict[str, tuple[dict[str, Any], float]] = {}
_jwks_cache: dict[str, tuple[dict[str, Any], float]] = {}

CACHE_TTL = 3600  # 1 hour


async def fetch_discovery(issuer_url: str) -> dict[str, Any]:
    """Fetch and cache the OIDC discovery document."""
    now = time.time()
    cached = _discovery_cache.get(issuer_url)
    if cached and (now - cached[1]) < CACHE_TTL:
        return cached[0]
    url = issuer_url.rstrip("/") + "/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        doc = resp.json()
    if doc.get("issuer", "").rstrip("/") != issuer_url.rstrip("/"):
        raise ValueError(
            f"Issuer mismatch: expected {issuer_url}, got {doc.get('issuer')}"
        )
    _discovery_cache[issuer_url] = (doc, now)
    return doc


async def fetch_jwks(jwks_uri: str) -> dict[str, Any]:
    """Fetch and cache the JWKS keys."""
    now = time.time()
    cached = _jwks_cache.get(jwks_uri)
    if cached and (now - cached[1]) < CACHE_TTL:
        return cached[0]
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(jwks_uri)
        resp.raise_for_status()
        keys = resp.json()
    _jwks_cache[jwks_uri] = (keys, now)
    return keys


def validate_id_token(
    id_token: str,
    issuer: str,
    client_id: str,
    jwks: dict[str, Any],
    *,
    nonce: str | None = None,
) -> dict[str, Any]:
    """Validate an external ID token using JWKS (RS256). Returns claims."""
    from jwt import PyJWK

    keys = jwks.get("keys", [])
    # Extract the kid from the token header to find the matching key
    unverified_header = jwt.get_unverified_header(id_token)
    kid = unverified_header.get("kid")

    matching_key = None
    for key_data in keys:
        if kid and key_data.get("kid") == kid:
            matching_key = PyJWK(key_data)
            break
    if matching_key is None and keys:
        matching_key = PyJWK(keys[0])
    if matching_key is None:
        raise ValueError("No matching key found in JWKS")

    try:
        decoded = jwt.decode(
            id_token,
            key=matching_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=issuer.rstrip("/"),
            leeway=30,
        )
    except jwt.PyJWTError as exc:
        raise ValueError(f"ID token validation failed: {exc}") from exc
    if nonce and decoded.get("nonce") != nonce:
        raise ValueError("Nonce mismatch in ID token")
    return decoded


def clear_cache() -> None:
    """Clear the in-memory discovery and JWKS caches."""
    _discovery_cache.clear()
    _jwks_cache.clear()
