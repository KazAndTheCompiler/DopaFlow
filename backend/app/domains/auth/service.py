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
from app.domains.auth.oidc import (
    at_hash_from_access_token,
    build_id_token,
)
from app.domains.auth.repository import AuthRepository
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
    def __init__(self, repo: AuthRepository, settings: Settings) -> None:
        self.repo = repo
        self.settings = settings

    def get_client(self, client_id: str) -> dict[str, Any] | None:
        return self.repo.get_by_client_id(client_id)

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
        row = self.repo.get_credentials_by_email(email)
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
        self.repo.insert_code(
            code_hash,
            verifier_hash,
            client_id,
            redirect_uri,
            scope,
            user_id,
            email,
            expires_at,
            state,
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
        row = self.repo.consume_code(code_hash, now)
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
        user_id = row["user_id"]
        email = row["email"]
        scope = row["scope"]
        user_row = self.repo.get_email_and_role_by_id(user_id)
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
        self.repo.insert_token(token_hash, user_id, email, scope, expires_at, now)
        return token

    def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        token_hash = _token_hash(refresh_token)
        now = _now_utc().isoformat()
        row = self.repo.consume_refresh_token(token_hash, now, "rotated")
        if not row:
            raise HTTPException(status_code=401, detail="invalid_grant")
        if row["expires_at"] < now:
            raise HTTPException(status_code=401, detail="invalid_grant")
        user_id = row["user_id"]
        email = row["email"]
        scope = row["scope"]
        user_row = self.repo.get_email_and_role_by_id(user_id)
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
        user_row = self.repo.get_email_and_role_by_id(user_id)
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
        if token_hint == "refresh_token" or token_hint is None:
            self.repo.revoke_by_hash(token_hash, now)
            # If hint was refresh_token, we're done
            if token_hint == "refresh_token":
                return True
        if token_hint == "access_token" or token_hint is None:
            try:
                payload = verify_scope_token(token, settings=self.settings)
                token_id = payload.get("jti")
                if token_id:
                    self.repo.revoke_scope_token(token_id, now)
                    return True
            except Exception:
                pass
        return True

    def get_userinfo(self, access_token: str) -> dict[str, Any]:
        payload = verify_scope_token(access_token, settings=self.settings)
        user_id = payload["sub"]
        row = self.repo.get_by_id(user_id)
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
            self.repo.create_user(
                user_id, email.lower().strip(), hashed_password, role, now
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
            self.repo.create_client(
                client_db_id,
                client_id,
                client_secret_hash,
                client_name,
                redirect_uri,
                scope,
                pkce_required,
                now,
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
        rows = self.repo.list_all_clients()
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
        row = self.repo.get_by_id(user_id)
        if not row:
            return None
        return {"id": row["id"], "email": row["email"], "role": row["role"]}

    def list_users(self) -> list[dict[str, Any]]:
        rows = self.repo.list_active()
        return [
            {
                "id": row["id"],
                "email": row["email"],
                "role": row["role"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def get_or_create_user_by_oidc(
        self,
        issuer: str,
        subject: str,
        email: str,
        default_role: str = "viewer",
    ) -> dict[str, Any]:
        """Look up or create a local user from an external OIDC identity.

        1. Match by (oidc_issuer, oidc_subject) — return if found
        2. Match by email — link the OIDC identity to the existing user
        3. Auto-provision a new user with a random password
        """
        if default_role not in ROLE_SCOPES:
            default_role = "viewer"
        issuer = issuer.rstrip("/")
        email = email.lower().strip()

        # 1. Match by OIDC identity
        row = self.repo.get_by_oidc_identity(issuer, subject)
        if row:
            # Update email if changed in the external IdP
            if row["email"] != email:
                self.repo.update_email(row["id"], email, _now_utc().isoformat())
            return {"id": row["id"], "email": email, "role": row["role"]}

        # 2. Match by email — link existing user
        row = self.repo.get_by_email(email)
        if row:
            self.repo.link_oidc_identity(
                row["id"], issuer, subject, _now_utc().isoformat()
            )
            return {"id": row["id"], "email": row["email"], "role": row["role"]}

        # 3. Auto-provision — random untypeable password
        import secrets as _secrets

        random_password = _secrets.token_urlsafe(48)
        hashed_password = _hash_password(random_password)
        user_id = f"usr_{uuid4().hex[:16]}"
        now = _now_utc().isoformat()
        try:
            self.repo.create_user_with_oidc(
                user_id,
                email,
                hashed_password,
                default_role,
                issuer,
                subject,
                now,
            )
        except Exception:
            # Race condition: another request created the user first
            row = self.repo.get_by_oidc_identity(issuer, subject)
            if row:
                return {"id": row["id"], "email": row["email"], "role": row["role"]}
            raise
        return {"id": user_id, "email": email, "role": default_role}

    def get_enabled_providers(self) -> list[dict[str, Any]]:
        """Return all enabled OIDC providers (from DB + env vars)."""
        providers: list[dict[str, Any]] = []
        rows = self.repo.list_enabled_providers()
        for row in rows:
            providers.append(
                {
                    "name": row["name"],
                    "issuer_url": row["issuer_url"],
                    "scopes": row["scopes"],
                    "default_role": row["default_role"],
                }
            )

        # Merge env-var-configured provider if present
        if self.settings.oidc_issuer_url:
            env_name = self.settings.oidc_provider_name or "sso"
            if not any(
                p["issuer_url"].rstrip("/") == self.settings.oidc_issuer_url.rstrip("/")
                for p in providers
            ):
                providers.append(
                    {
                        "name": env_name,
                        "issuer_url": self.settings.oidc_issuer_url,
                        "scopes": self.settings.oidc_scopes,
                        "default_role": self.settings.oidc_default_role,
                    }
                )
        return providers

    def register_env_provider(self) -> None:
        """Ensure the env-var-configured provider exists in auth_oidc_providers."""
        if not self.settings.oidc_issuer_url:
            return
        if not self.settings.oidc_client_id or not self.settings.oidc_client_secret:
            return
        issuer = self.settings.oidc_issuer_url.rstrip("/")
        name = self.settings.oidc_provider_name or "sso"
        now = _now_utc().isoformat()
        try:
            self.repo.upsert_provider(
                f"op_{uuid4().hex[:16]}",
                name,
                issuer,
                self.settings.oidc_client_id,
                self.settings.oidc_client_secret,
                self.settings.oidc_scopes,
                self.settings.oidc_default_role,
                now,
            )
        except Exception as exc:
            import logging

            logging.getLogger(__name__).warning(
                "Failed to register env OIDC provider: %s", exc
            )

    def get_provider(self, name: str) -> dict[str, Any] | None:
        """Look up a specific OIDC provider by name (DB + env vars)."""
        row = self.repo.get_enabled_by_name(name)
        if row:
            return row

        # Check env-var provider
        env_name = self.settings.oidc_provider_name or "sso"
        if name == env_name and self.settings.oidc_issuer_url:
            return {
                "name": env_name,
                "issuer_url": self.settings.oidc_issuer_url,
                "client_id": self.settings.oidc_client_id,
                "client_secret": self.settings.oidc_client_secret,
                "scopes": self.settings.oidc_scopes,
                "default_role": self.settings.oidc_default_role,
            }
        return None


def get_auth_service(settings: Settings) -> AuthService:
    repo = AuthRepository(settings)
    return AuthService(repo, settings)
