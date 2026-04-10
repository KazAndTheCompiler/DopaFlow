"""SQLite-backed rate limit middleware."""

from __future__ import annotations

import logging
import os
import sqlite3
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

COMMAND_PATHS = {
    "/api/v2/packy/ask",
    "/api/v2/tasks/quick-add",
    "/api/v2/commands/execute",
}
TRUSTED_PROXY_HOSTS = {"127.0.0.1", "localhost", "::1"}
logger = logging.getLogger(__name__)


def _resolve_storage_path(db_path: str | None) -> str:
    if db_path and db_path != ":memory:":
        return f"{db_path}.rate_limit.sqlite"
    return str(Path(tempfile.gettempdir()) / "dopaflow-rate-limit.sqlite")


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        calls_per_minute: int = 60,
        *,
        db_path: str | None = None,
        default_limit_per_minute: int | None = None,
        command_limit_per_minute: int | None = None,
    ) -> None:
        super().__init__(app)
        self.calls_per_minute = (
            calls_per_minute
            if default_limit_per_minute is None
            else default_limit_per_minute
        )
        self.command_limit = command_limit_per_minute
        self.window_seconds = 60
        self.db_path = _resolve_storage_path(db_path)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=1.0)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS _rate_limit_hits (
              key TEXT NOT NULL,
              hit_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_key_time ON _rate_limit_hits(key, hit_at)"
        )
        return conn

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)
        if os.getenv("DOPAFLOW_DISABLE_RATE_LIMITS", "0") == "1":
            return await call_next(request)
        if os.getenv("ZOESTM_DISABLE_RATE_LIMITS", "0") == "1":
            return await call_next(request)

        now = time.time()
        identity = self._get_client_identity(request)
        path = request.url.path
        limit = (
            self.command_limit
            if self.command_limit is not None and path in COMMAND_PATHS
            else self.calls_per_minute
        )
        bucket = f"{request.method}:{path if path in COMMAND_PATHS else 'default'}:{identity}"
        cutoff = now - self.window_seconds

        try:
            conn = self._connect()
            conn.execute(
                "DELETE FROM _rate_limit_hits WHERE key = ? AND hit_at < ?",
                (bucket, cutoff),
            )
            count = conn.execute(
                "SELECT COUNT(*) FROM _rate_limit_hits WHERE key = ?", (bucket,)
            ).fetchone()[0]
            if count >= limit:
                conn.close()
                return JSONResponse(
                    status_code=429,
                    content={"code": "rate_limited", "message": "Too many requests"},
                )
            conn.execute(
                "INSERT INTO _rate_limit_hits(key, hit_at) VALUES(?, ?)", (bucket, now)
            )
            conn.commit()
            conn.close()
        except (sqlite3.Error, OSError) as exc:
            logger.warning(
                "Rate limit storage unavailable for %s: %s", request.url.path, exc
            )
            return JSONResponse(
                status_code=503,
                content={
                    "code": "rate_limit_unavailable",
                    "message": "Rate limit backend unavailable",
                },
            )

        return await call_next(request)

    @staticmethod
    def _get_client_identity(request: Request) -> str:
        """Extract client IP from headers or connection."""
        client = getattr(request, "client", None)
        client_host = client.host if client and client.host else ""

        if client_host in TRUSTED_PROXY_HOSTS:
            forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            if forwarded:
                return forwarded
            real_ip = request.headers.get("x-real-ip", "").strip()
            if real_ip:
                return real_ip

        origin = request.headers.get("origin", "").strip()
        if origin:
            try:
                parsed = urlparse(origin)
                if parsed.hostname:
                    return parsed.hostname
            except Exception:
                pass
        if client_host:
            return client_host
        return request.headers.get("host", "unknown")
