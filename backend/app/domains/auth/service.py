"""OIDC auth service: code exchange, token issuance, PKCE, refresh rotation, introspection."""

from __future__ import annotations

import hashlib
import time
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import bcrypt
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
AUTH_CODE_TTL = 600
ID_TOKEN_TTL = ACCESS_TOKEN_TTL


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))


def _verify_password(password: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed)


ROLE_SCOPES: dict[str, list[str]] = {
    "admin": [
        "openid",
        "profile",
        "email",
        "read:tasks",
        "write:tasks",
        "read:projects",
        "write:projects",
        "read:habits",
        "write:habits",
        "read:journal",
        "write:journal",
        "read:focus",
        "write:focus",
        "read:calendar",
        "write:calendar",
        "read:insights",
        "write:integrations",
        "read:integrations",
        "read:alarms",
        "write:alarms",
        "read:notifications",
        "write:notifications",
        "read:nutrition",
        "write:nutrition",
        "read:commands",
        "write:commands",
        "admin:ops",
    ],
    "editor": [
        "openid",
        "profile",
        "email",
        "read:tasks",
        "write:tasks",
        "read:projects",
        "write:projects",
        "read:habits",
        "write:habits",
        "read:journal",
        "write:journal",
        "read:focus",
        "write:focus",
        "read:calendar",
        "write:calendar",
        "read:insights",
        "read:integrations",
        "read:alarms",
        "write:alarms",
        "read:notifications",
        "write:notifications",
        "read:nutrition",
        "write:nutrition",
        "read:commands",
        "write:commands",
    ],
    "viewer": [
        "openid",
        "profile",
        "email",
        "read:tasks",
        "read:projects",
        "read:habits",
        "read:journal",
        "read:focus",
        "read:calendar",
        "read:insights",
        "read:integrations",
        "read:alarms",
        "read:notifications",
        "read:nutrition",
        "read:commands",
    ],
}


class AuthService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def get_client(self, client_id: str) -> dict[str, Any] | None:
        with get_db(self.settings) as conn:
            row = conn.execute(
                "SELECT * FROM auth_clients WHERE client_id = ? AND active = 1",
                (client_id,),
            ).fetchone()
        if not row:
            return None
        return dict(row)

    def validate_client_redirect(
        self, client_id: str, redirect_uri: str
    ) -> dict[str, Any]:
        client = self.get_client(client_id)
        if not client:
            raise HTTPException(status_code=401, detail="invalid_client")
        if client["redirect_uri"] != redirect_uri:
            raise HTTPException(status_code=400, detail="invalid_client")
        return client

    def authenticate_user(self, email: str, password: str) -> dict[str, Any]:
        with tx(self.settings) as conn:
            row = conn.execute(
                "SELECT id, email, hashed_password, role FROM auth_users WHERE email = ? AND active = 1",
                (email,),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        try:
            if not _verify_password(password, row["hashed_password"]):
                raise HTTPException(status_code=401, detail="Invalid credentials")
        except (ValueError, TypeError):
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
        state: str,
    ) -> str:
        self.validate_client_redirect(client_id, redirect_uri)
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
                    (code_hash, verifier_hash, client_id, redirect_uri, scope, user_id, email, expires_at, used_at, state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                """,
                (
                    code_hash,
                    verifier_hash,
                    client_id,
                    redirect_uri,
                    scope,
                    user_id,
                    email,
                    expires_at,
                    state,
                ),
            )
        return code

    def exchange_code(
        self,
        code: str,
        code_verifier: str,
        client_id: str,
        redirect_uri: str,
        state: str | None = None,
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
                raise HTTPException(status_code=400, detail="invalid_grant")
            if row["verifier_hash"] != verifier_hash:
                raise HTTPException(status_code=400, detail="invalid_grant")
            if row["client_id"] != client_id:
                raise HTTPException(status_code=400, detail="invalid_grant")
            if row["redirect_uri"] != redirect_uri:
                raise HTTPException(status_code=400, detail="invalid_grant")
            if row["expires_at"] < now:
                raise HTTPException(status_code=400, detail="invalid_grant")
            stored_state = row["state"]
            if stored_state is not None and state is not None and stored_state != state:
                raise HTTPException(status_code=400, detail="invalid_grant")
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

    def _create_refresh_token(self, user_id: str, email: str, scope: str) -> str:
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
                raise HTTPException(status_code=401, detail="invalid_grant")
            if row["expires_at"] < now:
                raise HTTPException(status_code=401, detail="invalid_grant")
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

    def introspect_token(self, token: str) -> dict[str, Any]:
        try:
            payload = verify_scope_token(token, settings=self.settings)
        except Exception:
            return {"active": False}
        now = int(time.time())
        exp = payload.get("exp", 0)
        if exp <= now:
            return {"active": False}
        user_id = payload["sub"]
        scopes = payload.get("scopes", [])
        with get_db(self.settings) as conn:
            user_row = conn.execute(
                "SELECT email, role FROM auth_users WHERE id = ? AND active = 1",
                (user_id,),
            ).fetchone()
        if not user_row:
            return {"active": False}
        return {
            "active": True,
            "sub": user_id,
            "email": user_row["email"],
            "role": user_row["role"],
            "scope": " ".join(scopes),
            "client_id": payload.get("iss"),
            "exp": exp,
            "iat": payload.get("iat"),
            "token_type": "Bearer",
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
            raise HTTPException(status_code=401, detail="invalid_token")
        return {
            "sub": row["id"],
            "email": row["email"],
            "role": row["role"],
        }

    def create_user(
        self,
        email: str,
        password: str,
        role: str = "viewer",
    ) -> dict[str, Any]:
        if role not in ROLE_SCOPES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid role. Must be one of: {', '.join(sorted(ROLE_SCOPES))}",
            )
        if len(password) < 8:
            raise HTTPException(
                status_code=422,
                detail="Password must be at least 8 characters",
            )
        hashed_password = _hash_password(password)
        user_id = f"usr_{uuid4().hex[:16]}"
        now = _now_utc().isoformat()
        try:
            with tx(self.settings) as conn:
                conn.execute(
                    """
                    INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 1, ?, ?)
                    """,
                    (user_id, email.lower().strip(), hashed_password, role, now, now),
                )
        except Exception as exc:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            ) from exc
        return {"id": user_id, "email": email.lower().strip(), "role": role}

    def create_client(
        self,
        client_id: str,
        client_name: str,
        redirect_uri: str,
        scope: str = "openid profile email",
        pkce_required: bool = True,
    ) -> dict[str, Any]:
        client_secret = f"cs_{uuid4().hex[:48]}"
        client_secret_hash = _token_hash(client_secret)
        client_db_id = f"ocl_{uuid4().hex[:16]}"
        now = _now_utc().isoformat()
        try:
            with tx(self.settings) as conn:
                conn.execute(
                    """
                    INSERT INTO auth_clients (id, client_id, client_secret_hash, client_name, redirect_uri, scope, pkce_required, active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                    """,
                    (
                        client_db_id,
                        client_id,
                        client_secret_hash,
                        client_name,
                        redirect_uri,
                        scope,
                        1 if pkce_required else 0,
                        now,
                        now,
                    ),
                )
        except Exception as exc:
            raise HTTPException(
                status_code=409, detail="Client ID already registered"
            ) from exc
        return {
            "client_id": client_id,
            "client_secret": client_secret,
            "client_name": client_name,
            "redirect_uri": redirect_uri,
            "scope": scope,
            "pkce_required": pkce_required,
        }

    def list_clients(self) -> list[dict[str, Any]]:
        with get_db(self.settings) as conn:
            rows = conn.execute(
                "SELECT id, client_id, client_name, redirect_uri, scope, pkce_required, active, created_at FROM auth_clients ORDER BY created_at DESC"
            ).fetchall()
        return [
            {
                "id": row["id"],
                "client_id": row["client_id"],
                "client_name": row["client_name"],
                "redirect_uri": row["redirect_uri"],
                "scope": row["scope"],
                "pkce_required": bool(row["pkce_required"]),
                "active": bool(row["active"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        with get_db(self.settings) as conn:
            row = conn.execute(
                "SELECT id, email, role FROM auth_users WHERE id = ? AND active = 1",
                (user_id,),
            ).fetchone()
        if not row:
            return None
        return {"id": row["id"], "email": row["email"], "role": row["role"]}

    def list_users(self) -> list[dict[str, Any]]:
        with get_db(self.settings) as conn:
            rows = conn.execute(
                "SELECT id, email, role, created_at FROM auth_users WHERE active = 1 ORDER BY created_at DESC"
            ).fetchall()
        return [
            {
                "id": row["id"],
                "email": row["email"],
                "role": row["role"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]


def get_auth_service(settings: Settings) -> AuthService:
    return AuthService(settings)
