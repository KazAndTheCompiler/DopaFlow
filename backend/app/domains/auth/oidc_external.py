"""Helpers for the external OIDC login flow (state management, code exchange)."""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import UTC, datetime

from app.core.config import Settings
from app.domains.auth.oidc import generate_code_verifier
from app.domains.auth.repository import AuthRepository

OIDC_STATE_TTL = 600  # 10 minutes


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_oidc_state(
    provider_name: str,
    redirect_uri: str,
    scope: str,
    client_id: str,
    original_state: str,
    code_challenge: str,
    settings: Settings,
) -> tuple[str, str]:
    """Create a state parameter for the external IdP redirect.

    Returns (state, code_verifier) where:
      - state is the opaque value sent to the external IdP
      - code_verifier is the PKCE verifier for the external IdP exchange
    """
    state = secrets.token_urlsafe(32)
    code_verifier = generate_code_verifier()
    state_hash = _token_hash(state)
    now = datetime.now(UTC).isoformat()
    expires_at = datetime.fromtimestamp(
        time.time() + OIDC_STATE_TTL, tz=UTC
    ).isoformat()
    repo = AuthRepository(settings)
    repo.insert_state(
        state_hash,
        provider_name,
        code_verifier,
        redirect_uri,
        scope,
        client_id,
        original_state,
        code_challenge,
        now,
        expires_at,
    )
    return state, code_verifier


def consume_oidc_state(state: str, db_path: str) -> dict | None:
    """Look up and consume an OIDC state. Returns None if not found or expired."""
    state_hash = _token_hash(state)
    now = datetime.now(UTC).isoformat()
    repo = AuthRepository(db_path)
    return repo.get_valid_state(state_hash, now)
