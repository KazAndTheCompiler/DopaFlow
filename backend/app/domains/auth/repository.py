"""Persistence layer for the auth domain: users, clients, codes, tokens, providers, states."""

from __future__ import annotations

from app.core.base_repository import BaseRepository
from app.core.config import Settings


class AuthRepository(BaseRepository):
    """Data-access methods for all auth-related tables.

    Subclasses BaseRepository for consistent connection management.
    Use self.get_db_readonly() for reads, self.tx() for writes.
    """

    # ── auth_users ──────────────────────────────────────────────

    def get_by_email(self, email: str) -> dict | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT id, email, hashed_password, role FROM auth_users WHERE email = ? AND active = 1",
                (email,),
            ).fetchone()
        return dict(row) if row else None

    def get_by_id(self, user_id: str) -> dict | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT id, email, role FROM auth_users WHERE id = ? AND active = 1",
                (user_id,),
            ).fetchone()
        return dict(row) if row else None

    def get_by_oidc_identity(self, issuer: str, subject: str) -> dict | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT id, email, role FROM auth_users WHERE oidc_issuer = ? AND oidc_subject = ? AND active = 1",
                (issuer, subject),
            ).fetchone()
        return dict(row) if row else None

    def get_email_and_role_by_id(self, user_id: str) -> dict | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT email, role FROM auth_users WHERE id = ? AND active = 1",
                (user_id,),
            ).fetchone()
        return dict(row) if row else None

    def get_credentials_by_email(self, email: str) -> dict | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT id, email, hashed_password, role FROM auth_users WHERE email = ? AND active = 1",
                (email,),
            ).fetchone()
        return dict(row) if row else None

    def list_active(self) -> list[dict]:
        with self.get_db_readonly() as conn:
            rows = conn.execute(
                "SELECT id, email, role, created_at FROM auth_users WHERE active = 1 ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def create_user(self, user_id: str, email: str, hashed_password: bytes, role: str, now: str) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO auth_users (id, email, hashed_password, role, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                """,
                (user_id, email, hashed_password, role, now, now),
            )

    def create_user_with_oidc(
        self, user_id: str, email: str, hashed_password: bytes, role: str,
        issuer: str, subject: str, now: str,
    ) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO auth_users
                    (id, email, hashed_password, role, active, oidc_issuer, oidc_subject, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
                """,
                (user_id, email, hashed_password, role, issuer, subject, now, now),
            )

    def update_email(self, user_id: str, email: str, now: str) -> None:
        with self.tx() as conn:
            conn.execute(
                "UPDATE auth_users SET email = ?, updated_at = ? WHERE id = ?",
                (email, now, user_id),
            )

    def link_oidc_identity(self, user_id: str, issuer: str, subject: str, now: str) -> None:
        with self.tx() as conn:
            conn.execute(
                "UPDATE auth_users SET oidc_issuer = ?, oidc_subject = ?, updated_at = ? WHERE id = ?",
                (issuer, subject, now, user_id),
            )

    # ── auth_clients ──────────────────────────────────────────────

    def get_by_client_id(self, client_id: str) -> dict | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM auth_clients WHERE client_id = ? AND active = 1",
                (client_id,),
            ).fetchone()
        return dict(row) if row else None

    def list_all_clients(self) -> list[dict]:
        with self.get_db_readonly() as conn:
            rows = conn.execute(
                "SELECT id, client_id, client_name, redirect_uri, scope, pkce_required, active, created_at FROM auth_clients ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def create_client(
        self, id: str, client_id: str, client_secret_hash: str, client_name: str,
        redirect_uri: str, scope: str, pkce_required: bool, now: str,
    ) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO auth_clients (id, client_id, client_secret_hash, client_name, redirect_uri, scope, pkce_required, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    id,
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

    # ── auth_oidc_codes ──────────────────────────────────────────

    def insert_code(
        self, code_hash: str, verifier_hash: str, client_id: str, redirect_uri: str,
        scope: str, user_id: str, email: str, expires_at: str, state: str,
    ) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO auth_oidc_codes
                    (code_hash, verifier_hash, client_id, redirect_uri, scope, user_id, email, expires_at, used_at, state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                """,
                (code_hash, verifier_hash, client_id, redirect_uri, scope, user_id, email, expires_at, state),
            )

    def get_unused_code(self, code_hash: str) -> dict | None:
        """Look up an unused code. Read-only — caller must call mark_code_used separately."""
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM auth_oidc_codes WHERE code_hash = ? AND used_at IS NULL",
                (code_hash,),
            ).fetchone()
        return dict(row) if row else None

    def consume_code(self, code_hash: str, now: str) -> dict | None:
        """Atomically look up an unused code and mark it used. Returns the code row or None."""
        with self.tx() as conn:
            row = conn.execute(
                "SELECT * FROM auth_oidc_codes WHERE code_hash = ? AND used_at IS NULL",
                (code_hash,),
            ).fetchone()
            if not row:
                return None
            conn.execute(
                "UPDATE auth_oidc_codes SET used_at = ? WHERE code_hash = ?",
                (now, code_hash),
            )
        return dict(row)

    def mark_code_used(self, code_hash: str, now: str) -> None:
        with self.tx() as conn:
            conn.execute(
                "UPDATE auth_oidc_codes SET used_at = ? WHERE code_hash = ?",
                (now, code_hash),
            )

    # ── auth_refresh_tokens ──────────────────────────────────────

    def insert_token(
        self, token_hash: str, user_id: str, email: str, scope: str,
        expires_at: str, now: str,
    ) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO auth_refresh_tokens
                    (token_hash, user_id, email, scope, expires_at, created_at, revoked_at, replaced_by_hash)
                VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
                """,
                (token_hash, user_id, email, scope, expires_at, now),
            )

    def get_active_by_hash(self, token_hash: str) -> dict | None:
        """Read-only lookup of an active (non-revoked) refresh token."""
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM auth_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL",
                (token_hash,),
            ).fetchone()
        return dict(row) if row else None

    def consume_refresh_token(self, token_hash: str, now: str, replacement_hash: str) -> dict | None:
        """Atomically look up an active refresh token, revoke it, and set replacement hash.

        Returns the token row or None if not found / already revoked.
        """
        with self.tx() as conn:
            row = conn.execute(
                "SELECT * FROM auth_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL",
                (token_hash,),
            ).fetchone()
            if not row:
                return None
            conn.execute(
                "UPDATE auth_refresh_tokens SET revoked_at = ?, replaced_by_hash = ? WHERE token_hash = ?",
                (now, replacement_hash, token_hash),
            )
        return dict(row)

    def revoke_and_rotate(self, token_hash: str, now: str, replacement_hash: str) -> None:
        with self.tx() as conn:
            conn.execute(
                "UPDATE auth_refresh_tokens SET revoked_at = ?, replaced_by_hash = ? WHERE token_hash = ?",
                (now, replacement_hash, token_hash),
            )

    def revoke_by_hash(self, token_hash: str, now: str) -> None:
        with self.tx() as conn:
            conn.execute(
                "UPDATE auth_refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
                (now, token_hash),
            )

    # ── auth_scope_tokens ────────────────────────────────────────

    def revoke_scope_token(self, token_id: str, now: str) -> None:
        with self.tx() as conn:
            conn.execute(
                "UPDATE auth_scope_tokens SET revoked_at = ? WHERE id = ?",
                (now, token_id),
            )

    # ── auth_oidc_providers ──────────────────────────────────────

    def list_enabled_providers(self) -> list[dict]:
        with self.get_db_readonly() as conn:
            rows = conn.execute(
                "SELECT name, issuer_url, scopes, default_role FROM auth_oidc_providers WHERE enabled = 1"
            ).fetchall()
        return [dict(r) for r in rows]

    def get_enabled_by_name(self, name: str) -> dict | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT * FROM auth_oidc_providers WHERE name = ? AND enabled = 1",
                (name,),
            ).fetchone()
        return dict(row) if row else None

    def get_id_by_issuer_url(self, issuer_url: str) -> str | None:
        with self.get_db_readonly() as conn:
            row = conn.execute(
                "SELECT id FROM auth_oidc_providers WHERE issuer_url = ?",
                (issuer_url,),
            ).fetchone()
        return row["id"] if row else None

    def upsert_provider(
        self, id: str, name: str, issuer_url: str, client_id: str,
        client_secret: str, scopes: str, default_role: str, now: str,
    ) -> None:
        with self.tx() as conn:
            existing = conn.execute(
                "SELECT id FROM auth_oidc_providers WHERE issuer_url = ?",
                (issuer_url,),
            ).fetchone()
            if existing:
                conn.execute(
                    """UPDATE auth_oidc_providers
                       SET client_id = ?, client_secret = ?, scopes = ?,
                           default_role = ?, name = ?, updated_at = ?
                       WHERE issuer_url = ?""",
                    (
                        client_id,
                        client_secret,
                        scopes,
                        default_role,
                        name,
                        now,
                        issuer_url,
                    ),
                )
            else:
                conn.execute(
                    """INSERT INTO auth_oidc_providers
                       (id, name, issuer_url, client_id, client_secret, scopes, enabled, default_role, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
                    (
                        id,
                        name,
                        issuer_url,
                        client_id,
                        client_secret,
                        scopes,
                        default_role,
                        now,
                        now,
                    ),
                )

    # ── auth_oidc_states ─────────────────────────────────────────

    def insert_state(
        self, state_hash: str, provider_name: str, code_verifier: str,
        redirect_uri: str, scope: str, client_id: str, original_state: str,
        code_challenge: str, now: str, expires_at: str,
    ) -> None:
        with self.tx() as conn:
            conn.execute(
                """
                INSERT INTO auth_oidc_states
                    (state_hash, provider_name, code_verifier, redirect_uri,
                     scope, client_id, original_state, code_challenge,
                     created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
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
                ),
            )

    def get_valid_state(self, state_hash: str, now: str) -> dict | None:
        with self.tx() as conn:
            row = conn.execute(
                "SELECT * FROM auth_oidc_states WHERE state_hash = ? AND expires_at > ?",
                (state_hash, now),
            ).fetchone()
            if not row:
                return None
            conn.execute(
                "DELETE FROM auth_oidc_states WHERE state_hash = ?",
                (state_hash,),
            )
        return dict(row)

    def delete_state(self, state_hash: str) -> None:
        with self.tx() as conn:
            conn.execute(
                "DELETE FROM auth_oidc_states WHERE state_hash = ?",
                (state_hash,),
            )