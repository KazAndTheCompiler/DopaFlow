"""
Auth scopes middleware provides fine-grained permission control.

To protect an endpoint with a scope requirement, use Depends():

  from app.middleware.auth_scopes import require_scope
  from fastapi import Depends

  @router.get("/tasks", dependencies=[Depends(require_scope("read:tasks"))])
  async def list_tasks():
    return tasks_repo.list_tasks()

  @router.post("/tasks", dependencies=[Depends(require_scope("write:tasks"))])
  async def create_task(payload: TaskIn):
    return tasks_repo.create_task(payload)

Available scopes are defined in SCOPES dict in auth_scopes.py.

Dev mode: Set DOPAFLOW_DEV_AUTH=1 to bypass all scope checks (testing only).
Local trust: Set DOPAFLOW_TRUST_LOCAL_CLIENTS=1 to trust localhost browser origins from a loopback client.
Legacy ZOESTM_* env vars are still accepted as fallback for older installs.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import Header, HTTPException, Request

from app.core.config import Settings, get_settings
from app.core.database import get_db, tx
from app.middleware.auth import TRUSTED_HOSTS

SCOPES = {
    "read:tasks": "Read tasks",
    "write:tasks": "Create/modify tasks",
    "read:projects": "Read projects",
    "write:projects": "Create/modify projects",
    "read:search": "Search across domains",
    "read:habits": "Read habits",
    "write:habits": "Create/modify habits",
    "read:journal": "Read journal entries",
    "write:journal": "Create/modify journal entries",
    "read:focus": "Read focus sessions",
    "write:focus": "Start/modify focus sessions",
    "read:digest": "Read generated daily and weekly digests",
    "read:motivation": "Read motivation content",
    "write:motivation": "Trigger motivation actions",
    "read:packy": "Read Packy status and suggestions",
    "write:packy": "Send Packy prompts and lorebook updates",
    "read:player": "Read player queue and predownload status",
    "write:player": "Control player queue and predownload actions",
    "read:review": "Read review cards",
    "write:review": "Create/modify review cards",
    "read:calendar": "Read calendar events",
    "write:calendar": "Create/modify calendar events",
    "share:calendar": "Expose calendar feed to a trusted peer",
    "read:insights": "Read generated insights and digests",
    "read:integrations": "Read integration status and metrics",
    "write:integrations": "Run integration imports and dispatches",
    "read:alarms": "Read alarms",
    "write:alarms": "Create/modify alarms",
    "read:notifications": "Read notifications",
    "write:notifications": "Create/modify notifications",
    "read:nutrition": "Read nutrition logs",
    "write:nutrition": "Log nutrition entries",
    "read:commands": "Read command history",
    "write:commands": "Execute commands",
    "read:ops": "Read ops diagnostics",
    "write:ops": "Write ops operations (backup, restore)",
    "admin:ops": "Full ops access (export, import, reconcile)",
}
_SCOPE_ACTIONS = frozenset({"read", "write", "share", "admin"})


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _scope_secret(settings: Settings | None = None) -> str:
    resolved = settings or get_settings()
    secret = resolved.auth_token_secret or resolved.api_key
    if not secret:
        raise RuntimeError(
            "Scoped bearer tokens require DOPAFLOW_AUTH_TOKEN_SECRET or DOPAFLOW_API_KEY"
        )
    return secret


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _normalize_scope(scope: str) -> str:
    if scope in SCOPES:
        return scope
    resource, separator, action = scope.partition(":")
    if not separator or action not in _SCOPE_ACTIONS:
        return scope
    normalized = f"{action}:{resource}"
    if normalized in SCOPES:
        return normalized
    return scope


def _normalize_scopes(scopes: list[str]) -> list[str]:
    return sorted({_normalize_scope(scope) for scope in scopes})


def _row_to_scope_token(row: object) -> dict[str, object]:
    return {
        "id": row["id"],  # type: ignore[index]
        "subject": row["subject"],  # type: ignore[index]
        "scopes": json.loads(row["scopes_json"]),  # type: ignore[index]
        "issued_at": row["issued_at"],  # type: ignore[index]
        "expires_at": row["expires_at"],  # type: ignore[index]
        "revoked_at": row["revoked_at"],  # type: ignore[index]
        "last_used_at": row["last_used_at"],  # type: ignore[index]
    }


def create_scope_token(
    scopes: list[str],
    *,
    subject: str = "ops-issued",
    ttl_seconds: int = 3600,
    settings: Settings | None = None,
    persist: bool = True,
) -> str:
    resolved = settings or get_settings()
    now = _now_utc()
    issued_at = int(now.timestamp())
    token_id = f"aut_{uuid4().hex[:16]}"
    payload = {
        "iss": resolved.auth_token_issuer,
        "jti": token_id,
        "sub": subject,
        "scopes": _normalize_scopes(scopes),
        "iat": issued_at,
        "exp": issued_at + ttl_seconds,
    }
    payload_segment = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = hmac.new(
        _scope_secret(resolved).encode("utf-8"),
        payload_segment.encode("ascii"),
        hashlib.sha256,
    ).digest()
    token = f"dfv1.{payload_segment}.{_b64url_encode(signature)}"
    if persist:
        with tx(resolved) as conn:
            conn.execute(
                """
                INSERT INTO auth_scope_tokens (id, subject, scopes_json, token_hash, issued_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    token_id,
                    subject,
                    json.dumps(_normalize_scopes(scopes)),
                    _token_hash(token),
                    now.isoformat(),
                    datetime.fromtimestamp(issued_at + ttl_seconds, tz=UTC).isoformat(),
                ),
            )
    return token


def list_scope_tokens(settings: Settings | None = None) -> list[dict[str, object]]:
    resolved = settings or get_settings()
    with get_db(resolved) as conn:
        rows = conn.execute(
            "SELECT * FROM auth_scope_tokens ORDER BY issued_at DESC"
        ).fetchall()
    return [_row_to_scope_token(row) for row in rows]


def revoke_scope_token(token_id: str, settings: Settings | None = None) -> bool:
    resolved = settings or get_settings()
    revoked_at = _now_utc().isoformat()
    with tx(resolved) as conn:
        result = conn.execute(
            "UPDATE auth_scope_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
            (revoked_at, token_id),
        )
    return result.rowcount > 0


def verify_scope_token(
    token: str, settings: Settings | None = None
) -> dict[str, object]:
    resolved = settings or get_settings()
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "dfv1":
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "Malformed bearer token"},
        )
    _, payload_segment, signature_segment = parts
    expected = hmac.new(
        _scope_secret(resolved).encode("utf-8"),
        payload_segment.encode("ascii"),
        hashlib.sha256,
    ).digest()
    try:
        given = _b64url_decode(signature_segment)
        payload = json.loads(_b64url_decode(payload_segment))
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "Unreadable bearer token"},
        ) from exc
    if not hmac.compare_digest(given, expected):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "invalid_token",
                "message": "Bearer token signature mismatch",
            },
        )
    if payload.get("iss") != resolved.auth_token_issuer:
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "Bearer token issuer mismatch"},
        )
    token_id = payload.get("jti")
    if not isinstance(token_id, str) or not token_id:
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "Bearer token id is missing"},
        )
    expires_at = payload.get("exp")
    if not isinstance(expires_at, int) or expires_at <= int(time.time()):
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "Bearer token expired"},
        )
    scopes = payload.get("scopes")
    if not isinstance(scopes, list) or not all(
        isinstance(item, str) for item in scopes
    ):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "invalid_token",
                "message": "Bearer token scopes are invalid",
            },
        )
    payload["scopes"] = _normalize_scopes(scopes)
    with tx(resolved) as conn:
        row = conn.execute(
            "SELECT * FROM auth_scope_tokens WHERE id = ?",
            (token_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=401,
                detail={"code": "invalid_token", "message": "Bearer token is unknown"},
            )
        if row["revoked_at"]:  # type: ignore[index]
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "invalid_token",
                    "message": "Bearer token has been revoked",
                },
            )
        if row["token_hash"] != _token_hash(token):  # type: ignore[index]
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "invalid_token",
                    "message": "Bearer token does not match registry",
                },
            )
        conn.execute(
            "UPDATE auth_scope_tokens SET last_used_at = ? WHERE id = ?",
            (_now_utc().isoformat(), token_id),
        )
    return payload


def require_scope(scope: str):
    """
    Dependency function: checks if request has the required scope.

    Authorization header format:
      Authorization: Bearer <token>

    Scopes are validated from a signed bearer token.
    Dev bypass: DOPAFLOW_DEV_AUTH=1
    Local trust: DOPAFLOW_TRUST_LOCAL_CLIENTS=1 (only loopback clients with localhost origins are auto-trusted)
    """

    def env_flag(name: str) -> bool:
        primary = f"DOPAFLOW_{name}"
        legacy = f"ZOESTM_{name}"
        value = os.getenv(primary)
        if value is None:
            value = os.getenv(legacy, "0")
        return value.lower() in {"1", "true", "yes"}

    async def dep(
        request: Request, authorization: str | None = Header(default=None)
    ) -> bool:
        if env_flag("DEV_AUTH"):
            return True
        origin = request.headers.get("origin", "")
        client_host = request.client.host if request.client else ""
        if env_flag("TRUST_LOCAL_CLIENTS"):
            if client_host in TRUSTED_HOSTS and (
                origin.startswith("http://127.0.0.1:")
                or origin.startswith("http://localhost:")
            ):
                return True
        if not authorization:
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "missing_token",
                    "message": "Missing Authorization header",
                },
            )
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise HTTPException(
                status_code=401,
                detail={"code": "invalid_token", "message": "Expected Bearer token"},
            )
        payload = verify_scope_token(token.strip())
        given_scopes = set(payload["scopes"])
        if scope not in given_scopes:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "insufficient_scopes",
                    "message": f"This endpoint requires scope: {scope}",
                    "required": scope,
                    "given": sorted(given_scopes),
                },
            )
        return True

    return dep
