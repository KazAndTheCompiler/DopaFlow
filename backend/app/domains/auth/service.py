"""OIDC auth service: code exchange, token issuance, PKCE, refresh rotation."""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.core.config import Settings
from app.core.database import get_db, tx
from app.domains.auth.oidc import (
    at_hash_from_access_token,
    build_id_token,
)
from app.middleware.auth_scopes import create_scope_token, verify_scope_token

ACCESS_TOKEN_TTL = 900
REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30
AUTH_CODE_TTL = 60
ID_TOKEN_TTL = ACCESS_TOKEN_TTL


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now_utc() -> datetime:
    return datetime.now(UTC)


class AuthService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def authenticate_user(self, email: str, password: str) -> dict[str, Any]:
        with tx(self.settings) as conn:
            row = conn.execute(
                "SELECT id, email, hashed_password, role FROM auth_users WHERE email = ? AND active = 1",
                (email,),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        stored_hash = row["hashed_password"]
        password_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if not secrets.compare_digest(password_hash, stored_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {"id": row["id"], "email": row["email"], "role": row["role"]}

    def create_auth_code(
        self,
        client_id: str,
        redirect_uri: str,
        code_verifier: str,
        scope: str,
        user_id: str,
        email: str,
    ) -> str:
        code = f"ac_{uuid4().hex[:32]}"
        code_hash = _token_hash(code)
        verifier_hash = _token_hash(code_verifier)
        expires_at = datetime.fromtimestamp(
            time.time() + AUTH_CODE_TTL, tz=UTC
        ).isoformat()
        with tx(self.settings) as conn:
            conn.execute(
                """
                INSERT INTO auth_oidc_codes
                    (code_hash, verifier_hash, client_id, redirect_uri, scope, user_id, email, expires_at, used_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (code_hash, verifier_hash, client_id, redirect_uri, scope, user_id, email, expires_at),
            )
        return code

    def exchange_code(
        self,
        code: str,
        code_verifier: str,
        client_id: str,
        redirect_uri: str,
    ) -> dict[str, Any]:
        code_hash = _token_hash(code)
        verifier_hash = _token_hash(code_verifier)
        now = _now_utc().isoformat()
        with tx(self.settings) as conn:
            row = conn.execute(
                "SELECT * FROM auth_oidc_codes WHERE code_hash = ? AND used_at IS NULL",
                (code_hash,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Invalid or expired authorization code")
            if row["verifier_hash"] != verifier_hash:
                raise HTTPException(status_code=400, detail="Invalid code verifier")
            if row["client_id"] != client_id:
                raise HTTPException(status_code=400, detail="client_id mismatch")
            if row["redirect_uri"] != redirect_uri:
                raise HTTPException(status_code=400, detail="redirect_uri mismatch")
            if row["expires_at"] < now:
                raise HTTPException(status_code=400, detail="Authorization code expired")
            conn.execute(
                "UPDATE auth_oidc_codes SET used_at = ? WHERE code_hash = ?",
                (now, code_hash),
            )
            user_id = row["user_id"]
            email = row["email"]
            scope = row["scope"]
            user_row = conn.execute(
                "SELECT role FROM auth_users WHERE id = ? AND active = 1",
                (user_id,),
            ).fetchone()
            role = user_row["role"] if user_row else None
        access_token = create_scope_token(
            scopes=scope.split(),
            subject=user_id,
            ttl_seconds=ACCESS_TOKEN_TTL,
            settings=self.settings,
        )
        refresh_token = self._create_refresh_token(user_id, email, scope)
        at_hash = at_hash_from_access_token(access_token)
        id_token = build_id_token(
            settings=self.settings,
            sub=user_id,
            email=email,
            nonce=None,
            at_hash=at_hash,
            roles=[role] if role else [],
            expiry=ID_TOKEN_TTL,
        )
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "id_token": id_token,
            "expires_in": ACCESS_TOKEN_TTL,
            "scope": scope,
        }

    def _create_refresh_token(
        self, user_id: str, email: str, scope: str
    ) -> str:
        token = f"rt_{uuid4().hex[:48]}"
        token_hash = _token_hash(token)
        expires_at = datetime.fromtimestamp(
            time.time() + REFRESH_TOKEN_TTL, tz=UTC
        ).isoformat()
        now = _now_utc().isoformat()
        with tx(self.settings) as conn:
            conn.execute(
                """
                INSERT INTO auth_refresh_tokens
                    (token_hash, user_id, email, scope, expires_at, created_at, revoked_at, replaced_by_hash)
                VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
                """,
                (token_hash, user_id, email, scope, expires_at, now),
            )
        return token

    def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        token_hash = _token_hash(refresh_token)
        now = _now_utc().isoformat()
        with tx(self.settings) as conn:
            row = conn.execute(
                "SELECT * FROM auth_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL",
                (token_hash,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Invalid refresh token")
            if row["expires_at"] < now:
                raise HTTPException(status_code=401, detail="Refresh token expired")
            user_id = row["user_id"]
            email = row["email"]
            scope = row["scope"]
            conn.execute(
                "UPDATE auth_refresh_tokens SET revoked_at = ?, replaced_by_hash = ? WHERE token_hash = ?",
                (now, "rotated", token_hash),
            )
            user_row = conn.execute(
                "SELECT role FROM auth_users WHERE id = ? AND active = 1",
                (user_id,),
            ).fetchone()
            role = user_row["role"] if user_row else None
        new_access_token = create_scope_token(
            scopes=scope.split(),
            subject=user_id,
            ttl_seconds=ACCESS_TOKEN_TTL,
            settings=self.settings,
        )
        new_refresh_token = self._create_refresh_token(user_id, email, scope)
        at_hash = at_hash_from_access_token(new_access_token)
        id_token = build_id_token(
            settings=self.settings,
            sub=user_id,
            email=email,
            nonce=None,
            at_hash=at_hash,
            roles=[role] if role else [],
            expiry=ID_TOKEN_TTL,
        )
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "id_token": id_token,
            "expires_in": ACCESS_TOKEN_TTL,
            "scope": scope,
        }

    def revoke_token(self, token: str, token_hint: str | None = None) -> bool:
        token_hash = _token_hash(token)
        now = _now_utc().isoformat()
        with tx(self.settings) as conn:
            if token_hint == "refresh_token" or token_hint is None:
                result = conn.execute(
                    "UPDATE auth_refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
                    (now, token_hash),
                )
                if result.rowcount > 0:
                    return True
            if token_hint == "access_token" or token_hint is None:
                try:
                    payload = verify_scope_token(token, settings=self.settings)
                    token_id = payload.get("jti")
                    if token_id:
                        conn.execute(
                            "UPDATE auth_scope_tokens SET revoked_at = ? WHERE id = ?",
                            (now, token_id),
                        )
                        return True
                except Exception:
                    pass
        return True

    def get_userinfo(self, access_token: str) -> dict[str, Any]:
        payload = verify_scope_token(access_token, settings=self.settings)
        user_id = payload["sub"]
        with get_db(self.settings) as conn:
            row = conn.execute(
                "SELECT id, email, role FROM auth_users WHERE id = ? AND active = 1",
                (user_id,),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        return {
            "sub": row["id"],
            "email": row["email"],
            "role": row["role"],
        }


def get_auth_service(settings: Settings) -> AuthService:
    return AuthService(settings)
